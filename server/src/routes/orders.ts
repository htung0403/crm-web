import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireSale } from '../middleware/auth.js';

const router = Router();

// Get all orders
router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { status, customer_id, search, sale_id, technician_id, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        // If technician_id is provided, we need to find orders with items assigned to that technician
        if (technician_id) {
            // Get order IDs where the technician is assigned
            const { data: techOrders, error: techError } = await supabaseAdmin
                .from('order_items')
                .select('order_id')
                .eq('technician_id', technician_id);

            if (techError) {
                throw new ApiError('Lỗi khi tìm đơn hàng', 500);
            }

            const orderIds = [...new Set((techOrders || []).map(o => o.order_id))];

            if (orderIds.length === 0) {
                return res.json({
                    status: 'success',
                    data: {
                        orders: [],
                        pagination: {
                            page: Number(page),
                            limit: Number(limit),
                            total: 0,
                            totalPages: 0,
                        }
                    },
                });
            }

            const { data: orders, error, count } = await supabaseAdmin
                .from('orders')
                .select(`
                    *,
                    customer:customers(id, name, phone, email),
                    sales_user:users!orders_sales_id_fkey(id, name),
                    items:order_items(id, order_id, product_id, service_id, item_type, item_name, quantity, unit_price, total_price, item_code, technician_id)
                `, { count: 'exact' })
                .in('id', orderIds)
                .order('created_at', { ascending: false })
                .range(offset, offset + Number(limit) - 1);

            if (error) {
                throw new ApiError('Lỗi khi lấy danh sách đơn hàng', 500);
            }

            return res.json({
                status: 'success',
                data: {
                    orders,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total: count || 0,
                        totalPages: Math.ceil((count || 0) / Number(limit)),
                    }
                },
            });
        }

        let query = supabaseAdmin
            .from('orders')
            .select(`
        *,
        customer:customers(id, name, phone, email),
        sales_user:users!orders_sales_id_fkey(id, name),
        items:order_items(id, order_id, product_id, service_id, item_type, item_name, quantity, unit_price, total_price, item_code, technician_id)
      `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (status) query = query.eq('status', status);
        if (customer_id) query = query.eq('customer_id', customer_id);
        if (search) query = query.ilike('order_code', `%${search}%`);
        if (sale_id) query = query.eq('sales_id', sale_id);

        const { data: orders, error, count } = await query;

        if (error) {
            throw new ApiError('Lỗi khi lấy danh sách đơn hàng', 500);
        }

        res.json({
            status: 'success',
            data: {
                orders,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: count || 0,
                    totalPages: Math.ceil((count || 0) / Number(limit)),
                }
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get order by ID or order_code
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        // Determine if id is a UUID or order_code
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        // Fetch order with V1 items
        let query = supabaseAdmin
            .from('orders')
            .select(`
        *,
        customer:customers(id, name, phone, email, address),
        sales_user:users!orders_sales_id_fkey(id, name),
        items:order_items(*, product:products(*), service:services(*))
      `);

        // Query by id (UUID) or order_code
        if (isUUID) {
            query = query.eq('id', id);
        } else {
            query = query.eq('order_code', id);
        }

        const { data: order, error } = await query.single();

        if (error || !order) {
            throw new ApiError('Không tìm thấy đơn hàng', 404);
        }

        // Fetch V2 items (order_products and their services) - use order.id (UUID)
        const { data: v2Products, error: v2Error } = await supabaseAdmin
            .from('order_products')
            .select(`
                *,
                services:order_product_services(
                    *,
                    service:services(*),
                    package:packages(*),
                    technician:users(id, name),
                    technicians:order_product_service_technicians(
                        id,
                        technician_id,
                        commission,
                        status,
                        assigned_at,
                        technician:users!order_product_service_technicians_technician_id_fkey(id, name, avatar)
                    )
                )
            `)
            .eq('order_id', order.id);

        if (!v2Error && v2Products && v2Products.length > 0) {
            const v2Items: any[] = [];

            // Map V2 structure to V1 items structure
            for (const product of v2Products) {
                // If product has services, add them as items
                if (product.services && product.services.length > 0) {
                    for (const s of product.services) {
                        // Get all technicians from junction table (or fallback to single technician)
                        let technicians = s.technicians || [];
                        if (technicians.length === 0 && s.technician_id) {
                            // Fallback for old data with single technician
                            technicians = [{
                                technician_id: s.technician_id,
                                technician: s.technician,
                                commission: 0
                            }];
                        }

                        v2Items.push({
                            id: s.id,
                            order_id: id,
                            // Show: Service Name (Product Name)
                            item_name: `${s.item_name} (${product.name})`,
                            item_type: s.item_type,
                            quantity: 1,
                            unit_price: s.unit_price,
                            total_price: s.unit_price,
                            status: s.status,
                            technician_id: s.technician_id,
                            technician: s.technician,
                            technicians: technicians, // Multiple technicians
                            service: s.service,
                            package: s.package,
                            started_at: s.started_at,
                            completed_at: s.completed_at,
                            assigned_at: s.assigned_at,
                            // Use product image if available, otherwise service image
                            product: {
                                image: product.images?.[0] || null
                            }
                        });
                    }
                } else {
                    // This is a product without services (just intake)? 
                    // Should we show it? Maybe not in progress if no service attached.
                    // But maybe user wants to track the product itself?
                    // For now, only show services as they are the billable/trackable items.
                }
            }

            // Combine items
            order.items = [...(order.items || []), ...v2Items];
            console.log(`[Order ${order.order_code}] V2 items added: ${v2Items.length}, Total items: ${order.items.length}`);
        } else {
            console.log(`[Order ${order.order_code}] No V2 products found. v2Products:`, v2Products?.length || 0, 'Error:', v2Error);
        }

        res.json({
            status: 'success',
            data: { order },
        });
    } catch (error) {
        next(error);
    }
});

// Create order
router.post('/', authenticate, requireSale, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { customer_id, items, notes, discount } = req.body;

        if (!customer_id || !items || items.length === 0) {
            throw new ApiError('Khách hàng và sản phẩm là bắt buộc', 400);
        }

        // Tính tổng tiền
        let subtotal = 0;
        for (const item of items) {
            subtotal += item.quantity * item.unit_price;
        }
        const discountAmount = discount || 0;
        const totalAmount = subtotal - discountAmount;

        // Tạo mã đơn hàng
        const orderCode = `DH${Date.now().toString().slice(-8)}`;

        // Tạo đơn hàng
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
                order_code: orderCode,
                customer_id,
                sales_id: req.user!.id,
                subtotal,
                discount: discountAmount,
                total_amount: totalAmount,
                status: 'pending',
                notes,
                created_by: req.user!.id,
            })
            .select()
            .single();

        if (orderError) {
            throw new ApiError('Lỗi khi tạo đơn hàng: ' + orderError.message, 500);
        }

        // Generate unique item codes for QR scanning
        const generateItemCode = () => `IT${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;

        // Tạo order items (including technician_id, item_code, and commission)
        const orderItems = items.map((item: any) => {
            const totalPrice = item.quantity * item.unit_price;
            // Get commission rates from item (passed from frontend) or default to 0
            const commissionSaleRate = item.commission_sale || 0;
            const commissionTechRate = item.commission_tech || 0;
            // Calculate commission amounts
            const commissionSaleAmount = Math.floor(totalPrice * commissionSaleRate / 100);
            const commissionTechAmount = Math.floor(totalPrice * commissionTechRate / 100);

            // Determine status based on technician assignment
            // Support both technician_id (single) and technicians (array) formats
            const technicianId = item.technician_id ||
                (item.technicians && item.technicians.length > 0 ? item.technicians[0].technician_id : null);
            const hasTechnician = !!technicianId;

            return {
                order_id: order.id,
                product_id: item.type === 'product' ? item.item_id : null,
                service_id: item.type === 'service' ? item.item_id : null,
                item_type: item.type,
                item_name: item.name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: totalPrice,
                technician_id: technicianId,
                item_code: generateItemCode(),
                commission_sale_rate: commissionSaleRate,
                commission_tech_rate: commissionTechRate,
                commission_sale_amount: commissionSaleAmount,
                commission_tech_amount: commissionTechAmount,
                // Set status based on technician assignment
                status: hasTechnician ? 'assigned' : 'pending',
                assigned_at: hasTechnician ? new Date().toISOString() : null,
            };
        });

        const { data: insertedItems, error: itemsError } = await supabaseAdmin
            .from('order_items')
            .insert(orderItems)
            .select();

        if (itemsError) {
            // Rollback - xóa order nếu tạo items thất bại
            await supabaseAdmin.from('orders').delete().eq('id', order.id);
            throw new ApiError('Lỗi khi tạo chi tiết đơn hàng', 500);
        }

        // =====================================================
        // AUTO-GENERATE WORKFLOW STEPS FOR SERVICE ITEMS
        // =====================================================
        const serviceItems = insertedItems?.filter((item: any) => item.item_type === 'service') || [];

        if (serviceItems.length > 0) {
            // Get service IDs to look up their workflows
            const serviceIds = [...new Set(serviceItems.map((item: any) => item.service_id))];

            // Fetch services with their workflow steps
            const { data: servicesWithWorkflows } = await supabaseAdmin
                .from('services')
                .select(`
                    id,
                    workflow_id,
                    workflow:workflows(
                        id,
                        name,
                        steps:workflow_steps(
                            id,
                            step_order,
                            name,
                            department_id,
                            estimated_duration,
                            is_required
                        )
                    )
                `)
                .in('id', serviceIds)
                .not('workflow_id', 'is', null);

            // Create order_item_steps for each service item that has a workflow
            const orderItemSteps: any[] = [];

            for (const serviceItem of serviceItems) {
                const serviceWithWorkflow = servicesWithWorkflows?.find(
                    (s: any) => s.id === serviceItem.service_id
                ) as any;

                // Supabase returns workflow as object (not array) for single FK relation
                const workflow = serviceWithWorkflow?.workflow;
                const workflowSteps = workflow?.steps;

                if (workflowSteps && workflowSteps.length > 0) {
                    const sortedSteps = [...workflowSteps].sort(
                        (a: any, b: any) => a.step_order - b.step_order
                    );

                    for (const step of sortedSteps) {
                        orderItemSteps.push({
                            order_item_id: serviceItem.id,
                            workflow_step_id: step.id,
                            step_order: step.step_order,
                            step_name: step.name || `Bước ${step.step_order}`,
                            department_id: step.department_id,
                            estimated_duration: step.estimated_duration,
                            status: 'pending'
                        });
                    }
                }
            }

            if (orderItemSteps.length > 0) {
                const { error: stepsError } = await supabaseAdmin
                    .from('order_item_steps')
                    .insert(orderItemSteps);

                if (stepsError) {
                    console.error('Error creating order item steps:', stepsError);
                    // Don't fail the order creation, just log the error
                } else {
                    console.log(`Created ${orderItemSteps.length} workflow steps for order items`);
                }
            }
        }

        // =====================================================
        // CREATE TECHNICIAN TASKS
        // =====================================================
        console.log('Inserted items:', JSON.stringify(insertedItems, null, 2));

        const serviceItemsWithTechnician = insertedItems?.filter(
            (item: any) => item.item_type === 'service' && item.technician_id
        ) || [];

        console.log('Service items with technician:', serviceItemsWithTechnician.length);

        if (serviceItemsWithTechnician.length > 0) {
            const technicianTasks = serviceItemsWithTechnician.map((item: any) => ({
                task_code: `TK${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`,
                order_id: order.id,
                order_item_id: item.id,
                service_id: item.service_id,
                customer_id: customer_id,
                technician_id: item.technician_id,
                service_name: item.item_name,
                quantity: item.quantity,
                status: 'assigned',
                priority: 'normal',
                assigned_by: req.user!.id,
                assigned_at: new Date().toISOString(),
                item_code: item.item_code, // QR code reference
            }));

            console.log('Creating technician tasks:', JSON.stringify(technicianTasks, null, 2));

            const { error: taskError } = await supabaseAdmin
                .from('technician_tasks')
                .insert(technicianTasks);

            if (taskError) {
                console.error('Error creating technician tasks:', taskError);
                // Don't fail the order creation, just log the error
            } else {
                console.log('Technician tasks created successfully');
            }
        }

        res.status(201).json({
            status: 'success',
            data: { order },
        });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// NEW ORDER CREATION (V2) - Product-based for cleaning services
// =====================================================
// Create order with customer products (shoes, bags, etc.)
router.post('/v2', authenticate, requireSale, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { customer_id, products, notes, discount, status } = req.body;

        if (!customer_id || !products || products.length === 0) {
            throw new ApiError('Khách hàng và sản phẩm là bắt buộc', 400);
        }

        // Tính tổng tiền từ tất cả services của tất cả products
        let subtotal = 0;
        for (const product of products) {
            if (product.services && product.services.length > 0) {
                for (const service of product.services) {
                    subtotal += service.price || 0;
                }
            }
        }
        const discountAmount = discount || 0;
        const totalAmount = subtotal - discountAmount;

        // Tạo mã đơn hàng
        const orderCode = `DH${Date.now().toString().slice(-8)}`;

        // Tạo đơn hàng
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
                order_code: orderCode,
                customer_id,
                sales_id: req.user!.id,
                subtotal,
                discount: discountAmount,
                total_amount: totalAmount,
                status: status || 'pending',
                notes,
                created_by: req.user!.id,
            })
            .select()
            .single();

        if (orderError) {
            throw new ApiError('Lỗi khi tạo đơn hàng: ' + orderError.message, 500);
        }

        // Tạo order_products và order_product_services
        const createdProducts = [];

        for (const product of products) {
            // Generate unique product code for QR
            const productCode = `SP${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

            // Create order_product
            const { data: orderProduct, error: productError } = await supabaseAdmin
                .from('order_products')
                .insert({
                    order_id: order.id,
                    product_code: productCode,
                    name: product.name,
                    type: product.type,
                    brand: product.brand,
                    color: product.color,
                    size: product.size,
                    material: product.material,
                    condition_before: product.condition_before,
                    images: product.images || [],
                    notes: product.notes,
                    status: 'pending'
                })
                .select()
                .single();

            if (productError) {
                console.error('Error creating order product:', productError);
                continue;
            }

            // Create order_product_services
            if (product.services && product.services.length > 0) {
                const productServices = product.services.map((service: any) => {
                    // Check if any technicians are assigned
                    const hasTechnicians = service.technicians && service.technicians.length > 0;
                    // Keep the first technician_id for backward compatibility
                    const technicianId = service.technician_id ||
                        (hasTechnicians ? service.technicians[0].technician_id : null);

                    return {
                        order_product_id: orderProduct.id,
                        service_id: service.type === 'service' ? service.id : null,
                        package_id: service.type === 'package' ? service.id : null,
                        item_name: service.name,
                        item_type: service.type,
                        unit_price: service.price || 0,
                        technician_id: technicianId,
                        status: hasTechnicians ? 'assigned' : 'pending',
                        assigned_at: hasTechnicians ? new Date().toISOString() : null,
                        // Store original technicians data for later insertion
                        _technicians: service.technicians || []
                    };
                });

                const { data: createdServices, error: servicesError } = await supabaseAdmin
                    .from('order_product_services')
                    .insert(productServices.map((s: any) => {
                        // Remove _technicians before insert (not a DB column)
                        const { _technicians, ...serviceData } = s;
                        return serviceData;
                    }))
                    .select(); // Select to get IDs for steps generation

                if (servicesError) {
                    console.error('Error creating product services:', servicesError);
                } else if (createdServices) {
                    // Insert multiple technicians into junction table
                    const technicianAssignments: any[] = [];

                    for (let i = 0; i < createdServices.length; i++) {
                        const createdService = createdServices[i];
                        const originalService = productServices[i];
                        const technicians = originalService._technicians || [];

                        for (const tech of technicians) {
                            technicianAssignments.push({
                                order_product_service_id: createdService.id,
                                technician_id: tech.technician_id,
                                commission: tech.commission || 0,
                                assigned_by: req.user!.id,
                                assigned_at: new Date().toISOString(),
                                status: 'assigned'
                            });
                        }
                    }

                    if (technicianAssignments.length > 0) {
                        const { error: techError } = await supabaseAdmin
                            .from('order_product_service_technicians')
                            .insert(technicianAssignments);

                        if (techError) {
                            console.error('Error creating technician assignments:', techError);
                        } else {
                            console.log(`Created ${technicianAssignments.length} technician assignments`);
                        }
                    }

                    // Generate Workflow Steps for services if applicable
                    const itemStepsToInsert: any[] = [];

                    for (const createdService of createdServices) {
                        // Only generate steps for 'service' type, check if service has workflow
                        if (createdService.item_type === 'service' && createdService.service_id) {
                            // Fetch service details to get workflow_id
                            const { data: serviceData } = await supabaseAdmin
                                .from('services')
                                .select('workflow_id')
                                .eq('id', createdService.service_id)
                                .single();

                            if (serviceData?.workflow_id) {
                                // Fetch workflow steps
                                const { data: workflowSteps } = await supabaseAdmin
                                    .from('workflow_steps')
                                    .select('*')
                                    .eq('workflow_id', serviceData.workflow_id)
                                    .order('step_order', { ascending: true });

                                if (workflowSteps && workflowSteps.length > 0) {
                                    // Map workflow steps to order item steps
                                    workflowSteps.forEach(step => {
                                        itemStepsToInsert.push({
                                            order_product_service_id: createdService.id, // V2 link
                                            workflow_step_id: step.id,
                                            step_order: step.step_order,
                                            step_name: step.name || `Bước ${step.step_order}`,
                                            department_id: step.department_id,
                                            status: 'pending',
                                            estimated_duration: step.estimated_duration
                                        });
                                    });
                                }
                            }
                        }
                    }

                    if (itemStepsToInsert.length > 0) {
                        const { error: stepsError } = await supabaseAdmin
                            .from('order_item_steps')
                            .insert(itemStepsToInsert);

                        if (stepsError) {
                            console.error('Error creating V2 workflow steps:', stepsError);
                        } else {
                            console.log(`Created ${itemStepsToInsert.length} workflow steps for V2 services`);
                        }
                    }
                }
            }

            createdProducts.push({
                ...orderProduct,
                qr_code: productCode
            });
        }

        res.status(201).json({
            status: 'success',
            data: {
                order,
                products: createdProducts
            },
            message: `Đã tạo đơn hàng với ${createdProducts.length} sản phẩm`
        });
    } catch (error) {
        next(error);
    }
});

// Update order (items, notes, discount)
router.put('/:id', authenticate, requireSale, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { items, notes, discount } = req.body;

        // Check if order exists and is not completed/cancelled
        const { data: existingOrder } = await supabaseAdmin
            .from('orders')
            .select('status')
            .eq('id', id)
            .single();

        if (!existingOrder) {
            throw new ApiError('Không tìm thấy đơn hàng', 404);
        }

        if (existingOrder.status === 'completed' || existingOrder.status === 'cancelled') {
            throw new ApiError('Không thể cập nhật đơn hàng đã hoàn thành hoặc đã huỷ', 400);
        }

        // Recalculate totals
        let subtotal = 0;
        for (const item of items) {
            subtotal += item.quantity * item.unit_price;
        }
        const discountAmount = discount || 0;
        const totalAmount = subtotal - discountAmount;

        // Update order
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .update({
                subtotal,
                discount: discountAmount,
                total_amount: totalAmount,
                notes,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (orderError) {
            throw new ApiError('Lỗi khi cập nhật đơn hàng: ' + orderError.message, 500);
        }

        // Delete old items and insert new ones
        await supabaseAdmin.from('order_items').delete().eq('order_id', id);

        // Generate unique item codes for QR scanning
        const generateItemCode = () => `IT${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;

        const orderItems = items.map((item: any) => {
            const totalPrice = item.quantity * item.unit_price;
            // Get commission rates from item (passed from frontend) or default to 0
            const commissionSaleRate = item.commission_sale || 0;
            const commissionTechRate = item.commission_tech || 0;
            // Calculate commission amounts
            const commissionSaleAmount = Math.floor(totalPrice * commissionSaleRate / 100);
            const commissionTechAmount = Math.floor(totalPrice * commissionTechRate / 100);

            return {
                order_id: id,
                product_id: item.type === 'product' ? item.item_id : null,
                service_id: item.type === 'service' ? item.item_id : null,
                item_type: item.type,
                item_name: item.name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: totalPrice,
                technician_id: item.technician_id || null,
                item_code: item.item_code || generateItemCode(),
                commission_sale_rate: commissionSaleRate,
                commission_tech_rate: commissionTechRate,
                commission_sale_amount: commissionSaleAmount,
                commission_tech_amount: commissionTechAmount,
            };
        });

        const { error: itemsError } = await supabaseAdmin
            .from('order_items')
            .insert(orderItems);

        if (itemsError) {
            throw new ApiError('Lỗi khi cập nhật chi tiết đơn hàng', 500);
        }

        // Fetch updated order with items
        const { data: updatedOrder } = await supabaseAdmin
            .from('orders')
            .select(`
                *,
                customer:customers(id, name, phone, email),
                sales_user:users!orders_sales_id_fkey(id, name),
                items:order_items(id, order_id, product_id, service_id, item_type, item_name, quantity, unit_price, total_price)
            `)
            .eq('id', id)
            .single();

        res.json({
            status: 'success',
            data: { order: updatedOrder },
        });
    } catch (error) {
        next(error);
    }
});

// Update order status
router.patch('/:id/status', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'confirmed', 'processing', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            throw new ApiError('Trạng thái không hợp lệ', 400);
        }

        const { data: order, error } = await supabaseAdmin
            .from('orders')
            .update({
                status,
                updated_at: new Date().toISOString(),
                ...(status === 'completed' && { completed_at: new Date().toISOString() }),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi cập nhật đơn hàng', 500);
        }

        res.json({
            status: 'success',
            data: { order },
        });
    } catch (error) {
        next(error);
    }
});

// Delete order
router.delete('/:id', authenticate, requireSale, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        // Chỉ xóa được đơn hàng pending
        const { data: order } = await supabaseAdmin
            .from('orders')
            .select('status')
            .eq('id', id)
            .single();

        if (order?.status !== 'pending') {
            throw new ApiError('Chỉ có thể xóa đơn hàng đang chờ xử lý', 400);
        }

        // Xóa order items trước
        await supabaseAdmin.from('order_items').delete().eq('order_id', id);

        // Xóa order
        const { error } = await supabaseAdmin.from('orders').delete().eq('id', id);

        if (error) {
            throw new ApiError('Lỗi khi xóa đơn hàng', 500);
        }

        res.json({
            status: 'success',
            message: 'Đã xóa đơn hàng',
        });
    } catch (error) {
        next(error);
    }
});

export { router as ordersRouter };
