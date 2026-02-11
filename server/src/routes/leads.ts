import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireSale } from '../middleware/auth.js';

const router = Router();

// Get all leads
router.get('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { status, source, assigned_to, search, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let query = supabaseAdmin
            .from('leads')
            .select('*, assigned_user:users!leads_assigned_to_fkey(id, name, email)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        // Nếu không phải manager, chỉ xem lead của mình
        if (req.user!.role !== 'manager' && req.user!.role !== 'admin') {
            query = query.eq('assigned_to', req.user!.id);
        } else if (assigned_to) {
            query = query.eq('assigned_to', assigned_to);
        }

        if (status) query = query.eq('status', status);
        if (source) query = query.eq('source', source);
        if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);

        const { data: leads, error, count } = await query;

        if (error) {
            throw new ApiError('Lỗi khi lấy danh sách leads', 500);
        }

        res.json({
            status: 'success',
            data: {
                leads,
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

// Get lead by ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { data: lead, error } = await supabaseAdmin
            .from('leads')
            .select('*, assigned_user:users!leads_assigned_to_fkey(id, name, email)')
            .eq('id', id)
            .single();

        if (error || !lead) {
            throw new ApiError('Không tìm thấy lead', 404);
        }

        res.json({
            status: 'success',
            data: { lead },
        });
    } catch (error) {
        next(error);
    }
});

// Create lead
router.post('/', authenticate, requireSale, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { name, phone, email, source, company, address, notes, assigned_to, dob } = req.body;

        if (!name || !phone) {
            throw new ApiError('Tên và số điện thoại là bắt buộc', 400);
        }

        const { data: lead, error } = await supabaseAdmin
            .from('leads')
            .insert({
                name,
                phone,
                email,
                source: source || 'other',
                company,
                address,
                notes,
                status: 'new',
                assigned_to: assigned_to || req.user!.id,
                created_by: req.user!.id,
                dob: dob || null,
            })
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi tạo lead: ' + error.message, 500);
        }

        res.status(201).json({
            status: 'success',
            data: { lead },
        });
    } catch (error) {
        next(error);
    }
});

// Update lead
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { name, phone, email, source, company, address, notes, status, assigned_to, pipeline_stage, dob } = req.body;

        // Get current lead to check for status change
        const { data: currentLead } = await supabaseAdmin
            .from('leads')
            .select('status, pipeline_stage')
            .eq('id', id)
            .single();

        const oldStatus = currentLead?.status || currentLead?.pipeline_stage;
        const newStatus = status || pipeline_stage;

        const updateData: Record<string, any> = {
            updated_at: new Date().toISOString(),
        };

        if (name) updateData.name = name;
        if (phone) updateData.phone = phone;
        if (email !== undefined) updateData.email = email;
        if (source) updateData.source = source;
        if (company !== undefined) updateData.company = company;
        if (address !== undefined) updateData.address = address;
        if (notes !== undefined) updateData.notes = notes;
        if (status) updateData.status = status;
        if (pipeline_stage) updateData.pipeline_stage = pipeline_stage;
        if (assigned_to) updateData.assigned_to = assigned_to;
        if (dob !== undefined) updateData.dob = dob;

        const { data: lead, error } = await supabaseAdmin
            .from('leads')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi cập nhật lead', 500);
        }

        // Log status change activity if status changed
        if (newStatus && oldStatus !== newStatus) {
            await supabaseAdmin.from('lead_activities').insert({
                lead_id: id,
                activity_type: 'status_change',
                old_status: oldStatus,
                new_status: newStatus,
                created_by: req.user?.id,
            });
        }

        res.json({
            status: 'success',
            data: { lead },
        });
    } catch (error) {
        next(error);
    }
});

// Delete lead
router.delete('/:id', authenticate, requireSale, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('leads')
            .delete()
            .eq('id', id);

        if (error) {
            throw new ApiError('Lỗi khi xóa lead', 500);
        }

        res.json({
            status: 'success',
            message: 'Đã xóa lead',
        });
    } catch (error) {
        next(error);
    }
});

// Convert lead to customer
router.post('/:id/convert', authenticate, requireSale, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        // Lấy thông tin lead
        const { data: lead, error: leadError } = await supabaseAdmin
            .from('leads')
            .select('*')
            .eq('id', id)
            .single();

        if (leadError || !lead) {
            throw new ApiError('Không tìm thấy lead', 404);
        }

        // Kiểm tra nếu lead đã được convert
        if (lead.customer_id) {
            // Lead đã được convert, chỉ trả về customer hiện tại
            const { data: existingCustomer } = await supabaseAdmin
                .from('customers')
                .select('*')
                .eq('id', lead.customer_id)
                .single();

            return res.json({
                status: 'success',
                data: { customer: existingCustomer },
                message: 'Lead đã được chuyển đổi trước đó',
            });
        }

        // Kiểm tra customer đã tồn tại với số điện thoại này chưa
        const { data: existingByPhone } = await supabaseAdmin
            .from('customers')
            .select('*')
            .eq('phone', lead.phone)
            .maybeSingle();

        let customer;

        if (existingByPhone) {
            // Đã có customer với số điện thoại này, chỉ link lead vào
            customer = existingByPhone;
        } else {
            // Tạo customer mới từ lead
            const { data: newCustomer, error: customerError } = await supabaseAdmin
                .from('customers')
                .insert({
                    name: lead.name,
                    phone: lead.phone,
                    email: lead.email,
                    company: lead.company,
                    address: lead.address,
                    source: lead.source,
                    type: lead.company ? 'company' : 'individual',
                    status: 'active',
                    assigned_to: lead.assigned_to,
                    created_by: req.user!.id,
                    lead_id: lead.id,
                    dob: lead.dob,
                })
                .select()
                .single();

            if (customerError) {
                throw new ApiError('Lỗi khi tạo khách hàng', 500);
            }
            customer = newCustomer;
        }

        // Cập nhật trạng thái lead
        await supabaseAdmin
            .from('leads')
            .update({
                status: 'converted',
                converted_at: new Date().toISOString(),
                customer_id: customer.id,
            })
            .eq('id', id);

        res.json({
            status: 'success',
            data: { customer },
            message: existingByPhone
                ? 'Đã liên kết lead với khách hàng hiện có'
                : 'Đã chuyển đổi lead thành khách hàng',
        });
    } catch (error) {
        next(error);
    }
});

// Get lead activities/history
router.get('/:id/activities', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { limit = 50 } = req.query;

        const { data: activities, error } = await supabaseAdmin
            .from('lead_activities')
            .select(`
                *,
                created_by_user:users!lead_activities_created_by_fkey(name)
            `)
            .eq('lead_id', id)
            .order('created_at', { ascending: false })
            .limit(Number(limit));

        if (error) {
            throw new ApiError('Lỗi khi lấy lịch sử hoạt động', 500);
        }

        // Map to add created_by_name
        const activitiesWithNames = activities?.map(activity => ({
            ...activity,
            created_by_name: activity.created_by_user?.name || null,
        }));

        res.json({
            status: 'success',
            data: { activities: activitiesWithNames },
        });
    } catch (error) {
        next(error);
    }
});

// Add activity/note to lead
router.post('/:id/activities', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { activity_type, content, old_status, new_status, metadata } = req.body;

        if (!activity_type) {
            throw new ApiError('Loại hoạt động là bắt buộc', 400);
        }

        const { data: activity, error } = await supabaseAdmin
            .from('lead_activities')
            .insert({
                lead_id: id,
                activity_type,
                content,
                old_status,
                new_status,
                metadata: metadata || {},
                created_by: req.user!.id,
                created_by_name: req.user!.name,
            })
            .select()
            .single();

        if (error) {
            throw new ApiError('Lỗi khi thêm hoạt động: ' + error.message, 500);
        }

        res.status(201).json({
            status: 'success',
            data: { activity },
        });
    } catch (error) {
        next(error);
    }
});

export { router as leadsRouter };
