import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireSale } from '../middleware/auth.js';

const router = Router();

// Get all customers
router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { type, status, search, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let query = supabaseAdmin
            .from('customers')
            .select('*, assigned_user:users!customers_assigned_to_fkey(id, name, email)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (type) query = query.eq('type', type);
        if (status) query = query.eq('status', status);
        if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);

        const { data: customers, error, count } = await query;

        if (error) {
            throw new ApiError('Lỗi khi lấy danh sách khách hàng', 500);
        }

        // Lấy thống kê đơn hàng cho tất cả customers
        const customerIds = customers?.map(c => c.id) || [];
        let customersWithStats = customers || [];

        if (customerIds.length > 0) {
            const { data: allOrders } = await supabaseAdmin
                .from('orders')
                .select('customer_id, total_amount')
                .in('customer_id', customerIds);

            // Tính toán stats cho từng customer
            customersWithStats = customers!.map(customer => {
                const customerOrders = allOrders?.filter(o => o.customer_id === customer.id) || [];
                const totalOrders = customerOrders.length;
                const totalSpent = customerOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

                return {
                    ...customer,
                    total_orders: totalOrders,
                    total_spent: totalSpent,
                };
            });
        }

        res.json({
            status: 'success',
            data: {
                customers: customersWithStats,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: count || 0,
                    totalPages: Math.ceil((count || 0) / Number(limit)),
                }
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get customer by ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { data: customer, error } = await supabaseAdmin
            .from('customers')
            .select('*, assigned_user:users!customers_assigned_to_fkey(id, name, email)')
            .eq('id', id)
            .single();

        if (error || !customer) {
            throw new ApiError('Không tìm thấy khách hàng', 404);
        }

        // Lấy thống kê
        const { data: stats } = await supabaseAdmin
            .from('orders')
            .select('id, total_amount')
            .eq('customer_id', id);

        const totalOrders = stats?.length || 0;
        const totalSpent = stats?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

        res.json({
            status: 'success',
            data: {
                customer: {
                    ...customer,
                    total_orders: totalOrders,
                    total_spent: totalSpent,
                }
            },
        });
    } catch (error) {
        next(error);
    }
});

// Create customer
router.post('/', authenticate, requireSale, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { name, phone, email, type, company, tax_code, address, source, notes, assigned_to } = req.body;

        if (!name || !phone) {
            throw new ApiError('Tên và số điện thoại là bắt buộc', 400);
        }

        const { data: customer, error } = await supabaseAdmin
            .from('customers')
            .insert({
                name,
                phone,
                email,
                type: type || 'individual',
                company,
                tax_code,
                address,
                source: source || 'other',
                notes,
                status: 'active',
                assigned_to: assigned_to || req.user!.id,
                created_by: req.user!.id,
            })
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi tạo khách hàng: ' + error.message, 500);
        }

        res.status(201).json({
            status: 'success',
            data: { customer },
        });
    } catch (error) {
        next(error);
    }
});

// Update customer
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const updateFields = req.body;

        const { data: customer, error } = await supabaseAdmin
            .from('customers')
            .update({ ...updateFields, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi cập nhật khách hàng', 500);
        }

        res.json({
            status: 'success',
            data: { customer },
        });
    } catch (error) {
        next(error);
    }
});

// Delete customer (soft delete)
router.delete('/:id', authenticate, requireSale, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('customers')
            .update({ status: 'inactive', updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            throw new ApiError('Lỗi khi xóa khách hàng', 500);
        }

        res.json({
            status: 'success',
            message: 'Đã vô hiệu hóa khách hàng',
        });
    } catch (error) {
        next(error);
    }
});

export { router as customersRouter };
