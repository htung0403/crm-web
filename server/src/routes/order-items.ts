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

        // Try to update V1 item
        let { data: item, error } = await supabaseAdmin
            .from('order_items')
            .update({
                technician_id,
                status: 'assigned',
                assigned_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*, order:orders(id, order_code, sales_id)')
            .maybeSingle();

        // If not found in V1, try V2 item (service)
        if (!item) {
            const { data: v2Item, error: v2Error } = await supabaseAdmin
                .from('order_product_services')
                .update({
                    technician_id,
                    status: 'assigned',
                    assigned_at: new Date().toISOString()
                })
                .eq('id', id)
                .select('*, order_product:order_products(order:orders(id, order_code, sales_id))')
                .maybeSingle();

            if (v2Error || !v2Item) {
                throw new ApiError('Không tìm thấy hạng mục hoặc không thể phân công', 404);
            }

            // Normalize structure
            item = {
                ...v2Item,
                order: v2Item.order_product?.order
            };
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

        // Try V1
        let { data: item, error } = await supabaseAdmin
            .from('order_items')
            .update({
                status: 'in_progress',
                started_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*, order:orders(id, order_code, sales_id)')
            .maybeSingle();

        // Try V2
        if (!item) {
            const { data: v2Item, error: v2Error } = await supabaseAdmin
                .from('order_product_services')
                .update({
                    status: 'in_progress',
                    started_at: new Date().toISOString()
                })
                .eq('id', id)
                .select('*, order_product:order_products(order:orders(id, order_code, sales_id))')
                .maybeSingle();

            if (v2Error || !v2Item) {
                throw new ApiError('Không tìm thấy hạng mục', 404);
            }

            item = {
                ...v2Item,
                order: v2Item.order_product?.order
            };
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

        // Try V1
        let { data: item, error } = await supabaseAdmin
            .from('order_items')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*, order:orders(id, order_code, sales_id, customer:customers(name))')
            .maybeSingle();

        let isV2 = false;

        // Try V2
        if (!item) {
            isV2 = true;
            const { data: v2Item, error: v2Error } = await supabaseAdmin
                .from('order_product_services')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    notes: notes || null
                })
                .eq('id', id)
                .select('*, order_product:order_products(order:orders(id, order_code, sales_id, customer:customers(name)))')
                .maybeSingle();

            if (v2Error || !v2Item) {
                throw new ApiError('Không tìm thấy hạng mục', 404);
            }

            item = {
                ...v2Item,
                order: v2Item.order_product?.order
            };
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
        let allCompleted = false;
        if (isV2) {
            // Check order_product_services for the same order
            // Complex because we need all services of all products in that order
            // Simplified check: Check current product's services? 
            // Or just fetch all services for the order via join?
            // Actually, querying all order_products -> services is heavy.
            // Let's check status of ALL tasks in this order?
            // Re-use logic: Check if any pending tasks exist for this order.

            // To be precise: Check UNCOMPLETED services in this order.
            const { count } = await supabaseAdmin
                .from('order_product_services')
                .select('id', { count: 'exact', head: true })
                .neq('status', 'completed')
                .neq('status', 'cancelled')
                .eq('order_product_id', item.order_product_id);
            // Wait, item.order_id is correct? item.order_product.order.id
            // We need to check ALL items in the ORDER, not just the product.

            // Better logic: Query order_products of this order, join order_product_services
            const { data: products } = await supabaseAdmin
                .from('order_products')
                .select('services:order_product_services(status)')
                .eq('order_id', item.order.id);

            if (products) {
                const allServices = products.flatMap(p => p.services || []);
                allCompleted = allServices.every((s: any) => s.status === 'completed' || s.status === 'cancelled');
            }

        } else {
            const { data: orderItems } = await supabaseAdmin
                .from('order_items')
                .select('status')
                .eq('order_id', item.order_id);

            allCompleted = orderItems?.every(i => i.status === 'completed') || false;
        }

        // If all completed, we *could* update order status to completed? 
        // V1 logic didn't do it automatically in the code snippet but calculated `allCompleted`.

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

        let { data: item, error } = await supabaseAdmin
            .from('order_items')
            .select('*, technician:users!order_items_technician_id_fkey(id, name, avatar)')
            .eq('id', id)
            .maybeSingle();

        if (!item) {
            const { data: v2Item, error: v2Error } = await supabaseAdmin
                .from('order_product_services')
                .select('*, technician:users!order_product_services_technician_id_fkey(id, name)') // No avatar in users? Relation check.
                .eq('id', id)
                .maybeSingle();

            if (v2Error || !v2Item) {
                throw new ApiError('Không tìm thấy hạng mục', 404);
            }
            item = v2Item;
        }

        res.json({
            status: 'success',
            data: item
        });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// ORDER ITEM STEPS ROUTES
// =====================================================

// Get steps for an order item
router.get('/:id/steps', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        let query = supabaseAdmin
            .from('order_item_steps')
            .select(`
                *,
                department:departments(id, name),
                technician:users!order_item_steps_technician_id_fkey(id, name, avatar)
            `)
            .order('step_order', { ascending: true });

        // Check if ID matches order_item or order_product_service
        // Heuristic: Try to find steps by order_item_id first
        const { count: v1Count } = await supabaseAdmin
            .from('order_item_steps')
            .select('id', { count: 'exact', head: true })
            .eq('order_item_id', id);

        if (v1Count && v1Count > 0) {
            query = query.eq('order_item_id', id);
        } else {
            // Assume it is V2 service ID
            query = query.eq('order_product_service_id', id);
        }

        const { data: steps, error } = await query;

        if (error) {
            throw new ApiError('Không thể lấy danh sách bước', 500);
        }

        res.json({
            status: 'success',
            data: steps || []
        });
    } catch (error) {
        next(error);
    }
});

// Assign technician to a step
router.patch('/steps/:stepId/assign', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { stepId } = req.params;
        const { technician_id } = req.body;

        if (!technician_id) {
            throw new ApiError('Vui lòng chọn kỹ thuật viên', 400);
        }

        const { data: step, error } = await supabaseAdmin
            .from('order_item_steps')
            .update({
                technician_id,
                status: 'assigned',
                assigned_at: new Date().toISOString()
            })
            .eq('id', stepId)
            .select('*, department:departments(id, name), technician:users!order_item_steps_technician_id_fkey(id, name)')
            .single();

        if (error) {
            throw new ApiError('Không thể phân công kỹ thuật viên', 500);
        }

        res.json({
            status: 'success',
            data: step,
            message: 'Đã phân công kỹ thuật viên cho bước này'
        });
    } catch (error) {
        next(error);
    }
});

// Start a step
router.patch('/steps/:stepId/start', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { stepId } = req.params;

        const { data: step, error } = await supabaseAdmin
            .from('order_item_steps')
            .update({
                status: 'in_progress',
                started_at: new Date().toISOString()
            })
            .eq('id', stepId)
            .select('*')
            .single();

        if (error) {
            throw new ApiError('Không thể bắt đầu bước', 500);
        }

        res.json({
            status: 'success',
            data: step,
            message: 'Đã bắt đầu thực hiện bước'
        });
    } catch (error) {
        next(error);
    }
});

// Complete a step
router.patch('/steps/:stepId/complete', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { stepId } = req.params;
        const { notes } = req.body;

        const { data: step, error } = await supabaseAdmin
            .from('order_item_steps')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                notes: notes || null
            })
            .eq('id', stepId)
            .select('*')
            .single();

        if (error) {
            throw new ApiError('Không thể hoàn thành bước', 500);
        }

        // Check if all steps for this order item are completed
        const { data: allSteps } = await supabaseAdmin
            .from('order_item_steps')
            .select('status')
            .eq('order_item_id', step.order_item_id);

        const allStepsCompleted = allSteps?.every(s => s.status === 'completed' || s.status === 'skipped');

        // If all steps completed, update the order item status
        if (allStepsCompleted) {
            await supabaseAdmin
                .from('order_items')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', step.order_item_id);
        }

        res.json({
            status: 'success',
            data: step,
            message: 'Đã hoàn thành bước',
            allStepsCompleted
        });
    } catch (error) {
        next(error);
    }
});

// Skip a step (optional step only)
router.patch('/steps/:stepId/skip', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { stepId } = req.params;
        const { notes } = req.body;

        const { data: step, error } = await supabaseAdmin
            .from('order_item_steps')
            .update({
                status: 'skipped',
                completed_at: new Date().toISOString(),
                notes: notes || 'Bước này đã được bỏ qua'
            })
            .eq('id', stepId)
            .select('*')
            .single();

        if (error) {
            throw new ApiError('Không thể bỏ qua bước', 500);
        }

        res.json({
            status: 'success',
            data: step,
            message: 'Đã bỏ qua bước này'
        });
    } catch (error) {
        next(error);
    }
});

export default router;

