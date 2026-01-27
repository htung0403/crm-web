import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireManager } from '../middleware/auth.js';

const router = Router();

// Get all packages
router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { status, search } = req.query;

        let query = supabaseAdmin
            .from('packages')
            .select(`
                *,
                package_items (
                    id,
                    quantity,
                    services (
                        id,
                        code,
                        name,
                        price
                    )
                )
            `)
            .order('created_at', { ascending: false });

        if (status) query = query.eq('status', status);
        if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);

        const { data: packages, error } = await query;

        if (error) {
            throw new ApiError('Lỗi khi lấy danh sách gói dịch vụ', 500);
        }

        res.json({
            status: 'success',
            data: { packages },
        });
    } catch (error) {
        next(error);
    }
});

// Get package by ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { data: pkg, error } = await supabaseAdmin
            .from('packages')
            .select(`
                *,
                package_items (
                    id,
                    quantity,
                    services (
                        id,
                        code,
                        name,
                        price
                    )
                )
            `)
            .eq('id', id)
            .single();

        if (error || !pkg) {
            throw new ApiError('Không tìm thấy gói dịch vụ', 404);
        }

        res.json({
            status: 'success',
            data: { package: pkg },
        });
    } catch (error) {
        next(error);
    }
});

// Create package
router.post('/', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { name, description, price, original_price, validity_days, items } = req.body;

        if (!name || !price) {
            throw new ApiError('Tên và giá gói là bắt buộc', 400);
        }

        // Auto-generate package code if not provided
        let code = req.body.code;
        if (!code) {
            const { data: latestPackage } = await supabaseAdmin
                .from('packages')
                .select('code')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (latestPackage && latestPackage.code) {
                const match = latestPackage.code.match(/\d+$/);
                const nextNum = match ? parseInt(match[0]) + 1 : 1;
                code = `GOI${String(nextNum).padStart(3, '0')}`;
            } else {
                code = 'GOI001';
            }
        }

        const { data: pkg, error } = await supabaseAdmin
            .from('packages')
            .insert({
                code,
                name,
                description,
                price,
                original_price: original_price || price,
                validity_days: validity_days || 0,
                status: 'active',
                created_by: req.user!.id,
            })
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi tạo gói dịch vụ: ' + error.message, 500);
        }

        // Insert package items if provided
        if (items && Array.isArray(items) && items.length > 0) {
            const packageItems = items.map((item: any) => ({
                package_id: pkg.id,
                service_id: item.service_id,
                quantity: item.quantity || 1,
            }));

            const { error: itemsError } = await supabaseAdmin
                .from('package_items')
                .insert(packageItems);

            if (itemsError) {
                // Rollback package if items fail
                await supabaseAdmin.from('packages').delete().eq('id', pkg.id);
                throw new ApiError('Lỗi khi thêm dịch vụ vào gói: ' + itemsError.message, 500);
            }
        }

        // Fetch complete package with items
        const { data: completePackage } = await supabaseAdmin
            .from('packages')
            .select(`
                *,
                package_items (
                    id,
                    quantity,
                    services (
                        id,
                        code,
                        name,
                        price
                    )
                )
            `)
            .eq('id', pkg.id)
            .single();

        res.status(201).json({
            status: 'success',
            data: { package: completePackage },
        });
    } catch (error) {
        next(error);
    }
});

// Update package
router.put('/:id', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, price, original_price, validity_days, status, items } = req.body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (price !== undefined) updateData.price = price;
        if (original_price !== undefined) updateData.original_price = original_price;
        if (validity_days !== undefined) updateData.validity_days = validity_days;
        if (status !== undefined) updateData.status = status;
        updateData.updated_at = new Date().toISOString();

        const { data: pkg, error } = await supabaseAdmin
            .from('packages')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error || !pkg) {
            throw new ApiError('Lỗi khi cập nhật gói dịch vụ', 500);
        }

        // Update package items if provided
        if (items !== undefined && Array.isArray(items)) {
            // Delete existing items
            await supabaseAdmin.from('package_items').delete().eq('package_id', id);

            // Insert new items
            if (items.length > 0) {
                const packageItems = items.map((item: any) => ({
                    package_id: id,
                    service_id: item.service_id,
                    quantity: item.quantity || 1,
                }));

                await supabaseAdmin.from('package_items').insert(packageItems);
            }
        }

        // Fetch complete package with items
        const { data: completePackage } = await supabaseAdmin
            .from('packages')
            .select(`
                *,
                package_items (
                    id,
                    quantity,
                    services (
                        id,
                        code,
                        name,
                        price
                    )
                )
            `)
            .eq('id', id)
            .single();

        res.json({
            status: 'success',
            data: { package: completePackage },
        });
    } catch (error) {
        next(error);
    }
});

// Delete package
router.delete('/:id', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('packages')
            .delete()
            .eq('id', id);

        if (error) {
            throw new ApiError('Lỗi khi xóa gói dịch vụ', 500);
        }

        res.json({
            status: 'success',
            message: 'Đã xóa gói dịch vụ',
        });
    } catch (error) {
        next(error);
    }
});

export default router;
