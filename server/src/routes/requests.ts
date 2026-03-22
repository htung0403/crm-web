import { Router, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { fireWebhook } from '../utils/webhookNotifier.js';

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

        // Fetch CURRENT to validate status change
        const { data: current, error: fetchError } = await supabaseAdmin
            .from('order_item_accessories')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !current) {
            throw new ApiError('Không tìm thấy yêu cầu: ' + (fetchError?.message || ''), 404);
        }

        // Validate if changing status
        if (status && status !== current.status) {
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

        // 🔔 WH5: Fire webhook — Mua phụ kiện (status change)
        if (status) {
            fireWebhook('accessory.status_changed', {
                accessory_id: id,
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

router.patch('/partners/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { status, notes, metadata } = req.body;
        const userId = req.user?.id;

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

        // 🔔 WH5: Fire webhook — Gửi đối tác (status change)
        if (status) {
            fireWebhook('partner.status_changed', {
                partner_id: id,
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
                requested_by,
                reason,
                status,
                customer_result,
                new_due_at,
                valid_reason,
                created_at,
                updated_at,
                order:orders(id, order_code)
            `)
            .order('created_at', { ascending: false });

        if (error) throw new ApiError('Không thể lấy danh sách yêu cầu gia hạn', 500);

        res.json({ status: 'success', data: data || [] });
    } catch (e) {
        next(e);
    }
});

export const requestsRouter = router;
