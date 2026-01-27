import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireManager } from '../middleware/auth.js';

const router = Router();

// Get all users (chỉ manager)
router.get('/', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { role, department, status, search } = req.query;

        let query = supabaseAdmin
            .from('users')
            .select('id, email, name, role, phone, avatar, department, status, created_at, last_login')
            .order('created_at', { ascending: false });

        if (role) query = query.eq('role', role);
        if (department) query = query.eq('department', department);
        if (status) query = query.eq('status', status);
        if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);

        const { data: users, error } = await query;

        if (error) {
            throw new ApiError('Lỗi khi lấy danh sách người dùng', 500);
        }

        res.json({
            status: 'success',
            data: { users },
        });
    } catch (error) {
        next(error);
    }
});

// Get user by ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        // Chỉ cho phép xem thông tin của chính mình hoặc quản lý
        if (req.user!.id !== id && req.user!.role !== 'manager' && req.user!.role !== 'admin') {
            throw new ApiError('Không có quyền xem thông tin người dùng này', 403);
        }

        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('id, email, name, role, phone, avatar, department, status, created_at, last_login')
            .eq('id', id)
            .single();

        if (error || !user) {
            throw new ApiError('Không tìm thấy người dùng', 404);
        }

        res.json({
            status: 'success',
            data: { user },
        });
    } catch (error) {
        next(error);
    }
});

// Update user
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { name, phone, avatar, department, status, role } = req.body;

        // Chỉ cho phép cập nhật thông tin của chính mình hoặc quản lý
        const isOwner = req.user!.id === id;
        const isManager = req.user!.role === 'manager' || req.user!.role === 'admin';

        if (!isOwner && !isManager) {
            throw new ApiError('Không có quyền cập nhật thông tin người dùng này', 403);
        }

        const updateData: Record<string, any> = {
            updated_at: new Date().toISOString(),
        };

        // Thông tin cơ bản - ai cũng có thể cập nhật cho mình
        if (name) updateData.name = name;
        if (phone) updateData.phone = phone;
        if (avatar) updateData.avatar = avatar;

        // Chỉ manager mới được cập nhật role, status, department
        if (isManager) {
            if (department) updateData.department = department;
            if (status) updateData.status = status;
            if (role) updateData.role = role;
        }

        const { data: user, error } = await supabaseAdmin
            .from('users')
            .update(updateData)
            .eq('id', id)
            .select('id, email, name, role, phone, avatar, department, status')
            .single();

        if (error) {
            throw new ApiError('Lỗi khi cập nhật người dùng', 500);
        }

        res.json({
            status: 'success',
            data: { user },
        });
    } catch (error) {
        next(error);
    }
});

// Delete user (soft delete - chỉ manager)
router.delete('/:id', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        // Không cho phép xóa chính mình
        if (req.user!.id === id) {
            throw new ApiError('Không thể xóa tài khoản của chính mình', 400);
        }

        const { error } = await supabaseAdmin
            .from('users')
            .update({ status: 'inactive', updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            throw new ApiError('Lỗi khi xóa người dùng', 500);
        }

        res.json({
            status: 'success',
            message: 'Đã vô hiệu hóa người dùng',
        });
    } catch (error) {
        next(error);
    }
});

export { router as usersRouter };
