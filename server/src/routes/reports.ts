import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireManager } from '../middleware/auth.js';

const router = Router();

// Get revenue report
router.get('/revenue', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { from_date, to_date, group_by = 'month' } = req.query;

        // Lấy doanh thu từ invoices đã thanh toán
        let query = supabaseAdmin
            .from('invoices')
            .select('total_amount, paid_at, created_at')
            .eq('status', 'paid');

        if (from_date) query = query.gte('paid_at', from_date);
        if (to_date) query = query.lte('paid_at', to_date);

        const { data: invoices, error } = await query;

        if (error) {
            throw new ApiError('Lỗi khi lấy báo cáo doanh thu', 500);
        }

        const totalRevenue = invoices?.reduce((sum, i) => sum + i.total_amount, 0) || 0;

        // Group by period
        const revenueByPeriod: Record<string, number> = {};
        invoices?.forEach(invoice => {
            const date = new Date(invoice.paid_at || invoice.created_at);
            let key: string;

            if (group_by === 'day') {
                key = date.toISOString().split('T')[0];
            } else if (group_by === 'week') {
                const week = Math.ceil(date.getDate() / 7);
                key = `${date.getFullYear()}-W${week}`;
            } else {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }

            revenueByPeriod[key] = (revenueByPeriod[key] || 0) + invoice.total_amount;
        });

        res.json({
            status: 'success',
            data: {
                totalRevenue,
                count: invoices?.length || 0,
                byPeriod: Object.entries(revenueByPeriod).map(([period, amount]) => ({ period, amount })),
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get sales report
router.get('/sales', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { from_date, to_date } = req.query;

        // Lấy đơn hàng
        let query = supabaseAdmin
            .from('orders')
            .select(`
        id, total_amount, status, created_at,
        sales_user:users!orders_sales_id_fkey(id, name)
      `);

        if (from_date) query = query.gte('created_at', from_date);
        if (to_date) query = query.lte('created_at', to_date);

        const { data: orders, error } = await query;

        if (error) {
            throw new ApiError('Lỗi khi lấy báo cáo bán hàng', 500);
        }

        // Thống kê theo nhân viên
        const bySalesperson: Record<string, { name: string; orders: number; revenue: number }> = {};
        orders?.forEach(order => {
            const salesId = (order.sales_user as any)?.id;
            const salesName = (order.sales_user as any)?.name || 'Unknown';

            if (salesId) {
                if (!bySalesperson[salesId]) {
                    bySalesperson[salesId] = { name: salesName, orders: 0, revenue: 0 };
                }
                bySalesperson[salesId].orders += 1;
                if (order.status === 'completed') {
                    bySalesperson[salesId].revenue += order.total_amount;
                }
            }
        });

        // Thống kê theo trạng thái
        const byStatus: Record<string, number> = {};
        orders?.forEach(order => {
            byStatus[order.status] = (byStatus[order.status] || 0) + 1;
        });

        res.json({
            status: 'success',
            data: {
                totalOrders: orders?.length || 0,
                totalRevenue: orders?.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.total_amount, 0) || 0,
                bySalesperson: Object.entries(bySalesperson).map(([id, data]) => ({ id, ...data })),
                byStatus,
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get customer report
router.get('/customers', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { from_date, to_date } = req.query;

        // Tổng khách hàng
        const { count: totalCustomers } = await supabaseAdmin
            .from('customers')
            .select('*', { count: 'exact', head: true });

        // Khách hàng mới trong kỳ
        let newQuery = supabaseAdmin
            .from('customers')
            .select('*', { count: 'exact', head: true });

        if (from_date) newQuery = newQuery.gte('created_at', from_date);
        if (to_date) newQuery = newQuery.lte('created_at', to_date);

        const { count: newCustomers } = await newQuery;

        // Top khách hàng
        const { data: orders } = await supabaseAdmin
            .from('orders')
            .select('customer_id, total_amount, customer:customers(id, name, email)')
            .eq('status', 'completed');

        const customerSpending: Record<string, { name: string; email: string; total: number; orders: number }> = {};
        orders?.forEach(order => {
            const customerId = order.customer_id;
            const customer = order.customer as any;

            if (customerId && customer) {
                if (!customerSpending[customerId]) {
                    customerSpending[customerId] = {
                        name: customer.name,
                        email: customer.email,
                        total: 0,
                        orders: 0
                    };
                }
                customerSpending[customerId].total += order.total_amount;
                customerSpending[customerId].orders += 1;
            }
        });

        const topCustomers = Object.entries(customerSpending)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

        res.json({
            status: 'success',
            data: {
                totalCustomers: totalCustomers || 0,
                newCustomers: newCustomers || 0,
                topCustomers,
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get financial report
router.get('/financial', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { from_date, to_date } = req.query;

        // Thu
        let incomeQuery = supabaseAdmin
            .from('finance_transactions')
            .select('amount, category')
            .eq('type', 'income')
            .eq('status', 'approved');

        if (from_date) incomeQuery = incomeQuery.gte('created_at', from_date);
        if (to_date) incomeQuery = incomeQuery.lte('created_at', to_date);

        const { data: incomeData } = await incomeQuery;

        // Chi
        let expenseQuery = supabaseAdmin
            .from('finance_transactions')
            .select('amount, category')
            .eq('type', 'expense')
            .eq('status', 'approved');

        if (from_date) expenseQuery = expenseQuery.gte('created_at', from_date);
        if (to_date) expenseQuery = expenseQuery.lte('created_at', to_date);

        const { data: expenseData } = await expenseQuery;

        const totalIncome = incomeData?.reduce((sum, t) => sum + t.amount, 0) || 0;
        const totalExpense = expenseData?.reduce((sum, t) => sum + t.amount, 0) || 0;
        const profit = totalIncome - totalExpense;

        // Group by category
        const incomeByCategory: Record<string, number> = {};
        incomeData?.forEach(t => {
            incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
        });

        const expenseByCategory: Record<string, number> = {};
        expenseData?.forEach(t => {
            expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
        });

        res.json({
            status: 'success',
            data: {
                totalIncome,
                totalExpense,
                profit,
                profitMargin: totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(2) : 0,
                incomeByCategory,
                expenseByCategory,
            },
        });
    } catch (error) {
        next(error);
    }
});

export { router as reportsRouter };
