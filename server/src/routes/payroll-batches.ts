import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireAccountant, requireManager } from '../middleware/auth.js';

const router = Router();

// ========== Helper: Get last Sunday of a given month ==========
function getLastSundayOfMonth(year: number, month: number): Date {
    // month is 1-based
    const lastDay = new Date(year, month, 0); // last day of the month
    const dayOfWeek = lastDay.getDay(); // 0=Sunday
    const lastSunday = new Date(lastDay);
    lastSunday.setDate(lastDay.getDate() - (dayOfWeek === 0 ? 0 : dayOfWeek));
    return lastSunday;
}

// ========== Helper: Create or get payroll batch for a month ==========
async function getOrCreatePayrollBatch(month: number, year: number, createdBy?: string) {
    // Check if batch already exists
    const { data: existing } = await supabaseAdmin
        .from('payroll_batches')
        .select('*')
        .eq('month', month)
        .eq('year', year)
        .single();

    if (existing) return existing;

    // Create new batch
    const lastDay = new Date(year, month, 0).getDate();
    const workPeriodStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const workPeriodEnd = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const { data: batch, error } = await supabaseAdmin
        .from('payroll_batches')
        .insert({
            code: '', // auto-generated via trigger
            name: `Bảng lương tháng ${month}/${year}`,
            month,
            year,
            pay_period: 'Hàng tháng',
            work_period_start: workPeriodStart,
            work_period_end: workPeriodEnd,
            status: 'pending',
            scope: 'Tất cả nhân viên',
            created_by: createdBy || null,
        })
        .select()
        .single();

    if (error) {
        console.error('[PayrollBatch] Error creating batch:', error);
        throw new ApiError('Lỗi khi tạo bảng lương: ' + error.message, 500);
    }

    return batch;
}

// ========== Helper: Recalculate batch totals from salary_records ==========
async function recalculateBatchTotals(batchId: string) {
    const { data: records } = await supabaseAdmin
        .from('salary_records')
        .select('gross_salary, net_salary, deduction, status')
        .eq('payroll_batch_id', batchId);

    if (!records) return;

    const totalSalary = records.reduce((s, r) => s + (r.gross_salary || r.net_salary + r.deduction), 0);
    const totalPaid = records.reduce((s, r) => s + (r.status === 'paid' ? r.net_salary : 0), 0);

    await supabaseAdmin
        .from('payroll_batches')
        .update({
            total_salary: totalSalary,
            total_paid: totalPaid,
            total_remaining: totalSalary - totalPaid,
            employee_count: records.length,
        })
        .eq('id', batchId);
}

// ========================================================================
// ROUTES
// ========================================================================

// GET /api/payroll-batches - List all payroll batches
router.get('/', authenticate, requireAccountant, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { status, month, year } = req.query;

        let query = supabaseAdmin
            .from('payroll_batches')
            .select('*')
            .order('year', { ascending: false })
            .order('month', { ascending: false });

        if (status) query = query.eq('status', status);
        if (month) query = query.eq('month', Number(month));
        if (year) query = query.eq('year', Number(year));

        const { data: batches, error } = await query;

        if (error) {
            if (error.code === '42P01' || error.message?.includes('does not exist')) {
                return res.json({ status: 'success', data: { batches: [] } });
            }
            throw new ApiError('Lỗi khi lấy danh sách bảng lương: ' + error.message, 500);
        }

        res.json({ status: 'success', data: { batches: batches || [] } });
    } catch (error) {
        next(error);
    }
});

// GET /api/payroll-batches/:id - Get single batch with salary records
router.get('/:id', authenticate, requireAccountant, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { data: batch, error } = await supabaseAdmin
            .from('payroll_batches')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !batch) throw new ApiError('Không tìm thấy bảng lương', 404);

        // Get salary records for this batch
        const { data: records } = await supabaseAdmin
            .from('salary_records')
            .select(`*, user:users!salary_records_user_id_fkey(id, name, email, avatar, department, role, employee_code)`)
            .eq('payroll_batch_id', id)
            .order('created_at', { ascending: false });

        res.json({
            status: 'success',
            data: { batch, records: records || [] },
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/payroll-batches/generate - Generate payroll batch for a month
// This calculates salary for ALL active employees and creates/updates the batch
router.post('/generate', authenticate, requireAccountant, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { month, year } = req.body;
        if (!month || !year) throw new ApiError('Thiếu tháng hoặc năm', 400);

        // Create or get the batch
        const batch = await getOrCreatePayrollBatch(month, year, req.user!.id);

        // Get all active employees
        const { data: users } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('status', 'active');

        if (!users || users.length === 0) {
            return res.json({
                status: 'success',
                data: { batch, message: 'Không có nhân viên active' },
            });
        }

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        for (const user of users) {
            try {
                const { data: userData } = await supabaseAdmin
                    .from('users')
                    .select('id, name, base_salary, hourly_rate, role')
                    .eq('id', user.id)
                    .single();

                if (!userData) continue;

                const baseSalary = userData.base_salary || 15000000;
                const hourlyRate = userData.hourly_rate || Math.floor(baseSalary / 176);

                // ── Commission breakdown ──
                let serviceCommission = 0, productCommission = 0, referralCommission = 0;
                try {
                    const { data: commissions } = await supabaseAdmin
                        .from('commissions')
                        .select('amount, commission_type')
                        .eq('user_id', user.id)
                        .in('status', ['pending', 'approved'])
                        .gte('created_at', startDate)
                        .lte('created_at', endDate + 'T23:59:59');
                    if (commissions) {
                        for (const c of commissions) {
                            if (c.commission_type === 'referral') referralCommission += (c.amount || 0);
                            else serviceCommission += (c.amount || 0);
                        }
                    }
                } catch (e) { /* table may not exist */ }

                try {
                    const { data: salesOrders } = await supabaseAdmin
                        .from('orders')
                        .select('id')
                        .eq('sales_id', user.id)
                        .in('status', ['done', 'completed', 'delivered', 'after_sale'])
                        .gte('created_at', startDate)
                        .lte('created_at', endDate + 'T23:59:59');
                    if (salesOrders && salesOrders.length > 0) {
                        const { data: salesItems } = await supabaseAdmin
                            .from('order_items')
                            .select('commission_sale_amount, item_type')
                            .in('order_id', salesOrders.map(o => o.id));
                        if (salesItems) {
                            for (const item of salesItems) {
                                if (item.item_type === 'product') productCommission += (item.commission_sale_amount || 0);
                                else serviceCommission += (item.commission_sale_amount || 0);
                            }
                        }
                    }
                } catch (e) { /* ignore */ }

                const totalCommission = serviceCommission + productCommission + referralCommission;

                // ── Timesheets ──
                let totalHours = 176, overtimeHours = 0;
                try {
                    const { data: timesheets } = await supabaseAdmin
                        .from('timesheets')
                        .select('check_in, check_out, status, schedule_date')
                        .eq('user_id', user.id)
                        .gte('schedule_date', startDate)
                        .lte('schedule_date', endDate);
                    if (timesheets && timesheets.length > 0) {
                        let workedHours = 0;
                        for (const t of timesheets) {
                            if (t.check_in && t.check_out && t.status !== 'day_off') {
                                const hours = (new Date(t.check_out).getTime() - new Date(t.check_in).getTime()) / (1000 * 60 * 60);
                                workedHours += Math.min(hours, 12);
                            }
                        }
                        totalHours = Math.round(workedHours * 100) / 100;
                        const standardDays = timesheets.filter(t => t.status !== 'day_off').length;
                        overtimeHours = Math.max(0, Math.round((totalHours - standardDays * 8) * 100) / 100);
                    }
                } catch (e) { /* ignore */ }

                const hourlyWage = Math.round(totalHours * hourlyRate);
                const overtimePay = Math.round(overtimeHours * hourlyRate * 1.5);

                // ── KPI ──
                let kpiAchievement = 0, kpiBonus = 0;
                try {
                    const { data: kpis } = await supabaseAdmin
                        .from('kpi')
                        .select('achievement_rate')
                        .eq('user_id', user.id)
                        .eq('month', month)
                        .eq('year', year);
                    if (kpis && kpis.length > 0) {
                        kpiAchievement = Math.round(kpis.reduce((sum: number, k: any) => sum + (k.achievement_rate || 0), 0) / kpis.length);
                    }
                    if (kpiAchievement >= 120) kpiBonus = 3000000;
                    else if (kpiAchievement >= 100) kpiBonus = 2000000;
                    else if (kpiAchievement >= 90) kpiBonus = 1000000;
                    else if (kpiAchievement >= 80) kpiBonus = 500000;
                } catch (e) { /* ignore */ }

                // ── Violations / Rewards ──
                let totalRewards = 0, totalViolationAmount = 0;
                try {
                    const { data: vrRecords } = await supabaseAdmin
                        .from('violations_rewards')
                        .select('type, amount')
                        .eq('user_id', user.id)
                        .eq('month', month)
                        .eq('year', year);
                    if (vrRecords) {
                        for (const r of vrRecords) {
                            if (r.type === 'reward') totalRewards += Number(r.amount);
                            else totalViolationAmount += Number(r.amount);
                        }
                    }
                } catch (e) { /* ignore */ }

                // ── Advances ──
                let totalAdvances = 0;
                try {
                    const { data: advances } = await supabaseAdmin
                        .from('salary_advances')
                        .select('amount')
                        .eq('user_id', user.id)
                        .eq('month', month)
                        .eq('year', year)
                        .eq('status', 'approved');
                    if (advances) totalAdvances = advances.reduce((sum: number, a: any) => sum + Number(a.amount), 0);
                } catch (e) { /* ignore */ }

                // ── Final calculation (aligned with salary.ts formula) ──
                const totalBonus = kpiBonus + totalRewards;
                const grossSalary = baseSalary + overtimePay + totalCommission + totalBonus;
                const socialInsurance = Math.floor(baseSalary * 0.08);
                const healthInsurance = Math.floor(baseSalary * 0.015);
                const taxableIncome = grossSalary - 11000000;
                const personalTax = taxableIncome > 0 ? Math.floor(taxableIncome * 0.05) : 0;
                const totalDeduction = socialInsurance + healthInsurance + personalTax + totalAdvances + totalViolationAmount;
                const netSalary = grossSalary - totalDeduction;

                const salaryData = {
                    user_id: user.id,
                    month,
                    year,
                    base_salary: baseSalary,
                    hourly_rate: hourlyRate,
                    hourly_wage: hourlyWage,
                    overtime_pay: overtimePay,
                    total_hours: totalHours,
                    overtime_hours: overtimeHours,
                    service_commission: serviceCommission,
                    product_commission: productCommission,
                    referral_commission: referralCommission,
                    commission: totalCommission,
                    kpi_achievement: kpiAchievement,
                    bonus: totalBonus,
                    social_insurance: socialInsurance,
                    health_insurance: healthInsurance,
                    personal_tax: personalTax,
                    advances: totalAdvances,
                    deduction: totalDeduction,
                    gross_salary: grossSalary,
                    net_salary: netSalary,
                    status: 'draft',
                    payroll_batch_id: batch.id,
                };

                // Upsert
                const { data: existing } = await supabaseAdmin
                    .from('salary_records')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('month', month)
                    .eq('year', year)
                    .single();

                if (existing) {
                    await supabaseAdmin
                        .from('salary_records')
                        .update({ ...salaryData, updated_at: new Date().toISOString() })
                        .eq('id', existing.id);
                } else {
                    await supabaseAdmin
                        .from('salary_records')
                        .insert({ ...salaryData, created_by: req.user!.id });
                }
            } catch (e) {
                console.error(`[PayrollBatch] Error calculating for user ${user.id}:`, e);
            }
        }

        // Mark advances as deducted
        try {
            await supabaseAdmin
                .from('salary_advances')
                .update({ status: 'deducted', deducted_at: new Date().toISOString() })
                .eq('month', month)
                .eq('year', year)
                .eq('status', 'approved');
        } catch (e) { /* table may not exist */ }

        // Recalculate totals
        await recalculateBatchTotals(batch.id);

        // Fetch updated batch
        const { data: updatedBatch } = await supabaseAdmin
            .from('payroll_batches')
            .select('*')
            .eq('id', batch.id)
            .single();

        res.json({
            status: 'success',
            data: { batch: updatedBatch },
            message: `Đã tạo bảng lương tháng ${month}/${year} cho ${users.length} nhân viên`,
        });
    } catch (error) {
        next(error);
    }
});

// PATCH /api/payroll-batches/:id/status - Update batch status
router.patch('/:id/status', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const updateData: Record<string, any> = { status };
        if (status === 'approved') {
            updateData.approved_by = req.user!.id;
            updateData.approved_at = new Date().toISOString();
        }

        const { data: batch, error } = await supabaseAdmin
            .from('payroll_batches')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new ApiError('Lỗi khi cập nhật trạng thái', 500);

        res.json({ status: 'success', data: { batch } });
    } catch (error) {
        next(error);
    }
});

// POST /api/payroll-batches/auto-create - Auto-create batch for current month
// Called by cron on last Sunday of month
router.post('/auto-create', async (req, res, next) => {
    try {
        // Verify cron secret
        const secret = req.headers['x-cron-secret'] || req.query.secret;
        const expectedSecret = process.env.CRON_SECRET;
        if (expectedSecret && secret !== expectedSecret) {
            throw new ApiError('Unauthorized', 401);
        }

        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // Check if today is the last Sunday
        const lastSunday = getLastSundayOfMonth(year, month);
        const isLastSunday = now.getDate() === lastSunday.getDate() &&
            now.getMonth() === lastSunday.getMonth() &&
            now.getFullYear() === lastSunday.getFullYear();

        if (!isLastSunday) {
            return res.json({
                status: 'skipped',
                message: `Hôm nay không phải chủ nhật cuối tháng. Chủ nhật cuối: ${lastSunday.toISOString().split('T')[0]}`,
            });
        }

        // Create batch
        const batch = await getOrCreatePayrollBatch(month, year);

        console.log(`[PayrollBatch] Auto-created batch for ${month}/${year}: ${batch.code}`);

        res.json({
            status: 'success',
            data: { batch },
            message: `Đã tự động tạo bảng lương tháng ${month}/${year}`,
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/payroll-batches/:id - Cancel/delete a batch
router.delete('/:id', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        // Set status to locked (=cancelled) instead of hard delete
        const { error } = await supabaseAdmin
            .from('payroll_batches')
            .update({ status: 'locked' })
            .eq('id', id);

        if (error) throw new ApiError('Lỗi khi huỷ bảng lương', 500);

        res.json({ status: 'success', message: 'Đã huỷ bảng lương' });
    } catch (error) {
        next(error);
    }
});

export { router as payrollBatchesRouter };
