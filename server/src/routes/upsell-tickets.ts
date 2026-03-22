import { Router, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { fireWebhook } from '../utils/webhookNotifier.js';

const router = Router();

// Middleware to check for Admin or Manager
function requireAdminOrManager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'manager') {
        return next(new ApiError('Chỉ admin hoặc quản lý mới có quyền thực hiện hành động này', 403));
    }
    next();
}

router.use(authenticate);

// GET /api/upsell-tickets - List tickets
router.get('/', requireAdminOrManager, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('upsell_tickets')
            .select(`
                *,
                order:orders(id, order_code),
                sales_user:users!upsell_tickets_sales_id_fkey(id, name),
                customer:customers(id, name, phone)
            `)
            .order('created_at', { ascending: false });

        if (error) throw new ApiError('Không thể lấy danh sách ticket', 500);

        res.json({ status: 'success', data: data || [] });
    } catch (e) {
        next(e);
    }
});

// POST /api/upsell-tickets/:id/approve - Approve ticket
router.post('/:id/approve', requireAdminOrManager, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id: ticketId } = req.params;
        const userId = req.user!.id;

        // 1. Fetch Ticket
        const { data: ticket, error: ticketFetchError } = await supabaseAdmin
            .from('upsell_tickets')
            .select('*')
            .eq('id', ticketId)
            .single();

        if (ticketFetchError || !ticket) {
            throw new ApiError('Không tìm thấy ticket', 404);
        }

        if (ticket.status !== 'pending') {
            throw new ApiError('Ticket này đã được xử lý', 400);
        }

        const { order_id: id, data: upsellData } = ticket;
        const { customer_items, sale_items } = upsellData;

        // 2. Fetch Order
        const { data: order, error: orderFetchError } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('id', id)
            .single();

        if (orderFetchError || !order) {
            throw new ApiError('Không tìm thấy đơn hàng liên quan', 404);
        }

        if (order.status === 'cancelled') {
            throw new ApiError('Không thể upsell trên đơn hàng đã hủy', 400);
        }

        let totalIncrement = 0;

        // 3. Process Customer Items
        if (customer_items && Array.isArray(customer_items) && customer_items.length > 0) {
            const { count } = await supabaseAdmin
                .from('order_products')
                .select('*', { count: 'exact', head: true })
                .eq('order_id', id);

            let productIdx = (count || 0) + 1;

            for (const item of customer_items) {
                let orderProduct;
                if (item.order_product_id) {
                    const { data: existingProduct } = await supabaseAdmin
                        .from('order_products')
                        .select('*')
                        .eq('id', item.order_product_id)
                        .single();
                    orderProduct = existingProduct;
                } else {
                    const productCode = `${order.order_code}-${productIdx++}`;
                    const { data: newProduct } = await supabaseAdmin
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
                    orderProduct = newProduct;
                }

                if (orderProduct && item.services && Array.isArray(item.services)) {
                    for (const svc of item.services) {
                        const newPrice = Number(svc.price) || 0;

                        if (svc.id && svc.is_existing) {
                            // Update existing service price
                            const { data: oldSvc } = await supabaseAdmin
                                .from('order_product_services')
                                .select('unit_price')
                                .eq('id', svc.id)
                                .single();

                            if (oldSvc) {
                                totalIncrement += (newPrice - Number(oldSvc.unit_price || 0));
                                await supabaseAdmin
                                    .from('order_product_services')
                                    .update({ unit_price: newPrice })
                                    .eq('id', svc.id);
                            }
                        } else {
                            // Insert new service
                            totalIncrement += newPrice;

                            const hasTechs = svc.technicians && svc.technicians.length > 0;
                            const techId = hasTechs ? svc.technicians[0].technician_id : null;

                            const { data: createdSvc } = await supabaseAdmin
                                .from('order_product_services')
                                .insert({
                                    order_product_id: orderProduct.id,
                                    service_id: svc.type === 'service' ? svc.id : null,
                                    package_id: svc.type === 'package' ? svc.id : null,
                                    item_name: svc.name,
                                    item_type: svc.type,
                                    unit_price: newPrice,
                                    technician_id: techId,
                                    status: hasTechs ? 'assigned' : 'pending',
                                    assigned_at: hasTechs ? new Date().toISOString() : null,
                                })
                                .select()
                                .single();

                            if (createdSvc) {
                                if (hasTechs) {
                                    const techPayload = svc.technicians.map((t: any) => ({
                                        order_product_service_id: createdSvc.id,
                                        technician_id: t.technician_id,
                                        commission: t.commission || 0,
                                        assigned_by: userId,
                                        assigned_at: new Date().toISOString(),
                                        status: 'assigned'
                                    }));
                                    await supabaseAdmin.from('order_product_service_technicians').insert(techPayload);
                                }
                                if (svc.sales && svc.sales.length > 0) {
                                    const salePayload = svc.sales.map((s: any) => ({
                                        order_product_service_id: createdSvc.id,
                                        sale_id: s.sale_id || s.id,
                                        commission: s.commission || 0,
                                        assigned_by: userId,
                                        assigned_at: new Date().toISOString()
                                    }));
                                    await supabaseAdmin.from('order_product_service_sales').insert(salePayload);
                                }
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
        }

        // 4. Process Sale Items
        if (sale_items && Array.isArray(sale_items) && sale_items.length > 0) {
            const baseTime = Date.now().toString().slice(-8);
            for (let idxValue = 0; idxValue < sale_items.length; idxValue++) {
                const itemValue = sale_items[idxValue];
                const qValue = Math.max(1, Number(itemValue.quantity) || 1);
                const pValue = Number(itemValue.unit_price || itemValue.price) || 0;
                const totalValue = pValue * qValue;
                const productId = itemValue.product_id || itemValue.id;

                if (itemValue.id && itemValue.is_existing) {
                    // Update existing retail item
                    const { data: oldItem } = await supabaseAdmin
                        .from('order_items')
                        .select('total_price, quantity')
                        .eq('id', itemValue.id)
                        .single();

                    if (oldItem) {
                        totalIncrement += (totalValue - Number(oldItem.total_price || 0));

                        // Handle stock if quantity changed
                        if (productId && qValue !== Number(oldItem.quantity)) {
                            const diff = qValue - Number(oldItem.quantity);
                            const { data: currentProd } = await supabaseAdmin.from('products').select('stock').eq('id', productId).single();
                            if (currentProd) {
                                await supabaseAdmin.from('products').update({ stock: (currentProd.stock || 0) - diff }).eq('id', productId);
                            }
                        }

                        await supabaseAdmin.from('order_items').update({
                            quantity: qValue,
                            unit_price: pValue,
                            total_price: totalValue,
                            updated_at: new Date().toISOString()
                        }).eq('id', itemValue.id);
                    }
                } else {
                    // New retail item
                    totalIncrement += totalValue;

                    let targetItemId: string | null = null;
                    if (productId) {
                        const { data: existingItem } = await supabaseAdmin
                            .from('order_items')
                            .select('id, quantity, total_price')
                            .eq('order_id', id)
                            .eq('product_id', productId)
                            .eq('unit_price', pValue)
                            .eq('status', 'pending')
                            .maybeSingle();

                        if (existingItem) {
                            targetItemId = existingItem.id;
                            const newQty = (Number(existingItem.quantity) || 0) + qValue;
                            const newTotal = (Number(existingItem.total_price) || 0) + totalValue;
                            await supabaseAdmin.from('order_items').update({
                                quantity: newQty,
                                total_price: newTotal,
                                updated_at: new Date().toISOString()
                            }).eq('id', targetItemId);
                        }
                    }

                    if (!targetItemId) {
                        const { data: newItem } = await supabaseAdmin
                            .from('order_items')
                            .insert({
                                order_id: id,
                                product_id: productId || null,
                                item_type: 'product',
                                item_name: itemValue.name || 'Sản phẩm upsell',
                                quantity: qValue,
                                unit_price: pValue,
                                total_price: totalValue,
                                item_code: `UP${baseTime}${idxValue.toString().padStart(2, '0')}`,
                                status: 'pending'
                            })
                            .select()
                            .single();
                        if (newItem) targetItemId = newItem.id;
                    }

                    if (targetItemId) {
                        const sales = itemValue.sales || [];
                        if (sales.length > 0) {
                            const saleItemAssignments = sales.map((s: any) => ({
                                order_item_id: targetItemId,
                                sale_id: s.sale_id || s.id,
                                commission: s.commission || 0,
                                assigned_by: userId,
                                assigned_at: new Date().toISOString()
                            }));
                            await supabaseAdmin.from('order_item_sales').insert(saleItemAssignments);
                        }
                    }

                    if (productId) {
                        try {
                            const { data: currentProd } = await supabaseAdmin.from('products').select('stock').eq('id', productId).single();
                            if (currentProd) {
                                const newStock = Math.max(0, (currentProd.stock || 0) - qValue);
                                await supabaseAdmin.from('products').update({ stock: newStock }).eq('id', productId);
                            }
                        } catch (err) { console.error('Stock decrement error:', err); }
                    }
                }
            }
        }

        // 5. Update Order Totals
        const updatedSubtotal = (Number(order.subtotal) || 0) + totalIncrement;
        const updatedTotalAmount = (Number(order.total_amount) || 0) + totalIncrement;
        const updatedRemainingDebt = (Number(order.remaining_debt) || 0) + totalIncrement;

        await supabaseAdmin
            .from('orders')
            .update({
                subtotal: updatedSubtotal,
                total_amount: updatedTotalAmount,
                remaining_debt: updatedRemainingDebt,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        // 6. Update Ticket Status
        await supabaseAdmin
            .from('upsell_tickets')
            .update({
                status: 'approved',
                approved_by: userId,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                total_amount: totalIncrement // Update the actual total amount approved
            })
            .eq('id', ticketId);

        // 🔔 WH2: Fire webhook — Duyệt Upsell thành công
        const { data: saleUser } = await supabaseAdmin.from('users').select('name').eq('id', ticket.sales_id).single();
        fireWebhook('upsell.approved', {
            order_code: order.order_code,
            sale_name: saleUser?.name || 'N/A',
            service_name: (customer_items || []).map((i: any) => i.name).concat((sale_items || []).map((i: any) => i.name)).join(', ') || 'Upsell',
            amount: totalIncrement,
        });

        res.json({
            status: 'success',
            message: `Đã duyệt và cập nhật thành công ${totalIncrement.toLocaleString()}đ vào đơn hàng.`
        });

    } catch (error) {
        next(error);
    }
});

// POST /api/upsell-tickets/:id/reject - Reject ticket
router.post('/:id/reject', requireAdminOrManager, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('upsell_tickets')
            .update({
                status: 'rejected',
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw new ApiError('Không thể từ chối ticket', 500);

        res.json({ status: 'success', message: 'Đã từ chối yêu cầu upsell' });
    } catch (e) {
        next(e);
    }
});

export const upsellTicketsRouter = router;
