import { Router, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AuthenticatedRequest, authenticate } from '../middleware/auth';

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
                technician:users!technician_tasks_technician_id_fkey(name, phone, avatar),
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

        console.log('DEBUG /my-tasks - req.user:', req.user);
        console.log('DEBUG /my-tasks - userId:', userId);

        // If no userId, return empty array
        if (!userId) {
            console.log('DEBUG /my-tasks - No userId, returning empty array');
            return res.json([]);
        }

        let tasks: any[] = [];

        // Try to get tasks from technician_tasks table
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
            console.log('technician_tasks table not available, using order_items only');
        }

        // Also get order_items assigned to this technician
        const { data: orderItems, error: itemsError } = await supabase
            .from('order_items')
            .select(`
                *,
                order:orders(id, order_code, status, customer:customers(*)),
                service:services(*)
            `)
            .eq('technician_id', userId)
            .not('item_code', 'is', null);

        if (itemsError) {
            console.error('Error fetching order_items:', itemsError);
            // If order_items also fails, just return tasks we have
            return res.json(tasks);
        }

        // Filter out order_items that already have a task
        const taskItemCodes = new Set(tasks.map(t => t.item_code).filter(Boolean));
        const additionalItems = (orderItems || [])
            .filter(item => item.item_code && !taskItemCodes.has(item.item_code))
            .map(item => ({
                id: item.id,
                task_code: 'PENDING-' + item.id.substring(0, 8),
                item_code: item.item_code,
                order_id: item.order?.id,
                order_item_id: item.id,
                service_id: item.service_id,
                technician_id: userId,
                service_name: item.item_name,
                quantity: item.quantity,
                status: 'assigned',
                priority: 'normal',
                scheduled_date: null,
                scheduled_time: null,
                started_at: null,
                completed_at: null,
                duration_minutes: null,
                notes: null,
                customer_feedback: null,
                rating: null,
                assigned_by: null,
                assigned_at: item.created_at,
                created_at: item.created_at,
                updated_at: item.updated_at,
                order: item.order ? {
                    order_code: item.order.order_code,
                    customer: item.order.customer
                } : undefined,
                service: item.service,
                customer: item.order?.customer,
                is_virtual: true
            }));

        // Combine tasks and virtual tasks
        const allTasks = [...tasks, ...additionalItems];

        res.json(allTasks);
    } catch (error) {
        console.error('Error in /my-tasks:', error);
        next(error);
    }
});

// Get stats summary for current technician
router.get('/stats/summary', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const isTechnician = req.user?.role === 'technician';

        // If technician but no userId, return empty stats
        if (isTechnician && !userId) {
            return res.json({
                total: 0, pending: 0, assigned: 0, in_progress: 0,
                completed: 0, cancelled: 0, total_duration: 0, avg_rating: 0
            });
        }

        // Get stats from technician_tasks
        let tasksQuery = supabase.from('technician_tasks').select('status, duration_minutes, rating');

        if (isTechnician && userId) {
            tasksQuery = tasksQuery.eq('technician_id', userId);
        }

        const { data: tasks, error } = await tasksQuery;
        if (error) throw error;

        // Also get order_items assigned to technician but not in tasks (for additional 'assigned' count)
        let orderItemsQuery = supabase
            .from('order_items')
            .select('id, item_code, technician_id')
            .not('technician_id', 'is', null)
            .not('item_code', 'is', null);

        if (isTechnician && userId) {
            orderItemsQuery = orderItemsQuery.eq('technician_id', userId);
        }

        const { data: orderItems, error: itemsError } = await orderItemsQuery;
        if (itemsError) throw itemsError;

        // Get task item codes
        const { data: taskItems } = await supabase
            .from('technician_tasks')
            .select('item_code')
            .not('item_code', 'is', null);

        const taskItemCodes = new Set((taskItems || []).map(t => t.item_code));
        const additionalAssigned = (orderItems || []).filter(
            item => item.item_code && !taskItemCodes.has(item.item_code)
        ).length;

        // Calculate stats
        const stats = {
            total: (tasks?.length || 0) + additionalAssigned,
            pending: tasks?.filter(t => t.status === 'pending').length || 0,
            assigned: (tasks?.filter(t => t.status === 'assigned').length || 0) + additionalAssigned,
            in_progress: tasks?.filter(t => t.status === 'in_progress').length || 0,
            completed: tasks?.filter(t => t.status === 'completed').length || 0,
            cancelled: tasks?.filter(t => t.status === 'cancelled').length || 0,
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

        // First try to find in technician_tasks
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
            // Task found, return it
            return res.json({ ...data, type: 'task' });
        }

        // If not found in technician_tasks, try to find in order_items
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

        if (itemError) {
            return res.status(404).json({ message: 'Không tìm thấy mã QR này' });
        }

        // If order_item has technician_id, auto-create a task
        if (orderItem.technician_id && orderItem.technician) {
            const taskCode = 'TK' + Date.now().toString().slice(-10);

            const { data: newTask, error: createError } = await supabase
                .from('technician_tasks')
                .insert({
                    task_code: taskCode,
                    item_code: orderItem.item_code,
                    order_id: orderItem.order?.id,
                    order_item_id: orderItem.id,
                    service_id: orderItem.service_id,
                    customer_id: orderItem.order?.customer?.id,
                    technician_id: orderItem.technician_id,
                    service_name: orderItem.item_name,
                    quantity: orderItem.quantity,
                    status: 'assigned',
                    assigned_at: new Date().toISOString()
                })
                .select(`
                    *,
                    order:orders(order_code, customer:customers(*)),
                    service:services(*),
                    technician:users!technician_tasks_technician_id_fkey(id, name, phone, avatar),
                    customer:customers(*)
                `)
                .single();

            if (!createError && newTask) {
                return res.json({ ...newTask, type: 'task' });
            }
        }

        // Return order item data (no technician assigned)
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
                technician:users!technician_tasks_technician_id_fkey(name, phone, avatar),
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

// Create task (usually from order)
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

// Create tasks from order items (batch create)
router.post('/from-order/:orderId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { orderId } = req.params;
        const { technician_id, scheduled_date, scheduled_time } = req.body;

        // Get order with service items
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

        // Filter only service items
        const serviceItems = order.items.filter((item: { item_type: string }) => item.item_type === 'service');

        if (serviceItems.length === 0) {
            return res.status(400).json({ message: 'Đơn hàng không có dịch vụ nào' });
        }

        // Create tasks for each service
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

        // Get task to find associated order
        const { data: taskInfo } = await supabase
            .from('technician_tasks')
            .select('order_id')
            .eq('id', id)
            .single();

        const { data, error } = await supabase
            .from('technician_tasks')
            .update({
                status: 'in_progress',
                started_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Update order status to 'processing' if it's in 'confirmed' status
        if (taskInfo?.order_id) {
            await supabase
                .from('orders')
                .update({
                    status: 'processing',
                    updated_at: new Date().toISOString()
                })
                .eq('id', taskInfo.order_id)
                .eq('status', 'confirmed'); // Only update if currently confirmed
        }

        res.json(data);
    } catch (error) {
        next(error);
    }
});


// Complete task
router.put('/:id/complete', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { notes, duration_minutes } = req.body;

        // Get task to calculate duration if not provided
        const { data: task } = await supabase
            .from('technician_tasks')
            .select('started_at')
            .eq('id', id)
            .single();

        let actualDuration = duration_minutes;
        if (!actualDuration && task?.started_at) {
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
            .select()
            .single();

        if (error) throw error;

        res.json(data);
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

// Get technician stats
router.get('/stats/summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const { date_from, date_to } = req.query;

        let query = supabase
            .from('technician_tasks')
            .select('status, duration_minutes, rating');

        if (userId) {
            query = query.eq('technician_id', userId);
        }

        if (date_from) {
            query = query.gte('scheduled_date', date_from);
        }

        if (date_to) {
            query = query.lte('scheduled_date', date_to);
        }

        const { data, error } = await query;

        if (error) throw error;

        const stats = {
            total: data?.length || 0,
            pending: data?.filter(t => t.status === 'pending').length || 0,
            assigned: data?.filter(t => t.status === 'assigned').length || 0,
            in_progress: data?.filter(t => t.status === 'in_progress').length || 0,
            completed: data?.filter(t => t.status === 'completed').length || 0,
            cancelled: data?.filter(t => t.status === 'cancelled').length || 0,
            total_duration: data?.reduce((sum, t) => sum + (t.duration_minutes || 0), 0) || 0,
            avg_rating: data?.filter(t => t.rating).reduce((sum, t, _, arr) => sum + (t.rating || 0) / arr.length, 0) || 0
        };

        res.json(stats);
    } catch (error) {
        next(error);
    }
});

export default router;
