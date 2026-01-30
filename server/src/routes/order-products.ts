import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

// Get order product by QR code
router.get('/code/:code', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { code } = req.params;

        const { data: product, error } = await supabaseAdmin
            .from('order_products')
            .select(`
                *,
                order:orders(id, order_code, status, customer:customers(id, name, phone)),
                services:order_product_services(
                    *,
                    service:services(id, name, image),
                    package:packages(id, name),
                    technician:users!order_product_services_technician_id_fkey(id, name, avatar)
                )
            `)
            .eq('product_code', code)
            .single();

        if (error || !product) {
            throw new ApiError('Không tìm thấy sản phẩm', 404);
        }

        res.json({
            status: 'success',
            data: product
        });
    } catch (error) {
        next(error);
    }
});

// Get order product by ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { data: product, error } = await supabaseAdmin
            .from('order_products')
            .select(`
                *,
                order:orders(id, order_code, status, customer:customers(id, name, phone)),
                services:order_product_services(
                    *,
                    service:services(id, name, image),
                    package:packages(id, name),
                    technician:users!order_product_services_technician_id_fkey(id, name, avatar)
                )
            `)
            .eq('id', id)
            .single();

        if (error || !product) {
            throw new ApiError('Không tìm thấy sản phẩm', 404);
        }

        res.json({
            status: 'success',
            data: product
        });
    } catch (error) {
        next(error);
    }
});

// Update order product status
router.patch('/:id/status', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'processing', 'completed', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            throw new ApiError('Trạng thái không hợp lệ', 400);
        }

        const updateData: any = {
            status,
            updated_at: new Date().toISOString()
        };

        if (status === 'completed') {
            updateData.completed_at = new Date().toISOString();
        } else if (status === 'delivered') {
            updateData.delivered_at = new Date().toISOString();
        }

        const { data: product, error } = await supabaseAdmin
            .from('order_products')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new ApiError('Không thể cập nhật trạng thái', 500);
        }

        res.json({
            status: 'success',
            data: product,
            message: 'Đã cập nhật trạng thái sản phẩm'
        });
    } catch (error) {
        next(error);
    }
});

// =====================================================
// ORDER PRODUCT SERVICES ROUTES
// =====================================================

// Assign technician to a service
router.patch('/services/:serviceId/assign', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { serviceId } = req.params;
        const { technician_id } = req.body;

        if (!technician_id) {
            throw new ApiError('Vui lòng chọn kỹ thuật viên', 400);
        }

        const { data: service, error } = await supabaseAdmin
            .from('order_product_services')
            .update({
                technician_id,
                status: 'assigned',
                assigned_at: new Date().toISOString()
            })
            .eq('id', serviceId)
            .select('*, technician:users!order_product_services_technician_id_fkey(id, name)')
            .single();

        if (error) {
            throw new ApiError('Không thể phân công kỹ thuật viên', 500);
        }

        res.json({
            status: 'success',
            data: service,
            message: 'Đã phân công kỹ thuật viên'
        });
    } catch (error) {
        next(error);
    }
});

// Start service
router.patch('/services/:serviceId/start', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { serviceId } = req.params;

        const { data: service, error } = await supabaseAdmin
            .from('order_product_services')
            .update({
                status: 'in_progress',
                started_at: new Date().toISOString()
            })
            .eq('id', serviceId)
            .select()
            .single();

        if (error) {
            throw new ApiError('Không thể bắt đầu dịch vụ', 500);
        }

        // Update order_product status to processing if pending
        if (service.order_product_id) {
            await supabaseAdmin
                .from('order_products')
                .update({ status: 'processing' })
                .eq('id', service.order_product_id)
                .eq('status', 'pending');
        }

        res.json({
            status: 'success',
            data: service,
            message: 'Đã bắt đầu dịch vụ'
        });
    } catch (error) {
        next(error);
    }
});

// Complete service
router.patch('/services/:serviceId/complete', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { serviceId } = req.params;
        const { notes } = req.body;

        const { data: service, error } = await supabaseAdmin
            .from('order_product_services')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                notes: notes || null
            })
            .eq('id', serviceId)
            .select()
            .single();

        if (error) {
            throw new ApiError('Không thể hoàn thành dịch vụ', 500);
        }

        // Check if all services for this product are completed
        const { data: allServices } = await supabaseAdmin
            .from('order_product_services')
            .select('status')
            .eq('order_product_id', service.order_product_id);

        const allCompleted = allServices?.every(s => s.status === 'completed' || s.status === 'cancelled');

        // If all services completed, update product status
        if (allCompleted) {
            await supabaseAdmin
                .from('order_products')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', service.order_product_id);
        }

        res.json({
            status: 'success',
            data: service,
            message: 'Đã hoàn thành dịch vụ',
            allServicesCompleted: allCompleted
        });
    } catch (error) {
        next(error);
    }
});

export default router;
