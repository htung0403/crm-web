import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireAccountant, requireManager } from '../middleware/auth.js';
import { fireWebhook } from '../utils/webhookNotifier.js';

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
        user:users!salary_records_user_id_fkey(id, name, email, avatar, department, role, employee_code)
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

// ====================================================================
// Calculate salary (CÔNG THỨC MỚI)
// ====================================================================
// LƯƠNG THỰC NHẬN = Lương cơ bản
//   + Làm thêm giờ (overtime_pay)
//   + Hoa hồng (service + product + referral)
//   + KPI Bonus
//   + Thưởng (từ violations_rewards type=reward)
//   − BHXH + BHYT + Thuế TNCN
//   − Ứng lương (từ salary_advances status=approved)
//   − Phạt vi phạm (từ violations_rewards type=violation)
// ====================================================================
router.post('/calculate', authenticate, requireAccountant, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { user_id, month, year } = req.body;

        if (!user_id || !month || !year) {
            throw new ApiError('Thiếu thông tin bắt buộc', 400);
        }

        // ── 1. Lấy thông tin user ────────────────────────────────
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, name, email, avatar, role, department, base_salary, hourly_rate')
            .eq('id', user_id)
            .single();

        if (userError || !user) {
            throw new ApiError('Không tìm thấy nhân viên', 404);
        }

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        const baseSalary = user.base_salary || 15000000;
        const hourlyRate = user.hourly_rate || Math.floor(baseSalary / 176);

        // ── 2. Tính giờ công từ TIMESHEETS ───────────────────────
        let totalHours = 176; // Default 22 days * 8 hours
        let overtimeHours = 0;
        try {
            // Query timesheets table (new schema: check_in, check_out, schedule_date)
            const { data: timesheets } = await supabaseAdmin
                .from('timesheets')
                .select('check_in, check_out, status, schedule_date')
                .eq('user_id', user_id)
                .gte('schedule_date', startDate)
                .lte('schedule_date', endDate);

            if (timesheets && timesheets.length > 0) {
                let workedHours = 0;
                for (const t of timesheets) {
                    if (t.check_in && t.check_out && t.status !== 'day_off') {
                        const checkIn = new Date(t.check_in);
                        const checkOut = new Date(t.check_out);
                        const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
                        workedHours += Math.min(hours, 12); // Cap at 12h per day
                    }
                }
                totalHours = Math.round(workedHours * 100) / 100;
                // Overtime = anything above 8h * working days
                const standardDays = timesheets.filter(t => t.status !== 'day_off').length;
                const standardHours = standardDays * 8;
                overtimeHours = Math.max(0, Math.round((totalHours - standardHours) * 100) / 100);
            }
        } catch (e) {
            console.log('[Salary] Timesheets table error, using defaults');
        }

        const hourlyWage = Math.round(totalHours * hourlyRate);
        const overtimePay = Math.round(overtimeHours * hourlyRate * 1.5);

        // ── 3. Tính HOA HỒNG từ orders ──────────────────────────
        let serviceCommission = 0;
        let productCommission = 0;
        let referralCommission = 0;

        try {
            // Commission from commissions table
            const { data: commissions } = await supabaseAdmin
                .from('commissions')
                .select('amount, commission_type')
                .eq('user_id', user_id)
                .in('status', ['pending', 'approved'])
                .gte('created_at', startDate)
                .lte('created_at', endDate + 'T23:59:59');

            if (commissions) {
                for (const c of commissions) {
                    const amt = c.amount || 0;
                    if (c.commission_type === 'referral') {
                        referralCommission += amt;
                    } else {
                        serviceCommission += amt;
                    }
                }
            }
        } catch (e) {
            console.log('[Salary] Commissions table may not exist');
        }

        try {
            // Sales commission from order_items
            const { data: salesOrders } = await supabaseAdmin
                .from('orders')
                .select('id')
                .eq('sales_id', user_id)
                .in('status', ['done', 'completed', 'delivered', 'after_sale'])
                .gte('created_at', startDate)
                .lte('created_at', endDate + 'T23:59:59');

            if (salesOrders && salesOrders.length > 0) {
                const orderIds = salesOrders.map(o => o.id);
                const { data: salesItems } = await supabaseAdmin
                    .from('order_items')
                    .select('commission_sale_amount, item_type')
                    .in('order_id', orderIds);

                if (salesItems) {
                    for (const item of salesItems) {
                        const amt = item.commission_sale_amount || 0;
                        if (item.item_type === 'product') {
                            productCommission += amt;
                        } else {
                            serviceCommission += amt;
                        }
                    }
                }
            }

            // Technician commission from order_items
            const { data: completedOrders } = await supabaseAdmin
                .from('orders')
                .select('id')
                .in('status', ['done', 'completed', 'delivered', 'after_sale'])
                .gte('created_at', startDate)
                .lte('created_at', endDate + 'T23:59:59');

            if (completedOrders && completedOrders.length > 0) {
                const completedOrderIds = completedOrders.map(o => o.id);
                const { data: techItems } = await supabaseAdmin
                    .from('order_items')
                    .select('commission_tech_amount')
                    .eq('technician_id', user_id)
                    .in('order_id', completedOrderIds);

                if (techItems) {
                    serviceCommission += techItems.reduce((sum, item) => sum + (item.commission_tech_amount || 0), 0);
                }
            }
        } catch (e) {
            console.log('[Salary] Error calculating commission from order_items:', e);
        }

        const totalCommission = serviceCommission + productCommission + referralCommission;

        // ── 4. Tính KPI BONUS từ kpi table ──────────────────────
        let kpiAchievement = 0;
        let kpiBonus = 0;
        try {
            const { data: kpis } = await supabaseAdmin
                .from('kpi')
                .select('achievement_rate, target, actual')
                .eq('user_id', user_id)
                .eq('month', month)
                .eq('year', year);

            if (kpis && kpis.length > 0) {
                // Average achievement rate across all KPI types
                kpiAchievement = Math.round(
                    kpis.reduce((sum, k) => sum + (k.achievement_rate || 0), 0) / kpis.length
                );
            }

            // KPI bonus tiers
            if (kpiAchievement >= 120) kpiBonus = 3000000;
            else if (kpiAchievement >= 100) kpiBonus = 2000000;
            else if (kpiAchievement >= 90) kpiBonus = 1000000;
            else if (kpiAchievement >= 80) kpiBonus = 500000;
            else kpiBonus = 0;
        } catch (e) {
            console.log('[Salary] KPI table may not exist');
        }

        // ── 5. Tính THƯỞNG / PHẠT từ violations_rewards ─────────
        let totalRewards = 0;
        let totalViolations = 0;
        try {
            const { data: vrRecords } = await supabaseAdmin
                .from('violations_rewards')
                .select('type, amount')
                .eq('user_id', user_id)
                .eq('month', month)
                .eq('year', year);

            if (vrRecords) {
                for (const r of vrRecords) {
                    if (r.type === 'reward') {
                        totalRewards += Number(r.amount);
                    } else {
                        totalViolations += Number(r.amount);
                    }
                }
            }
        } catch (e) {
            console.log('[Salary] violations_rewards table may not exist');
        }

        // ── 6. Tính ỨNG LƯƠNG từ salary_advances ─────────────────
        let totalAdvances = 0;
        try {
            const { data: advances } = await supabaseAdmin
                .from('salary_advances')
                .select('amount')
                .eq('user_id', user_id)
                .eq('month', month)
                .eq('year', year)
                .eq('status', 'approved');

            if (advances) {
                totalAdvances = advances.reduce((sum, a) => sum + Number(a.amount), 0);
            }
        } catch (e) {
            console.log('[Salary] salary_advances table may not exist');
        }

        // ── 7. Tổng hợp: GROSS SALARY ───────────────────────────
        const totalBonus = kpiBonus + totalRewards;
        const grossSalary = baseSalary + overtimePay + totalCommission + totalBonus;

        // ── 8. Tính KHẤU TRỪ ─────────────────────────────────────
        const socialInsurance = Math.floor(baseSalary * 0.08);   // 8% lương cơ bản
        const healthInsurance = Math.floor(baseSalary * 0.015);  // 1.5% lương cơ bản
        const taxableIncome = grossSalary - 11000000;            // Giảm trừ gia cảnh 11M
        const personalTax = taxableIncome > 0 ? Math.floor(taxableIncome * 0.05) : 0;

        const totalDeduction = socialInsurance + healthInsurance + personalTax + totalAdvances + totalViolations;

        // ── 9. NET SALARY ────────────────────────────────────────
        const netSalary = grossSalary - totalDeduction;

        console.log(`[Salary] User ${user.name} (${user_id}) - ${month}/${year}:`);
        console.log(`  Base: ${baseSalary}, Overtime: ${overtimePay}`);
        console.log(`  Commission: ${totalCommission} (service: ${serviceCommission}, product: ${productCommission}, referral: ${referralCommission})`);
        console.log(`  KPI: ${kpiAchievement}% → bonus: ${kpiBonus}`);
        console.log(`  Rewards: ${totalRewards}, Violations: ${totalViolations}`);
        console.log(`  Advances: ${totalAdvances}`);
        console.log(`  Insurance: ${socialInsurance + healthInsurance}, Tax: ${personalTax}`);
        console.log(`  Gross: ${grossSalary} → Net: ${netSalary}`);

        // ── 10. Upsert salary record ─────────────────────────────
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
            // Commission breakdown
            service_commission: serviceCommission,
            product_commission: productCommission,
            referral_commission: referralCommission,
            commission: totalCommission,
            // KPI
            kpi_achievement: kpiAchievement,
            // Bonus = KPI bonus + rewards
            bonus: totalBonus,
            // Deductions breakdown
            social_insurance: socialInsurance,
            health_insurance: healthInsurance,
            personal_tax: personalTax,
            advances: totalAdvances,
            // Violations as separate field
            deduction: totalDeduction,
            // Totals
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
                    .select(`*, user:users!salary_records_user_id_fkey(id, name, email, avatar, role, department, employee_code)`)
                    .single();

                if (error) throw new ApiError('Lỗi khi cập nhật lương: ' + error.message, 500);
                salary = data;
            } else {
                const { data, error } = await supabaseAdmin
                    .from('salary_records')
                    .insert({ ...salaryData, created_by: req.user!.id })
                    .select(`*, user:users!salary_records_user_id_fkey(id, name, email, avatar, role, department, employee_code)`)
                    .single();

                if (error) throw new ApiError('Lỗi khi tạo bản ghi lương: ' + error.message, 500);
                salary = data;
            }
        } catch (e: any) {
            if (e.message?.includes('does not exist')) {
                throw new ApiError('Bảng salary_records chưa được tạo. Vui lòng chạy migration.', 500);
            }
            throw e;
        }

        // ── 11. Mark advances as deducted ────────────────────────
        if (totalAdvances > 0 && salary) {
            try {
                await supabaseAdmin
                    .from('salary_advances')
                    .update({
                        status: 'deducted',
                        deducted_at: new Date().toISOString(),
                        salary_record_id: salary.id,
                    })
                    .eq('user_id', user_id)
                    .eq('month', month)
                    .eq('year', year)
                    .eq('status', 'approved');
            } catch (e) {
                console.log('[Salary] Error marking advances as deducted:', e);
            }
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

// POST /api/salary/send-payroll — Chốt bảng lương & gửi Telegram/n8n
router.post('/send-payroll', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { month, year } = req.body;

        if (!month || !year) {
            throw new ApiError('Thiếu tháng hoặc năm', 400);
        }

        // Lấy toàn bộ bảng lương tháng đó
        const { data: salaries, error } = await supabaseAdmin
            .from('salary_records')
            .select(`
                *,
                user:users!salary_records_user_id_fkey(id, name, email, role, department)
            `)
            .eq('month', month)
            .eq('year', year);

        if (error) {
            throw new ApiError('Lỗi khi lấy bảng lương: ' + error.message, 500);
        }

        if (!salaries || salaries.length === 0) {
            throw new ApiError('Không có dữ liệu lương cho tháng này', 404);
        }

        // Format payroll data cho n8n
        const payrollData = salaries.map((s: any) => ({
            employee_name: s.user?.name || 'N/A',
            department: s.user?.department || 'N/A',
            role: s.user?.role || 'N/A',
            base_salary: s.base_salary,
            commission: s.commission,
            kpi_achievement: s.kpi_achievement,
            bonus: s.bonus,
            deduction: s.deduction,
            advances: s.advances,
            gross_salary: s.gross_salary,
            net_salary: s.net_salary,
            status: s.status,
        }));

        // 🔔 WH8: Fire webhook — Chốt Bảng Lương
        fireWebhook('payroll.finalized', {
            month,
            year,
            total_employees: payrollData.length,
            total_net: salaries.reduce((sum: number, s: any) => sum + (s.net_salary || 0), 0),
            payroll: payrollData,
        });

        res.json({
            status: 'success',
            message: `Đã gửi bảng lương tháng ${month}/${year} (${payrollData.length} nhân viên)`,
            data: { count: payrollData.length },
        });
    } catch (error) {
        next(error);
    }
});

export { router as salaryRouter };
