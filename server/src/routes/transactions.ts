import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Generate transaction code
async function generateTransactionCode(type: 'income' | 'expense'): Promise<string> {
    const prefix = type === 'income' ? 'PT' : 'PC';

    const { data: transactions } = await supabaseAdmin
        .from('transactions')
        .select('code')
        .like('code', `${prefix}%`)
        .order('created_at', { ascending: false })
        .limit(100);

    let maxNumber = 0;
    if (transactions && transactions.length > 0) {
        for (const trans of transactions) {
            const numStr = trans.code.replace(prefix, '');
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num > maxNumber) maxNumber = num;
        }
    }

    return `${prefix}${String(maxNumber + 1).padStart(6, '0')}`;
}

// Get all transactions
router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { type, status, search, page = 1, limit = 50, start_date, end_date } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let query = supabaseAdmin
            .from('transactions')
            .select(`
                *,
                created_by_user:users!transactions_created_by_fkey(id, name, avatar),
                approved_by_user:users!transactions_approved_by_fkey(id, name)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (type) query = query.eq('type', type);
        if (status) query = query.eq('status', status);
        if (search) {
            query = query.or(`code.ilike.%${search}%,category.ilike.%${search}%,notes.ilike.%${search}%`);
        }
        if (start_date) query = query.gte('date', start_date);
        if (end_date) query = query.lte('date', end_date);

        const { data: transactions, error, count } = await query;

        if (error) {
            console.error('Error fetching transactions:', error);
            throw new ApiError('Lỗi khi lấy danh sách giao dịch', 500);
        }

        res.json({
            status: 'success',
            data: {
                transactions: transactions || [],
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

// Get transaction summary (totals)
router.get('/summary', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { start_date, end_date } = req.query;

        let incomeQuery = supabaseAdmin
            .from('transactions')
            .select('amount')
            .eq('type', 'income')
            .eq('status', 'approved');

        let expenseQuery = supabaseAdmin
            .from('transactions')
            .select('amount')
            .eq('type', 'expense')
            .eq('status', 'approved');

        if (start_date) {
            incomeQuery = incomeQuery.gte('date', start_date);
            expenseQuery = expenseQuery.gte('date', start_date);
        }
        if (end_date) {
            incomeQuery = incomeQuery.lte('date', end_date);
            expenseQuery = expenseQuery.lte('date', end_date);
        }

        const [incomeResult, expenseResult] = await Promise.all([
            incomeQuery,
            expenseQuery
        ]);

        const totalIncome = (incomeResult.data || []).reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalExpense = (expenseResult.data || []).reduce((sum, t) => sum + (t.amount || 0), 0);

        // Get pending counts
        const { count: pendingIncomeCount } = await supabaseAdmin
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('type', 'income')
            .eq('status', 'pending');

        const { count: pendingExpenseCount } = await supabaseAdmin
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('type', 'expense')
            .eq('status', 'pending');

        res.json({
            status: 'success',
            data: {
                totalIncome,
                totalExpense,
                balance: totalIncome - totalExpense,
                pendingIncomeCount: pendingIncomeCount || 0,
                pendingExpenseCount: pendingExpenseCount || 0,
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get transaction by ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { data: transaction, error } = await supabaseAdmin
            .from('transactions')
            .select(`
                *,
                created_by_user:users!transactions_created_by_fkey(id, name, avatar),
                approved_by_user:users!transactions_approved_by_fkey(id, name)
            `)
            .eq('id', id)
            .single();

        if (error || !transaction) {
            throw new ApiError('Không tìm thấy giao dịch', 404);
        }

        res.json({
            status: 'success',
            data: { transaction },
        });
    } catch (error) {
        next(error);
    }
});

// Create transaction
router.post('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { type, category, amount, payment_method, notes, image_url, date, order_id, order_code } = req.body;

        if (!type || !category || !amount) {
            throw new ApiError('Loại, danh mục và số tiền là bắt buộc', 400);
        }

        if (!['income', 'expense'].includes(type)) {
            throw new ApiError('Loại giao dịch không hợp lệ', 400);
        }

        const code = await generateTransactionCode(type);

        const { data: transaction, error } = await supabaseAdmin
            .from('transactions')
            .insert({
                code,
                type,
                category,
                amount,
                payment_method: payment_method || 'cash',
                notes,
                image_url,
                date: date || new Date().toISOString().split('T')[0],
                order_id,
                order_code,
                status: 'pending',
                created_by: req.user!.id,
            })
            .select(`
                *,
                created_by_user:users!transactions_created_by_fkey(id, name, avatar)
            `)
            .single();

        if (error) {
            console.error('Error creating transaction:', error);
            throw new ApiError('Lỗi khi tạo giao dịch: ' + error.message, 500);
        }

        res.status(201).json({
            status: 'success',
            data: { transaction },
            message: `Đã tạo phiếu ${type === 'income' ? 'thu' : 'chi'} ${code}`,
        });
    } catch (error) {
        next(error);
    }
});

// Update transaction status (approve/cancel)
router.patch('/:id/status', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['approved', 'cancelled', 'pending'].includes(status)) {
            throw new ApiError('Trạng thái không hợp lệ', 400);
        }

        const updateData: any = {
            status,
            updated_at: new Date().toISOString(),
        };

        if (status === 'approved') {
            updateData.approved_by = req.user!.id;
            updateData.approved_at = new Date().toISOString();
        }

        const { data: transaction, error } = await supabaseAdmin
            .from('transactions')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi cập nhật trạng thái', 500);
        }

        res.json({
            status: 'success',
            data: { transaction },
            message: status === 'approved' ? 'Đã duyệt phiếu' : status === 'cancelled' ? 'Đã hủy phiếu' : 'Đã cập nhật',
        });
    } catch (error) {
        next(error);
    }
});

// Update transaction
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { category, amount, payment_method, notes, image_url, date } = req.body;

        // Only allow updating pending transactions
        const { data: existing } = await supabaseAdmin
            .from('transactions')
            .select('status')
            .eq('id', id)
            .single();

        if (existing?.status !== 'pending') {
            throw new ApiError('Chỉ có thể sửa phiếu đang chờ duyệt', 400);
        }

        const { data: transaction, error } = await supabaseAdmin
            .from('transactions')
            .update({
                category,
                amount,
                payment_method,
                notes,
                image_url,
                date,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi cập nhật giao dịch', 500);
        }

        res.json({
            status: 'success',
            data: { transaction },
        });
    } catch (error) {
        next(error);
    }
});

// Delete transaction
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        // Only allow deleting pending transactions
        const { data: existing } = await supabaseAdmin
            .from('transactions')
            .select('status')
            .eq('id', id)
            .single();

        if (existing?.status !== 'pending') {
            throw new ApiError('Chỉ có thể xóa phiếu đang chờ duyệt', 400);
        }

        const { error } = await supabaseAdmin
            .from('transactions')
            .delete()
            .eq('id', id);

        if (error) {
            throw new ApiError('Lỗi khi xóa giao dịch', 500);
        }

        res.json({
            status: 'success',
            message: 'Đã xóa phiếu',
        });
    } catch (error) {
        next(error);
    }
});

export { router as transactionsRouter };
