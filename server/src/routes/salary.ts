import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireAccountant, requireManager } from '../middleware/auth.js';

const router = Router();

// Get salary list by period
router.get('/', authenticate, requireAccountant, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { month, year, status } = req.query;
        const currentMonth = month || new Date().getMonth() + 1;
        const currentYear = year || new Date().getFullYear();

        let query = supabaseAdmin
            .from('salary_records')
            .select(`
        *,
        user:users(id, name, email, department, role)
      `)
            .eq('month', currentMonth)
            .eq('year', currentYear)
            .order('created_at', { ascending: false });

        if (status) query = query.eq('status', status);

        const { data: salaries, error } = await query;

        if (error) {
            throw new ApiError('Lỗi khi lấy danh sách lương', 500);
        }

        // Tính tổng
        const totalBaseSalary = salaries?.reduce((sum, s) => sum + s.base_salary, 0) || 0;
        const totalCommission = salaries?.reduce((sum, s) => sum + s.commission, 0) || 0;
        const totalBonus = salaries?.reduce((sum, s) => sum + s.bonus, 0) || 0;
        const totalDeduction = salaries?.reduce((sum, s) => sum + s.deduction, 0) || 0;
        const totalNet = salaries?.reduce((sum, s) => sum + s.net_salary, 0) || 0;

        res.json({
            status: 'success',
            data: {
                salaries,
                summary: {
                    totalBaseSalary,
                    totalCommission,
                    totalBonus,
                    totalDeduction,
                    totalNet,
                    count: salaries?.length || 0,
                    month: currentMonth,
                    year: currentYear,
                }
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get salary by user
router.get('/user/:userId', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { userId } = req.params;
        const { year } = req.query;
        const currentYear = year || new Date().getFullYear();

        // Chỉ cho phép xem lương của chính mình hoặc quản lý
        if (req.user!.id !== userId && req.user!.role !== 'manager' && req.user!.role !== 'accountant') {
            throw new ApiError('Không có quyền xem lương người khác', 403);
        }

        const { data: salaries, error } = await supabaseAdmin
            .from('salary_records')
            .select('*')
            .eq('user_id', userId)
            .eq('year', currentYear)
            .order('month', { ascending: true });

        if (error) {
            throw new ApiError('Lỗi khi lấy lương', 500);
        }

        res.json({
            status: 'success',
            data: { salaries },
        });
    } catch (error) {
        next(error);
    }
});

// Calculate salary (tính lương cho 1 nhân viên)
router.post('/calculate', authenticate, requireAccountant, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { user_id, month, year } = req.body;

        if (!user_id || !month || !year) {
            throw new ApiError('Thiếu thông tin bắt buộc', 400);
        }

        // Lấy thông tin user
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, name, base_salary, hourly_rate')
            .eq('id', user_id)
            .single();

        if (userError || !user) {
            throw new ApiError('Không tìm thấy nhân viên', 404);
        }

        // Tính hoa hồng từ invoices đã thanh toán trong tháng
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const { data: commissions } = await supabaseAdmin
            .from('commissions')
            .select('amount')
            .eq('user_id', user_id)
            .eq('status', 'approved')
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        const totalCommission = commissions?.reduce((sum, c) => sum + c.amount, 0) || 0;

        // Tính giờ làm việc
        const { data: timesheets } = await supabaseAdmin
            .from('timesheets')
            .select('hours_worked, overtime_hours')
            .eq('user_id', user_id)
            .gte('work_date', startDate)
            .lte('work_date', endDate);

        const totalHours = timesheets?.reduce((sum, t) => sum + t.hours_worked, 0) || 0;
        const overtimeHours = timesheets?.reduce((sum, t) => sum + t.overtime_hours, 0) || 0;

        // Tính lương
        const baseSalary = user.base_salary || 0;
        const hourlyWage = totalHours * (user.hourly_rate || 0);
        const overtimePay = overtimeHours * (user.hourly_rate || 0) * 1.5;
        const bonus = 0; // Có thể thêm logic tính thưởng
        const deduction = 0; // Có thể thêm logic tính khấu trừ
        const netSalary = baseSalary + hourlyWage + overtimePay + totalCommission + bonus - deduction;

        // Kiểm tra đã có bản ghi chưa
        const { data: existing } = await supabaseAdmin
            .from('salary_records')
            .select('id')
            .eq('user_id', user_id)
            .eq('month', month)
            .eq('year', year)
            .single();

        const salaryData = {
            user_id,
            month,
            year,
            base_salary: baseSalary,
            hourly_wage: hourlyWage,
            overtime_pay: overtimePay,
            commission: totalCommission,
            bonus,
            deduction,
            net_salary: netSalary,
            total_hours: totalHours,
            overtime_hours: overtimeHours,
            status: 'draft',
        };

        let salary;
        if (existing) {
            const { data, error } = await supabaseAdmin
                .from('salary_records')
                .update({ ...salaryData, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) throw new ApiError('Lỗi khi cập nhật lương', 500);
            salary = data;
        } else {
            const { data, error } = await supabaseAdmin
                .from('salary_records')
                .insert({ ...salaryData, created_by: req.user!.id })
                .select()
                .single();

            if (error) throw new ApiError('Lỗi khi tạo bản ghi lương: ' + error.message, 500);
            salary = data;
        }

        res.json({
            status: 'success',
            data: { salary },
        });
    } catch (error) {
        next(error);
    }
});

// Approve salary
router.patch('/:id/approve', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { data: salary, error } = await supabaseAdmin
            .from('salary_records')
            .update({
                status: 'approved',
                approved_by: req.user!.id,
                approved_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi duyệt lương', 500);
        }

        res.json({
            status: 'success',
            data: { salary },
        });
    } catch (error) {
        next(error);
    }
});

// Mark as paid
router.patch('/:id/pay', authenticate, requireAccountant, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { payment_method } = req.body;

        const { data: salary, error } = await supabaseAdmin
            .from('salary_records')
            .update({
                status: 'paid',
                payment_method: payment_method || 'bank_transfer',
                paid_at: new Date().toISOString(),
                paid_by: req.user!.id,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi cập nhật trạng thái thanh toán', 500);
        }

        res.json({
            status: 'success',
            data: { salary },
        });
    } catch (error) {
        next(error);
    }
});

export { router as salaryRouter };
