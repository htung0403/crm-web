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
        user:users!salary_records_user_id_fkey(id, name, email, avatar, department, role)
      `)
            .eq('month', currentMonth)
            .eq('year', currentYear)
            .order('created_at', { ascending: false });

        if (status) query = query.eq('status', status);

        const { data: salaries, error } = await query;

        if (error) {
            console.error('Salary query error:', error);
            // If table doesn't exist, return empty data instead of error
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                return res.json({
                    status: 'success',
                    data: {
                        salaries: [],
                        summary: {
                            totalBaseSalary: 0,
                            totalCommission: 0,
                            totalBonus: 0,
                            totalDeduction: 0,
                            totalNet: 0,
                            count: 0,
                            month: currentMonth,
                            year: currentYear,
                        }
                    },
                    message: 'Bảng salary_records chưa được tạo. Vui lòng chạy migration.'
                });
            }
            throw new ApiError('Lỗi khi lấy danh sách lương: ' + error.message, 500);
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
            .select('id, name, email, avatar, role, department, base_salary, hourly_rate')
            .eq('id', user_id)
            .single();

        if (userError || !user) {
            throw new ApiError('Không tìm thấy nhân viên', 404);
        }

        // Tính hoa hồng từ invoices đã thanh toán trong tháng
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        // Try to get commissions from commissions table (legacy)
        let totalCommission = 0;
        try {
            const { data: commissions } = await supabaseAdmin
                .from('commissions')
                .select('amount')
                .eq('user_id', user_id)
                .eq('status', 'approved')
                .gte('created_at', startDate)
                .lte('created_at', endDate);
            totalCommission = commissions?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
        } catch (e) {
            console.log('Commissions table may not exist, using 0');
        }

        // Calculate commission from order_items (OPTIMIZED)
        let salesCommission = 0;
        let techCommission = 0;

        try {
            // For sales: get commission from orders where user is sales_id
            const { data: salesOrders } = await supabaseAdmin
                .from('orders')
                .select('id')
                .eq('sales_id', user_id)
                .in('status', ['completed', 'delivered'])
                .gte('created_at', startDate)
                .lte('created_at', endDate + 'T23:59:59');

            if (salesOrders && salesOrders.length > 0) {
                const orderIds = salesOrders.map(o => o.id);
                const { data: salesItems } = await supabaseAdmin
                    .from('order_items')
                    .select('commission_sale_amount')
                    .in('order_id', orderIds);

                salesCommission = salesItems?.reduce((sum, item) =>
                    sum + (item.commission_sale_amount || 0), 0) || 0;
            }

            // For technician: get commission from completed order_items where user is technician_id
            const { data: completedOrders } = await supabaseAdmin
                .from('orders')
                .select('id')
                .in('status', ['completed', 'delivered'])
                .gte('created_at', startDate)
                .lte('created_at', endDate + 'T23:59:59');

            if (completedOrders && completedOrders.length > 0) {
                const completedOrderIds = completedOrders.map(o => o.id);
                const { data: techItems } = await supabaseAdmin
                    .from('order_items')
                    .select('commission_tech_amount')
                    .eq('technician_id', user_id)
                    .in('order_id', completedOrderIds);

                techCommission = techItems?.reduce((sum, item) =>
                    sum + (item.commission_tech_amount || 0), 0) || 0;
            }
        } catch (e) {
            console.log('Error calculating commission from order_items:', e);
        }

        // Total commission = legacy commissions + sales commission + tech commission
        totalCommission += salesCommission + techCommission;

        // Try to get timesheets (table may not exist)
        let totalHours = 176; // Default 22 days * 8 hours
        let overtimeHours = 0;
        try {
            const { data: timesheets } = await supabaseAdmin
                .from('timesheets')
                .select('hours_worked, overtime_hours')
                .eq('user_id', user_id)
                .gte('work_date', startDate)
                .lte('work_date', endDate);

            if (timesheets && timesheets.length > 0) {
                totalHours = timesheets.reduce((sum, t) => sum + (t.hours_worked || 0), 0);
                overtimeHours = timesheets.reduce((sum, t) => sum + (t.overtime_hours || 0), 0);
            }
        } catch (e) {
            console.log('Timesheets table may not exist, using defaults');
        }

        // Tính lương
        const baseSalary = user.base_salary || 15000000; // Default 15M
        const hourlyRate = user.hourly_rate || Math.floor(baseSalary / 176);
        const hourlyWage = totalHours * hourlyRate;
        const overtimePay = overtimeHours * hourlyRate * 1.5;

        // Calculate KPI achievement (mock for now, can be enhanced later)
        const kpiAchievement = 85 + Math.floor(Math.random() * 20);
        const bonus = kpiAchievement >= 100 ? 2000000 : kpiAchievement >= 90 ? 1000000 : kpiAchievement >= 80 ? 500000 : 0;

        // Calculate deductions
        const grossSalary = hourlyWage + overtimePay + totalCommission + bonus;
        const socialInsurance = Math.floor(grossSalary * 0.08);
        const healthInsurance = Math.floor(grossSalary * 0.015);
        const personalTax = grossSalary > 11000000 ? Math.floor((grossSalary - 11000000) * 0.05) : 0;
        const deduction = socialInsurance + healthInsurance + personalTax;

        const netSalary = grossSalary - deduction;

        // Try to check for existing record
        let existing = null;
        try {
            const { data } = await supabaseAdmin
                .from('salary_records')
                .select('id')
                .eq('user_id', user_id)
                .eq('month', month)
                .eq('year', year)
                .single();
            existing = data;
        } catch (e) {
            // Table may not exist
        }

        const salaryData = {
            user_id,
            month,
            year,
            base_salary: baseSalary,
            hourly_rate: hourlyRate,
            hourly_wage: hourlyWage,
            overtime_pay: overtimePay,
            total_hours: totalHours,
            overtime_hours: overtimeHours,
            commission: totalCommission,
            kpi_achievement: kpiAchievement,
            bonus,
            social_insurance: socialInsurance,
            health_insurance: healthInsurance,
            personal_tax: personalTax,
            deduction,
            gross_salary: grossSalary,
            net_salary: netSalary,
            status: 'draft',
        };

        let salary;
        try {
            if (existing) {
                const { data, error } = await supabaseAdmin
                    .from('salary_records')
                    .update({ ...salaryData, updated_at: new Date().toISOString() })
                    .eq('id', existing.id)
                    .select(`*, user:users!salary_records_user_id_fkey(id, name, email, avatar, role, department)`)
                    .single();

                if (error) throw new ApiError('Lỗi khi cập nhật lương: ' + error.message, 500);
                salary = data;
            } else {
                const { data, error } = await supabaseAdmin
                    .from('salary_records')
                    .insert({ ...salaryData, created_by: req.user!.id })
                    .select(`*, user:users!salary_records_user_id_fkey(id, name, email, avatar, role, department)`)
                    .single();

                if (error) throw new ApiError('Lỗi khi tạo bản ghi lương: ' + error.message, 500);
                salary = data;
            }
        } catch (e: any) {
            if (e.message?.includes('does not exist')) {
                throw new ApiError('Bảng salary_records chưa được tạo. Vui lòng chạy migration file: 20260127_salary_system.sql', 500);
            }
            throw e;
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
