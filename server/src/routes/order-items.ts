import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

// Assign technician to order item
router.patch('/:id/assign', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { technician_id } = req.body;

        if (!technician_id) {
            throw new ApiError('Vui lòng chọn kỹ thuật viên', 400);
        }

        // Try to update V1 item
        let { data: item, error } = await supabaseAdmin
            .from('order_items')
            .update({
                technician_id,
                status: 'assigned',
                assigned_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*, order:orders(id, order_code, sales_id)')
            .maybeSingle();

        // If not found in V1, try V2 item (service)
        if (!item) {
            const { data: v2Item, error: v2Error } = await supabaseAdmin
                .from('order_product_services')
                .update({
                    technician_id,
                    status: 'assigned',
                    assigned_at: new Date().toISOString()
                })
                .eq('id', id)
                .select('*, order_product:order_products(order:orders(id, order_code, sales_id))')
                .maybeSingle();

            if (v2Error || !v2Item) {
                throw new ApiError('Không tìm thấy hạng mục hoặc không thể phân công', 404);
            }

            // Normalize structure
            item = {
                ...v2Item,
                order: v2Item.order_product?.order
            };
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
            console.error(`Error updating order_items (${id}):`, error);
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
                console.error(`Error updating order_product_services (${id}):`, v2Error);
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
                console.error(`Error updating order_products (${id}):`, v2ProdError);
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
                                content: `Đơn hàng ${order.order_code} đang chờ phê duyệt: "${itemName}"`,
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

        // Create notification for sales user
        if (item.order?.sales_id) {
            await supabaseAdmin
                .from('notifications')
                .insert({
                    user_id: item.order.sales_id,
                    type: 'item_completed',
                    title: 'Dịch vụ đã hoàn thành',
                    content: `Dịch vụ "${item.item_name}" trong đơn ${item.order.order_code} đã được hoàn thành`,
                    data: {
                        order_id: item.order.id,
                        order_code: item.order.order_code,
                        item_id: item.id,
                        item_name: item.item_name
                    },
                    is_read: false
                });
        }

        // Check if all items in order are completed
        let allCompleted = false;
        if (isV2) {
            // Check order_product_services for the same order
            // Complex because we need all services of all products in that order
            // Simplified check: Check current product's services? 
            // Or just fetch all services for the order via join?
            // Actually, querying all order_products -> services is heavy.
            // Let's check status of ALL tasks in this order?
            // Re-use logic: Check if any pending tasks exist for this order.

            // To be precise: Check UNCOMPLETED services in this order.
            const { count } = await supabaseAdmin
                .from('order_product_services')
                .select('id', { count: 'exact', head: true })
                .neq('status', 'completed')
                .neq('status', 'cancelled')
                .eq('order_product_id', item.order_product_id);
            // Wait, item.order_id is correct? item.order_product.order.id
            // We need to check ALL items in the ORDER, not just the product.

            // Better logic: Query order_products of this order, join order_product_services
            const { data: products } = await supabaseAdmin
                .from('order_products')
                .select('services:order_product_services(status)')
                .eq('order_id', item.order.id);

            if (products) {
                const allServices = products.flatMap(p => p.services || []);
                allCompleted = allServices.every((s: any) => s.status === 'completed' || s.status === 'cancelled');
            }

        } else {
            const { data: orderItems } = await supabaseAdmin
                .from('order_items')
                .select('status')
                .eq('order_id', item.order_id);

            allCompleted = orderItems?.every(i => i.status === 'completed') || false;
        }

        // If all completed, we *could* update order status to completed? 
        // V1 logic didn't do it automatically in the code snippet but calculated `allCompleted`.

        res.json({
            status: 'success',
            data: item,
            message: 'Đã hoàn thành công việc',
            allItemsCompleted: allCompleted
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
                department:departments(id, name),
                technician:users!order_item_steps_technician_id_fkey(id, name, avatar)
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

export default router;

