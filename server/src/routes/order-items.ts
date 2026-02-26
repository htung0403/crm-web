import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { checkAndCompleteOrder } from '../utils/orderHelper.js';

const router = Router();

// Assign technician(s) to order item
router.patch('/:id/assign', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { technician_id, assignments } = req.body;
        console.log('[Assign] Body:', JSON.stringify(req.body, null, 2));
        const userId = req.user?.id;

        let item: any = null;

        // Try to update V1 item (order_items)
        // First check if it exists in V1
        const { data: v1Exists } = await supabaseAdmin.from('order_items').select('id, total_price').eq('id', id).maybeSingle();

        if (v1Exists) {
            const techAssignments = (Array.isArray(assignments) ? assignments : []).map(t => ({
                technician_id: t.technician_id,
                commission: Number(t.commission) || 0
            }));

            // Backward compatibility for single technician_id
            if (techAssignments.length === 0 && technician_id) {
                techAssignments.push({ technician_id, commission: 0 });
            }

            if (techAssignments.length === 0) throw new ApiError('Cần ít nhất một kỹ thuật viên', 400);

            const primaryTechId = techAssignments[0].technician_id;

            // Update V1 item main status/tech
            const { data: v1Item, error: v1Error } = await supabaseAdmin
                .from('order_items')
                .update({
                    technician_id: primaryTechId,
                    status: 'assigned',
                    assigned_at: new Date().toISOString(),
                    commission_tech_rate: techAssignments[0].commission,
                    commission_tech_amount: Math.floor(((v1Exists.total_price || 0) * (techAssignments[0].commission || 0)) / 100)
                })
                .eq('id', id)
                .select('*, order:orders(id, order_code, status, sales_id)')
                .single();

            if (v1Error) throw new ApiError('Lỗi cập nhật hạng mục: ' + v1Error.message, 500);
            item = v1Item;

            // Handle junction table for multiple technicians
            // 1. Delete existing assignments
            await supabaseAdmin.from('order_item_technicians').delete().eq('order_item_id', id);

            // 2. Insert new assignments
            const junctionRows = techAssignments.map(t => ({
                order_item_id: id,
                technician_id: t.technician_id,
                commission: t.commission || 0,
                assigned_by: userId,
                assigned_at: new Date().toISOString()
            }));

            console.log('[Assign] V1 junctionRows:', JSON.stringify(junctionRows, null, 2));

            const { error: junctionError } = await supabaseAdmin.from('order_item_technicians').insert(junctionRows);
            if (junctionError) {
                console.error('Error inserting order_item_technicians:', junctionError);
                // Continue anyway, primary tech is set
            }
        } else {
            // Try V2 item (order_product_services)
            const { data: v2Exists } = await supabaseAdmin.from('order_product_services').select('id, unit_price').eq('id', id).maybeSingle();

            if (v2Exists) {
                const techAssignments = (Array.isArray(assignments) ? assignments : []).map(t => ({
                    technician_id: t.technician_id,
                    commission: Number(t.commission) || 0
                }));

                if (techAssignments.length === 0 && technician_id) {
                    techAssignments.push({ technician_id, commission: 0 });
                }

                if (techAssignments.length === 0) throw new ApiError('Cần ít nhất một kỹ thuật viên', 400);

                const primaryTechId = techAssignments[0].technician_id;

                // Update V2 item main status/tech
                const { data: v2Item, error: v2Error } = await supabaseAdmin
                    .from('order_product_services')
                    .update({
                        technician_id: primaryTechId,
                        status: 'assigned',
                        assigned_at: new Date().toISOString()
                    })
                    .eq('id', id)
                    .select('*, order_product:order_products(order:orders(id, order_code, status, sales_id))')
                    .single();

                if (v2Error) throw new ApiError('Lỗi cập nhật dịch vụ: ' + v2Error.message, 500);

                item = {
                    ...v2Item,
                    order: v2Item.order_product?.order
                };

                // Handle junction table for V2
                // 1. Delete existing
                await supabaseAdmin.from('order_product_service_technicians').delete().eq('order_product_service_id', id);

                // 2. Insert new
                const junctionRows = techAssignments.map(t => ({
                    order_product_service_id: id,
                    technician_id: t.technician_id,
                    commission: t.commission || 0,
                    assigned_by: userId,
                    assigned_at: new Date().toISOString(),
                    status: 'assigned'
                }));

                console.log('[Assign] V2 junctionRows:', JSON.stringify(junctionRows, null, 2));

                const { error: junctionError } = await supabaseAdmin.from('order_product_service_technicians').insert(junctionRows);
                if (junctionError) {
                    console.error('Error inserting order_product_service_technicians:', junctionError);
                }
            } else {
                throw new ApiError('Không tìm thấy hạng mục hoặc dịch vụ', 404);
            }
        }

        // If order is already 'done' or 'after_sale', re-trigger commission recording
        if (item?.order?.id && (item.order.status === 'done' || item.order.status === 'after_sale')) {
            const { recordCommissions } = await import('../utils/orderHelper.js');
            await recordCommissions(item.order.id);
        }

        res.json({
            status: 'success',
            data: item,
            message: 'Đã phân công kỹ thuật viên thành công'
        });
    } catch (error) {
        next(error);
    }
});

// Assign salesperson(s) to order item
router.patch('/:id/assign-sale', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { sale_id, assignments } = req.body;
        console.log('[Assign Sale] Body:', JSON.stringify(req.body, null, 2));
        const userId = req.user?.id;

        let item: any = null;

        // Try to update V1 item (order_items)
        const { data: v1Exists } = await supabaseAdmin.from('order_items').select('id, total_price, order_id').eq('id', id).maybeSingle();

        if (v1Exists) {
            const saleAssignments = (Array.isArray(assignments) ? assignments : []).map(s => ({
                sale_id: s.sale_id || s.id,
                commission: Number(s.commission) || 0
            }));

            // Backward compatibility
            if (saleAssignments.length === 0 && sale_id) {
                saleAssignments.push({ sale_id, commission: 0 });
            }

            if (saleAssignments.length === 0) throw new ApiError('Cần ít nhất một nhân viên kinh doanh', 400);

            // Handle junction table for multiple salespersons
            // 1. Delete existing assignments
            await supabaseAdmin.from('order_item_sales').delete().eq('order_item_id', id);

            // 2. Insert new assignments
            const junctionRows = saleAssignments.map(s => ({
                order_item_id: id,
                sale_id: s.sale_id,
                commission: s.commission || 0,
                assigned_by: userId,
                assigned_at: new Date().toISOString()
            }));

            const { error: junctionError } = await supabaseAdmin.from('order_item_sales').insert(junctionRows);
            if (junctionError) throw new ApiError('Lỗi cập nhật phân công sales: ' + junctionError.message, 500);

            // Get updated item with order info
            const { data: v1Item } = await supabaseAdmin
                .from('order_items')
                .select('*, order:orders(id, order_code, status)')
                .eq('id', id)
                .single();
            item = v1Item;
        } else {
            // Try V2 item (order_product_services)
            const { data: v2Exists } = await supabaseAdmin.from('order_product_services').select('id, unit_price').eq('id', id).maybeSingle();

            if (v2Exists) {
                const saleAssignments = (Array.isArray(assignments) ? assignments : []).map(s => ({
                    sale_id: s.sale_id || s.id,
                    commission: Number(s.commission) || 0
                }));

                if (saleAssignments.length === 0 && sale_id) {
                    saleAssignments.push({ sale_id, commission: 0 });
                }

                if (saleAssignments.length === 0) throw new ApiError('Cần ít nhất một nhân viên kinh doanh', 400);

                // Handle junction table for V2
                // 1. Delete existing
                await supabaseAdmin.from('order_product_service_sales').delete().eq('order_product_service_id', id);

                // 2. Insert new
                const junctionRows = saleAssignments.map(s => ({
                    order_product_service_id: id,
                    sale_id: s.sale_id,
                    commission: s.commission || 0,
                    assigned_by: userId,
                    assigned_at: new Date().toISOString()
                }));

                const { error: junctionError } = await supabaseAdmin.from('order_product_service_sales').insert(junctionRows);
                if (junctionError) throw new ApiError('Lỗi cập nhật phân công sales cho dịch vụ: ' + junctionError.message, 500);

                // Get updated item
                const { data: v2Item } = await supabaseAdmin
                    .from('order_product_services')
                    .select('*, order_product:order_products(order:orders(id, order_code, status))')
                    .eq('id', id)
                    .single();

                item = {
                    ...v2Item,
                    order: v2Item.order_product?.order
                };
            } else {
                throw new ApiError('Không tìm thấy hạng mục hoặc dịch vụ', 404);
            }
        }

        // Re-trigger commission recording
        if (item?.order?.id && (item.order.status === 'done' || item.order.status === 'after_sale')) {
            const { recordCommissions } = await import('../utils/orderHelper.js');
            await recordCommissions(item.order.id);
        }

        res.json({
            status: 'success',
            data: item,
            message: 'Đã phân công nhân viên kinh doanh thành công'
        });
    } catch (error) {
        next(error);
    }
});

// Update order item status (generic)
router.patch('/:id/status', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const userId = req.user?.id;

        const validStatuses = [
            'pending', 'assigned', 'in_progress', 'completed', 'cancelled',
            'step1', 'step2', 'step3', 'step4', 'step5'
        ];

        if (!validStatuses.includes(status)) {
            throw new ApiError('Trạng thái không hợp lệ', 400);
        }

        // Lấy trạng thái cũ và order_id trước khi update (để ghi log Sales Kanban)
        let oldStatus: string | null = null;
        let orderIdForLog: string | null = null;
        let entityType: 'order_item' | 'order_product_service' | 'order_product' | null = null;

        const { data: v1Current } = await supabaseAdmin.from('order_items').select('id, status, order_id').eq('id', id).maybeSingle();
        if (v1Current) {
            oldStatus = v1Current.status ?? null;
            orderIdForLog = v1Current.order_id ?? null;
            entityType = 'order_item';
        }
        if (!entityType) {
            const { data: v2Svc } = await supabaseAdmin.from('order_product_services').select('id, status, order_product_id').eq('id', id).maybeSingle();
            if (v2Svc) {
                oldStatus = v2Svc.status ?? null;
                entityType = 'order_product_service';
                const { data: op } = await supabaseAdmin.from('order_products').select('order_id').eq('id', v2Svc.order_product_id).single();
                if (op) orderIdForLog = op.order_id;
            }
        }
        if (!entityType) {
            const { data: v2Prod } = await supabaseAdmin.from('order_products').select('id, status, order_id').eq('id', id).maybeSingle();
            if (v2Prod) {
                oldStatus = v2Prod.status ?? null;
                orderIdForLog = v2Prod.order_id ?? null;
                entityType = 'order_product';
            }
        }

        const updateData: any = {
            status
        };

        if (status === 'completed') {
            updateData.completed_at = new Date().toISOString();
        } else if (status === 'in_progress') {
            updateData.started_at = new Date().toISOString();
        }

        // Try V1
        let { data: item, error } = await supabaseAdmin
            .from('order_items')
            .update(updateData)
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) {
            console.error('Error updating order_items(' + id + '): ', error);
            // Ignore 500 here to try V2, but if it's a real error we might want to know
        }

        // Try V2 service
        if (!item) {
            const { data: v2Item, error: v2Error } = await supabaseAdmin
                .from('order_product_services')
                .update(updateData)
                .eq('id', id)
                .select()
                .maybeSingle();

            if (v2Item) {
                item = v2Item;
            } else if (v2Error) {
                console.error('Error updating order_product_services(' + id + '): ', v2Error);
                throw new ApiError('Lỗi cập nhật V2 (Service): ' + v2Error.message, 500);
            }
        }

        // Try V2 product
        if (!item) {
            const { data: v2Product, error: v2ProdError } = await supabaseAdmin
                .from('order_products')
                .update(updateData)
                .eq('id', id)
                .select()
                .maybeSingle();

            if (v2Product) {
                item = v2Product;
            } else if (v2ProdError) {
                console.error('Error updating order_products(' + id + '): ', v2ProdError);
                throw new ApiError('Lỗi cập nhật V2 (Product): ' + v2ProdError.message, 500);
            }

            if (!item) {
                throw new ApiError('Không tìm thấy hạng mục sau khi thử tất cả các bảng', 404);
            }
        }

        res.json({
            status: 'success',
            data: item,
            message: 'Đã cập nhật trạng thái hạng mục'
        });

        // Lịch sử Sales Kanban: ghi log chuyển bước (step1-step5 hoặc bất kỳ status)
        if (orderIdForLog && entityType && (oldStatus !== status)) {
            try {
                await supabaseAdmin.from('order_item_status_log').insert({
                    order_id: orderIdForLog,
                    entity_type: entityType,
                    entity_id: id,
                    from_status: oldStatus,
                    to_status: status,
                    created_by: userId ?? null
                });
            } catch (logErr) {
                console.error('order_item_status_log insert error:', logErr);
            }
        }

        // Trigger manager notification for approval (step4)
        if (status === 'step4') {
            try {
                let orderId = item.order_id;

                // If it's a V2 service, we need to get order_id from order_products
                if (!orderId && item.order_product_id) {
                    const { data: op } = await supabaseAdmin
                        .from('order_products')
                        .select('order_id')
                        .eq('id', item.order_product_id)
                        .single();
                    if (op) orderId = op.order_id;
                }

                if (orderId) {
                    const { data: order } = await supabaseAdmin
                        .from('orders')
                        .select('id, order_code')
                        .eq('id', orderId)
                        .single();

                    if (order) {
                        // Fetch all managers and admins
                        const { data: managers } = await supabaseAdmin
                            .from('users')
                            .select('id')
                            .or('role.eq.manager,role.eq.admin')
                            .eq('status', 'active');

                        if (managers && managers.length > 0) {
                            const itemName = item.item_name || item.product_name || 'hạng mục';
                            const notifications = managers.map(m => ({
                                user_id: m.id,
                                type: 'order_approval_required',
                                title: 'Yêu cầu phê duyệt đơn hàng',
                                content: 'Đơn hàng ' + order.order_code + ' đang chờ phê duyệt: "' + itemName + '"',
                                data: {
                                    order_id: order.id,
                                    order_code: order.order_code,
                                    item_id: item.id
                                },
                                is_read: false
                            }));

                            await supabaseAdmin.from('notifications').insert(notifications);
                        }
                    }
                }
            } catch (notifyError) {
                console.error('Error sending manager notifications:', notifyError);
            }
        }
    } catch (error) {
        next(error);
    }
});

// Technician starts work on item
router.patch('/:id/start', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        // Try V1
        let { data: item, error } = await supabaseAdmin
            .from('order_items')
            .update({
                status: 'in_progress',
                started_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*, order:orders(id, order_code, sales_id)')
            .maybeSingle();

        // Try V2 service
        if (!item) {
            const { data: v2Item, error: v2Error } = await supabaseAdmin
                .from('order_product_services')
                .update({
                    status: 'in_progress',
                    started_at: new Date().toISOString()
                })
                .eq('id', id)
                .select('*, order_product:order_products(order:orders(id, order_code, sales_id))')
                .maybeSingle();

            if (v2Item) {
                item = {
                    ...v2Item,
                    order: v2Item.order_product?.order
                };
            } else if (v2Error) {
                throw new ApiError('Lỗi khi cập nhật trạng thái', 500);
            }
        }

        // Try V2 product
        if (!item) {
            const { data: v2Product, error: v2ProdError } = await supabaseAdmin
                .from('order_products')
                .update({
                    status: 'in_progress',
                    started_at: new Date().toISOString()
                })
                .eq('id', id)
                .select('order:orders(id, order_code, sales_id)')
                .maybeSingle();

            if (v2ProdError || !v2Product) {
                throw new ApiError('Không tìm thấy hạng mục', 404);
            }
            item = v2Product;
        }

        if (item) {
            // Update parent order status to 'in_progress' if pending/confirmed
            let parentOrder: any = null;
            if (item.order) {
                parentOrder = Array.isArray(item.order) ? item.order[0] : item.order;
            } else if (item.order_id) {
                const { data: ord } = await supabaseAdmin.from('orders').select('id, status').eq('id', item.order_id).single();
                parentOrder = ord;
            }

            if (parentOrder && parentOrder.status !== 'in_progress' && parentOrder.status !== 'completed' && parentOrder.status !== 'cancelled') {
                await supabaseAdmin.from('orders').update({ status: 'in_progress' }).eq('id', parentOrder.id);
            }
        }

        res.json({
            status: 'success',
            data: item,
            message: 'Đã bắt đầu công việc'
        });
    } catch (error) {
        next(error);
    }
});

// Technician completes item - send notification to sales
router.patch('/:id/complete', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        // Try V1
        let { data: item, error } = await supabaseAdmin
            .from('order_items')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*, order:orders(id, order_code, sales_id, customer:customers(name))')
            .maybeSingle();

        let isV2 = false;

        // Try V2
        if (!item) {
            isV2 = true;
            const { data: v2Item, error: v2Error } = await supabaseAdmin
                .from('order_product_services')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    notes: notes || null
                })
                .eq('id', id)
                .select('*, order_product:order_products(order:orders(id, order_code, sales_id, customer:customers(name)))')
                .maybeSingle();

            if (v2Error || !v2Item) {
                throw new ApiError('Không tìm thấy hạng mục', 404);
            }

            item = {
                ...v2Item,
                order: v2Item.order_product?.order
            };
        }

        // 3. Mark all workflow steps for this item as 'completed'
        // This ensures the progress bar and Kanban details are correct
        const stepFilter = isV2 ? { order_product_service_id: id } : { order_item_id: id };
        const { error: stepsUpdateError } = await supabaseAdmin
            .from('order_item_steps')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                notes: notes ? `Hoàn thành hạng mục: ${notes}` : 'Hoàn thành hạng mục'
            })
            .match(stepFilter)
            .neq('status', 'skipped'); // Don't touch skipped steps

        if (stepsUpdateError) {
            console.error('[CompleteItem] Error updating steps:', stepsUpdateError);
        }

        // Create notification for sales user
        if (item.order?.sales_id) {
            await supabaseAdmin
                .from('notifications')
                .insert({
                    user_id: item.order.sales_id,
                    type: 'item_completed',
                    title: 'Dịch vụ đã hoàn thành',
                    content: 'Dịch vụ "' + item.item_name + '" trong đơn ' + item.order.order_code + ' đã được hoàn thành',
                    data: {
                        order_id: item.order.id,
                        order_code: item.order.order_code,
                        item_id: item.id,
                        item_name: item.item_name
                    },
                    is_read: false
                });
        }

        // Check and potentially complete the order
        const allRelatedCompleted = await checkAndCompleteOrder(item.order.id);

        res.json({
            status: 'success',
            data: item,
            message: 'Đã hoàn thành hạng mục',
            allRelatedCompleted
        });
    } catch (error) {
        next(error);
    }
});

// Get order item by ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        let { data: item, error } = await supabaseAdmin
            .from('order_items')
            .select('*, technician:users!order_items_technician_id_fkey(id, name, avatar)')
            .eq('id', id)
            .maybeSingle();

        if (!item) {
            const { data: v2Item, error: v2Error } = await supabaseAdmin
                .from('order_product_services')
                .select('*, technician:users!order_product_services_technician_id_fkey(id, name)') // No avatar in users? Relation check.
                .eq('id', id)
                .maybeSingle();

            if (v2Error || !v2Item) {
                throw new ApiError('Không tìm thấy hạng mục', 404);
            }
            item = v2Item;
        }

        res.json({
            status: 'success',
            data: item
        });
    } catch (error) {
        next(error);
    }
});

// Update sales step data (receiver info, technician exchange details, etc.)
router.patch('/:id/sales-step-data', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { sales_step_data } = req.body;

        if (!sales_step_data || typeof sales_step_data !== 'object') {
            throw new ApiError('Dữ liệu không hợp lệ', 400);
        }

        // Try V1 order_items first
        const { data: v1Exists } = await supabaseAdmin
            .from('order_items')
            .select('id, sales_step_data')
            .eq('id', id)
            .maybeSingle();

        if (v1Exists) {
            const merged = { ...(v1Exists.sales_step_data || {}), ...sales_step_data };

            const { data: updated, error } = await supabaseAdmin
                .from('order_items')
                .update({ sales_step_data: merged })
                .eq('id', id)
                .select()
                .single();

            if (error) throw new ApiError('Lỗi cập nhật dữ liệu: ' + error.message, 500);

            return res.json({
                status: 'success',
                data: updated,
                message: 'Đã cập nhật thông tin bước bán hàng'
            });
        }

        // Try V2 order_products directly
        const { data: v2Product } = await supabaseAdmin
            .from('order_products')
            .select('id, sales_step_data')
            .eq('id', id)
            .maybeSingle();

        if (v2Product) {
            const merged = { ...(v2Product.sales_step_data || {}), ...sales_step_data };

            const { data: updated, error } = await supabaseAdmin
                .from('order_products')
                .update({ sales_step_data: merged })
                .eq('id', id)
                .select()
                .single();

            if (error) throw new ApiError('Lỗi cập nhật dữ liệu: ' + error.message, 500);

            return res.json({
                status: 'success',
                data: updated,
                message: 'Đã cập nhật thông tin bước bán hàng'
            });
        }

        // Try V2 order_product_services → save on parent order_products
        const { data: v2Service } = await supabaseAdmin
            .from('order_product_services')
            .select('id, order_product_id')
            .eq('id', id)
            .maybeSingle();

        if (v2Service?.order_product_id) {
            const { data: parentProduct } = await supabaseAdmin
                .from('order_products')
                .select('id, sales_step_data')
                .eq('id', v2Service.order_product_id)
                .single();

            if (parentProduct) {
                const merged = { ...(parentProduct.sales_step_data || {}), ...sales_step_data };

                const { data: updated, error } = await supabaseAdmin
                    .from('order_products')
                    .update({ sales_step_data: merged })
                    .eq('id', v2Service.order_product_id)
                    .select()
                    .single();

                if (error) throw new ApiError('Lỗi cập nhật dữ liệu: ' + error.message, 500);

                return res.json({
                    status: 'success',
                    data: updated,
                    message: 'Đã cập nhật thông tin bước bán hàng'
                });
            }
        }

        throw new ApiError('Không tìm thấy hạng mục', 404);
    } catch (error) {
        next(error);
    }
});

// =====================================================
// ORDER ITEM STEPS ROUTES
// =====================================================

// Get steps for an order item
router.get('/:id/steps', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        let query = supabaseAdmin
            .from('order_item_steps')
            .select(`
    *,
    department: departments(id, name),
        technician: users!order_item_steps_technician_id_fkey(id, name, avatar)
            `)
            .order('step_order', { ascending: true });

        // Check if ID matches order_item or order_product_service
        // Heuristic: Try to find steps by order_item_id first
        const { count: v1Count } = await supabaseAdmin
            .from('order_item_steps')
            .select('id', { count: 'exact', head: true })
            .eq('order_item_id', id);

        if (v1Count && v1Count > 0) {
            query = query.eq('order_item_id', id);
        } else {
            // Assume it is V2 service ID
            query = query.eq('order_product_service_id', id);
        }

        const { data: steps, error } = await query;

        if (error) {
            throw new ApiError('Không thể lấy danh sách bước', 500);
        }

        res.json({
            status: 'success',
            data: steps || []
        });
    } catch (error) {
        next(error);
    }
});

// Assign technician to a step
router.patch('/steps/:stepId/assign', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { stepId } = req.params;
        const { technician_id } = req.body;

        if (!technician_id) {
            throw new ApiError('Vui lòng chọn kỹ thuật viên', 400);
        }

        const { data: step, error } = await supabaseAdmin
            .from('order_item_steps')
            .update({
                technician_id,
                status: 'assigned',
                assigned_at: new Date().toISOString()
            })
            .eq('id', stepId)
            .select('*, department:departments(id, name), technician:users!order_item_steps_technician_id_fkey(id, name)')
            .single();

        if (error) {
            throw new ApiError('Không thể phân công kỹ thuật viên', 500);
        }

        res.json({
            status: 'success',
            data: step,
            message: 'Đã phân công kỹ thuật viên cho bước này'
        });
    } catch (error) {
        next(error);
    }
});

// Start a step
router.patch('/steps/:stepId/start', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { stepId } = req.params;

        const { data: step, error } = await supabaseAdmin
            .from('order_item_steps')
            .update({
                status: 'in_progress',
                started_at: new Date().toISOString()
            })
            .eq('id', stepId)
            .select('*')
            .single();

        if (error) {
            throw new ApiError('Không thể bắt đầu bước', 500);
        }

        res.json({
            status: 'success',
            data: step,
            message: 'Đã bắt đầu thực hiện bước'
        });

        // Update parent status (V1 or V2) and Order status
        (async () => {
            try {
                let orderId: string | null = null;

                if (step.order_product_service_id) {
                    // V2 Service
                    // Update service status if pending/assigned
                    await supabaseAdmin
                        .from('order_product_services')
                        .update({ status: 'in_progress', started_at: new Date().toISOString() })
                        .eq('id', step.order_product_service_id)
                        .in('status', ['pending', 'assigned']);

                    // Get order_id
                    const { data: service } = await supabaseAdmin
                        .from('order_product_services')
                        .select('order_product:order_products(order_id)')
                        .eq('id', step.order_product_service_id)
                        .single();

                    if (service?.order_product) {
                        const op = Array.isArray(service.order_product) ? service.order_product[0] : service.order_product;
                        orderId = op?.order_id;
                    }

                } else if (step.order_item_id) {
                    // V1 Item
                    await supabaseAdmin
                        .from('order_items')
                        .update({ status: 'in_progress', started_at: new Date().toISOString() })
                        .eq('id', step.order_item_id)
                        .in('status', ['pending', 'assigned', 'step1', 'step2', 'step3', 'step4']); // approximate statuses

                    const { data: item } = await supabaseAdmin
                        .from('order_items')
                        .select('order_id')
                        .eq('id', step.order_item_id)
                        .single();

                    orderId = item?.order_id;
                }

                // Update Order Status
                if (orderId) {
                    const { data: order } = await supabaseAdmin
                        .from('orders')
                        .select('status')
                        .eq('id', orderId)
                        .single();

                    if (order && order.status !== 'in_progress' && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'tech_completed') {
                        await supabaseAdmin
                            .from('orders')
                            .update({ status: 'in_progress' })
                            .eq('id', orderId);
                    }
                }
            } catch (err) {
                console.error('Error auto-updating parent status from step start:', err);
            }
        })();
    } catch (error) {
        next(error);
    }
});

// Complete a step: mark step completed, then start next step (pending/assigned) or complete item/service when all done (V1 & V2)
router.patch('/steps/:stepId/complete', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { stepId } = req.params;
        const { notes } = req.body;
        const userId = req.user?.id;

        const { data: step, error } = await supabaseAdmin
            .from('order_item_steps')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                notes: notes || null
            })
            .eq('id', stepId)
            .select('*')
            .single();

        if (error) {
            throw new ApiError('Không thể hoàn thành bước', 500);
        }

        try {
            await supabaseAdmin.from('order_workflow_step_log').insert({
                order_item_step_id: stepId,
                action: 'completed',
                step_name: step?.step_name ?? null,
                step_order: step?.step_order ?? null,
                created_by: userId ?? null
            });
        } catch (logErr) {
            console.error('order_workflow_step_log insert error:', logErr);
        }

        const isV2 = !!step.order_product_service_id;
        const itemFilter = isV2
            ? { order_product_service_id: step.order_product_service_id }
            : { order_item_id: step.order_item_id };

        const { data: allSteps, error: stepsError } = await supabaseAdmin
            .from('order_item_steps')
            .select('id, step_order, status')
            .match(itemFilter)
            .order('step_order', { ascending: true });

        if (stepsError || !allSteps?.length) {
            return res.json({
                status: 'success',
                data: step,
                message: 'Đã hoàn thành bước',
                allStepsCompleted: true,
                nextStep: null
            });
        }

        const allStepsCompleted = allSteps.every(s => s.status === 'completed' || s.status === 'skipped');

        let nextStep: { id: string; step_order: number } | null = null;

        if (allStepsCompleted) {
            if (isV2 && step.order_product_service_id) {
                await supabaseAdmin
                    .from('order_product_services')
                    .update({
                        status: 'completed',
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', step.order_product_service_id);
            } else if (step.order_item_id) {
                await supabaseAdmin
                    .from('order_items')
                    .update({
                        status: 'completed',
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', step.order_item_id);
            }

            // Nếu vừa xong hết bước của một item/service, kiểm tra toàn đơn: nếu mọi bước quy trình trong đơn đã xong thì chuyển đơn sang tech_completed
            let orderId: string | null = null;
            if (step.order_item_id) {
                const { data: oi } = await supabaseAdmin.from('order_items').select('order_id').eq('id', step.order_item_id).single();
                orderId = (oi as { order_id?: string } | null)?.order_id ?? null;
            } else if (step.order_product_service_id) {
                const { data: ops } = await supabaseAdmin.from('order_product_services').select('order_product_id').eq('id', step.order_product_service_id).single();
                const opId = (ops as { order_product_id?: string } | null)?.order_product_id;
                if (opId) {
                    const { data: op } = await supabaseAdmin.from('order_products').select('order_id').eq('id', opId).single();
                    orderId = (op as { order_id?: string } | null)?.order_id ?? null;
                }
            }
            if (orderId) {
                const { data: stepsV1 } = await supabaseAdmin.from('order_items').select('id').eq('order_id', orderId);
                const orderItemIds = ((stepsV1 as { id: string }[] | null) || []).map(r => r.id);
                const { data: orderProducts } = await supabaseAdmin.from('order_products').select('id').eq('order_id', orderId);
                const opIds = ((orderProducts as { id: string }[] | null) || []).map(r => r.id);
                const { data: services } = opIds.length ? await supabaseAdmin.from('order_product_services').select('id').in('order_product_id', opIds) : { data: [] };
                const serviceIds = ((services as { id: string }[] | null) || []).map(r => r.id);
                const { data: stepsV1Rows } = orderItemIds.length ? await supabaseAdmin.from('order_item_steps').select('id, status').in('order_item_id', orderItemIds) : { data: [] };
                const { data: stepsV2Rows } = serviceIds.length ? await supabaseAdmin.from('order_item_steps').select('id, status').in('order_product_service_id', serviceIds) : { data: [] };
                const allOrderSteps = [...((stepsV1Rows as { id: string; status: string }[] | null) || []), ...((stepsV2Rows as { id: string; status: string }[] | null) || [])];
                const allDone = allOrderSteps.length > 0 && allOrderSteps.every(s => s.status === 'completed' || s.status === 'skipped');
                if (allDone) {
                    await checkAndCompleteOrder(orderId);
                }
            }
        } else {
            const nextStepRow = allSteps.find(s => s.status !== 'completed' && s.status !== 'skipped');
            if (nextStepRow) {
                nextStep = { id: nextStepRow.id, step_order: nextStepRow.step_order };
            }
        }

        res.json({
            status: 'success',
            data: step,
            message: 'Đã hoàn thành bước',
            allStepsCompleted,
            nextStep
        });
    } catch (error) {
        next(error);
    }
});

// Skip a step (optional step only)
router.patch('/steps/:stepId/skip', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { stepId } = req.params;
        const { notes } = req.body;
        const userId = req.user?.id;

        const { data: step, error } = await supabaseAdmin
            .from('order_item_steps')
            .update({
                status: 'skipped',
                completed_at: new Date().toISOString(),
                notes: notes || 'Bước này đã được bỏ qua'
            })
            .eq('id', stepId)
            .select('*')
            .single();

        if (error) {
            throw new ApiError('Không thể bỏ qua bước', 500);
        }

        try {
            await supabaseAdmin.from('order_workflow_step_log').insert({
                order_item_step_id: stepId,
                action: 'skipped',
                step_name: step?.step_name ?? null,
                step_order: step?.step_order ?? null,
                created_by: userId ?? null
            });
        } catch (logErr) {
            console.error('order_workflow_step_log insert error:', logErr);
        }

        // Sau khi skip, kiểm tra toàn đơn: nếu mọi bước quy trình đã xong thì chuyển đơn sang tech_completed
        let orderId: string | null = null;
        if (step?.order_item_id) {
            const { data: oi } = await supabaseAdmin.from('order_items').select('order_id').eq('id', step.order_item_id).single();
            orderId = (oi as { order_id?: string } | null)?.order_id ?? null;
        } else if (step?.order_product_service_id) {
            const { data: ops } = await supabaseAdmin.from('order_product_services').select('order_product_id').eq('id', step.order_product_service_id).single();
            const opId = (ops as { order_product_id?: string } | null)?.order_product_id;
            if (opId) {
                const { data: op } = await supabaseAdmin.from('order_products').select('order_id').eq('id', opId).single();
                orderId = (op as { order_id?: string } | null)?.order_id ?? null;
            }
        }
        if (orderId) {
            const { data: stepsV1 } = await supabaseAdmin.from('order_items').select('id').eq('order_id', orderId);
            const orderItemIds = ((stepsV1 as { id: string }[] | null) || []).map(r => r.id);
            const { data: orderProducts } = await supabaseAdmin.from('order_products').select('id').eq('order_id', orderId);
            const opIds = ((orderProducts as { id: string }[] | null) || []).map(r => r.id);
            const { data: services } = opIds.length ? await supabaseAdmin.from('order_product_services').select('id').in('order_product_id', opIds) : { data: [] };
            const serviceIds = ((services as { id: string }[] | null) || []).map(r => r.id);
            const { data: stepsV1Rows } = orderItemIds.length ? await supabaseAdmin.from('order_item_steps').select('id, status').in('order_item_id', orderItemIds) : { data: [] };
            const { data: stepsV2Rows } = serviceIds.length ? await supabaseAdmin.from('order_item_steps').select('id, status').in('order_product_service_id', serviceIds) : { data: [] };
            const allOrderSteps = [...((stepsV1Rows as { id: string; status: string }[] | null) || []), ...((stepsV2Rows as { id: string; status: string }[] | null) || [])];
            const allDone = allOrderSteps.length > 0 && allOrderSteps.every(s => s.status === 'completed' || s.status === 'skipped');
            if (allDone) {
                await checkAndCompleteOrder(orderId);
            }
        }

        res.json({
            status: 'success',
            data: step,
            message: 'Đã bỏ qua bước này'
        });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// ORDER ITEM ACCESSORIES (Mua phụ kiện)
// =====================================================
const ACCESSORY_STATUSES = ['need_buy', 'bought', 'waiting_ship', 'shipped', 'delivered_to_tech'];

router.patch('/:id/accessory', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        if (!status || !ACCESSORY_STATUSES.includes(status)) {
            throw new ApiError('Trạng thái không hợp lệ. Chọn: need_buy, bought, waiting_ship, shipped, delivered_to_tech', 400);
        }

        // Resolve id: V1 = order_items, V2 = order_product_services
        const { data: v1Item } = await supabaseAdmin.from('order_items').select('id').eq('id', id).maybeSingle();
        const { data: v2Item } = await supabaseAdmin.from('order_product_services').select('id').eq('id', id).maybeSingle();
        const isV1 = !!v1Item;
        const isV2 = !!v2Item;
        if (!isV1 && !isV2) {
            throw new ApiError('Không tìm thấy hạng mục đơn hàng', 404);
        }

        const payload = {
            order_item_id: isV1 ? id : null,
            order_product_service_id: isV2 ? id : null,
            status,
            notes: notes || null,
            updated_by: req.user!.id,
        };

        const existingQuery = supabaseAdmin
            .from('order_item_accessories')
            .select('id')
            .order('updated_at', { ascending: false })
            .limit(1);
        const existingResult = isV1
            ? await existingQuery.eq('order_item_id', id).maybeSingle()
            : await existingQuery.eq('order_product_service_id', id).maybeSingle();
        const { data: existing } = existingResult;

        if (existing) {
            const { data: updated, error } = await supabaseAdmin
                .from('order_item_accessories')
                .update({ status, notes: notes || null, updated_by: req.user!.id, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw new ApiError('Lỗi cập nhật: ' + error.message, 500);
            return res.json({ status: 'success', data: updated, message: 'Đã cập nhật trạng thái mua phụ kiện' });
        }

        const { data: inserted, error } = await supabaseAdmin
            .from('order_item_accessories')
            .insert(payload)
            .select()
            .single();
        if (error) throw new ApiError('Lỗi tạo: ' + error.message, 500);

        res.json({
            status: 'success',
            data: inserted,
            message: 'Đã cập nhật trạng thái mua phụ kiện',
        });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// ORDER ITEM PARTNER (Gửi Đối Tác)
// =====================================================
const PARTNER_STATUSES = ['ship_to_partner', 'partner_doing', 'ship_back', 'done'];

router.patch('/:id/partner', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        if (!status || !PARTNER_STATUSES.includes(status)) {
            throw new ApiError('Trạng thái không hợp lệ. Chọn: ship_to_partner, partner_doing, ship_back, done', 400);
        }

        // Resolve id: V1 = order_items, V2 = order_product_services
        const { data: v1Item } = await supabaseAdmin.from('order_items').select('id').eq('id', id).maybeSingle();
        const { data: v2Item } = await supabaseAdmin.from('order_product_services').select('id').eq('id', id).maybeSingle();
        const isV1 = !!v1Item;
        const isV2 = !!v2Item;
        if (!isV1 && !isV2) {
            throw new ApiError('Không tìm thấy hạng mục đơn hàng', 404);
        }

        const payload = {
            order_item_id: isV1 ? id : null,
            order_product_service_id: isV2 ? id : null,
            status,
            notes: notes || null,
            updated_by: req.user!.id,
        };

        const existingQuery = supabaseAdmin
            .from('order_item_partner')
            .select('id')
            .order('updated_at', { ascending: false })
            .limit(1);
        const existingResult = isV1
            ? await existingQuery.eq('order_item_id', id).maybeSingle()
            : await existingQuery.eq('order_product_service_id', id).maybeSingle();
        const { data: existing } = existingResult;

        if (existing) {
            const { data: updated, error } = await supabaseAdmin
                .from('order_item_partner')
                .update({ status, notes: notes || null, updated_by: req.user!.id, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw new ApiError('Lỗi cập nhật: ' + error.message, 500);
            return res.json({ status: 'success', data: updated, message: 'Đã cập nhật trạng thái gửi đối tác' });
        }

        const { data: inserted, error } = await supabaseAdmin
            .from('order_item_partner')
            .insert(payload)
            .select()
            .single();
        if (error) throw new ApiError('Lỗi tạo: ' + error.message, 500);

        res.json({
            status: 'success',
            data: inserted,
            message: 'Đã cập nhật trạng thái gửi đối tác',
        });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// NEW ENDPOINTS FOR KANBAN PROCESS CHANGE
// =====================================================

// Fail/Cancel an item with reason
router.patch('/:id/fail', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user?.id;

        if (!reason) {
            throw new ApiError('Vui lòng nhập lý do thất bại/hủy', 400);
        }

        // 1. Determine if V1 or V2
        const { data: v1Item } = await supabaseAdmin.from('order_items').select('id, order_id').eq('id', id).maybeSingle();
        const { data: v2Item } = await supabaseAdmin.from('order_product_services').select('id, order_product:order_products(order_id)').eq('id', id).maybeSingle();

        let item: any = null;
        let orderId: string | null = null;
        let entityType: 'order_item' | 'order_product_service' | null = null;

        if (v1Item) {
            entityType = 'order_item';
            orderId = v1Item.order_id;
            const { data: updated, error } = await supabaseAdmin
                .from('order_items')
                .update({
                    status: 'cancelled',
                    // notes: reason // Append or set notes? Maybe better to log in status log or append to notes
                })
                .eq('id', id)
                .select()
                .single();
            if (error) throw new ApiError('Lỗi cập nhật: ' + error.message, 500);
            item = updated;
        } else if (v2Item) {
            entityType = 'order_product_service';
            if (v2Item.order_product) {
                const op = Array.isArray(v2Item.order_product) ? v2Item.order_product[0] : v2Item.order_product;
                orderId = op.order_id;
            }
            const { data: updated, error } = await supabaseAdmin
                .from('order_product_services')
                .update({
                    status: 'cancelled',
                    notes: reason // V2 has notes field, we can use it or append
                })
                .eq('id', id)
                .select()
                .single();
            if (error) throw new ApiError('Lỗi cập nhật: ' + error.message, 500);
            item = updated;
        } else {
            throw new ApiError('Không tìm thấy hạng mục', 404);
        }

        // 2. Log status change with reason
        if (orderId && entityType) {
            await supabaseAdmin.from('order_item_status_log').insert({
                order_id: orderId,
                entity_type: entityType,
                entity_id: id,
                from_status: 'unknown', // We didn't fetch old status to save a query, or we can catch it
                to_status: 'cancelled',
                created_by: userId,
                // note: reason // If schema supports it, otherwise rely on item notes
            });
        }

        // 3. Skip all pending steps for this item
        if (entityType === 'order_item') {
            await supabaseAdmin.from('order_item_steps')
                .update({
                    status: 'skipped',
                    notes: 'Hạng mục thất bại/bị hủy: ' + reason,
                    completed_at: new Date().toISOString()
                })
                .eq('order_item_id', id)
                .neq('status', 'completed');
        } else if (entityType === 'order_product_service') {
            await supabaseAdmin.from('order_item_steps')
                .update({
                    status: 'skipped',
                    notes: 'Dịch vụ thất bại/bị hủy: ' + reason,
                    completed_at: new Date().toISOString()
                })
                .eq('order_product_service_id', id)
                .neq('status', 'completed');
        }

        res.json({
            status: 'success',
            data: item,
            message: 'Đã hủy hạng mục thành công'
        });
    } catch (error) {
        next(error);
    }
});

// Change Room / Process Step with Reason and Deadline
router.patch('/:id/change-room', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { targetRoomId, reason, deadline_days } = req.body;
        const userId = req.user?.id;

        if (!targetRoomId || !reason || !deadline_days) {
            throw new ApiError('Thiếu thông tin: phòng đích, lý do, hoặc hạn hoàn thành', 400);
        }

        // Map targetRoomId to step order (assuming 1=Mạ, 2=Dán đế, 3=Da based on constants.ts TECH_ROOMS)
        // Ideally this should be dynamic or passed as step_id, but for now we map based on fixed logic or fetch steps
        let targetStepOrder = 0;
        if (targetRoomId === 'phong_ma') targetStepOrder = 1;
        else if (targetRoomId === 'phong_dan_de') targetStepOrder = 2;
        else if (targetRoomId === 'phong_da') targetStepOrder = 3;

        if (targetStepOrder === 0) {
            throw new ApiError('Phòng đích không hợp lệ', 400);
        }

        // 1. Resolve Item Type
        const { data: v1Item } = await supabaseAdmin.from('order_items').select('id, order_id').eq('id', id).maybeSingle();
        const { data: v2Item } = await supabaseAdmin.from('order_product_services').select('id, order_product:order_products(order_id)').eq('id', id).maybeSingle();

        let isV1 = !!v1Item;
        let isV2 = !!v2Item;

        if (!isV1 && !isV2) throw new ApiError('Không tìm thấy hạng mục', 404);

        // 2. Fetch all steps for this item with department names
        const itemFilter = isV1 ? { order_item_id: id } : { order_product_service_id: id };
        const { data: steps, error: stepsError } = await supabaseAdmin
            .from('order_item_steps')
            .select('*, department:departments(name)')
            .match(itemFilter)
            .order('step_order', { ascending: true });

        if (stepsError || !steps) throw new ApiError('Lỗi lấy danh sách bước', 500);

        // 3. Forcefully handle Room Transition
        // Strategy: 
        // a. Map targetRoomId to a search pattern for department
        let deptSearch = '';
        if (targetRoomId === 'phong_ma') deptSearch = 'Mạ';
        else if (targetRoomId === 'phong_dan_de') deptSearch = 'Dán đế';
        else if (targetRoomId === 'phong_da') deptSearch = 'Da';

        // b. Fetch all departments to find the ID
        const { data: allDepts } = await supabaseAdmin.from('departments').select('id, name');
        const targetDept = (allDepts || []).find(d => {
            const n = d.name.toLowerCase();
            const searchStr = deptSearch.toLowerCase();
            if (searchStr === 'da') return n.includes('da') && !n.includes('dán');
            return n.includes(searchStr);
        });

        // c. Mark ALL currently active/pending steps as 'skipped'
        const activeSteps = steps.filter(s => ['pending', 'assigned', 'in_progress'].includes(s.status));
        for (const step of activeSteps) {
            const { error: skipError } = await supabaseAdmin.from('order_item_steps')
                .update({
                    status: 'skipped',
                    notes: `Chuyển quy trình sang bước ${targetRoomId}: ` + reason,
                    completed_at: new Date().toISOString()
                })
                .eq('id', step.id);
            if (skipError) console.error(`[ChangeRoom] Error skipping step ${step.id}:`, skipError);

            // Log skipped action
            await supabaseAdmin.from('order_workflow_step_log').insert({
                order_item_step_id: step.id,
                action: 'skipped',
                step_name: step.step_name,
                step_order: step.step_order,
                created_by: userId
            });
        }

        // d. Find Target Step or Create New
        let targetStep = steps.find(s => {
            const deptName = (s as any).department?.name?.toLowerCase() || '';
            const searchStr = deptSearch.toLowerCase();
            if (searchStr === 'da') return deptName.includes('da') && !deptName.includes('dán');
            return deptName.includes(searchStr);
        });

        // If not found by dept name, fallback to targetStepOrder if it matches something reasonable
        if (!targetStep) {
            targetStep = steps.find(s => s.step_order === targetStepOrder);
        }

        let activatedStepId = targetStep?.id;

        if (targetStep) {
            // Update existing step
            const { error: updateError } = await supabaseAdmin
                .from('order_item_steps')
                .update({
                    status: 'assigned',
                    estimated_duration: deadline_days,
                    started_at: null,
                    completed_at: null,
                    technician_id: null,
                    notes: reason,
                    department_id: targetDept?.id || targetStep.department_id // Ensure department matches
                })
                .eq('id', targetStep.id);

            if (updateError) throw new ApiError('Lỗi cập nhật bước đích: ' + updateError.message, 500);
        } else {
            // CREATE a new step for this department since the workflow didn't have it
            if (!targetDept) throw new ApiError(`Không tìm thấy bộ phận tương ứng với ${targetRoomId} trong hệ thống`, 404);

            const { data: newStep, error: insertError } = await supabaseAdmin
                .from('order_item_steps')
                .insert({
                    order_item_id: isV1 ? id : null,
                    order_product_service_id: isV2 ? id : null,
                    step_order: targetStepOrder, // Use the suggested order
                    step_name: targetDept.name,
                    department_id: targetDept.id,
                    status: 'assigned',
                    estimated_duration: deadline_days,
                    notes: reason
                })
                .select()
                .single();

            if (insertError) throw new ApiError('Lỗi tạo bước quy trình mới: ' + insertError.message, 500);
            activatedStepId = newStep.id;
        }

        // Also update the PARENT item status to 'in_progress'
        if (isV1) {
            await supabaseAdmin.from('order_items').update({ status: 'in_progress' }).eq('id', id);
        } else {
            await supabaseAdmin.from('order_product_services').update({ status: 'in_progress' }).eq('id', id);
        }

        // Log the activation
        const { data: finalStep } = await supabaseAdmin.from('order_item_steps').select('*, department:departments(name)').eq('id', activatedStepId).single();

        if (finalStep) {
            await supabaseAdmin.from('order_workflow_step_log').insert({
                order_item_step_id: finalStep.id,
                action: 'assigned',
                step_name: finalStep.step_name,
                step_order: finalStep.step_order,
                created_by: userId
            });
        }

        res.json({
            status: 'success',
            data: finalStep,
            message: 'Đã chuyển quy trình thành công'
        });

    } catch (error) {
        next(error);
    }
});

export default router;


