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

// Get HR report
router.get('/hr', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        // Get all employees
        const { data: users, error: usersError } = await supabaseAdmin
            .from('users')
            .select('id, name, role, salary, commission, department, status')
            .neq('role', 'customer');

        if (usersError) {
            throw new ApiError('Lỗi khi lấy dữ liệu nhân viên', 500);
        }

        // Get departments
        const { data: departments } = await supabaseAdmin
            .from('departments')
            .select('id, name');

        const deptMap = new Map(departments?.map(d => [d.id, d.name]) || []);

        // Calculate stats
        const activeEmployees = users?.filter(u => u.status === 'active') || [];
        const totalEmployees = activeEmployees.length;
        const totalSalary = activeEmployees.reduce((sum, u) => sum + (u.salary || 0), 0);

        // Get commission from completed orders
        const { data: completedOrders } = await supabaseAdmin
            .from('orders')
            .select('total_amount, sales_id')
            .eq('status', 'completed');

        // Calculate total commission (assume 5% default)
        const commissionBySales: Record<string, number> = {};
        completedOrders?.forEach(order => {
            const salesId = order.sales_id;
            if (salesId) {
                const user = activeEmployees.find(u => u.id === salesId);
                const rate = user?.commission || 5;
                const commission = (order.total_amount * rate) / 100;
                commissionBySales[salesId] = (commissionBySales[salesId] || 0) + commission;
            }
        });
        const totalCommission = Object.values(commissionBySales).reduce((sum, c) => sum + c, 0);

        // Group by department
        const byDepartment: Record<string, { name: string; count: number; salary: number }> = {};
        activeEmployees.forEach(user => {
            const deptId = user.department || 'unknown';
            const deptName = deptMap.get(deptId) || 'Chưa phân bổ';
            if (!byDepartment[deptId]) {
                byDepartment[deptId] = { name: deptName, count: 0, salary: 0 };
            }
            byDepartment[deptId].count += 1;
            byDepartment[deptId].salary += user.salary || 0;
        });

        // Group by role
        const byRole: Record<string, number> = {};
        activeEmployees.forEach(user => {
            byRole[user.role] = (byRole[user.role] || 0) + 1;
        });

        res.json({
            status: 'success',
            data: {
                totalEmployees,
                totalSalary,
                totalCommission,
                avgKPI: 85, // Placeholder - would need KPI tracking
                byDepartment: Object.entries(byDepartment).map(([id, data]) => ({ id, ...data })),
                byRole,
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get summary report (all-in-one for dashboard)
router.get('/summary', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { period = 'month', from_date, to_date } = req.query;

        // Calculate date range based on period
        const now = new Date();
        let fromDate: Date;
        let previousFromDate: Date;
        let previousToDate: Date;

        // Handle custom date range
        if (period === 'custom' && from_date && to_date) {
            fromDate = new Date(from_date as string);
            const toDateObj = new Date(to_date as string);
            // Calculate duration for previous period comparison
            const duration = toDateObj.getTime() - fromDate.getTime();
            previousFromDate = new Date(fromDate.getTime() - duration);
            previousToDate = new Date(fromDate.getTime());
        } else {
            switch (period) {
                case 'week':
                    fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    previousFromDate = new Date(fromDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                    previousToDate = fromDate;
                    break;
                case 'quarter':
                    fromDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                    previousFromDate = new Date(fromDate.getFullYear(), fromDate.getMonth() - 3, 1);
                    previousToDate = fromDate;
                    break;
                case 'year':
                    fromDate = new Date(now.getFullYear(), 0, 1);
                    previousFromDate = new Date(now.getFullYear() - 1, 0, 1);
                    previousToDate = fromDate;
                    break;
                default: // month
                    fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    previousFromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    previousToDate = fromDate;
            }
        }

        // Get orders for current period
        const { data: currentOrders } = await supabaseAdmin
            .from('orders')
            .select(`
                id, total_amount, status, created_at, customer_id,
                sales_user:users!orders_sales_id_fkey(id, name),
                items:order_items(item_type, item_name, total_price)
            `)
            .gte('created_at', fromDate.toISOString());

        // Get orders for previous period
        const { data: previousOrders } = await supabaseAdmin
            .from('orders')
            .select('id, total_amount, status')
            .gte('created_at', previousFromDate.toISOString())
            .lt('created_at', previousToDate.toISOString());

        // Calculate revenue stats
        const currentRevenue = currentOrders?.filter(o => o.status === 'completed')
            .reduce((sum, o) => sum + o.total_amount, 0) || 0;
        const previousRevenue = previousOrders?.filter(o => o.status === 'completed')
            .reduce((sum, o) => sum + o.total_amount, 0) || 0;
        const growth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

        // Revenue by source (item type)
        const bySource: Record<string, number> = {};
        currentOrders?.forEach(order => {
            (order.items as any[])?.forEach((item: any) => {
                const source = item.item_type === 'product' ? 'Sản phẩm' :
                    item.item_type === 'service' ? 'Dịch vụ' :
                        item.item_type === 'package' ? 'Gói combo' : 'Khác';
                bySource[source] = (bySource[source] || 0) + (item.total_price || 0);
            });
        });

        // Revenue by month (for year view)
        const byMonth: Record<string, number> = {};
        currentOrders?.filter(o => o.status === 'completed').forEach(order => {
            const date = new Date(order.created_at);
            const monthKey = `T${date.getMonth() + 1}`;
            byMonth[monthKey] = (byMonth[monthKey] || 0) + order.total_amount;
        });

        // Unique customers
        const uniqueCustomers = new Set(currentOrders?.map(o => o.customer_id)).size;

        // Sales by person
        const bySalesperson: Record<string, { name: string; orders: number; revenue: number }> = {};
        currentOrders?.forEach(order => {
            const sales = order.sales_user as any;
            if (sales?.id) {
                if (!bySalesperson[sales.id]) {
                    bySalesperson[sales.id] = { name: sales.name, orders: 0, revenue: 0 };
                }
                bySalesperson[sales.id].orders += 1;
                if (order.status === 'completed') {
                    bySalesperson[sales.id].revenue += order.total_amount;
                }
            }
        });

        // Top products/services
        const productRevenue: Record<string, { name: string; quantity: number; revenue: number }> = {};
        currentOrders?.forEach(order => {
            (order.items as any[])?.forEach((item: any) => {
                if (!productRevenue[item.item_name]) {
                    productRevenue[item.item_name] = { name: item.item_name, quantity: 0, revenue: 0 };
                }
                productRevenue[item.item_name].quantity += 1;
                productRevenue[item.item_name].revenue += item.total_price || 0;
            });
        });

        const topProducts = Object.values(productRevenue)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // Get HR data
        const { data: users } = await supabaseAdmin
            .from('users')
            .select('id, name, role, salary, status, department')
            .eq('status', 'active')
            .neq('role', 'customer');

        const { data: departments } = await supabaseAdmin
            .from('departments')
            .select('id, name');

        const deptMap = new Map(departments?.map(d => [d.id, d.name]) || []);

        const hrByDepartment: Record<string, { name: string; count: number; salary: number }> = {};
        users?.forEach(user => {
            const deptId = user.department || 'unknown';
            const deptName = deptMap.get(deptId) || 'Chưa phân bổ';
            if (!hrByDepartment[deptId]) {
                hrByDepartment[deptId] = { name: deptName, count: 0, salary: 0 };
            }
            hrByDepartment[deptId].count += 1;
            hrByDepartment[deptId].salary += user.salary || 0;
        });

        res.json({
            status: 'success',
            data: {
                revenue: {
                    total: currentRevenue,
                    previousPeriod: previousRevenue,
                    growth: Number(growth.toFixed(1)),
                    byMonth: Object.entries(byMonth).map(([month, value]) => ({ month, value })),
                    bySource: Object.entries(bySource).map(([source, value]) => {
                        const total = Object.values(bySource).reduce((s, v) => s + v, 0);
                        return { source, value, percent: total > 0 ? Math.round((value / total) * 100) : 0 };
                    }),
                },
                sales: {
                    totalOrders: currentOrders?.length || 0,
                    totalCustomers: uniqueCustomers,
                    avgOrderValue: currentOrders?.length ? Math.round(currentRevenue / currentOrders.length) : 0,
                    topProducts,
                    bySalesperson: Object.entries(bySalesperson)
                        .map(([id, data]) => ({ id, ...data, commission: Math.round(data.revenue * 0.05) }))
                        .sort((a, b) => b.revenue - a.revenue),
                },
                hr: {
                    totalEmployees: users?.length || 0,
                    totalSalary: users?.reduce((sum, u) => sum + (u.salary || 0), 0) || 0,
                    byDepartment: Object.entries(hrByDepartment).map(([id, data]) => ({ id, dept: data.name, count: data.count, salary: data.salary })),
                },
            },
        });
    } catch (error) {
        next(error);
    }
});

export { router as reportsRouter };
