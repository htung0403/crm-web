import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

// Assign technician to order item
router.patch('/:id/assign', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { technician_id } = req.body;

        if (!technician_id) {
            throw new ApiError('Vui lòng chọn kỹ thuật viên', 400);
        }

        const { data: item, error } = await supabaseAdmin
            .from('order_items')
            .update({
                technician_id,
                status: 'assigned',
                assigned_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*, order:orders(id, order_code, sales_id)')
            .single();

        if (error) {
            throw new ApiError('Không thể phân công kỹ thuật viên', 500);
        }

        res.json({
            status: 'success',
            data: item,
            message: 'Đã phân công kỹ thuật viên thành công'
        });
    } catch (error) {
        next(error);
    }
});

// Technician starts work on item
router.patch('/:id/start', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { data: item, error } = await supabaseAdmin
            .from('order_items')
            .update({
                status: 'in_progress',
                started_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*, order:orders(id, order_code, sales_id)')
            .single();

        if (error) {
            throw new ApiError('Không thể bắt đầu công việc', 500);
        }

        res.json({
            status: 'success',
            data: item,
            message: 'Đã bắt đầu công việc'
        });
    } catch (error) {
        next(error);
    }
});

// Technician completes item - send notification to sales
router.patch('/:id/complete', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        // Update item status
        const { data: item, error } = await supabaseAdmin
            .from('order_items')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*, order:orders(id, order_code, sales_id, customer:customers(name))')
            .single();

        if (error) {
            throw new ApiError('Không thể hoàn thành công việc', 500);
        }

        // Create notification for sales user
        if (item.order?.sales_id) {
            await supabaseAdmin
                .from('notifications')
                .insert({
                    user_id: item.order.sales_id,
                    type: 'item_completed',
                    title: 'Dịch vụ đã hoàn thành',
                    content: `Dịch vụ "${item.item_name}" trong đơn ${item.order.order_code} đã được hoàn thành`,
                    data: {
                        order_id: item.order.id,
                        order_code: item.order.order_code,
                        item_id: item.id,
                        item_name: item.item_name
                    },
                    is_read: false
                });
        }

        // Check if all items in order are completed
        const { data: orderItems } = await supabaseAdmin
            .from('order_items')
            .select('status')
            .eq('order_id', item.order_id);

        const allCompleted = orderItems?.every(i => i.status === 'completed');

        res.json({
            status: 'success',
            data: item,
            message: 'Đã hoàn thành công việc',
            allItemsCompleted: allCompleted
        });
    } catch (error) {
        next(error);
    }
});

// Get order item by ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { data: item, error } = await supabaseAdmin
            .from('order_items')
            .select('*, technician:users!order_items_technician_id_fkey(id, name, avatar)')
            .eq('id', id)
            .single();

        if (error) {
            throw new ApiError('Không tìm thấy hạng mục', 404);
        }

        res.json({
            status: 'success',
            data: item
        });
    } catch (error) {
        next(error);
    }
});

export default router;
