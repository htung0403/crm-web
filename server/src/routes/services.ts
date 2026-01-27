import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireManager } from '../middleware/auth.js';

const router = Router();

// Get all services
router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { category, status, search } = req.query;

        let query = supabaseAdmin
            .from('services')
            .select('*')
            .order('created_at', { ascending: false });

        if (category) query = query.eq('category', category);
        if (status) query = query.eq('status', status);
        if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);

        const { data: services, error } = await query;

        if (error) {
            throw new ApiError('Lỗi khi lấy danh sách dịch vụ', 500);
        }

        res.json({
            status: 'success',
            data: { services },
        });
    } catch (error) {
        next(error);
    }
});

// Get service by ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { data: service, error } = await supabaseAdmin
            .from('services')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !service) {
            throw new ApiError('Không tìm thấy dịch vụ', 404);
        }

        res.json({
            status: 'success',
            data: { service },
        });
    } catch (error) {
        next(error);
    }
});

// Create service
router.post('/', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { name, category, price, duration, description, commission_rate } = req.body;

        if (!name || !price) {
            throw new ApiError('Tên và giá dịch vụ là bắt buộc', 400);
        }

        // Auto-generate service code if not provided
        let code = req.body.code;
        if (!code) {
            // Get the latest service to generate next code
            const { data: latestService } = await supabaseAdmin
                .from('services')
                .select('code')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (latestService && latestService.code) {
                // Extract number from code (e.g., DV001 -> 1)
                const match = latestService.code.match(/\d+$/);
                const nextNum = match ? parseInt(match[0]) + 1 : 1;
                code = `DV${String(nextNum).padStart(3, '0')}`;
            } else {
                code = 'DV001';
            }
        }

        const { data: service, error } = await supabaseAdmin
            .from('services')
            .insert({
                code,
                name,
                category,
                price,
                duration,
                description,
                commission_rate: commission_rate || 5,
                status: 'active',
                created_by: req.user!.id,
            })
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi tạo dịch vụ: ' + error.message, 500);
        }

        res.status(201).json({
            status: 'success',
            data: { service },
        });
    } catch (error) {
        next(error);
    }
});

// Update service
router.put('/:id', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const updateFields = req.body;

        const { data: service, error } = await supabaseAdmin
            .from('services')
            .update({ ...updateFields, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi cập nhật dịch vụ', 500);
        }

        res.json({
            status: 'success',
            data: { service },
        });
    } catch (error) {
        next(error);
    }
});

// Delete service (soft delete)
router.delete('/:id', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('services')
            .update({ status: 'inactive', updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            throw new ApiError('Lỗi khi xóa dịch vụ', 500);
        }

        res.json({
            status: 'success',
            message: 'Đã vô hiệu hóa dịch vụ',
        });
    } catch (error) {
        next(error);
    }
});

// Get packages
router.get('/packages/list', authenticate, async (req, res, next) => {
    try {
        const { data: packages, error } = await supabaseAdmin
            .from('packages')
            .select('*, items:package_items(*, service:services(*))')
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) {
            throw new ApiError('Lỗi khi lấy danh sách gói dịch vụ', 500);
        }

        res.json({
            status: 'success',
            data: { packages },
        });
    } catch (error) {
        next(error);
    }
});

// Get vouchers
router.get('/vouchers/list', authenticate, async (req, res, next) => {
    try {
        const { data: vouchers, error } = await supabaseAdmin
            .from('vouchers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw new ApiError('Lỗi khi lấy danh sách voucher', 500);
        }

        res.json({
            status: 'success',
            data: { vouchers },
        });
    } catch (error) {
        next(error);
    }
});

export { router as servicesRouter };
