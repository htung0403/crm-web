import { Router, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

function requireAdminOrManager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'manager') {
        return next(new ApiError('Chỉ admin hoặc quản lý mới xem được trang yêu cầu', 403));
    }
    next();
}

router.use(authenticate);
router.use(requireAdminOrManager);

// GET /api/requests/accessories - Danh sách yêu cầu Mua phụ kiện (V1 + V2)
router.get('/accessories', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('order_item_accessories')
            .select(`
                id,
                order_item_id,
                order_product_service_id,
                status,
                notes,
                created_at,
                updated_at,
                order_item:order_items(
                    id,
                    item_name,
                    item_code,
                    order:orders(id, order_code)
                ),
                order_product_service:order_product_services(
                    id,
                    order_product:order_products(name, product_code, order:orders(id, order_code))
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
                order_item_id,
                order_product_service_id,
                status,
                notes,
                created_at,
                updated_at,
                order_item:order_items(
                    id,
                    item_name,
                    item_code,
                    order:orders(id, order_code)
                ),
                order_product_service:order_product_services(
                    id,
                    order_product:order_products(name, product_code, order:orders(id, order_code))
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
