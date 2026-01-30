import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireAccountant } from '../middleware/auth.js';

const router = Router();

// Get all invoices
router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { status, customer_id, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let query = supabaseAdmin
            .from('invoices')
            .select(`
        *,
        customer:customers(id, name, phone, email),
        order:orders(id, order_code),
        created_user:users!invoices_created_by_fkey(id, name)
      `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (status) query = query.eq('status', status);
        if (customer_id) query = query.eq('customer_id', customer_id);

        const { data: invoices, error, count } = await query;

        if (error) {
            throw new ApiError('Lỗi khi lấy danh sách hóa đơn', 500);
        }

        res.json({
            status: 'success',
            data: {
                invoices,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: count || 0,
                }
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get invoice by ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { data: invoice, error } = await supabaseAdmin
            .from('invoices')
            .select(`
        *,
        customer:customers(*),
        order:orders(*, items:order_items(*)),
        created_user:users!invoices_created_by_fkey(id, name)
      `)
            .eq('id', id)
            .single();

        if (error || !invoice) {
            throw new ApiError('Không tìm thấy hóa đơn', 404);
        }

        res.json({
            status: 'success',
            data: { invoice },
        });
    } catch (error) {
        next(error);
    }
});

// Create invoice from order
router.post('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { order_id, payment_method, notes } = req.body;

        if (!order_id) {
            throw new ApiError('Đơn hàng là bắt buộc', 400);
        }

        // Lấy thông tin đơn hàng
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('*, customer:customers(*)')
            .eq('id', order_id)
            .single();

        if (orderError || !order) {
            throw new ApiError('Không tìm thấy đơn hàng', 404);
        }

        // Tạo mã hóa đơn
        const invoiceCode = `HD${Date.now().toString().slice(-8)}`;

        // Tạo hóa đơn
        const { data: invoice, error } = await supabaseAdmin
            .from('invoices')
            .insert({
                invoice_code: invoiceCode,
                order_id,
                customer_id: order.customer_id,
                subtotal: order.subtotal,
                discount: order.discount,
                total_amount: order.total_amount,
                payment_method: payment_method || 'cash',
                status: 'draft',
                notes,
                created_by: req.user!.id,
            })
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi tạo hóa đơn: ' + error.message, 500);
        }

        res.status(201).json({
            status: 'success',
            data: { invoice },
        });
    } catch (error) {
        next(error);
    }
});

// Update invoice status
router.patch('/:id/status', authenticate, requireAccountant, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['draft', 'pending', 'paid', 'cancelled'];
        if (!validStatuses.includes(status)) {
            throw new ApiError('Trạng thái không hợp lệ', 400);
        }

        const updateData: Record<string, any> = {
            status,
            updated_at: new Date().toISOString(),
        };

        if (status === 'paid') {
            updateData.paid_at = new Date().toISOString();
        }

        const { data: invoice, error } = await supabaseAdmin
            .from('invoices')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi cập nhật hóa đơn', 500);
        }

        // Nếu thanh toán, tính hoa hồng
        if (status === 'paid') {
            // Lấy đơn hàng để tính hoa hồng
            const { data: order } = await supabaseAdmin
                .from('orders')
                .select('sales_id, total_amount')
                .eq('id', invoice.order_id)
                .single();

            if (order) {
                // Tạo bản ghi hoa hồng cho nhân viên sales (5% mặc định)
                const commissionRate = 0.05;
                const commissionAmount = order.total_amount * commissionRate;

                await supabaseAdmin
                    .from('commissions')
                    .insert({
                        user_id: order.sales_id,
                        invoice_id: invoice.id,
                        commission_type: 'product',
                        amount: commissionAmount,
                        percentage: commissionRate * 100,
                        base_amount: order.total_amount,
                        status: 'pending'
                    });
            }

            // ===== TECHNICIAN COMMISSION RECORDING =====
            console.log('[Invoice Paid] Recording technician commissions for order:', invoice.order_id);

            // Get all V2 products and their services for this order
            const { data: orderProducts, error: opError } = await supabaseAdmin
                .from('order_products')
                .select(`
                    id,
                    order_product_services (
                        id,
                        item_name,
                        unit_price,
                        technicians:order_product_service_technicians (
                            technician_id,
                            commission
                        )
                    )
                `)
                .eq('order_id', invoice.order_id);

            console.log('[Invoice Paid] Order products found:', orderProducts?.length || 0, opError ? `Error: ${opError.message}` : '');

            if (orderProducts) {
                for (const product of orderProducts) {
                    const services = product.order_product_services || [];
                    console.log(`[Invoice Paid] Product ${product.id} has ${services.length} services`);

                    for (const service of services as any[]) {
                        const technicians = service.technicians || [];
                        const servicePrice = service.unit_price || 0;
                        console.log(`[Invoice Paid] Service ${service.id} (${service.item_name}) - price: ${servicePrice}, technicians: ${technicians.length}`);

                        for (const tech of technicians) {
                            console.log(`[Invoice Paid] Technician ${tech.technician_id} - commission: ${tech.commission}%`);

                            if (tech.commission && tech.commission > 0) {
                                const techCommission = (servicePrice * tech.commission) / 100;

                                const { error: insertError } = await supabaseAdmin
                                    .from('commissions')
                                    .insert({
                                        user_id: tech.technician_id,
                                        invoice_id: invoice.id,
                                        commission_type: 'service',
                                        amount: techCommission,
                                        percentage: tech.commission,
                                        base_amount: servicePrice,
                                        status: 'pending'
                                    });

                                if (insertError) {
                                    console.error(`[Invoice Paid] Error inserting commission:`, insertError.message);
                                } else {
                                    console.log(`[Invoice Paid] Created commission: ${tech.technician_id} - ${techCommission} VND (${tech.commission}%)`);
                                }
                            }
                        }
                    }
                }
            }
            // ===== END TECHNICIAN COMMISSION =====
        }

        res.json({
            status: 'success',
            data: { invoice },
        });
    } catch (error) {
        next(error);
    }
});

export { router as invoicesRouter };
