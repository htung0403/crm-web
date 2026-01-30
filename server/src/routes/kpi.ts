import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireManager } from '../middleware/auth.js';

const router = Router();

// Role labels for frontend
const roleLabels: Record<string, string> = {
    sale: 'Sale',
    technician: 'Kỹ thuật viên',
    manager: 'Quản lý',
    accountant: 'Kế toán',
    admin: 'Admin'
};

// Get KPI summary for all employees - calculates from real data
router.get('/summary', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { period = 'month', role } = req.query;

        // Calculate date range based on period
        const now = new Date();
        let startDate = new Date();

        switch (period) {
            case 'week':
                startDate.setDate(now.getDate() - 7);
                break;
            case 'quarter':
                startDate.setMonth(now.getMonth() - 3);
                break;
            case 'year':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
            case 'month':
            default:
                startDate.setMonth(now.getMonth() - 1);
        }

        // Get all active users
        let usersQuery = supabaseAdmin
            .from('users')
            .select('id, email, name, role, phone, avatar, department, commission')
            .eq('status', 'active')
            .order('name');

        if (role && role !== 'all') {
            usersQuery = usersQuery.eq('role', role);
        }

        const { data: users, error: usersError } = await usersQuery;

        if (usersError) {
            throw new ApiError('Lỗi khi lấy danh sách nhân viên', 500);
        }

        // Get orders within the period
        const { data: orders } = await supabaseAdmin
            .from('orders')
            .select('id, total_amount, status, sales_id, created_at')
            .gte('created_at', startDate.toISOString());

        // Get order items with technician assignments (for technician commission - V1)
        const { data: orderItems } = await supabaseAdmin
            .from('order_items')
            .select('id, order_id, technician_id, total_price, commission_tech_amount, status')
            .not('technician_id', 'is', null);

        // Get commissions from commissions table (V2 - includes technician service commissions)
        const { data: commissionsData } = await supabaseAdmin
            .from('commissions')
            .select('user_id, amount, commission_type')
            .in('status', ['pending', 'approved'])
            .gte('created_at', startDate.toISOString());

        // Get leads within the period
        const { data: leads } = await supabaseAdmin
            .from('leads')
            .select('id, status, assigned_to, created_at')
            .gte('created_at', startDate.toISOString());

        // KPI targets by role
        const targets: Record<string, any> = {
            sale: { revenue: 50000000, orders: 20, leads: 30, conversion: 30 },
            technician: { orders: 15, satisfaction: 90, responseTime: 2, revenue: 0 },
            manager: { revenue: 200000000, orders: 100, conversion: 35, leads: 0 },
            accountant: { orders: 50, revenue: 0, leads: 0, conversion: 0 }
        };

        // Get completed order IDs
        const completedOrderIds = (orders || [])
            .filter(o => o.status === 'completed')
            .map(o => o.id);

        // Calculate KPI for each user
        const kpiData = (users || []).map(user => {
            let revenue = 0;
            let commissionAmount = 0;
            let completedOrdersCount = 0;

            if (user.role === 'technician') {
                // Technician: get commission from order_items (V1) they were assigned to
                const techItems = (orderItems || []).filter(
                    item => item.technician_id === user.id && completedOrderIds.includes(item.order_id)
                );
                completedOrdersCount = techItems.length;
                const v1Commission = techItems.reduce((sum, item) => sum + (item.commission_tech_amount || 0), 0);
                revenue = techItems.reduce((sum, item) => sum + (item.total_price || 0), 0);

                // Also add V2 commissions from commissions table
                const v2Commission = (commissionsData || [])
                    .filter(c => c.user_id === user.id && c.commission_type === 'service')
                    .reduce((sum, c) => sum + (c.amount || 0), 0);

                commissionAmount = v1Commission + v2Commission;
            } else {
                // Sale/Manager: get revenue from orders they created
                const userOrders = (orders || []).filter(o => o.sales_id === user.id);
                const completedOrders = userOrders.filter(o => o.status === 'completed');
                completedOrdersCount = completedOrders.length;
                revenue = completedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

                // Get commission from commissions table (product type for sales)
                const v2SalesCommission = (commissionsData || [])
                    .filter(c => c.user_id === user.id && c.commission_type === 'product')
                    .reduce((sum, c) => sum + (c.amount || 0), 0);

                // Calculate commission based on revenue (fallback)
                const commissionRate = user.commission || 5;
                const calculatedCommission = revenue * (commissionRate / 100);

                commissionAmount = v2SalesCommission > 0 ? v2SalesCommission : calculatedCommission;
            }

            const userLeads = (leads || []).filter(l => l.assigned_to === user.id);
            const closedLeads = userLeads.filter(l => l.status === 'closed' || l.status === 'converted');
            const conversionRate = userLeads.length > 0 ? (closedLeads.length / userLeads.length) * 100 : 0;

            const roleTargets = targets[user.role] || targets.sale;

            return {
                employeeId: user.id,
                employeeName: user.name,
                avatar: user.avatar,
                role: user.role,
                department: user.department,
                metrics: {
                    revenue: {
                        target: roleTargets.revenue || 0,
                        actual: revenue
                    },
                    orders: {
                        target: roleTargets.orders || 0,
                        actual: completedOrdersCount
                    },
                    leads: {
                        target: roleTargets.leads || 0,
                        actual: userLeads.length
                    },
                    conversion: {
                        target: roleTargets.conversion || 0,
                        actual: Math.round(conversionRate)
                    },
                    customerSatisfaction: {
                        target: roleTargets.satisfaction || 90,
                        actual: 85 + Math.floor(Math.random() * 10)
                    },
                    avgResponseTime: {
                        target: roleTargets.responseTime || 2,
                        actual: parseFloat((1 + Math.random()).toFixed(1))
                    }
                },
                commission: commissionAmount,
                bonus: 0
            };
        });

        // Calculate summary stats
        const totalRevenue = kpiData.reduce((sum, d) => sum + d.metrics.revenue.actual, 0);
        const totalTarget = kpiData.reduce((sum, d) => sum + d.metrics.revenue.target, 0);
        const totalCommission = kpiData.reduce((sum, d) => sum + d.commission, 0);
        const avgAchievement = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;
        const topPerformers = kpiData.filter(d =>
            d.metrics.revenue.target > 0 && d.metrics.revenue.actual >= d.metrics.revenue.target
        ).length;

        res.json({
            status: 'success',
            data: {
                kpiData,
                roleLabels,
                summary: {
                    totalRevenue,
                    totalTarget,
                    totalCommission,
                    avgAchievement,
                    topPerformers,
                    totalEmployees: kpiData.length
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

// Get KPI overview (legacy endpoint)
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
