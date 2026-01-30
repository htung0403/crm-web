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

// Get order by ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { data: order, error } = await supabaseAdmin
            .from('orders')
            .select(`
        *,
        customer:customers(id, name, phone, email, address),
        sales_user:users!orders_sales_id_fkey(id, name),
        items:order_items(*, product:products(*), service:services(*))
      `)
            .eq('id', id)
            .single();

        if (error || !order) {
            throw new ApiError('Không tìm thấy đơn hàng', 404);
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

        // Tạo technician tasks cho các dịch vụ đã phân công technician
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
