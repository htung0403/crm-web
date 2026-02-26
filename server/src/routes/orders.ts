import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireSale } from '../middleware/auth.js';
import { checkAndCompleteOrder } from '../utils/orderHelper.js';

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
                    items:order_items(
                        id, order_id, product_id, service_id, item_type, item_name, quantity, unit_price, total_price, item_code, technician_id, sales_step_data,
                        product:products(id, image, code),
                        service:services(id, image, code),
                        technician:users!order_product_services_technician_id_fkey(id, name),
                        order_item_steps(id, started_at, estimated_duration, status, step_order)
                    )
                `, { count: 'exact' })
                .in('id', orderIds)
                .order('created_at', { ascending: false })
                .range(offset, offset + Number(limit) - 1);

            if (error) {
                throw new ApiError('Lỗi khi lấy danh sách đơn hàng', 500);
            }

            // Merge V2 order_products into items for each order
            const orderIdsList = (orders || []).map((o: { id: string }) => o.id);
            if (orderIdsList.length > 0) {
                const { data: v2Products } = await supabaseAdmin
                    .from('order_products')
                    .select(`
                        id, order_id, product_code, name, type, images, status, sales_step_data,
                        services:order_product_services(
                            id, item_name, item_type, unit_price, technician_id,
                            service:services(id, image, code),
                            technician:users(id, name),
                            order_item_steps(id, started_at, estimated_duration, status, step_order)
                        )
                    `)
                    .in('order_id', orderIdsList);

                const allServiceIds: string[] = [];
                for (const p of v2Products || []) {
                    for (const s of p.services || []) {
                        if (s?.id) allServiceIds.push(s.id);
                    }
                }
                let techniciansByService: Record<string, Array<{ technician_id: string; technician: { id: string; name: string } }>> = {};
                if (allServiceIds.length > 0) {
                    const { data: techRows } = await supabaseAdmin
                        .from('order_product_service_technicians')
                        .select('order_product_service_id, technician_id, technician:users!order_product_service_technicians_technician_id_fkey(id, name)')
                        .in('order_product_service_id', allServiceIds);
                    for (const row of techRows || []) {
                        const svcId = (row as any).order_product_service_id;
                        const tech = (row as any).technician;
                        if (!techniciansByService[svcId]) techniciansByService[svcId] = [];
                        techniciansByService[svcId].push({
                            technician_id: (row as any).technician_id,
                            technician: tech ? { id: tech.id, name: tech.name } : { id: (row as any).technician_id, name: 'N/A' },
                        });
                    }
                }

                for (const order of orders || []) {
                    const opList = (v2Products || []).filter((p: { order_id: string }) => p.order_id === order.id);
                    if (opList.length > 0) {
                        const v2Items: any[] = [];
                        for (const product of opList) {
                            v2Items.push({
                                id: product.id,
                                order_id: order.id,
                                item_name: product.name,
                                item_type: 'product',
                                quantity: 1,
                                unit_price: 0,
                                total_price: 0,
                                status: product.status || 'pending',
                                item_code: product.product_code,
                                product: { id: product.id, image: product.images?.[0] || null, code: product.product_code },
                                is_customer_item: true,
                                sales_step_data: product.sales_step_data || null,
                            });
                            if (product.services?.length) {
                                for (const s of product.services as any[]) {
                                    const svc = s.service;
                                    const techList = techniciansByService[s.id] || [];
                                    const tech = s.technician || (techList[0]?.technician);
                                    const techListFinal = techList.length > 0
                                        ? techList
                                        : tech ? [{ technician_id: tech.id, technician: { id: tech.id, name: tech.name } }] : [];
                                    v2Items.push({
                                        id: s.id,
                                        order_id: order.id,
                                        item_name: `${s.item_name} (${product.name})`,
                                        item_type: s.item_type,
                                        quantity: 1,
                                        unit_price: s.unit_price,
                                        total_price: s.unit_price,
                                        status: s.status,
                                        technician_id: s.technician_id,
                                        technician: tech ? { id: tech.id, name: tech.name } : null,
                                        technicians: techListFinal.length ? techListFinal : undefined,
                                        service: svc ? { id: svc.id, image: svc.image, code: svc.code } : null,
                                        package: s.package,
                                        product: { id: product.id, image: product.images?.[0] || null, code: product.product_code },
                                        is_customer_item: true,
                                        sales_step_data: product.sales_step_data,
                                        order_item_steps: s.order_item_steps || [],
                                    });
                                }
                            }
                        }
                        order.items = [...(order.items || []), ...v2Items];
                    }
                }
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
        items:order_items(
            id, order_id, product_id, service_id, item_type, item_name, quantity, unit_price, total_price, item_code, technician_id, sales_step_data,
            product:products(id, image, code),
            service:services(id, image, code),
            technician:users!order_items_technician_id_fkey(id, name),
            order_item_steps(id, started_at, estimated_duration, status, step_order)
        )
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

        // Merge V2 order_products into items for each order
        const orderIdsList = (orders || []).map((o: { id: string }) => o.id);
        if (orderIdsList.length > 0) {
            const { data: v2Products } = await supabaseAdmin
                .from('order_products')
                .select(`
                    id, order_id, product_code, name, type, images, status, sales_step_data,
                    services:order_product_services(
                        id, item_name, item_type, unit_price, technician_id,
                        service:services(id, image, code),
                        technician:users(id, name),
                        order_item_steps(id, started_at, estimated_duration, status, step_order)
                    )
                `)
                .in('order_id', orderIdsList);

            // Fetch all technicians from order_product_service_technicians (separate query - reliable)
            const allServiceIds: string[] = [];
            for (const p of v2Products || []) {
                for (const s of p.services || []) {
                    if (s?.id) allServiceIds.push(s.id);
                }
            }
            let techniciansByService: Record<string, Array<{ technician_id: string; technician: { id: string; name: string } }>> = {};
            if (allServiceIds.length > 0) {
                const { data: techRows } = await supabaseAdmin
                    .from('order_product_service_technicians')
                    .select('order_product_service_id, technician_id, technician:users!order_product_service_technicians_technician_id_fkey(id, name)')
                    .in('order_product_service_id', allServiceIds);
                for (const row of techRows || []) {
                    const svcId = (row as any).order_product_service_id;
                    const tech = (row as any).technician;
                    if (!techniciansByService[svcId]) techniciansByService[svcId] = [];
                    techniciansByService[svcId].push({
                        technician_id: (row as any).technician_id,
                        technician: tech ? { id: tech.id, name: tech.name } : { id: (row as any).technician_id, name: 'N/A' },
                    });
                }
            }

            for (const order of orders || []) {
                const opList = (v2Products || []).filter((p: { order_id: string }) => p.order_id === order.id);
                if (opList.length > 0) {
                    const v2Items: any[] = [];
                    for (const product of opList) {
                        v2Items.push({
                            id: product.id,
                            order_id: order.id,
                            item_name: product.name,
                            item_type: 'product',
                            quantity: 1,
                            unit_price: 0,
                            total_price: 0,
                            status: product.status || 'pending',
                            item_code: product.product_code,
                            product: { id: product.id, image: product.images?.[0] || null, code: product.product_code },
                            is_customer_item: true,
                            sales_step_data: product.sales_step_data || null,
                        });
                        if (product.services?.length) {
                            for (const s of product.services as any[]) {
                                const svc = s.service;
                                const techList = techniciansByService[s.id] || [];
                                const tech = s.technician || (techList[0]?.technician);
                                const techListFinal = techList.length > 0
                                    ? techList
                                    : tech ? [{ technician_id: tech.id, technician: { id: tech.id, name: tech.name } }] : [];
                                v2Items.push({
                                    id: s.id,
                                    order_id: order.id,
                                    item_name: `${s.item_name} (${product.name})`,
                                    item_type: s.item_type,
                                    quantity: 1,
                                    unit_price: s.unit_price,
                                    total_price: s.unit_price,
                                    status: s.status,
                                    technician_id: s.technician_id,
                                    technician: tech ? { id: tech.id, name: tech.name } : null,
                                    technicians: techListFinal.length ? techListFinal : undefined,
                                    service: svc ? { id: svc.id, image: svc.image, code: svc.code } : null,
                                    package: s.package,
                                    product: { id: product.id, image: product.images?.[0] || null, code: product.product_code },
                                    is_customer_item: true,
                                    sales_step_data: product.sales_step_data,
                                    order_item_steps: s.order_item_steps || [],
                                });
                            }
                        }
                    }
                    order.items = [...(order.items || []), ...v2Items];
                }
            }
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

        // Fetch order with Sale Items (order_items table)
        let query = supabaseAdmin
            .from('orders')
            .select(`
        *,
        customer:customers(id, name, phone, email, address),
        sales_user:users!orders_sales_id_fkey(id, name),
        sale_items:order_items(
            *,
            sales_step_data,
            product:products(*),
            service:services(*),
            technicians:order_item_technicians(
                id,
                technician_id,
                commission,
                assigned_by,
                assigned_at,
                technician:users!order_item_technicians_technician_id_fkey(id, name)
            ),
            sales:order_item_sales(
                id,
                sale_id,
                commission,
                assigned_by,
                assigned_at,
                sale:users!order_item_sales_sale_id_fkey(id, name, avatar)
            )
        )
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

        // Rename sale_items for clarity in internal logic
        const saleItems = order.sale_items || [];
        delete order.sale_items; // We'll re-attach at the end

        // Fetch Customer Items (order_products and their services) - use order.id (UUID)
        const { data: customerItemsData, error: customerError } = await supabaseAdmin
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
                    ),
                    sales:order_product_service_sales(
                        id,
                        sale_id,
                        commission,
                        assigned_at,
                        sale:users!order_product_service_sales_sale_id_fkey(id, name, avatar)
                    )
                )
            `)
            .eq('order_id', order.id);

        const customerItems: any[] = [];
        const flatItems: any[] = [...saleItems];

        if (!customerError && customerItemsData && customerItemsData.length > 0) {
            for (const product of customerItemsData) {
                // Map to CustomerItem structure (includes product details and its services)
                const cItem = {
                    ...product,
                    is_customer_item: true
                };
                customerItems.push(cItem);

                // Add to flat items list for backward compatibility
                flatItems.push({
                    id: product.id,
                    order_id: order.id,
                    item_name: product.name,
                    item_type: 'product',
                    quantity: 1,
                    unit_price: 0,
                    total_price: 0,
                    status: product.status || 'pending',
                    item_code: product.product_code,
                    product: {
                        image: product.images?.[0] || null
                    },
                    is_customer_item: true,
                    product_type: product.type || null,
                    product_images: product.images || [],
                    product_brand: product.brand || null,
                    product_color: product.color || null,
                    product_size: product.size || null,
                    product_material: product.material || null,
                    product_condition_before: product.condition_before || null,
                    product_notes: product.notes || null,
                    sales_step_data: product.sales_step_data || null
                });

                if (product.services && product.services.length > 0) {
                    for (const s of product.services) {
                        let technicians = s.technicians || [];
                        let sales = s.sales || [];
                        if (technicians.length === 0 && s.technician_id) {
                            technicians = [{
                                technician_id: s.technician_id,
                                technician: s.technician,
                                commission: 0
                            }];
                        }

                        flatItems.push({
                            id: s.id,
                            order_id: order.id,
                            item_name: `${s.item_name} (${product.name})`,
                            item_type: s.item_type,
                            quantity: 1,
                            unit_price: s.unit_price,
                            total_price: s.unit_price,
                            status: s.status,
                            technician_id: s.technician_id,
                            technician: s.technician,
                            technicians: technicians,
                            sales: sales,
                            service: s.service,
                            package: s.package,
                            started_at: s.started_at,
                            completed_at: s.completed_at,
                            assigned_at: s.assigned_at,
                            is_customer_item: true, // Mark as customer item for grouping in OrderDetailPage
                            sales_step_data: product.sales_step_data, // Inherit from parent product
                            product: {
                                id: product.id,
                                image: product.images?.[0] || null
                            }
                        });
                    }
                }
            }
        }

        order.customer_items = customerItems;
        order.sale_items = saleItems;
        order.items = flatItems;

        // Attach latest extension request
        const { data: extRequest } = await supabaseAdmin
            .from('order_extension_requests')
            .select('*')
            .eq('order_id', order.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        (order as any).extension_request = extRequest || null;

        // Attach accessories and partners for each flat item
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

// Create order (Unified endpoint: Customer Items + Sale Items)
router.post('/', authenticate, requireSale, async (req: AuthenticatedRequest, res, next) => {
    try {
        const {
            customer_id,
            customer_items, // New name
            products, // Deprecated name (alias for customer_items)
            sale_items, // New name
            add_on_products, // Deprecated name (alias for sale_items)
            notes,
            discount,
            discount_type,
            discount_value,
            surcharges,
            paid_amount,
            status,
            due_at
        } = req.body;

        const finalCustomerItems = customer_items || products;
        const finalSaleItems = sale_items || add_on_products;

        if (!customer_id || (!finalCustomerItems && !finalSaleItems)) {
            throw new ApiError('Khách hàng và sản phẩm là bắt buộc', 400);
        }

        // 1. Calculate Subtotals
        let subtotalFromCustomerItems = 0;
        if (finalCustomerItems && Array.isArray(finalCustomerItems)) {
            for (const item of finalCustomerItems) {
                if (item.services && Array.isArray(item.services)) {
                    for (const service of item.services) {
                        subtotalFromCustomerItems += Number(service.price) || 0;
                    }
                }
            }
        }

        let subtotalFromSaleItems = 0;
        if (finalSaleItems && Array.isArray(finalSaleItems)) {
            for (const item of finalSaleItems) {
                const qty = Math.max(1, Number(item.quantity) || 1);
                const price = Number(item.unit_price || item.price) || 0;
                subtotalFromSaleItems += price * qty;
            }
        }

        const subtotal = subtotalFromCustomerItems + subtotalFromSaleItems;
        const discountAmount = Number(discount) || 0;

        let totalSurchargesAmount = 0;
        if (surcharges && Array.isArray(surcharges)) {
            for (const surcharge of surcharges) {
                totalSurchargesAmount += Number(surcharge.amount) || 0;
            }
        }

        const totalAmount = Math.max(0, subtotal - discountAmount + totalSurchargesAmount);
        const paidAmountValue = Number(paid_amount) || 0;
        const remainingDebt = Math.max(0, totalAmount - paidAmountValue);

        // 2. Generate Order Code
        const orderCode = await generateNextOrderCode();

        // 3. Create Order
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
                status: status || 'in_progress',
                notes,
                due_at: due_at || null,
                created_by: req.user!.id,
            })
            .select()
            .single();

        if (orderError) {
            throw new ApiError('Lỗi khi tạo đơn hàng: ' + orderError.message, 500);
        }

        // 4. Create Customer Items (order_products) and their services
        const createdCustomerItems = [];
        if (finalCustomerItems && Array.isArray(finalCustomerItems)) {
            for (let i = 0; i < finalCustomerItems.length; i++) {
                const item = finalCustomerItems[i];
                const productCode = generateProductCode(orderCode, i);

                const { data: orderProduct, error: productError } = await supabaseAdmin
                    .from('order_products')
                    .insert({
                        order_id: order.id,
                        product_code: productCode,
                        name: item.name,
                        type: item.type,
                        brand: item.brand,
                        color: item.color,
                        size: item.size,
                        material: item.material,
                        condition_before: item.condition_before,
                        images: item.images || [],
                        notes: item.notes,
                        status: 'pending'
                    })
                    .select()
                    .single();

                if (productError) {
                    console.error('Error creating customer item:', productError);
                    continue;
                }

                if (item.services && Array.isArray(item.services)) {
                    const servicesPayload = item.services.map((svc: any) => {
                        const hasTechs = svc.technicians && svc.technicians.length > 0;
                        const techId = svc.technician_id || (hasTechs ? svc.technicians[0].technician_id : null);

                        return {
                            order_product_id: orderProduct.id,
                            service_id: svc.type === 'service' ? (svc.id || svc.service_id) : null,
                            package_id: svc.type === 'package' ? (svc.id || svc.package_id) : null,
                            item_name: svc.name,
                            item_type: svc.type,
                            unit_price: Number(svc.price) || 0,
                            technician_id: techId,
                            status: hasTechs ? 'assigned' : 'pending',
                            assigned_at: hasTechs ? new Date().toISOString() : null,
                            _technicians: svc.technicians || [], // temp metadata
                            _sales: svc.sales || [] // temp metadata
                        };
                    });

                    const { data: createdSvcs, error: svcsError } = await supabaseAdmin
                        .from('order_product_services')
                        .insert(servicesPayload.map((s: any) => {
                            const { _technicians, ...data } = s;
                            return data;
                        }))
                        .select();

                    if (!svcsError && createdSvcs) {
                        // Handle multiple technicians
                        const techAssignments: any[] = [];
                        for (let j = 0; j < createdSvcs.length; j++) {
                            const createdSvc = createdSvcs[j];
                            const originalSvc = servicesPayload[j];
                            const techs = originalSvc._technicians || [];
                            for (const t of techs) {
                                techAssignments.push({
                                    order_product_service_id: createdSvc.id,
                                    technician_id: t.technician_id,
                                    commission: t.commission || 0,
                                    assigned_by: req.user!.id,
                                    assigned_at: new Date().toISOString(),
                                    status: 'assigned'
                                });
                            }
                        }

                        if (techAssignments.length > 0) {
                            await supabaseAdmin.from('order_product_service_technicians').insert(techAssignments);
                        }

                        // Handle multiple salespersons
                        const saleAssignments: any[] = [];
                        for (let j = 0; j < createdSvcs.length; j++) {
                            const createdSvc = createdSvcs[j];
                            const originalSvc = servicesPayload[j];
                            const sales = originalSvc._sales || [];
                            for (const s of sales) {
                                saleAssignments.push({
                                    order_product_service_id: createdSvc.id,
                                    sale_id: s.sale_id || s.id,
                                    commission: s.commission || 0,
                                    assigned_by: req.user!.id,
                                    assigned_at: new Date().toISOString()
                                });
                            }
                        }

                        if (saleAssignments.length > 0) {
                            await supabaseAdmin.from('order_product_service_sales').insert(saleAssignments);
                        }

                        // Generate Workflow Steps for services
                        const itemSteps: any[] = [];
                        for (const createdSvc of createdSvcs) {
                            if (createdSvc.item_type === 'service' && createdSvc.service_id) {
                                const { data: sData } = await supabaseAdmin.from('services').select('workflow_id').eq('id', createdSvc.service_id).single();
                                if (sData?.workflow_id) {
                                    const { data: wSteps } = await supabaseAdmin.from('workflow_steps').select('*').eq('workflow_id', sData.workflow_id).order('step_order', { ascending: true });
                                    if (wSteps) {
                                        wSteps.forEach(ws => {
                                            itemSteps.push({
                                                order_product_service_id: createdSvc.id,
                                                workflow_step_id: ws.id,
                                                step_order: ws.step_order,
                                                step_name: ws.name || `Bước ${ws.step_order}`,
                                                department_id: ws.department_id,
                                                status: 'pending',
                                                estimated_duration: ws.estimated_duration
                                            });
                                        });
                                    }
                                }
                            }
                        }
                        if (itemSteps.length > 0) {
                            await supabaseAdmin.from('order_item_steps').insert(itemSteps);
                        }
                    }
                }

                createdCustomerItems.push({ ...orderProduct, qr_code: productCode });
            }
        }

        // 5. Create Sale Items (order_items table)
        if (finalSaleItems && Array.isArray(finalSaleItems) && finalSaleItems.length > 0) {
            const baseTime = Date.now().toString().slice(-8);
            const saleItemsPayload = finalSaleItems.map((itemValue: any, idxValue: number) => {
                const qValue = Math.max(1, Number(itemValue.quantity) || 1);
                const pValue = Number(itemValue.unit_price || itemValue.price) || 0;
                const totalValue = pValue * qValue;
                return {
                    order_id: order.id,
                    product_id: itemValue.product_id || itemValue.id || null, // Handle both catalog id and product_id
                    item_type: 'product',
                    item_name: itemValue.name || 'Sản phẩm bán kèm',
                    quantity: qValue,
                    unit_price: pValue,
                    total_price: totalValue,
                    item_code: `IT${baseTime}${idxValue.toString().padStart(2, '0')}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
                    status: 'pending'
                };
            });
            const { data: createdItems, error: itemsError } = await supabaseAdmin.from('order_items').insert(saleItemsPayload).select();

            if (!itemsError && createdItems) {
                const saleItemAssignments: any[] = [];
                for (let idx = 0; idx < createdItems.length; idx++) {
                    const createdItem = createdItems[idx];
                    const originalItem = finalSaleItems[idx];
                    const sales = originalItem.sales || [];
                    for (const s of sales) {
                        saleItemAssignments.push({
                            order_item_id: createdItem.id,
                            sale_id: s.sale_id || s.id,
                            commission: s.commission || 0,
                            assigned_by: req.user!.id,
                            assigned_at: new Date().toISOString()
                        });
                    }
                }
                if (saleItemAssignments.length > 0) {
                    await supabaseAdmin.from('order_item_sales').insert(saleItemAssignments);
                }
            }
        }

        // 6. Create Transaction record for payment
        if (paidAmountValue > 0) {
            const { data: lastTrans } = await supabaseAdmin.from('transactions').select('code').like('code', 'PT%').order('created_at', { ascending: false }).limit(1);
            let tCodeValue = 'PT000001';
            if (lastTrans && lastTrans.length > 0) {
                const lNum = parseInt(lastTrans[0].code.replace('PT', ''), 10);
                tCodeValue = `PT${String(lNum + 1).padStart(6, '0')}`;
            }

            await supabaseAdmin.from('transactions').insert({
                code: tCodeValue,
                type: 'income',
                category: 'Thanh toán đơn hàng',
                amount: paidAmountValue,
                payment_method: 'cash',
                notes: `Thanh toán tại chỗ khi tạo đơn - ${orderCode}`,
                date: new Date().toISOString().split('T')[0],
                order_id: order.id,
                order_code: orderCode,
                status: 'approved',
                created_by: req.user!.id,
                approved_by: req.user!.id,
                approved_at: new Date().toISOString(),
            });
        }

        res.status(201).json({
            status: 'success',
            data: {
                order,
                customer_items: createdCustomerItems
            },
            message: `Đã tạo đơn hàng thành công với ${createdCustomerItems.length} sản phẩm khách gửi.`
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

        if (existingOrder.status === 'after_sale' || existingOrder.status === 'cancelled') {
            throw new ApiError('Không thể cập nhật đơn hàng đã hoàn thành hoặc đã huỷ', 400);
        }

        // Recalculate totals
        let subtotal = 0;
        for (const item of items) {
            subtotal += (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
        }
        const discountAmount = Number(discount) || 0;
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

        // Separate items
        // items from EditOrderDialog currently might be a mix.
        // We only want to manage order_items (Sale Items/V1 style) here.
        // Customer Items (order_products) are managed elsewhere (or preserved for now).
        const saleItemsToInsert = items
            .filter((item: any) => !item.is_customer_item)
            .map((item: any) => {
                const totalPrice = (Number(item.quantity) || 1) * (Number(item.unit_price) || 0);
                const commissionSaleRate = Number(item.commission_sale) || 0;
                const commissionTechRate = Number(item.commission_tech) || 0;
                const commissionSaleAmount = Math.floor(totalPrice * commissionSaleRate / 100);
                const commissionTechAmount = Math.floor(totalPrice * commissionTechRate / 100);

                // Ensure item_id is a valid UUID for products/services if needed
                // If it's a random string or invalid, we should be careful.
                const product_id = item.type === 'product' ? item.item_id : null;
                const service_id = (item.type === 'service' || item.type === 'package') ? item.item_id : null;

                return {
                    order_id: id,
                    product_id,
                    service_id,
                    item_type: item.type,
                    item_name: item.name,
                    quantity: Number(item.quantity) || 1,
                    unit_price: Number(item.unit_price) || 0,
                    total_price: totalPrice,
                    technician_id: item.technician_id || null,
                    item_code: item.item_code || `IT${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
                    commission_sale_rate: commissionSaleRate,
                    commission_tech_rate: commissionTechRate,
                    commission_sale_amount: commissionSaleAmount,
                    commission_tech_amount: commissionTechAmount,
                    _sales: item.sales || [] // temp metadata
                };
            });

        // Delete only old Sale Items (those in order_items table)
        // Note: order_products are in a different table and won't be deleted by this.
        await supabaseAdmin
            .from('order_items')
            .delete()
            .eq('order_id', id);

        if (saleItemsToInsert.length > 0) {
            const { data: createdItems, error: itemsError } = await supabaseAdmin
                .from('order_items')
                .insert(saleItemsToInsert.map(({ _sales, ...data }: any) => data))
                .select();

            if (itemsError || !createdItems) {
                console.error('Error updating sale items:', itemsError);
                throw new ApiError('Lỗi khi cập nhật danh sách sản phẩm bán kèm', 500);
            }

            // Insert Sales assignments
            const saleItemAssignments: any[] = [];
            for (let idx = 0; idx < createdItems.length; idx++) {
                const createdItem = createdItems[idx];
                const originalItem = saleItemsToInsert[idx];
                const sales = originalItem._sales || [];
                for (const s of sales) {
                    saleItemAssignments.push({
                        order_item_id: createdItem.id,
                        sale_id: s.sale_id || s.id,
                        commission: s.commission || 0,
                        assigned_by: req.user!.id,
                        assigned_at: new Date().toISOString()
                    });
                }
            }
            if (saleItemAssignments.length > 0) {
                await supabaseAdmin.from('order_item_sales').insert(saleItemAssignments);
            }
        }

        // Fetch updated order with items
        const { data: updatedOrder } = await supabaseAdmin
            .from('orders')
            .select(`
                *,
                customer:customers(id, name, phone, email),
                sales_user:users!orders_sales_id_fkey(id, name),
                items:order_items(
                    id, order_id, product_id, service_id, item_type, item_name, quantity, unit_price, total_price,
                    sales:order_item_sales(
                        id, sale_id, commission, assigned_at,
                        sale:users!order_item_sales_sale_id_fkey(id, name, avatar)
                    )
                )
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

router.put('/:id/full', authenticate, requireSale, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { customer_id, customer_items, sale_items, notes, discount, discount_type, discount_value, surcharges, paid_amount, due_at } = req.body;

        // 1. Check if order exists
        const { data: existingOrder } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('id', id)
            .single();

        if (!existingOrder) {
            throw new ApiError('Không tìm thấy đơn hàng', 404);
        }

        // 2. Calculate totals
        let subtotal = 0;
        if (customer_items && Array.isArray(customer_items)) {
            for (const item of customer_items) {
                if (item.services && Array.isArray(item.services)) {
                    for (const svc of item.services) {
                        subtotal += Number(svc.price) || 0;
                    }
                }
            }
        }
        if (sale_items && Array.isArray(sale_items)) {
            for (const item of sale_items) {
                subtotal += (Number(item.quantity) || 1) * (Number(item.unit_price) || 0);
            }
        }

        const discountAmount = Number(discount) || 0;
        const totalAmount = subtotal - discountAmount;

        // 3. Update main order record
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .update({
                customer_id,
                subtotal,
                discount: discountAmount,
                discount_type,
                discount_value,
                total_amount: totalAmount,
                notes,
                paid_amount: Number(paid_amount) || 0,
                remaining_amount: totalAmount - (Number(paid_amount) || 0),
                due_at: due_at || null,
                surcharges: surcharges || [],
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (orderError) {
            throw new ApiError('Lỗi khi cập nhật đơn hàng: ' + orderError.message, 500);
        }

        // 4. Clean up old highly-dependent data
        // Order of deletion to respect FKs
        const { data: oldProducts } = await supabaseAdmin.from('order_products').select('id').eq('order_id', id);
        if (oldProducts && oldProducts.length > 0) {
            const productIds = oldProducts.map(p => p.id);
            const { data: oldSvcs } = await supabaseAdmin.from('order_product_services').select('id').in('order_product_id', productIds);
            if (oldSvcs && oldSvcs.length > 0) {
                const svcIds = oldSvcs.map(s => s.id);
                await supabaseAdmin.from('order_product_service_technicians').delete().in('order_product_service_id', svcIds);
                await supabaseAdmin.from('order_item_steps').delete().in('order_product_service_id', svcIds);
                await supabaseAdmin.from('order_product_services').delete().in('id', svcIds);
            }
            await supabaseAdmin.from('order_products').delete().eq('order_id', id);
        }
        await supabaseAdmin.from('order_items').delete().eq('order_id', id);

        // 5. Re-insert Customer Items (logic similar to POST /orders)
        if (customer_items && Array.isArray(customer_items)) {
            const orderCode = order.order_code;
            for (let i = 0; i < customer_items.length; i++) {
                const item = customer_items[i];
                const productCode = `${orderCode}-${i + 1}`;

                const { data: orderProduct, error: pError } = await supabaseAdmin
                    .from('order_products')
                    .insert({
                        order_id: id,
                        product_code: productCode,
                        name: item.name,
                        type: item.type,
                        brand: item.brand,
                        color: item.color,
                        size: item.size,
                        material: item.material,
                        condition_before: item.condition_before,
                        images: item.images || [],
                        notes: item.notes,
                        status: 'pending'
                    })
                    .select()
                    .single();

                if (pError || !orderProduct) continue;

                if (item.services && Array.isArray(item.services)) {
                    for (const svc of item.services) {
                        const hasTechs = svc.technicians && svc.technicians.length > 0;
                        const techId = hasTechs ? svc.technicians[0].technician_id : null;

                        const { data: createdSvc, error: sError } = await supabaseAdmin
                            .from('order_product_services')
                            .insert({
                                order_product_id: orderProduct.id,
                                service_id: svc.type === 'service' ? svc.id : null,
                                package_id: svc.type === 'package' ? svc.id : null,
                                item_name: svc.name,
                                item_type: svc.type,
                                unit_price: Number(svc.price) || 0,
                                technician_id: techId,
                                status: hasTechs ? 'assigned' : 'pending',
                                assigned_at: hasTechs ? new Date().toISOString() : null,
                            })
                            .select()
                            .single();

                        if (!sError && createdSvc) {
                            // Technicians
                            if (hasTechs) {
                                const techPayload = svc.technicians.map((t: any) => ({
                                    order_product_service_id: createdSvc.id,
                                    technician_id: t.technician_id,
                                    commission: t.commission || 0,
                                    assigned_by: req.user!.id,
                                    assigned_at: new Date().toISOString(),
                                    status: 'assigned'
                                }));
                                await supabaseAdmin.from('order_product_service_technicians').insert(techPayload);
                            }

                            // Sales
                            const hasSales = svc.sales && svc.sales.length > 0;
                            if (hasSales) {
                                const salePayload = svc.sales.map((s: any) => ({
                                    order_product_service_id: createdSvc.id,
                                    sale_id: s.sale_id || s.id,
                                    commission: s.commission || 0,
                                    assigned_by: req.user!.id,
                                    assigned_at: new Date().toISOString()
                                }));
                                await supabaseAdmin.from('order_product_service_sales').insert(salePayload);
                            }

                            // Workflow steps
                            if (svc.type === 'service' && svc.id) {
                                const { data: sData } = await supabaseAdmin.from('services').select('workflow_id').eq('id', svc.id).single();
                                if (sData?.workflow_id) {
                                    const { data: wSteps } = await supabaseAdmin.from('workflow_steps').select('*').eq('workflow_id', sData.workflow_id).order('step_order', { ascending: true });
                                    if (wSteps) {
                                        const itemSteps = wSteps.map(ws => ({
                                            order_product_service_id: createdSvc.id,
                                            workflow_step_id: ws.id,
                                            step_order: ws.step_order,
                                            step_name: ws.name || `Bước ${ws.step_order}`,
                                            department_id: ws.department_id,
                                            status: 'pending',
                                            estimated_duration: ws.estimated_duration
                                        }));
                                        await supabaseAdmin.from('order_item_steps').insert(itemSteps);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 6. Re-insert Sale Items
        if (sale_items && Array.isArray(sale_items) && sale_items.length > 0) {
            const saleItemsPayload = sale_items.map(a => ({
                order_id: id,
                product_id: a.product_id,
                item_type: 'product',
                item_name: a.name,
                quantity: Number(a.quantity) || 1,
                unit_price: Number(a.unit_price) || 0,
                total_price: (Number(a.quantity) || 1) * (Number(a.unit_price) || 0),
                item_code: a.item_code || `IT${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
            }));
            const { data: createdItems, error: itemsError } = await supabaseAdmin.from('order_items').insert(saleItemsPayload).select();

            if (!itemsError && createdItems) {
                const saleItemAssignments: any[] = [];
                for (let idx = 0; idx < createdItems.length; idx++) {
                    const createdItem = createdItems[idx];
                    const originalItem = sale_items[idx];
                    const sales = originalItem.sales || [];
                    for (const s of sales) {
                        saleItemAssignments.push({
                            order_item_id: createdItem.id,
                            sale_id: s.sale_id || s.id,
                            commission: s.commission || 0,
                            assigned_by: req.user!.id,
                            assigned_at: new Date().toISOString()
                        });
                    }
                }
                if (saleItemAssignments.length > 0) {
                    await supabaseAdmin.from('order_item_sales').insert(saleItemAssignments);
                }
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

const CARE_WARRANTY_FLOWS = ['warranty', 'care'];
const CARE_WARRANTY_STAGES = ['war1', 'war2', 'war3', 'care6', 'care12', 'care-custom'];

// Update order (partial: due_at, after-sale data, care_warranty)
router.patch('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        let oldCareFlow: string | null | undefined;
        let oldCareStage: string | null | undefined;
        let oldAfterSaleStage: string | null | undefined;
        const {
            due_at,
            completion_photos,
            debt_checked,
            debt_checked_notes,
            debt_checked_by_name,
            aftersale_receiver_name,
            packaging_photos,
            delivery_carrier,
            delivery_address,
            delivery_self_pickup,
            delivery_type,
            delivery_code,
            delivery_fee,
            aftersale_return_user_name,
            delivery_notes,
            hd_sent,
            feedback_requested,
            care_warranty_flow,
            care_warranty_stage,
            after_sale_stage,
        } = req.body;

        if (care_warranty_flow !== undefined || care_warranty_stage !== undefined || after_sale_stage !== undefined) {
            const { data: current } = await supabaseAdmin
                .from('orders')
                .select('care_warranty_flow, care_warranty_stage, after_sale_stage')
                .eq('id', id)
                .single();
            if (care_warranty_flow !== undefined || care_warranty_stage !== undefined) {
                oldCareFlow = (current as any)?.care_warranty_flow ?? null;
                oldCareStage = (current as any)?.care_warranty_stage ?? null;
            }
            if (after_sale_stage !== undefined) {
                oldAfterSaleStage = (current as any)?.after_sale_stage ?? null;
            }
        }

        const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (due_at !== undefined) updatePayload.due_at = due_at || null;
        if (completion_photos !== undefined) updatePayload.completion_photos = Array.isArray(completion_photos) ? completion_photos : [];
        if (debt_checked !== undefined) {
            updatePayload.debt_checked = !!debt_checked;
            updatePayload.debt_checked_at = !!debt_checked ? new Date().toISOString() : null;
        }
        if (debt_checked_notes !== undefined) updatePayload.debt_checked_notes = debt_checked_notes ?? null;
        if (debt_checked_by_name !== undefined) updatePayload.debt_checked_by_name = debt_checked_by_name ?? null;
        if (aftersale_receiver_name !== undefined) updatePayload.aftersale_receiver_name = aftersale_receiver_name ?? null;
        if (packaging_photos !== undefined) updatePayload.packaging_photos = Array.isArray(packaging_photos) ? packaging_photos : [];
        if (delivery_carrier !== undefined) updatePayload.delivery_carrier = delivery_carrier ?? null;
        if (delivery_address !== undefined) updatePayload.delivery_address = delivery_address ?? null;
        if (delivery_self_pickup !== undefined) updatePayload.delivery_self_pickup = !!delivery_self_pickup;
        if (delivery_type !== undefined) updatePayload.delivery_type = delivery_type ?? 'ship';
        if (delivery_code !== undefined) updatePayload.delivery_code = delivery_code ?? null;
        if (delivery_fee !== undefined) updatePayload.delivery_fee = Number(delivery_fee) || 0;
        if (aftersale_return_user_name !== undefined) updatePayload.aftersale_return_user_name = aftersale_return_user_name ?? null;
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
        if (after_sale_stage !== undefined) {
            updatePayload.after_sale_stage = after_sale_stage || null;
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

        if (after_sale_stage !== undefined && oldAfterSaleStage !== after_sale_stage) {
            try {
                // Determine previous stage from log if needed, or just use oldAfterSaleStage
                await supabaseAdmin.from('order_after_sale_stage_log').insert({
                    order_id: id,
                    from_stage: oldAfterSaleStage ?? null,
                    to_stage: after_sale_stage,
                    created_by: userId ?? null
                });
            } catch (logErr) {
                console.error('order_after_sale_stage_log insert error:', logErr);
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

        const validStatuses = ['before_sale', 'in_progress', 'done', 'after_sale', 'cancelled'];
        if (!validStatuses.includes(status)) {
            throw new ApiError('Trạng thái không hợp lệ', 400);
        }

        // When moving to in_progress: set confirmed_at only on first time (do not overwrite)
        let confirmedAtPayload: { confirmed_at?: string } = {};
        if (status === 'in_progress') {
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
                ...(status === 'after_sale' && { completed_at: new Date().toISOString() }),
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

        // Check for auto-completion (Paid + All Services Done)
        await checkAndCompleteOrder(id);

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

        if (order?.status !== 'before_sale') {
            throw new ApiError('Chỉ có thể xóa đơn hàng ở trạng thái Before Sale', 400);
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
