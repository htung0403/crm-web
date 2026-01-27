import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireManager } from '../middleware/auth.js';

const router = Router();

// Get KPI overview
router.get('/overview', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { month, year } = req.query;
        const currentMonth = month || new Date().getMonth() + 1;
        const currentYear = year || new Date().getFullYear();

        // Lấy KPI của tất cả nhân viên sale
        const { data: kpis, error } = await supabaseAdmin
            .from('kpi_records')
            .select(`
        *,
        user:users(id, name, email, avatar, department)
      `)
            .eq('month', currentMonth)
            .eq('year', currentYear)
            .order('achievement_rate', { ascending: false });

        if (error) {
            throw new ApiError('Lỗi khi lấy dữ liệu KPI', 500);
        }

        // Tính tổng quan
        const totalTarget = kpis?.reduce((sum, k) => sum + k.target, 0) || 0;
        const totalActual = kpis?.reduce((sum, k) => sum + k.actual, 0) || 0;
        const avgAchievement = kpis?.length > 0
            ? kpis.reduce((sum, k) => sum + k.achievement_rate, 0) / kpis.length
            : 0;

        res.json({
            status: 'success',
            data: {
                kpis,
                summary: {
                    totalTarget,
                    totalActual,
                    avgAchievement: avgAchievement.toFixed(1),
                    month: currentMonth,
                    year: currentYear,
                }
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get KPI by user
router.get('/user/:userId', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { userId } = req.params;
        const { year } = req.query;
        const currentYear = year || new Date().getFullYear();

        const { data: kpis, error } = await supabaseAdmin
            .from('kpi_records')
            .select('*')
            .eq('user_id', userId)
            .eq('year', currentYear)
            .order('month', { ascending: true });

        if (error) {
            throw new ApiError('Lỗi khi lấy KPI', 500);
        }

        res.json({
            status: 'success',
            data: { kpis },
        });
    } catch (error) {
        next(error);
    }
});

// Set KPI target (chỉ manager)
router.post('/target', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { user_id, month, year, target, target_type } = req.body;

        if (!user_id || !month || !year || !target) {
            throw new ApiError('Thiếu thông tin bắt buộc', 400);
        }

        // Check if KPI already exists
        const { data: existing } = await supabaseAdmin
            .from('kpi_records')
            .select('id')
            .eq('user_id', user_id)
            .eq('month', month)
            .eq('year', year)
            .single();

        if (existing) {
            // Update existing
            const { data: kpi, error } = await supabaseAdmin
                .from('kpi_records')
                .update({
                    target,
                    target_type: target_type || 'revenue',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) throw new ApiError('Lỗi khi cập nhật KPI', 500);

            return res.json({
                status: 'success',
                data: { kpi },
            });
        }

        // Create new KPI record
        const { data: kpi, error } = await supabaseAdmin
            .from('kpi_records')
            .insert({
                user_id,
                month,
                year,
                target,
                target_type: target_type || 'revenue',
                actual: 0,
                achievement_rate: 0,
                created_by: req.user!.id,
            })
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi tạo KPI: ' + error.message, 500);
        }

        res.status(201).json({
            status: 'success',
            data: { kpi },
        });
    } catch (error) {
        next(error);
    }
});

// Update KPI actual (thường được gọi tự động khi có hóa đơn thanh toán)
router.patch('/update/:userId', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { userId } = req.params;
        const { month, year, actual } = req.body;

        const achievementRate = actual > 0 ? 0 : 0; // Sẽ tính lại

        const { data: kpi, error } = await supabaseAdmin
            .from('kpi_records')
            .update({
                actual,
                achievement_rate: achievementRate,
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
            .eq('month', month)
            .eq('year', year)
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi cập nhật KPI', 500);
        }

        // Recalculate achievement rate
        if (kpi && kpi.target > 0) {
            const rate = ((kpi.actual / kpi.target) * 100).toFixed(1);
            await supabaseAdmin
                .from('kpi_records')
                .update({ achievement_rate: parseFloat(rate) })
                .eq('id', kpi.id);
        }

        res.json({
            status: 'success',
            data: { kpi },
        });
    } catch (error) {
        next(error);
    }
});

// Get leaderboard
router.get('/leaderboard', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { month, year, limit = 10 } = req.query;
        const currentMonth = month || new Date().getMonth() + 1;
        const currentYear = year || new Date().getFullYear();

        const { data: leaderboard, error } = await supabaseAdmin
            .from('kpi_records')
            .select(`
        *,
        user:users(id, name, email, avatar)
      `)
            .eq('month', currentMonth)
            .eq('year', currentYear)
            .order('actual', { ascending: false })
            .limit(Number(limit));

        if (error) {
            throw new ApiError('Lỗi khi lấy bảng xếp hạng', 500);
        }

        res.json({
            status: 'success',
            data: { leaderboard },
        });
    } catch (error) {
        next(error);
    }
});

export { router as kpiRouter };
