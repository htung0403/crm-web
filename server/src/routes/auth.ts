import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { config } from '../config/index.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new ApiError('Email và mật khẩu là bắt buộc', 400);
        }

        // Lấy user từ database
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase())
            .single();

        if (error || !user) {
            throw new ApiError('Email hoặc mật khẩu không đúng', 401);
        }

        if (user.status !== 'active') {
            throw new ApiError('Tài khoản đã bị vô hiệu hóa', 401);
        }

        // Kiểm tra password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            throw new ApiError('Email hoặc mật khẩu không đúng', 401);
        }

        // Tạo JWT token
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
            },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
        );

        // Cập nhật last_login
        await supabaseAdmin
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);

        res.json({
            status: 'success',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    avatar: user.avatar,
                },
                token,
            },
        });
    } catch (error) {
        next(error);
    }
});

// Register (chỉ admin mới có thể tạo user mới)
router.post('/register', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        if (req.user?.role !== 'manager' && req.user?.role !== 'admin') {
            throw new ApiError('Không có quyền tạo tài khoản mới', 403);
        }

        const { email, password, name, role, phone, department } = req.body;

        if (!email || !password || !name || !role) {
            throw new ApiError('Thiếu thông tin bắt buộc', 400);
        }

        // Kiểm tra email đã tồn tại chưa
        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email.toLowerCase())
            .single();

        if (existingUser) {
            throw new ApiError('Email đã được sử dụng', 400);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Tạo user mới
        const { data: newUser, error } = await supabaseAdmin
            .from('users')
            .insert({
                email: email.toLowerCase(),
                password_hash: passwordHash,
                name,
                role,
                phone,
                department,
                status: 'active',
                created_by: req.user.id,
            })
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi tạo tài khoản: ' + error.message, 500);
        }

        res.status(201).json({
            status: 'success',
            data: {
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    name: newUser.name,
                    role: newUser.role,
                },
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get current user
router.get('/me', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('id, email, name, role, phone, avatar, department, status, created_at')
            .eq('id', req.user!.id)
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

// Change password
router.post('/change-password', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            throw new ApiError('Thiếu thông tin bắt buộc', 400);
        }

        // Lấy user hiện tại
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('password_hash')
            .eq('id', req.user!.id)
            .single();

        if (error || !user) {
            throw new ApiError('Không tìm thấy người dùng', 404);
        }

        // Kiểm tra mật khẩu hiện tại
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
            throw new ApiError('Mật khẩu hiện tại không đúng', 400);
        }

        // Hash mật khẩu mới
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);

        // Cập nhật mật khẩu
        await supabaseAdmin
            .from('users')
            .update({ password_hash: newPasswordHash, updated_at: new Date().toISOString() })
            .eq('id', req.user!.id);

        res.json({
            status: 'success',
            message: 'Đổi mật khẩu thành công',
        });
    } catch (error) {
        next(error);
    }
});

// Logout (chỉ để invalidate token ở client)
router.post('/logout', authenticate, (req, res) => {
    res.json({
        status: 'success',
        message: 'Đăng xuất thành công',
    });
});

export { router as authRouter };
