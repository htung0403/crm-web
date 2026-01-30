import { Router, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { AuthenticatedRequest, authenticate } from '../middleware/auth.js';

const router = Router();

// Generate task code
const generateTaskCode = async (): Promise<string> => {
    const today = new Date();
    const prefix = `CV${today.getFullYear().toString().slice(-2)}${(today.getMonth() + 1).toString().padStart(2, '0')}`;

    const { data } = await supabase
        .from('technician_tasks')
        .select('task_code')
        .like('task_code', `${prefix}%`)
        .order('task_code', { ascending: false })
        .limit(1);

    let nextNumber = 1;
    if (data && data.length > 0) {
        const lastCode = data[0].task_code;
        const lastNumber = parseInt(lastCode.slice(-4));
        nextNumber = lastNumber + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

// Get all tasks (with filters)
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { status, technician_id, date_from, date_to, priority } = req.query;

        let query = supabase
            .from('technician_tasks')
            .select(`
                *,
                order:orders(order_code, customer:customers(name, phone, address)),
                service:services(name, price, duration),
                technician:users!technician_tasks_technician_id_fkey(name, phone, avatar, department, department_id),
                customer:customers(name, phone, address)
            `)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        if (technician_id) {
            query = query.eq('technician_id', technician_id);
        }

        if (date_from) {
            query = query.gte('scheduled_date', date_from);
        }

        if (date_to) {
            query = query.lte('scheduled_date', date_to);
        }

        if (priority) {
            query = query.eq('priority', priority);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Get tasks for current technician
router.get('/my-tasks', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { status, date } = req.query;

        if (!userId) {
            return res.json([]);
        }

        let tasks: any[] = [];

        try {
            let query = supabase
                .from('technician_tasks')
                .select(`
                    *,
                    order:orders(order_code, customer:customers(name, phone, address)),
                    service:services(name, price, duration),
                    customer:customers(name, phone, address)
                `)
                .eq('technician_id', userId)
                .order('scheduled_date', { ascending: true })
                .order('scheduled_time', { ascending: true });

            if (status && status !== 'all') {
                query = query.eq('status', status);
            }

            if (date) {
                query = query.eq('scheduled_date', date);
            }

            const { data, error } = await query;
            if (!error && data) {
                tasks = data;
            }
        } catch (e) {
            console.log('technician_tasks table not available');
        }

        // Also get order_items assigned to this technician (V1)
        const { data: orderItems, error: itemsError } = await supabase
            .from('order_items')
            .select(`
                *,
                order:orders(id, order_code, status, customer:customers(*)),
                service:services(*)
            `)
            .eq('technician_id', userId)
            .not('item_code', 'is', null);

        // Get order_product_services assigned to this technician (V2) - check both old column and new junction table
        const { data: v2Services, error: v2Error } = await supabaseAdmin
            .from('order_product_services')
            .select(`
                *,
                order_products(
                    id, 
                    product_code,
                    orders(id, order_code, status, customer:customers(*))
                )
            `)
            .eq('technician_id', userId);

        // Also get V2 services from junction table (new multi-technician assignments)
        const { data: v2JunctionServices } = await supabaseAdmin
            .from('order_product_service_technicians')
            .select(`
                *,
                order_product_services(
                    *,
                    order_products(
                        id, 
                        product_code,
                        orders(id, order_code, status, customer:customers(*))
                    )
                )
            `)
            .eq('technician_id', userId);

        // Combine V2 services (avoid duplicates)
        const v2ServiceIds = new Set((v2Services || []).map(s => s.id));
        const additionalV2Services = (v2JunctionServices || [])
            .filter(j => j.order_product_services && !v2ServiceIds.has(j.order_product_services.id))
            .map(j => ({
                ...j.order_product_services,
                junction_status: j.status, // Use junction status if needed
                junction_commission: j.commission
            }));
        const allV2Services = [...(v2Services || []), ...additionalV2Services];

        // Get workflow steps assigned to this technician
        const { data: workflowSteps, error: stepsError } = await supabaseAdmin
            .from('order_item_steps')
            .select(`
                *,
                order_product_services(
                    item_name,
                    order_products(
                        id,
                        product_code,
                        orders(id, order_code, status, customer:customers(*))
                    )
                ),
                order_items(
                    item_name,
                    orders(id, order_code, status, customer:customers(*))
                )
            `)
            .eq('technician_id', userId);

        if (itemsError) {
            console.error('Error fetching order items:', itemsError);
        }

        const taskItemCodes = new Set(tasks.map(t => t.item_code).filter(Boolean));
        const allTasks = [...tasks];

        // Process V1 Items
        if (orderItems) {
            const v1Items = orderItems
                .filter(item => item.item_code && !taskItemCodes.has(item.item_code))
                .map(item => {
                    let taskStatus = 'assigned';
                    if (item.status === 'in_progress') taskStatus = 'in_progress';
                    else if (item.status === 'completed') taskStatus = 'completed';
                    else if (item.status === 'cancelled') taskStatus = 'cancelled';
                    else if (item.status === 'pending') taskStatus = 'assigned';

                    return {
                        id: item.id,
                        task_code: 'V1-' + item.item_code,
                        item_code: item.item_code,
                        order_id: item.order?.id,
                        order_item_id: item.id,
                        service_id: item.service_id,
                        technician_id: userId,
                        service_name: item.item_name,
                        quantity: item.quantity,
                        status: taskStatus,
                        priority: 'normal',
                        scheduled_date: null,
                        scheduled_time: null,
                        started_at: item.started_at || null,
                        completed_at: item.completed_at || null,
                        assigned_at: item.created_at,
                        created_at: item.created_at,
                        updated_at: item.updated_at,
                        order: item.order ? {
                            order_code: item.order.order_code,
                            customer: item.order.customer
                        } : undefined,
                        service: item.service,
                        customer: item.order?.customer,
                        is_virtual: true,
                        type: 'v1_service'
                    };
                });
            allTasks.push(...v1Items);
        }

        // Process V2 Services (including junction table assignments)
        if (allV2Services.length > 0) {
            const v2Items = allV2Services.map(item => {
                let taskStatus = 'assigned';
                if (item.status === 'in_progress') taskStatus = 'in_progress';
                else if (item.status === 'completed') taskStatus = 'completed';
                else if (item.status === 'cancelled') taskStatus = 'cancelled';
                else if (item.status === 'pending') taskStatus = 'assigned';

                return {
                    id: item.id,
                    task_code: 'V2-' + (item.order_products?.product_code || item.id.substring(0, 6)),
                    item_code: item.order_products?.product_code,
                    order_id: item.order_products?.orders?.id,
                    service_id: item.service_id,
                    technician_id: userId,
                    service_name: item.item_name,
                    quantity: 1,
                    status: taskStatus,
                    priority: 'normal',
                    scheduled_date: null,
                    scheduled_time: null,
                    started_at: item.started_at || null,
                    completed_at: item.completed_at || null,
                    assigned_at: item.assigned_at || item.created_at,
                    created_at: item.created_at,
                    updated_at: item.updated_at || item.created_at,
                    order: item.order_products?.orders ? {
                        order_code: item.order_products.orders.order_code,
                        customer: item.order_products.orders.customer
                    } : undefined,
                    customer: item.order_products?.orders?.customer,
                    is_virtual: true,
                    type: 'v2_service'
                };
            });
            allTasks.push(...v2Items);
        }

        // Process Workflow Steps
        if (workflowSteps) {
            const stepItems = workflowSteps.map(step => {
                let taskStatus = 'assigned';
                if (step.status === 'in_progress') taskStatus = 'in_progress';
                else if (step.status === 'completed') taskStatus = 'completed';
                else if (step.status === 'skipped') taskStatus = 'cancelled';
                else if (step.status === 'pending') taskStatus = 'assigned';

                // Determine parent service name and order info
                let serviceName = step.step_name;
                let parentServiceName = '';
                let orderInfo = null;
                let customerInfo = null;

                if (step.order_product_services) {
                    parentServiceName = step.order_product_services.item_name;
                    orderInfo = step.order_product_services.order_products?.orders;
                    customerInfo = orderInfo?.customer;
                } else if (step.order_items) {
                    parentServiceName = step.order_items.item_name;
                    orderInfo = step.order_items.orders;
                    customerInfo = orderInfo?.customer;
                }

                return {
                    id: step.id,
                    task_code: 'STEP-' + step.step_order, // Simple display code
                    item_code: null,
                    order_id: orderInfo?.id,
                    technician_id: userId,
                    service_name: `${step.step_name} (${parentServiceName})`,
                    quantity: 1,
                    status: taskStatus,
                    priority: 'normal',
                    scheduled_date: null,
                    scheduled_time: null,
                    started_at: step.started_at || null,
                    completed_at: step.completed_at || null,
                    assigned_at: step.created_at,
                    created_at: step.created_at,
                    updated_at: step.created_at,
                    order: orderInfo ? {
                        order_code: orderInfo.order_code,
                        customer: customerInfo
                    } : undefined,
                    customer: customerInfo,
                    is_virtual: true,
                    type: 'workflow_step',
                    is_step: true,
                    step_id: step.id
                };
            });
            allTasks.push(...stepItems);
        }

        res.json(allTasks);
    } catch (error) {
        next(error);
    }
});

// Get stats summary
router.get('/stats/summary', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const isTechnician = req.user?.role === 'technician';

        if (isTechnician && !userId) {
            return res.json({
                total: 0, pending: 0, assigned: 0, in_progress: 0,
                completed: 0, cancelled: 0, total_duration: 0, avg_rating: 0
            });
        }

        // Get technician_tasks
        let tasksQuery = supabase.from('technician_tasks').select('status, duration_minutes, rating, item_code');

        if (isTechnician && userId) {
            tasksQuery = tasksQuery.eq('technician_id', userId);
        }

        const { data: tasks, error } = await tasksQuery;
        if (error) throw error;

        // Also get order_items assigned to this technician
        let orderItemsStats = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
        if (isTechnician && userId) {
            const taskItemCodes = new Set((tasks || []).map(t => t.item_code).filter(Boolean));

            const { data: orderItems } = await supabase
                .from('order_items')
                .select('status, item_code')
                .eq('technician_id', userId)
                .not('item_code', 'is', null);

            // Count items not in technician_tasks
            (orderItems || []).forEach(item => {
                if (item.item_code && !taskItemCodes.has(item.item_code)) {
                    if (item.status === 'pending') orderItemsStats.pending++;
                    else if (item.status === 'in_progress') orderItemsStats.in_progress++;
                    else if (item.status === 'completed') orderItemsStats.completed++;
                    else if (item.status === 'cancelled') orderItemsStats.cancelled++;
                    else orderItemsStats.pending++; // default to pending/assigned
                }
            });
        }

        const stats = {
            total: (tasks?.length || 0) + orderItemsStats.pending + orderItemsStats.in_progress + orderItemsStats.completed + orderItemsStats.cancelled,
            pending: (tasks?.filter(t => t.status === 'pending').length || 0) + orderItemsStats.pending,
            assigned: (tasks?.filter(t => t.status === 'assigned').length || 0) + orderItemsStats.pending,
            in_progress: (tasks?.filter(t => t.status === 'in_progress').length || 0) + orderItemsStats.in_progress,
            completed: (tasks?.filter(t => t.status === 'completed').length || 0) + orderItemsStats.completed,
            cancelled: (tasks?.filter(t => t.status === 'cancelled').length || 0) + orderItemsStats.cancelled,
            total_duration: tasks?.reduce((sum, t) => sum + (t.duration_minutes || 0), 0) || 0,
            avg_rating: (() => {
                const rated = tasks?.filter(t => t.rating !== null) || [];
                if (rated.length === 0) return 0;
                return rated.reduce((sum, t) => sum + (t.rating || 0), 0) / rated.length;
            })()
        };

        res.json(stats);
    } catch (error) {
        next(error);
    }
});

// Get task by item_code (for QR code scanning)
router.get('/by-code/:itemCode', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { itemCode } = req.params;

        const { data, error } = await supabase
            .from('technician_tasks')
            .select(`
                *,
                order:orders(order_code, customer:customers(*)),
                service:services(*),
                technician:users!technician_tasks_technician_id_fkey(id, name, phone, avatar),
                customer:customers(*)
            `)
            .eq('item_code', itemCode)
            .single();

        if (!error && data) {
            return res.json({ ...data, type: 'task' });
        }

        const { data: orderItem, error: itemError } = await supabase
            .from('order_items')
            .select(`
                *,
                order:orders(id, order_code, status, customer:customers(*)),
                service:services(*),
                technician:users(id, name, phone, avatar)
            `)
            .eq('item_code', itemCode)
            .single();

        // If V1 item not found, try V2 product (order_products)
        if (itemError || !orderItem) {
            const { data: v2Product, error: v2Error } = await supabaseAdmin
                .from('order_products')
                .select(`
                    id,
                    name,
                    product_code,
                    orders (id, order_code, status, customer:customers(*)),
                    order_product_services (
                        id,
                        item_name,
                        status,
                        technician_id,
                        unit_price,
                        started_at,
                        completed_at,
                        users (id, name, phone, avatar),
                        technicians:order_product_service_technicians (
                            id,
                            technician_id,
                            commission,
                            status,
                            assigned_at,
                            technician:users!order_product_service_technicians_technician_id_fkey(id, name, phone, avatar)
                        )
                    )
                `)
                .eq('product_code', itemCode)
                .single();

            if (v2Error || !v2Product) {
                return res.status(404).json({ message: 'Không tìm thấy mã QR này' });
            }

            // If found, we need to decide what to return.
            // A product might have multiple services.
            // For now, return the first service or generic product info.

            // Prefer services assigned to current user if possible?
            // But this is public scan? Or technician scan? "AuthenticatedRequest".
            // If technician, prioritize their task.

            const userId = req.user?.id;

            // Check both old single technician and new junction table
            let targetService = v2Product.order_product_services?.find((s: any) =>
                s.technician_id === userId ||
                s.technicians?.some((t: any) => t.technician_id === userId)
            );

            // If no service assigned to me, take the first one?
            if (!targetService && v2Product.order_product_services?.length > 0) {
                targetService = v2Product.order_product_services[0];
            }

            // Get technicians array from junction table, fallback to single technician
            let technicians: any[] = targetService?.technicians || [];
            if (technicians.length === 0 && targetService?.technician_id && targetService?.users) {
                technicians = [{
                    technician_id: targetService.technician_id,
                    technician: targetService.users
                }] as any;
            }

            return res.json({
                id: targetService?.id || v2Product.id, // Use service ID if available, else product ID
                type: 'v2_service', // Or 'v2_product' if no service?
                item_code: v2Product.product_code,
                service_name: targetService ? targetService.item_name : v2Product.name,
                quantity: 1,
                unit_price: targetService?.unit_price || 0,
                total_price: targetService?.unit_price || 0,
                item_type: 'service',
                status: targetService?.status || (targetService?.technician_id ? 'assigned' : 'not_assigned'),
                started_at: targetService?.started_at,
                completed_at: targetService?.completed_at,
                order: v2Product.orders,
                service: null, // V2 doesn't link to services table directly in response structure same as V1?
                technician: targetService?.users, // Single technician for backward compatibility
                technicians: technicians, // Multiple technicians from junction table
                customer: (v2Product.orders as any)?.customer,
                order_product_id: v2Product.id // Extra info
            });
        }

        return res.json({
            id: orderItem.id,
            type: 'order_item',
            item_code: orderItem.item_code,
            service_name: orderItem.item_name,
            quantity: orderItem.quantity,
            unit_price: orderItem.unit_price,
            total_price: orderItem.total_price,
            item_type: orderItem.item_type,
            status: orderItem.technician_id ? 'assigned' : 'not_assigned',
            order: orderItem.order,
            service: orderItem.service,
            technician: orderItem.technician,
            customer: orderItem.order?.customer,
        });
    } catch (error) {
        next(error);
    }
});

// Get single task
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('technician_tasks')
            .select(`
                *,
                order:orders(order_code, customer:customers(*)),
                service:services(*),
                technician:users!technician_tasks_technician_id_fkey(name, phone, avatar, department),
                customer:customers(*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Create task
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const taskCode = await generateTaskCode();

        const { data, error } = await supabase
            .from('technician_tasks')
            .insert({
                ...req.body,
                task_code: taskCode,
                created_by: userId
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        next(error);
    }
});

// Create tasks from order items
router.post('/from-order/:orderId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { orderId } = req.params;
        const { technician_id, scheduled_date, scheduled_time } = req.body;

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`
                *,
                customer:customers(id, name, phone, address),
                items:order_items(*)
            `)
            .eq('id', orderId)
            .single();

        if (orderError) throw orderError;

        const serviceItems = order.items.filter((item: { item_type: string }) => item.item_type === 'service');

        if (serviceItems.length === 0) {
            return res.status(400).json({ message: 'Đơn hàng không có dịch vụ nào' });
        }

        const tasks = [];
        for (const item of serviceItems) {
            const taskCode = await generateTaskCode();
            tasks.push({
                task_code: taskCode,
                order_id: orderId,
                order_item_id: item.id,
                service_id: item.service_id,
                customer_id: order.customer?.id,
                technician_id: technician_id || null,
                service_name: item.item_name,
                quantity: item.quantity,
                status: technician_id ? 'assigned' : 'pending',
                scheduled_date: scheduled_date || null,
                scheduled_time: scheduled_time || null,
                assigned_by: technician_id ? userId : null,
                assigned_at: technician_id ? new Date().toISOString() : null,
                created_by: userId
            });
        }

        const { data, error } = await supabase
            .from('technician_tasks')
            .insert(tasks)
            .select();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        next(error);
    }
});

// Update task
router.put('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('technician_tasks')
            .update({
                ...req.body,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Assign task to technician
router.put('/:id/assign', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { technician_id, scheduled_date, scheduled_time } = req.body;
        const userId = req.user?.id;

        const { data, error } = await supabase
            .from('technician_tasks')
            .update({
                technician_id,
                scheduled_date,
                scheduled_time,
                status: 'assigned',
                assigned_by: userId,
                assigned_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Start task
router.put('/:id/start', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        // First try to find in technician_tasks
        const { data: taskInfo, error: taskError } = await supabase
            .from('technician_tasks')
            .select('id, order_id')
            .eq('id', id)
            .maybeSingle();

        if (taskInfo) {
            // Update technician_tasks
            const { data, error } = await supabase
                .from('technician_tasks')
                .update({
                    status: 'in_progress',
                    started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select('*, order_item_id')
                .single();

            if (error) throw error;

            // Also update the corresponding order_item status
            if (data.order_item_id) {
                await supabase
                    .from('order_items')
                    .update({
                        status: 'in_progress',
                        started_at: new Date().toISOString()
                    })
                    .eq('id', data.order_item_id);
                console.log('Updated order_item status to in_progress:', data.order_item_id);
            }

            // Also update order status
            if (taskInfo.order_id) {
                await supabase
                    .from('orders')
                    .update({
                        status: 'processing',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', taskInfo.order_id)
                    .eq('status', 'confirmed');
            }

            return res.json(data);
        }

        // If not found in technician_tasks, try order_item_steps (Workflow Step)
        const { data: step } = await supabaseAdmin
            .from('order_item_steps')
            .select('id, status')
            .eq('id', id)
            .maybeSingle();

        if (step) {
            const { data: updatedStep, error: stepError } = await supabaseAdmin
                .from('order_item_steps')
                .update({
                    status: 'in_progress',
                    started_at: new Date().toISOString()
                })
                .eq('id', id)
                .select('*, order_items:order_items(id, orders:orders(id, order_code)), order_product_services:order_product_services(id, order_products(id, orders(id, order_code)))')
                .single();

            if (stepError) throw stepError;

            return res.json({
                ...updatedStep,
                type: 'workflow_step',
                is_virtual: true
            });
        }

        // Check if it is a V2 service (order_product_services)
        const { data: v2Service } = await supabaseAdmin
            .from('order_product_services')
            .select('id')
            .eq('id', id)
            .maybeSingle();

        if (v2Service) {
            const { data: updatedService, error: serviceError } = await supabaseAdmin
                .from('order_product_services')
                .update({
                    status: 'in_progress',
                    started_at: new Date().toISOString()
                })
                .eq('id', id)
                .select('*, order_products(id, orders(id, order_code))')
                .single();

            if (serviceError) throw serviceError;
            // Update order status potentially?
            if (updatedService.order_products?.orders?.id) {
                await supabaseAdmin
                    .from('orders')
                    .update({
                        status: 'processing',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', updatedService.order_products.orders.id)
                    .eq('status', 'confirmed');
            }

            return res.json({
                ...updatedService,
                type: 'v2_service',
                is_virtual: true
            });
        }


        // If not found in steps or V2, try order_items (V1 virtual task)
        const { data: orderItem, error: itemError } = await supabase
            .from('order_items')
            .select('id, order_id')
            .eq('id', id)
            .maybeSingle();

        if (!orderItem) {
            return res.status(404).json({ message: 'Không tìm thấy công việc' });
        }

        // Update order_item status
        const { data: updatedItem, error: updateError } = await supabase
            .from('order_items')
            .update({
                status: 'in_progress',
                started_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Update order status to processing
        if (orderItem.order_id) {
            await supabase
                .from('orders')
                .update({
                    status: 'processing',
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderItem.order_id)
                .eq('status', 'confirmed');
        }

        res.json({
            ...updatedItem,
            is_virtual: true
        });
    } catch (error) {
        next(error);
    }
});

// Complete task
router.put('/:id/complete', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { notes, duration_minutes } = req.body;

        // First try to find in technician_tasks
        const { data: task } = await supabase
            .from('technician_tasks')
            .select('id, started_at')
            .eq('id', id)
            .maybeSingle();

        if (task) {
            let actualDuration = duration_minutes;
            if (!actualDuration && task.started_at) {
                const startTime = new Date(task.started_at);
                const endTime = new Date();
                actualDuration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
            }

            const { data, error } = await supabase
                .from('technician_tasks')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    duration_minutes: actualDuration,
                    notes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select('*, order_id, order_item_id')
                .single();

            if (error) throw error;

            // Also update the corresponding order_item status
            if (data.order_item_id) {
                await supabase
                    .from('order_items')
                    .update({
                        status: 'completed',
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', data.order_item_id);
                console.log('Updated order_item status to completed:', data.order_item_id);
            }

            // Check if all tasks of this order are completed
            if (data.order_id) {
                const { data: allTasks } = await supabase
                    .from('technician_tasks')
                    .select('id, status')
                    .eq('order_id', data.order_id);

                const allCompleted = allTasks?.every(t => t.status === 'completed');

                if (allCompleted && allTasks && allTasks.length > 0) {
                    // Get order details with sale info
                    const { data: order } = await supabase
                        .from('orders')
                        .select('id, order_code, created_by, customer:customers(name)')
                        .eq('id', data.order_id)
                        .single();

                    if (order?.created_by) {
                        const customerName = (order.customer as any)?.name || 'khách hàng';
                        await supabase.from('notifications').insert({
                            user_id: order.created_by,
                            type: 'order_completed',
                            title: 'Tất cả dịch vụ đã hoàn thành',
                            message: `Đơn hàng ${order.order_code} của ${customerName} đã hoàn thành. Vui lòng liên hệ khách hàng để thanh toán.`,
                            data: { order_id: order.id, order_code: order.order_code },
                            is_read: false
                        });
                        console.log('Sent completion notification to sale:', order.created_by);
                    }
                }
            }

            return res.json(data);
        }

        // Try order_item_steps (Workflow Step)
        const { data: step } = await supabaseAdmin
            .from('order_item_steps')
            .select('id, started_at')
            .eq('id', id)
            .maybeSingle();

        if (step) {
            let actualDuration = duration_minutes;
            if (!actualDuration && step.started_at) {
                const startTime = new Date(step.started_at);
                const endTime = new Date();
                actualDuration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
            }

            const { data: updatedStep, error: stepError } = await supabaseAdmin
                .from('order_item_steps')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    duration_minutes: actualDuration
                })
                .eq('id', id)
                .select()
                .single();

            if (stepError) throw stepError;

            return res.json({
                ...updatedStep,
                type: 'workflow_step',
                is_virtual: true
            });
        }

        // Try V2 service
        const { data: v2Service } = await supabaseAdmin
            .from('order_product_services')
            .select('id, started_at, order_product_id, unit_price')
            .eq('id', id)
            .maybeSingle();

        if (v2Service) {
            let actualDuration = duration_minutes;
            if (!actualDuration && v2Service.started_at) {
                const startTime = new Date(v2Service.started_at);
                const endTime = new Date();
                actualDuration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
            }

            const { data: updatedService, error: serviceError } = await supabaseAdmin
                .from('order_product_services')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (serviceError) throw serviceError;

            return res.json({
                ...updatedService,
                type: 'v2_service',
                is_virtual: true
            });
        }

        // If not found in technician_tasks, try order_items (virtual task)
        const { data: orderItem } = await supabase
            .from('order_items')
            .select('id, started_at')
            .eq('id', id)
            .maybeSingle();

        if (!orderItem) {
            return res.status(404).json({ message: 'Không tìm thấy công việc' });
        }

        let actualDuration = duration_minutes;
        if (!actualDuration && orderItem.started_at) {
            const startTime = new Date(orderItem.started_at);
            const endTime = new Date();
            actualDuration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
        }

        const { data: updatedItem, error: updateError } = await supabase
            .from('order_items')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*, order_id')
            .single();

        if (updateError) throw updateError;

        // Check if all service items of this order are completed
        if (updatedItem.order_id) {
            const { data: orderItems } = await supabase
                .from('order_items')
                .select('id, status, item_type')
                .eq('order_id', updatedItem.order_id)
                .eq('item_type', 'service');

            const allServicesCompleted = orderItems?.every(item => item.status === 'completed');

            if (allServicesCompleted && orderItems && orderItems.length > 0) {
                // Get order details with sale info
                const { data: order } = await supabase
                    .from('orders')
                    .select('id, order_code, created_by, customer:customers(name)')
                    .eq('id', updatedItem.order_id)
                    .single();

                if (order?.created_by) {
                    // Send notification to sale
                    const customerName = (order.customer as any)?.name || 'khách hàng';
                    await supabase.from('notifications').insert({
                        user_id: order.created_by,
                        type: 'order_completed',
                        title: 'Tất cả dịch vụ đã hoàn thành',
                        message: `Đơn hàng ${order.order_code} của ${customerName} đã hoàn thành. Vui lòng liên hệ khách hàng để thanh toán.`,
                        data: { order_id: order.id, order_code: order.order_code },
                        is_read: false
                    });

                    console.log('Sent completion notification to sale:', order.created_by);
                }
            }
        }

        res.json({
            ...updatedItem,
            duration_minutes: actualDuration,
            is_virtual: true
        });
    } catch (error) {
        next(error);
    }
});

// Cancel task
router.put('/:id/cancel', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const { data, error } = await supabase
            .from('technician_tasks')
            .update({
                status: 'cancelled',
                notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Add customer feedback/rating
router.put('/:id/feedback', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { customer_feedback, rating } = req.body;

        const { data, error } = await supabase
            .from('technician_tasks')
            .update({
                customer_feedback,
                rating,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Delete task
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('technician_tasks')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Đã xóa công việc' });
    } catch (error) {
        next(error);
    }
});

export default router;
