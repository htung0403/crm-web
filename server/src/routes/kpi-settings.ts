import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireManager } from '../middleware/auth.js';

const router = Router();

// ============================================================
// KPI RANK CONFIGS
// ============================================================

// GET /api/kpi/rank-configs - Get all rank configs
router.get('/rank-configs', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { data: configs, error } = await supabaseAdmin
            .from('kpi_rank_configs')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) throw new ApiError('Lỗi khi lấy cấu hình xếp loại: ' + error.message, 500);

        res.json({
            status: 'success',
            data: { configs: configs || [] }
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/kpi/rank-configs - Create rank config
router.post('/rank-configs', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { rank_code, rank_name, min_score, max_score, bonus_amount, penalty_amount, commission_factor, sort_order } = req.body;

        if (!rank_code || !rank_name) {
            throw new ApiError('Thiếu thông tin bắt buộc (rank_code, rank_name)', 400);
        }

        const { data: config, error } = await supabaseAdmin
            .from('kpi_rank_configs')
            .insert({
                rank_code,
                rank_name,
                min_score: min_score ?? 0,
                max_score: max_score ?? 100,
                bonus_amount: bonus_amount ?? 0,
                penalty_amount: penalty_amount ?? 0,
                commission_factor: commission_factor ?? 1.0,
                sort_order: sort_order ?? 0,
                is_active: true
            })
            .select()
            .single();

        if (error) throw new ApiError('Lỗi khi tạo cấu hình xếp loại: ' + error.message, 500);

        res.status(201).json({
            status: 'success',
            data: { config }
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/kpi/rank-configs/:id - Update rank config
router.put('/rank-configs/:id', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { rank_name, min_score, max_score, bonus_amount, penalty_amount, commission_factor, sort_order, is_active } = req.body;

        const updateData: any = {};
        if (rank_name !== undefined) updateData.rank_name = rank_name;
        if (min_score !== undefined) updateData.min_score = min_score;
        if (max_score !== undefined) updateData.max_score = max_score;
        if (bonus_amount !== undefined) updateData.bonus_amount = bonus_amount;
        if (penalty_amount !== undefined) updateData.penalty_amount = penalty_amount;
        if (commission_factor !== undefined) updateData.commission_factor = commission_factor;
        if (sort_order !== undefined) updateData.sort_order = sort_order;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data: config, error } = await supabaseAdmin
            .from('kpi_rank_configs')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new ApiError('Lỗi khi cập nhật cấu hình xếp loại: ' + error.message, 500);

        res.json({
            status: 'success',
            data: { config }
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/kpi/rank-configs/:id - Delete rank config
router.delete('/rank-configs/:id', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('kpi_rank_configs')
            .delete()
            .eq('id', id);

        if (error) throw new ApiError('Lỗi khi xóa cấu hình xếp loại: ' + error.message, 500);

        res.json({
            status: 'success',
            message: 'Đã xóa cấu hình xếp loại'
        });
    } catch (error) {
        next(error);
    }
});

// ============================================================
// BATCH ASSIGN KPI POLICY TO EMPLOYEES
// ============================================================

// GET /api/kpi/employee-assignments - List employees with their KPI policy assignments
router.get('/employee-assignments', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { role, department, status = 'active' } = req.query;

        let query = supabaseAdmin
            .from('users')
            .select(`
                id, name, email, role, department, status, kpi_policy_id
            `)
            .eq('status', status as string)
            .order('name', { ascending: true });

        if (role && role !== 'all') query = query.eq('role', role as string);
        if (department && department !== 'all') query = query.eq('department', department as string);

        const { data: employees, error } = await query;

        if (error) throw new ApiError('Lỗi khi lấy danh sách nhân sự: ' + error.message, 500);

        // Fetch policies separately to avoid join issues if column doesn't exist yet
        const { data: kpiPolicies } = await supabaseAdmin
            .from('kpi_policies')
            .select('id, code, name, role');

        const policyMap = new Map((kpiPolicies || []).map(p => [p.id, p]));

        const employeesWithPolicies = (employees || []).map((emp: any) => ({
            ...emp,
            kpi_policy: emp.kpi_policy_id ? policyMap.get(emp.kpi_policy_id) : null
        }));

        // Get all active policies for dropdown
        const { data: policies } = await supabaseAdmin
            .from('kpi_policies')
            .select('id, code, name, role')
            .eq('is_active', true)
            .order('name', { ascending: true });

        res.json({
            status: 'success',
            data: {
                employees: employeesWithPolicies,
                policies: policies || []
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/kpi/employee-assignments - Batch assign KPI policy to employees
router.post('/employee-assignments', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { assignments } = req.body;
        // assignments: [{ employee_id, policy_id }]

        if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
            throw new ApiError('Thiếu danh sách gán (assignments)', 400);
        }

        const results: any[] = [];
        const errors: any[] = [];

        for (const assignment of assignments) {
            try {
                const { employee_id, policy_id } = assignment;

                if (!employee_id) {
                    errors.push({ employee_id, error: 'Thiếu employee_id' });
                    continue;
                }

                // Validate policy exists if provided
                if (policy_id) {
                    const { data: policy } = await supabaseAdmin
                        .from('kpi_policies')
                        .select('id, role')
                        .eq('id', policy_id)
                        .single();

                    if (!policy) {
                        errors.push({ employee_id, error: 'Chính sách KPI không tồn tại' });
                        continue;
                    }
                }

                const { data: updated, error: updateError } = await supabaseAdmin
                    .from('users')
                    .update({ kpi_policy_id: policy_id || null })
                    .eq('id', employee_id)
                    .select('id, name, role, kpi_policy_id')
                    .single();

                if (updateError) {
                    errors.push({ employee_id, error: updateError.message });
                    continue;
                }

                results.push(updated);
            } catch (err: any) {
                errors.push({ employee_id: assignment.employee_id, error: err.message });
            }
        }

        res.json({
            status: 'success',
            data: {
                updated: results.length,
                errors: errors.length,
                results,
                errors_detail: errors
            }
        });
    } catch (error) {
        next(error);
    }
});

// ============================================================
// KPI LEADERBOARD
// ============================================================

// GET /api/kpi/leaderboard - KPI leaderboard by month
router.get('/leaderboard', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { month_key, role, limit = 20 } = req.query;

        // Default to current month
        const now = new Date();
        const currentMonthKey = month_key || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        let query = supabaseAdmin
            .from('kpi_monthly')
            .select(`
                *,
                employee:users(id, name, email, avatar, role, department),
                policy:kpi_policies(code, name)
            `)
            .eq('month_key', currentMonthKey)
            .in('status', ['pending', 'locked'])
            .order('total_score', { ascending: false })
            .limit(Number(limit));

        const { data: leaderboard, error } = await query;

        if (error) throw new ApiError('Lỗi khi lấy bảng xếp hạng: ' + error.message, 500);

        // Filter by role if specified (post-query since we joined)
        let filtered = leaderboard || [];
        if (role && role !== 'all') {
            filtered = filtered.filter((item: any) => item.employee?.role === role);
        }

        // Add position
        const ranked = filtered.map((item: any, index: number) => ({
            ...item,
            position: index + 1
        }));

        res.json({
            status: 'success',
            data: {
                leaderboard: ranked,
                month_key: currentMonthKey
            }
        });
    } catch (error) {
        next(error);
    }
});

export { router as kpiSettingsRouter };
