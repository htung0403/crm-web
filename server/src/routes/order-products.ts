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

        const validStatuses = [
            'pending', 'processing', 'completed', 'delivered', 'cancelled',
            'step1', 'step2', 'step3', 'step4', 'step5'
        ];
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

// Get product status summary with unified timeline
router.get('/:id/status-summary', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        // Get product with all services and their steps
        const { data: product, error: productError } = await supabaseAdmin
            .from('order_products')
            .select(`
                id,
                name,
                product_code,
                completion_percentage,
                overall_status,
                total_workflow_steps,
                completed_workflow_steps,
                earliest_started_at,
                latest_completed_at,
                product_total_duration_minutes,
                product_estimated_duration_minutes,
                services:order_product_services(
                    id,
                    item_name,
                    status,
                    started_at,
                    completed_at,
                    service:services(id, name),
                    steps:order_item_steps(
                        id,
                        step_order,
                        step_name,
                        status,
                        department:departments(id, name),
                        technician:users!order_item_steps_technician_id_fkey(id, name),
                        estimated_duration,
                        started_at,
                        completed_at,
                        notes
                    )
                )
            `)
            .eq('id', id)
            .single();

        if (productError || !product) {
            throw new ApiError('Không tìm thấy sản phẩm', 404);
        }

        // Build services array with completion percentage
        const services = (product.services || []).map((service: any) => {
            const steps = service.steps || [];
            const totalSteps = steps.length;
            const completedSteps = steps.filter((s: any) => 
                s.status === 'completed' || s.status === 'skipped'
            ).length;
            const serviceCompletionPct = totalSteps > 0 
                ? Math.round((completedSteps * 100) / totalSteps)
                : 0;

            return {
                id: service.id,
                name: service.item_name,
                status: service.status,
                completion_percentage: serviceCompletionPct,
                started_at: service.started_at,
                completed_at: service.completed_at,
                steps: steps.sort((a: any, b: any) => a.step_order - b.step_order)
            };
        });

        // Build unified timeline (all steps from all services, sorted chronologically)
        const allSteps: any[] = [];
        (product.services || []).forEach((service: any) => {
            (service.steps || []).forEach((step: any) => {
                allSteps.push({
                    step_id: step.id,
                    step_order: step.step_order,
                    step_name: step.step_name,
                    service_id: service.id,
                    service_name: service.item_name,
                    department_id: step.department?.id,
                    department_name: step.department?.name,
                    technician_id: step.technician?.id,
                    technician_name: step.technician?.name,
                    status: step.status,
                    estimated_duration: step.estimated_duration,
                    started_at: step.started_at,
                    completed_at: step.completed_at,
                    notes: step.notes
                });
            });
        });

        // Sort timeline by step_order, then by started_at if available
        allSteps.sort((a, b) => {
            if (a.step_order !== b.step_order) {
                return a.step_order - b.step_order;
            }
            if (a.started_at && b.started_at) {
                return new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
            }
            return 0;
        });

        res.json({
            status: 'success',
            data: {
                product_id: product.id,
                product_name: product.name,
                product_code: product.product_code,
                completion_percentage: product.completion_percentage || 0,
                overall_status: product.overall_status || 'pending',
                total_steps: product.total_workflow_steps || 0,
                completed_steps: product.completed_workflow_steps || 0,
                earliest_started_at: product.earliest_started_at,
                latest_completed_at: product.latest_completed_at,
                total_duration_minutes: product.product_total_duration_minutes,
                estimated_duration_minutes: product.product_estimated_duration_minutes,
                services,
                timeline: allSteps
            }
        });
    } catch (error) {
        next(error);
    }
});

// Recalculate product status manually
router.post('/:id/recalculate-status', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        // Trigger recalculation by updating a dummy field (triggers will fire)
        const { data: product, error } = await supabaseAdmin
            .from('order_products')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new ApiError('Không thể tính toán lại trạng thái', 500);
        }

        // Fetch updated product with calculated fields
        const { data: updatedProduct } = await supabaseAdmin
            .from('order_products')
            .select('completion_percentage, overall_status, total_workflow_steps, completed_workflow_steps')
            .eq('id', id)
            .single();

        res.json({
            status: 'success',
            data: updatedProduct,
            message: 'Đã tính toán lại trạng thái sản phẩm'
        });
    } catch (error) {
        next(error);
    }
});

export default router;
