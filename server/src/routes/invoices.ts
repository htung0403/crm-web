import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireAccountant } from '../middleware/auth.js';
import { syncOrderPayment } from '../utils/orderHelper.js';
import { processInvoicePayment } from '../utils/billingHelper.js';


const router = Router();

// Disable ETag for this router to ensure fresh data during refactor
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

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
        order:orders(*, items:order_items(*), products:order_products(*, services:order_product_services(*))),
        created_user:users!invoices_created_by_fkey(id, name)
      `)
            .eq('id', id)
            .single();

        if (error || !invoice) {
            throw new ApiError('Không tìm thấy hóa đơn', 404);
        }

        // 1. Fetch from payment_records (captured during order flow)
        const { data: pRecords } = await supabaseAdmin
            .from('payment_records')
            .select('*')
            .eq('order_id', invoice.order_id);

        // 2. Fetch from transactions (manual entry or linked)
        // We look for match in order_id OR matching order_code (e.g., HD10)
        let tQuery = supabaseAdmin
            .from('transactions')
            .select('*')
            .eq('status', 'approved');
            
        // Construct broad search criteria
        const searchTerms = [`order_id.eq.${invoice.order_id}`];
        const orderCode = invoice.order?.order_code || (invoice as any).order_code;
        
        if (orderCode) {
             searchTerms.push(`order_code.eq.${orderCode}`);
             searchTerms.push(`notes.ilike.%${orderCode}%`);
        }
        
        tQuery = tQuery.or(searchTerms.join(','));
        const { data: tRecords } = await tQuery;

        // 3. Merge and unify
        const unifiedPayments = new Map();

        // Process transactions first (official PT codes)
        (tRecords || []).forEach(t => {
            unifiedPayments.set(`t-${t.id}`, {
                id: t.id,
                code: t.code,
                amount: t.amount,
                payment_method: t.payment_method,
                created_at: t.created_at,
                status: t.status,
                description: t.notes || t.description || 'Thanh toán đơn hàng'
            });
        });

        // Add payment_records (order flow)
        (pRecords || []).forEach(p => {
            // Unify: Check if we already have this payment via transactions (match by amount and time)
            // If they are mostly the same, we update the transaction entries or skip
            const alreadyInTrans = (tRecords || []).some(t => 
                Math.abs(t.amount - p.amount) < 1 && 
                Math.abs(new Date(t.created_at).getTime() - new Date(p.created_at).getTime()) < 300000
            );
            
            if (!alreadyInTrans) {
                const pId = `p-${p.id}`;
                unifiedPayments.set(pId, {
                    id: p.id,
                    code: p.invoice_code || `PT-ORD-${p.id.slice(0, 4).toUpperCase()}`,
                    amount: p.amount,
                    payment_method: p.payment_method,
                    created_at: p.created_at,
                    status: p.transaction_status || 'approved',
                    description: p.content || p.notes || 'Thanh toán đơn hàng'
                });
            }
        });

        (invoice as any).transactions = Array.from(unifiedPayments.values())
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        console.log(`[Invoices] Unified Debug for ${invoice.invoice_code}:`, {
            order_id: invoice.order_id,
            order_code: orderCode,
            pRecords_count: (pRecords || []).length,
            tRecords_count: (tRecords || []).length,
            final_count: invoice.transactions.length
        });

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
        const { order_id, payment_method, notes, order_item_ids, order_product_service_ids } = req.body;


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
        const amount = Number(req.body.amount);
        const subtotal = amount || order.subtotal;
        const total_amount = amount || order.total_amount;
        const discount = amount ? 0 : order.discount;

        const { data: invoice, error } = await supabaseAdmin
            .from('invoices')
            .insert({
                invoice_code: invoiceCode,
                order_id,
                customer_id: order.customer_id,
                subtotal,
                discount,
                total_amount,
                payment_method: payment_method || 'cash',
                status: 'draft',
                notes,
                order_item_ids: order_item_ids || [],
                order_product_service_ids: order_product_service_ids || [],
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

        // NOTE: Commission recording moved to orderHelper.ts (triggered when order status changes to 'done')
        // to avoid double-counting and ensure all services are finished.
        // to avoid double-counting and ensure all services are finished.
        if (status === 'paid') {
            await processInvoicePayment(id);
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
// Final Reload for Log 3
