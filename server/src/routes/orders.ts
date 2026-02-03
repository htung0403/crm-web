import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireSale } from '../middleware/auth.js';

const router = Router();

// =====================================================
// ORDER CODE GENERATION HELPERS
// =====================================================

/**
 * Generate next order code in format A-1, A-2, A-3...
 * Queries database for the highest existing number and increments
 */
async function generateNextOrderCode(): Promise<string> {
    const prefix = 'A';

    // Get the latest order with A-X pattern
    const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('order_code')
        .like('order_code', `${prefix}-%`)
        .order('created_at', { ascending: false })
        .limit(100);

    let maxNumber = 0;

    if (orders && orders.length > 0) {
        for (const order of orders) {
            // Parse A-X format to extract number
            const match = order.order_code.match(/^A-(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNumber) maxNumber = num;
            }
        }
    }

    return `${prefix}-${maxNumber + 1}`;
}

/**
 * Generate product code in format A-1-1, A-1-2...
 * Based on order code and product index
 */
function generateProductCode(orderCode: string, productIndex: number): string {
    return `${orderCode}-${productIndex + 1}`;
}

// Get next order code (for preview on client)
router.get('/next-code', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const nextOrderCode = await generateNextOrderCode();
        res.json({
            status: 'success',
            data: {
                nextOrderCode
            }
        });
    } catch (error) {
        next(error);
    }
});

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
                // ADD THE PRODUCT ITSELF AS AN ITEM (for Sales Kanban)
                v2Items.push({
                    id: product.id,
                    order_id: order.id,
                    item_name: product.name,
                    item_type: 'product', // Treat as product in UI
                    quantity: 1,
                    unit_price: 0,
                    total_price: 0,
                    status: product.status || 'pending',
                    item_code: product.product_code,
                    product: {
                        image: product.images?.[0] || null
                    },
                    is_v2_product: true, // Flag to distinguish
                    product_type: product.type || null // Loại sản phẩm: giày, túi, ví, ...
                });

                // If product has services, add them as items (for Workflow/Technician)
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
                }
            }

            // Combine items
            order.items = [...(order.items || []), ...v2Items];
            console.log(`[Order ${order.order_code}] V2 items added: ${v2Items.length}, Total items: ${order.items.length}`);
        } else {
            console.log(`[Order ${order.order_code}] No V2 products found. v2Products:`, v2Products?.length || 0, 'Error:', v2Error);
        }

        // Attach latest extension request for this order (Phase 1 - Xin gia hạn)
        const { data: extRequest } = await supabaseAdmin
            .from('order_extension_requests')
            .select('*')
            .eq('order_id', order.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        (order as any).extension_request = extRequest || null;

        // For each order item, attach latest accessory and partner (V1 = order_items, V2 = order_product_services)
        if (order.items) {
            for (const item of order.items) {
                const itemId = item.id;
                if (!itemId) continue;
                const { data: acc } = await supabaseAdmin
                    .from('order_item_accessories')
                    .select('*')
                    .or(`order_item_id.eq.${itemId},order_product_service_id.eq.${itemId}`)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                const { data: part } = await supabaseAdmin
                    .from('order_item_partner')
                    .select('*')
                    .or(`order_item_id.eq.${itemId},order_product_service_id.eq.${itemId}`)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                (item as any).accessory = acc || null;
                (item as any).partner = part || null;
            }
        }

        res.json({
            status: 'success',
            data: { order },
        });
    } catch (error) {
        next(error);
    }
});

// Get Kanban logs by tab (sales | workflow | aftersale) – lịch sử chuyển trạng thái từng tab
router.get('/:id/kanban-logs', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id: orderIdOrCode } = req.params;
        const tab = (req.query.tab as string) || 'sales';
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderIdOrCode);
        let orderId: string = orderIdOrCode;
        if (!isUUID) {
            const { data: ord } = await supabaseAdmin.from('orders').select('id').eq('order_code', orderIdOrCode).single();
            if (!ord) throw new ApiError('Không tìm thấy đơn hàng', 404);
            orderId = ord.id;
        }

        if (tab === 'sales') {
            const { data: logs, error } = await supabaseAdmin
                .from('order_item_status_log')
                .select('id, entity_type, entity_id, from_status, to_status, created_by, created_at, created_by_user:users!order_item_status_log_created_by_fkey(id, name)')
                .eq('order_id', orderId)
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) throw new ApiError('Lỗi khi lấy lịch sử Sales', 500);
            return res.json({ status: 'success', data: { logs: logs || [] } });
        }

        if (tab === 'aftersale') {
            const { data: logs, error } = await supabaseAdmin
                .from('order_after_sale_stage_log')
                .select('id, from_stage, to_stage, created_by, created_at, created_by_user:users!order_after_sale_stage_log_created_by_fkey(id, name)')
                .eq('order_id', orderId)
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) throw new ApiError('Lỗi khi lấy lịch sử After sale', 500);
            return res.json({ status: 'success', data: { logs: logs || [] } });
        }

        if (tab === 'workflow') {
            const { data: orderItems } = await supabaseAdmin.from('order_items').select('id').eq('order_id', orderId);
            const orderItemIds = orderItems?.map((r: { id: string }) => r.id) || [];
            const { data: orderProducts } = await supabaseAdmin.from('order_products').select('id').eq('order_id', orderId);
            const opIds = orderProducts?.map((r: { id: string }) => r.id) || [];
            const { data: services } = opIds.length
                ? await supabaseAdmin.from('order_product_services').select('id').in('order_product_id', opIds)
                : { data: [] };
            const serviceIds = (services as { id: string }[] | null)?.map((r) => r.id) || [];
            const { data: stepsV1 } = orderItemIds.length
                ? await supabaseAdmin.from('order_item_steps').select('id').in('order_item_id', orderItemIds)
                : { data: [] };
            const { data: stepsV2 } = serviceIds.length
                ? await supabaseAdmin.from('order_item_steps').select('id').in('order_product_service_id', serviceIds)
                : { data: [] };
            const stepIds = [
                ...((stepsV1 as { id: string }[] | null) || []),
                ...((stepsV2 as { id: string }[] | null) || [])
            ].map((s) => s.id);
            const ids = [...new Set(stepIds)];
            if (ids.length === 0) {
                return res.json({ status: 'success', data: { logs: [] } });
            }
            const { data: logs, error } = await supabaseAdmin
                .from('order_workflow_step_log')
                .select('id, order_item_step_id, action, step_name, step_order, created_by, created_at, created_by_user:users!order_workflow_step_log_created_by_fkey(id, name)')
                .in('order_item_step_id', ids)
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) throw new ApiError('Lỗi khi lấy lịch sử Workflow', 500);
            return res.json({ status: 'success', data: { logs: logs || [] } });
        }

        if (tab === 'care') {
            const { data: logs, error } = await supabaseAdmin
                .from('order_care_warranty_log')
                .select('id, from_stage, to_stage, flow_type, created_by, created_at, created_by_user:users!order_care_warranty_log_created_by_fkey(id, name)')
                .eq('order_id', orderId)
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) throw new ApiError('Lỗi khi lấy lịch sử Chăm sóc/Bảo hành', 500);
            return res.json({ status: 'success', data: { logs: logs || [] } });
        }

        throw new ApiError('tab không hợp lệ. Chọn: sales, workflow, aftersale, care', 400);
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
        const { customer_id, products, add_on_products, notes, discount, discount_type, discount_value, surcharges, paid_amount, status } = req.body;

        if (!customer_id || !products || products.length === 0) {
            throw new ApiError('Khách hàng và sản phẩm là bắt buộc', 400);
        }

        // Tính tổng tiền từ tất cả services của tất cả products (sản phẩm khách + dịch vụ)
        let subtotalFromProducts = 0;
        for (const product of products) {
            if (product.services && product.services.length > 0) {
                for (const service of product.services) {
                    subtotalFromProducts += service.price || 0;
                }
            }
        }

        // Tổng tiền từ sản phẩm bán kèm
        let subtotalFromAddOns = 0;
        if (add_on_products && Array.isArray(add_on_products) && add_on_products.length > 0) {
            for (const addOn of add_on_products) {
                const qty = Math.max(1, Number(addOn.quantity) || 1);
                const price = Number(addOn.unit_price) || 0;
                subtotalFromAddOns += price * qty;
            }
        }

        const subtotal = subtotalFromProducts + subtotalFromAddOns;

        // Calculate discount amount (already calculated in frontend, but verify)
        const discountAmount = discount || 0;

        // Calculate total surcharges amount
        let totalSurchargesAmount = 0;
        if (surcharges && surcharges.length > 0) {
            for (const surcharge of surcharges) {
                totalSurchargesAmount += surcharge.amount || 0;
            }
        }

        const totalAmount = Math.max(0, subtotal - discountAmount + totalSurchargesAmount);

        // Calculate remaining debt
        const paidAmountValue = paid_amount || 0;
        const remainingDebt = Math.max(0, totalAmount - paidAmountValue);

        // Tạo mã đơn hàng theo format A-1, A-2, ...
        const orderCode = await generateNextOrderCode();

        // Tạo đơn hàng
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
                order_code: orderCode,
                customer_id,
                sales_id: req.user!.id,
                subtotal,
                discount: discountAmount,
                discount_type: discount_type || 'amount',
                discount_value: discount_value || 0,
                surcharges: surcharges || [],
                surcharges_amount: totalSurchargesAmount,
                total_amount: totalAmount,
                paid_amount: paidAmountValue,
                remaining_debt: remainingDebt,
                payment_status: remainingDebt <= 0 ? 'paid' : (paidAmountValue > 0 ? 'partial' : 'unpaid'),
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

        for (let productIndex = 0; productIndex < products.length; productIndex++) {
            const product = products[productIndex];
            // Generate product code in format A-1-1, A-1-2, ...
            const productCode = generateProductCode(orderCode, productIndex);

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

        // Tạo order_items cho sản phẩm bán kèm (V1 order_items, item_type = 'product')
        if (add_on_products && Array.isArray(add_on_products) && add_on_products.length > 0) {
            const base = Date.now().toString().slice(-8);
            const addOnOrderItems = add_on_products.map((addOn: any, idx: number) => {
                const qty = Math.max(1, Number(addOn.quantity) || 1);
                const unitPrice = Number(addOn.unit_price) || 0;
                const totalPrice = unitPrice * qty;
                const uniqueSuffix = `${idx.toString().padStart(2, '0')}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
                return {
                    order_id: order.id,
                    product_id: addOn.product_id || null,
                    item_type: 'product',
                    item_name: addOn.name || 'Sản phẩm bán kèm',
                    quantity: qty,
                    unit_price: unitPrice,
                    total_price: totalPrice,
                    item_code: `IT${base}${uniqueSuffix}`,
                    status: 'pending'
                };
            });
            const { error: addOnItemsError } = await supabaseAdmin
                .from('order_items')
                .insert(addOnOrderItems);
            if (addOnItemsError) {
                console.error('Error creating add-on order items:', addOnItemsError);
            } else {
                console.log(`Created ${addOnOrderItems.length} add-on order items for order ${orderCode}`);
            }
        }

        // Create transaction record if paid_amount > 0
        if (paidAmountValue > 0) {
            // Generate transaction code
            const { data: lastTrans } = await supabaseAdmin
                .from('transactions')
                .select('code')
                .like('code', 'PT%')
                .order('created_at', { ascending: false })
                .limit(1);

            let transCode = 'PT000001';
            if (lastTrans && lastTrans.length > 0) {
                const lastNum = parseInt(lastTrans[0].code.replace('PT', ''), 10);
                transCode = `PT${String(lastNum + 1).padStart(6, '0')}`;
            }

            const { error: transError } = await supabaseAdmin
                .from('transactions')
                .insert({
                    code: transCode,
                    type: 'income',
                    category: 'Thanh toán đơn hàng',
                    amount: paidAmountValue,
                    payment_method: 'cash',
                    notes: `Thanh toán trước khi tạo đơn - ${orderCode}`,
                    date: new Date().toISOString().split('T')[0],
                    order_id: order.id,
                    order_code: orderCode,
                    status: 'approved',
                    created_by: req.user!.id,
                    approved_by: req.user!.id,
                    approved_at: new Date().toISOString(),
                });

            if (transError) {
                console.error('Error creating transaction for order payment:', transError);
            } else {
                console.log(`Created transaction ${transCode} for order ${orderCode} with amount ${paidAmountValue}`);
            }
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

const AFTER_SALE_STAGES = ['after1', 'after2', 'after3', 'after4'];
const CARE_WARRANTY_FLOWS = ['warranty', 'care'];
const CARE_WARRANTY_STAGES = ['war1', 'war2', 'war3', 'care6', 'care12', 'care-custom'];

// Update order (partial: due_at, after_sale_stage, after-sale data, care_warranty)
router.patch('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        let oldAfterSaleStage: string | null | undefined;
        let oldCareFlow: string | null | undefined;
        let oldCareStage: string | null | undefined;
        const {
            due_at,
            after_sale_stage,
            completion_photos,
            debt_checked,
            debt_checked_notes,
            packaging_photos,
            delivery_carrier,
            delivery_address,
            delivery_self_pickup,
            delivery_notes,
            hd_sent,
            feedback_requested,
            care_warranty_flow,
            care_warranty_stage,
        } = req.body;

        if (after_sale_stage !== undefined || care_warranty_flow !== undefined || care_warranty_stage !== undefined) {
            const { data: current } = await supabaseAdmin
                .from('orders')
                .select('after_sale_stage, care_warranty_flow, care_warranty_stage')
                .eq('id', id)
                .single();
            if (after_sale_stage !== undefined) oldAfterSaleStage = (current as any)?.after_sale_stage ?? null;
            if (care_warranty_flow !== undefined || care_warranty_stage !== undefined) {
                oldCareFlow = (current as any)?.care_warranty_flow ?? null;
                oldCareStage = (current as any)?.care_warranty_stage ?? null;
            }
        }

        const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (due_at !== undefined) updatePayload.due_at = due_at || null;
        if (after_sale_stage !== undefined) {
            if (after_sale_stage !== null && !AFTER_SALE_STAGES.includes(after_sale_stage)) {
                throw new ApiError('after_sale_stage không hợp lệ. Chọn: after1, after2, after3, after4', 400);
            }
            updatePayload.after_sale_stage = after_sale_stage || null;
        }
        if (completion_photos !== undefined) updatePayload.completion_photos = Array.isArray(completion_photos) ? completion_photos : [];
        if (debt_checked !== undefined) {
            updatePayload.debt_checked = !!debt_checked;
            updatePayload.debt_checked_at = !!debt_checked ? new Date().toISOString() : null;
        }
        if (debt_checked_notes !== undefined) updatePayload.debt_checked_notes = debt_checked_notes ?? null;
        if (packaging_photos !== undefined) updatePayload.packaging_photos = Array.isArray(packaging_photos) ? packaging_photos : [];
        if (delivery_carrier !== undefined) updatePayload.delivery_carrier = delivery_carrier ?? null;
        if (delivery_address !== undefined) updatePayload.delivery_address = delivery_address ?? null;
        if (delivery_self_pickup !== undefined) updatePayload.delivery_self_pickup = !!delivery_self_pickup;
        if (delivery_notes !== undefined) updatePayload.delivery_notes = delivery_notes ?? null;
        if (hd_sent !== undefined) {
            updatePayload.hd_sent = !!hd_sent;
            updatePayload.hd_sent_at = !!hd_sent ? new Date().toISOString() : null;
        }
        if (feedback_requested !== undefined) {
            updatePayload.feedback_requested = !!feedback_requested;
            updatePayload.feedback_requested_at = !!feedback_requested ? new Date().toISOString() : null;
        }
        if (care_warranty_flow !== undefined) {
            if (care_warranty_flow !== null && !CARE_WARRANTY_FLOWS.includes(care_warranty_flow)) {
                throw new ApiError('care_warranty_flow không hợp lệ. Chọn: warranty, care', 400);
            }
            updatePayload.care_warranty_flow = care_warranty_flow || null;
        }
        if (care_warranty_stage !== undefined) {
            if (care_warranty_stage !== null && !CARE_WARRANTY_STAGES.includes(care_warranty_stage)) {
                throw new ApiError('care_warranty_stage không hợp lệ. Chọn: war1, war2, war3, care6, care12, care-custom', 400);
            }
            updatePayload.care_warranty_stage = care_warranty_stage || null;
            if (care_warranty_stage && (oldCareStage === null || oldCareStage === undefined)) {
                updatePayload.care_warranty_started_at = new Date().toISOString();
            }
        }

        const { data: order, error } = await supabaseAdmin
            .from('orders')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi cập nhật đơn hàng', 500);
        }

        if (after_sale_stage !== undefined && oldAfterSaleStage !== after_sale_stage) {
            try {
                await supabaseAdmin.from('order_after_sale_stage_log').insert({
                    order_id: id,
                    from_stage: oldAfterSaleStage ?? null,
                    to_stage: after_sale_stage ?? null,
                    created_by: userId ?? null
                });
            } catch (logErr) {
                console.error('order_after_sale_stage_log insert error:', logErr);
            }
        }

        const newCareFlow = care_warranty_flow !== undefined ? (care_warranty_flow || null) : oldCareFlow ?? null;
        const newCareStage = care_warranty_stage !== undefined ? (care_warranty_stage || null) : oldCareStage ?? null;
        const careStageChanged = (care_warranty_stage !== undefined && (oldCareStage !== care_warranty_stage || oldCareFlow !== care_warranty_flow))
            || (care_warranty_flow !== undefined && (oldCareFlow !== care_warranty_flow || oldCareStage !== care_warranty_stage));
        if (careStageChanged && newCareStage) {
            const flowType = ['war1', 'war2', 'war3'].includes(newCareStage) ? 'warranty' : 'care';
            try {
                await supabaseAdmin.from('order_care_warranty_log').insert({
                    order_id: id,
                    from_stage: oldCareStage ?? null,
                    to_stage: newCareStage,
                    flow_type: flowType,
                    created_by: userId ?? null
                });
            } catch (logErr) {
                console.error('order_care_warranty_log insert error:', logErr);
            }
        }

        res.json({
            status: 'success',
            data: { order },
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

        // When confirming: set confirmed_at only on first confirmation (do not overwrite)
        let confirmedAtPayload: { confirmed_at?: string } = {};
        if (status === 'confirmed') {
            const { data: existing } = await supabaseAdmin
                .from('orders')
                .select('confirmed_at')
                .eq('id', id)
                .single();
            if (!existing?.confirmed_at) {
                confirmedAtPayload = { confirmed_at: new Date().toISOString() };
            }
        }

        const { data: order, error } = await supabaseAdmin
            .from('orders')
            .update({
                status,
                updated_at: new Date().toISOString(),
                ...(status === 'completed' && { completed_at: new Date().toISOString() }),
                ...confirmedAtPayload,
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

// =====================================================
// PAYMENT RECORDS - Thanh toán đơn hàng
// =====================================================

// Get payment records for an order
router.get('/:id/payments', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { data: payments, error } = await supabaseAdmin
            .from('payment_records')
            .select('*, created_by_user:users!payment_records_created_by_fkey(id, name, avatar)')
            .eq('order_id', id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching payments:', error);
            throw new ApiError('Lỗi khi lấy danh sách thanh toán', 500);
        }

        res.json({
            status: 'success',
            data: { payments: payments || [] },
        });
    } catch (error) {
        next(error);
    }
});

// Create a payment record for an order
router.post('/:id/payments', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { content, amount, payment_method, image_url, notes } = req.body;

        if (!content || !amount || amount <= 0) {
            throw new ApiError('Nội dung và số tiền là bắt buộc', 400);
        }

        // Get order details
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id, order_code, total_amount, paid_amount, remaining_debt')
            .eq('id', id)
            .single();

        if (orderError || !order) {
            throw new ApiError('Không tìm thấy đơn hàng', 404);
        }

        // Create payment record
        const { data: payment, error: paymentError } = await supabaseAdmin
            .from('payment_records')
            .insert({
                order_id: order.id,
                order_code: order.order_code,
                content,
                amount,
                payment_method: payment_method || 'cash',
                image_url,
                notes,
                transaction_type: 'income',
                transaction_category: 'Thanh toán đơn hàng',
                transaction_status: 'approved',
                created_by: req.user!.id,
            })
            .select()
            .single();

        if (paymentError) {
            console.error('Error creating payment:', paymentError);
            throw new ApiError('Lỗi khi tạo thanh toán: ' + paymentError.message, 500);
        }

        // Update order's paid_amount and remaining_debt
        const newPaidAmount = (order.paid_amount || 0) + amount;
        const newRemainingDebt = Math.max(0, order.total_amount - newPaidAmount);
        const newPaymentStatus = newRemainingDebt <= 0 ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'unpaid');

        const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({
                paid_amount: newPaidAmount,
                remaining_debt: newRemainingDebt,
                payment_status: newPaymentStatus,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (updateError) {
            console.error('Error updating order payment:', updateError);
            // Don't fail, payment was recorded
        }

        // Also create a transaction record for Thu Chi
        const { data: lastTrans } = await supabaseAdmin
            .from('transactions')
            .select('code')
            .like('code', 'PT%')
            .order('created_at', { ascending: false })
            .limit(1);

        let transCode = 'PT000001';
        if (lastTrans && lastTrans.length > 0) {
            const lastNum = parseInt(lastTrans[0].code.replace('PT', ''), 10);
            transCode = `PT${String(lastNum + 1).padStart(6, '0')}`;
        }

        const { error: transError } = await supabaseAdmin
            .from('transactions')
            .insert({
                code: transCode,
                type: 'income',
                category: 'Thanh toán đơn hàng',
                amount,
                payment_method: payment_method || 'cash',
                notes: `${content} - ${order.order_code}`,
                image_url,
                date: new Date().toISOString().split('T')[0],
                order_id: order.id,
                order_code: order.order_code,
                status: 'approved',
                created_by: req.user!.id,
                approved_by: req.user!.id,
                approved_at: new Date().toISOString(),
            });

        if (transError) {
            console.error('Error creating transaction for payment:', transError);
        } else {
            console.log(`Created transaction ${transCode} for order ${order.order_code} payment`);
        }

        res.status(201).json({
            status: 'success',
            data: {
                payment,
                order: {
                    paid_amount: newPaidAmount,
                    remaining_debt: newRemainingDebt,
                    payment_status: newPaymentStatus,
                }
            },
            message: `Đã ghi nhận thanh toán ${amount.toLocaleString()}đ`,
        });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// ORDER EXTENSION REQUESTS (Xin gia hạn)
// =====================================================
const EXTENSION_STATUSES = ['requested', 'sale_contacted', 'manager_approved', 'notified_tech', 'kpi_recorded'];

router.post('/:id/extension-request', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason || typeof reason !== 'string' || !reason.trim()) {
            throw new ApiError('Lý do gia hạn là bắt buộc', 400);
        }

        const { data: order } = await supabaseAdmin.from('orders').select('id').eq('id', id).maybeSingle();
        if (!order) {
            throw new ApiError('Không tìm thấy đơn hàng', 404);
        }

        const { data: row, error } = await supabaseAdmin
            .from('order_extension_requests')
            .insert({
                order_id: id,
                requested_by: req.user!.id,
                reason: reason.trim(),
                status: 'requested',
            })
            .select()
            .single();

        if (error) throw new ApiError('Lỗi tạo yêu cầu gia hạn: ' + error.message, 500);

        res.status(201).json({
            status: 'success',
            data: row,
            message: 'Đã gửi yêu cầu gia hạn',
        });
    } catch (error) {
        next(error);
    }
});

router.patch('/:id/extension-request', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { customer_result, new_due_at, valid_reason, status } = req.body;

        const { data: latest } = await supabaseAdmin
            .from('order_extension_requests')
            .select('*')
            .eq('order_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!latest) {
            throw new ApiError('Không tìm thấy yêu cầu gia hạn', 404);
        }

        const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (typeof customer_result === 'string') updatePayload.customer_result = customer_result;
        if (new_due_at !== undefined) updatePayload.new_due_at = new_due_at || null;
        if (typeof valid_reason === 'boolean') updatePayload.valid_reason = valid_reason;
        if (status && EXTENSION_STATUSES.includes(status)) updatePayload.status = status;
        if (new_due_at && req.user?.id) {
            updatePayload.approved_by = req.user.id;
            updatePayload.approved_at = new Date().toISOString();
        }

        const { data: updated, error } = await supabaseAdmin
            .from('order_extension_requests')
            .update(updatePayload)
            .eq('id', latest.id)
            .select()
            .single();

        if (error) throw new ApiError('Lỗi cập nhật: ' + error.message, 500);

        if (new_due_at && updated) {
            await supabaseAdmin
                .from('orders')
                .update({ due_at: new_due_at, updated_at: new Date().toISOString() })
                .eq('id', id);
        }

        if (status === 'kpi_recorded' && updated && !(updated as any).valid_reason) {
            await supabaseAdmin
                .from('order_extension_requests')
                .update({ kpi_late_recorded: true })
                .eq('id', latest.id);
        }

        res.json({
            status: 'success',
            data: updated,
            message: 'Đã cập nhật yêu cầu gia hạn',
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
