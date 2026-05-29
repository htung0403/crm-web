import { Router, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { fireWebhook } from '../utils/webhookNotifier.js';
import { notifyCrmMasterUser } from '../utils/n8nCrmEvents.js';
import {
    logAccessoryStatusChange,
    logExtensionStatusChange,
    logPartnerStatusChange,
} from '../utils/workflowRequestLog.js';

const router = Router();
console.log('🚀 Requests Router Loaded');

function requireAdminOrManager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    console.log('🛡️ requireAdminOrManager check - Role:', req.user?.role);
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'manager') {
        return next(new ApiError('Chỉ admin hoặc quản lý mới xem được trang yêu cầu', 403));
    }
    next();
}

router.use(authenticate);

const ACCESSORY_REQUIRED_FIELDS: Record<string, string[]> = {
    need_buy: ['photos_purchase', 'photos_transfer'],
    bought: ['tracking_number'],
    waiting_ship: ['shipping_cost', 'photos_arrival'],
    shipped: ['photos_item', 'photos_storage']
};

const ACCESSORY_FIELD_LABELS: Record<string, string> = {
    photos_purchase: 'Ảnh mua',
    photos_transfer: 'Ảnh ck',
    tracking_number: 'Mã vận đơn',
    shipping_cost: 'Phí ship',
    photos_arrival: 'Ảnh chụp lúc nhận hàng',
    photos_item: 'Ảnh chụp ảnh hàng',
    photos_storage: 'Ảnh chụp chỗ để'
};

router.patch('/accessories/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    console.log('📝 Handling PATCH /api/requests/accessories/' + req.params.id);
    try {
        const { id } = req.params;
        const { status, notes, metadata } = req.body;
        const userId = req.user?.id;

        const { data: current, error: fetchError } = await supabaseAdmin
            .from('order_item_accessories')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !current) {
            throw new ApiError('Không tìm thấy yêu cầu: ' + (fetchError?.message || ''), 404);
        }

        // Validate if changing status
        if (status && status !== current.status && status !== 'rejected' && status !== 'cancelled') {
            const required = ACCESSORY_REQUIRED_FIELDS[current.status];
            if (required) {
                const finalMeta = metadata || current.metadata || {};
                for (const field of required) {
                    const val = finalMeta[field];
                    if (!val || (Array.isArray(val) && val.length === 0)) {
                        const label = ACCESSORY_FIELD_LABELS[field] || field;
                        throw new ApiError(`Không thể chuyển trạng thái. Thiếu thông tin bắt buộc: ${label}`, 400);
                    }
                }
            }
        }

        const { data, error } = await supabaseAdmin
            .from('order_item_accessories')
            .update({
                status: status || undefined,
                notes: notes !== undefined ? notes : undefined,
                metadata: metadata || undefined,
                updated_by: userId,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            throw new ApiError('Không thể cập nhật yêu cầu: ' + error.message, 500);
        }

        if (status && status !== current.status) {
            await logAccessoryStatusChange(
                {
                    order_item_id: current.order_item_id,
                    order_product_service_id: current.order_product_service_id,
                },
                current.status,
                status,
                notes ?? current.notes,
                userId
            );
        }

        if (status) {
            fireWebhook('accessory.status_changed', {
                accessory_id: id,
                old_status: current.status,
                new_status: status,
                notes: notes || null,
            });

            if (status === 'delivered_to_tech') {
                const technicianId = (metadata || current.metadata || {})?.technician_id;
                if (technicianId) {
                    notifyCrmMasterUser('accessory.approved', {
                        target_user_id: technicianId,
                        target_role: 'technician',
                        channel: 'telegram',
                        item: { id, service_name: (metadata || current.metadata || {})?.item_name || 'Phụ kiện', note: notes || null },
                    });
                }
            }
        }

        res.json({ status: 'success', data });
    } catch (e) {
        next(e);
    }
});

router.patch('/partners/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { status, notes, metadata } = req.body;
        const userId = req.user?.id;

        const { data: current, error: fetchError } = await supabaseAdmin
            .from('order_item_partner')
            .select('id, status, notes, order_item_id, order_product_service_id')
            .eq('id', id)
            .single();

        if (fetchError || !current) {
            throw new ApiError('Không tìm thấy yêu cầu gửi đối tác', 404);
        }

        const { data, error } = await supabaseAdmin
            .from('order_item_partner')
            .update({
                status: status || undefined,
                notes: notes !== undefined ? notes : undefined,
                metadata: metadata || undefined,
                updated_by: userId,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            throw new ApiError('Không thể cập nhật yêu cầu đối tác: ' + error.message, 500);
        }

        if (status && status !== current.status) {
            await logPartnerStatusChange(
                {
                    order_item_id: current.order_item_id,
                    order_product_service_id: current.order_product_service_id,
                },
                current.status,
                status,
                notes ?? current.notes,
                userId
            );
        }

        if (status) {
            fireWebhook('partner.status_changed', {
                partner_id: id,
                old_status: current.status,
                new_status: status,
                notes: notes || null,
            });
        }

        res.json({ status: 'success', data });
    } catch (e) {
        next(e);
    }
});

router.get('/test', (req, res) => res.json({ status: 'ok', msg: 'Requests router is working' }));

router.use(requireAdminOrManager);

// GET /api/requests/accessories - Danh sách yêu cầu Mua phụ kiện (V1 + V2)
router.get('/accessories', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('order_item_accessories')
            .select(`
                id,
                order_product_id,
                order_product_service_id,
                status,
                notes,
                metadata,
                created_at,
                updated_at,
                order_item:order_items(
                    id,
                    item_name,
                    item_code,
                    order:orders(id, order_code),
                    product:products(id, image)
                ),
                order_product:order_products(id, name, product_code, images, order:orders(id, order_code)),
                order_product_service:order_product_services(
                    id,
                    order_product:order_products(name, product_code, images, order:orders(id, order_code))
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw new ApiError('Không thể lấy danh sách yêu cầu mua phụ kiện', 500);

        res.json({ status: 'success', data: data || [] });
    } catch (e) {
        next(e);
    }
});

// GET /api/requests/partners - Danh sách yêu cầu Gửi Đối Tác (V1 + V2)
router.get('/partners', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('order_item_partner')
            .select(`
                *,
                order_item:order_items(
                    id, 
                    item_name, 
                    item_code, 
                    order:orders(id, order_code)
                ),
                technician:users(id, name),
                order_product:order_products(id, name, product_code, images, order:orders(id, order_code)),
                order_product_service:order_product_services(
                    id, 
                    order_product:order_products(name, product_code, images, order:orders(id, order_code))
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw new ApiError('Không thể lấy danh sách yêu cầu gửi đối tác', 500);

        res.json({ status: 'success', data: data || [] });
    } catch (e) {
        next(e);
    }
});

// GET /api/requests/extensions - Danh sách yêu cầu Xin gia hạn
router.get('/extensions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('order_extension_requests')
            .select(`
                id,
                order_id,
                order_item_id,
                order_product_id,
                order_product_service_id,
                requested_by,
                reason,
                status,
                customer_result,
                new_due_at,
                valid_reason,
                kpi_impact,
                approved_by,
                approved_at,
                created_at,
                updated_at,
                order:orders(id, order_code, order_products(id, images)),
                order_item:order_items(id, item_name, item_code, product:products(id, image)),
                order_product:order_products(id, name, product_code, images),
                order_product_service:order_product_services(id, item_name, order_product:order_products(id, name, product_code, images))
            `)
            .order('created_at', { ascending: false });

        if (error) throw new ApiError('Không thể lấy danh sách yêu cầu gia hạn: ' + error.message, 500);

        res.json({ status: 'success', data: data || [] });
    } catch (e) {
        next(e);
    }
});

// PATCH /api/requests/extensions/:id - Cập nhật yêu cầu gia hạn cụ thể
router.patch('/extensions/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { status, customer_result, new_due_at, valid_reason, kpi_impact } = req.body;
        const userId = req.user?.id;

        const { data: current, error: fetchError } = await supabaseAdmin
            .from('order_extension_requests')
            .select('id, status, reason, order_id, requested_by, order_item_id, order_product_service_id')
            .eq('id', id)
            .single();

        if (fetchError || !current) {
            throw new ApiError('Không tìm thấy yêu cầu gia hạn', 404);
        }

        const updatePayload: Record<string, any> = {
            status: status || undefined,
            customer_result: customer_result !== undefined ? customer_result : undefined,
            new_due_at: new_due_at || undefined,
            valid_reason: typeof valid_reason === 'boolean' ? valid_reason : undefined,
            kpi_impact: typeof kpi_impact === 'boolean' ? kpi_impact : undefined,
            updated_at: new Date().toISOString()
        };

        // Set approved_by/approved_at when manager approves (both KPI paths)
        if (status === 'manager_approved' && userId) {
            updatePayload.approved_by = userId;
            updatePayload.approved_at = new Date().toISOString();
        }

        const { data, error } = await supabaseAdmin
            .from('order_extension_requests')
            .update(updatePayload)
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            throw new ApiError('Không thể cập nhật yêu cầu gia hạn: ' + error.message, 500);
        }

        if (status && status !== current.status) {
            const noteText =
                customer_result ||
                (status === 'rejected' ? 'QL từ chối yêu cầu gia hạn' : 'QL đã xử lý yêu cầu gia hạn');
            await logExtensionStatusChange(
                {
                    order_item_id: current.order_item_id,
                    order_product_service_id: current.order_product_service_id,
                },
                current.status,
                status,
                noteText,
                userId
            );
        }

        // When extension approved, propagate new_due_at to orders.due_at and respective item/product
        if (data && new_due_at && status && !['rejected', 'declined'].includes(status)) {
            const orderId = data.order_id;
            if (orderId) {
                await supabaseAdmin
                    .from('orders')
                    .update({ due_at: new_due_at })
                    .eq('id', orderId);
            }
            // Propagate due_at to order_items or order_products
            if (data.order_item_id) {
                await supabaseAdmin
                    .from('order_items')
                    .update({ due_at: new_due_at })
                    .eq('id', data.order_item_id);
            } else if (data.order_product_service_id) {
                const { data: svc } = await supabaseAdmin
                    .from('order_product_services')
                    .select('order_product_id')
                    .eq('id', data.order_product_service_id)
                    .single();
                if (svc?.order_product_id) {
                    await supabaseAdmin
                        .from('order_products')
                        .update({ due_at: new_due_at })
                        .eq('id', svc.order_product_id);
                }
            }
        }

        // Resume SLA khi extension được xử lý xong
        if (data && status && (status === 'notified_tech' || status === 'rejected')) {
            const itemId = data.order_item_id || data.order_product_service_id;
            if (itemId) {
                const stepFilter = data.order_item_id 
                    ? { order_item_id: itemId }
                    : { order_product_service_id: itemId };
                
                // Fetch steps đang pause
                const { data: pausedSteps } = await supabaseAdmin
                    .from('order_item_steps')
                    .select('id, sla_paused_at, sla_total_paused_minutes')
                    .match(stepFilter)
                    .not('sla_paused_at', 'is', null);
                
                if (pausedSteps && pausedSteps.length > 0) {
                    const now = new Date();
                    for (const step of pausedSteps) {
                        if (!step.sla_paused_at) continue;
                        const pausedAt = new Date(step.sla_paused_at);
                        const pausedMinutes = Math.round((now.getTime() - pausedAt.getTime()) / 60000);
                        
                        await supabaseAdmin
                            .from('order_item_steps')
                            .update({
                                sla_paused_at: null,
                                sla_total_paused_minutes: (step.sla_total_paused_minutes || 0) + Math.max(0, pausedMinutes)
                            })
                            .eq('id', step.id);
                    }
                }
            }
        }

        // 🔔 WH5: Fire webhook — Gia hạn (status change)
        if (status) {
            fireWebhook('extension.status_changed', {
                extension_id: id,
                new_status: status,
                customer_result: customer_result || null,
                kpi_impact: typeof kpi_impact === 'boolean' ? kpi_impact : null,
            });
        }

        if (status === 'manager_approved' && data?.requested_by) {
            notifyCrmMasterUser('extension.approved', {
                target_user_id: data.requested_by,
                target_role: 'sale',
                channel: 'telegram',
                order: { id: data.order_id },
                new_deadline: data.new_due_at || new_due_at || null,
                approver_id: userId || null,
                extension_id: id,
            });
        }

        res.json({ status: 'success', data });
    } catch (e) {
        next(e);
    }
});

export const requestsRouter = router;
