import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

// ============================================================
// Middleware: Xác thực webhook bằng API Key
// n8n cần gửi header: x-webhook-secret: <WEBHOOK_SECRET>
// ============================================================
const verifyWebhookSecret = (req: Request, res: Response, next: NextFunction) => {
    const secret = req.headers['x-webhook-secret'] as string;
    const expectedSecret = process.env.WEBHOOK_SECRET;

    if (!expectedSecret) {
        console.error('[Webhook] WEBHOOK_SECRET chưa được cấu hình trong .env');
        return res.status(500).json({
            status: 'error',
            message: 'Webhook chưa được cấu hình',
        });
    }

    if (!secret || secret !== expectedSecret) {
        console.warn('[Webhook] Unauthorized request - invalid secret');
        return res.status(401).json({
            status: 'error',
            message: 'Unauthorized - Invalid webhook secret',
        });
    }

    next();
};

// ============================================================
// POST /api/webhooks/n8n
// Endpoint chính để n8n gửi data vào
// 
// Body format:
// {
//   "event": "lead.create" | "lead.update" | "customer.create" | "order.create" | "custom",
//   "data": { ... }
// }
// ============================================================
router.post('/n8n', verifyWebhookSecret, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { event, data } = req.body;

        if (!event || !data) {
            throw new ApiError('Thiếu trường "event" hoặc "data" trong request body', 400);
        }

        console.log(`[Webhook] Nhận event: ${event}`, JSON.stringify(data).substring(0, 200));

        let result: any;

        switch (event) {
            case 'lead.upsert':
            case 'lead.create':
            case 'lead.update':
                result = await handleLeadUpsert(data);
                break;
            case 'customer.create':
                result = await handleCustomerCreate(data);
                break;
            case 'order.create':
                result = await handleOrderCreate(data);
                break;
            default:
                // Lưu data vào bảng webhook_logs cho event chưa xử lý
                result = await logWebhookEvent(event, data);
                break;
        }

        // Log webhook vào database
        await logWebhookEvent(event, data, 'success');

        res.status(200).json({
            status: 'success',
            message: `Event "${event}" đã được xử lý`,
            data: result,
        });
    } catch (error) {
        // Log lỗi webhook
        try {
            await logWebhookEvent(
                req.body?.event || 'unknown',
                req.body?.data || {},
                'error',
                error instanceof Error ? error.message : 'Unknown error'
            );
        } catch (logErr) {
            console.error('[Webhook] Lỗi khi log webhook:', logErr);
        }
        next(error);
    }
});

// ============================================================
// POST /api/webhooks/n8n/raw
// Endpoint nhận raw data từ n8n (không cần format event/data)
// Data sẽ được lưu trực tiếp vào bảng webhook_logs
// ============================================================
router.post('/n8n/raw', verifyWebhookSecret, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = req.body;

        console.log('[Webhook] Nhận raw data:', JSON.stringify(data).substring(0, 200));

        await logWebhookEvent('raw', data, 'success');

        res.status(200).json({
            status: 'success',
            message: 'Raw data đã được lưu',
        });
    } catch (error) {
        next(error);
    }
});

// ============================================================
// GET /api/webhooks/health
// Kiểm tra webhook endpoint hoạt động (n8n có thể dùng để test)
// ============================================================
router.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        message: 'Webhook endpoint is active',
        timestamp: new Date().toISOString(),
    });
});

// ============================================================
// Handlers cho từng loại event
// ============================================================

/**
 * Helper: Kiểm tra chuỗi có phải UUID không
 */
const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

/**
 * Helper: Tìm UUID nhân viên dựa trên Họ tên
 */
async function resolveUserByName(nameOrId: string): Promise<string | null> {
    if (!nameOrId) return null;
    
    // Nếu đã là UUID thì dùng luôn
    if (isUUID(nameOrId)) return nameOrId;

    // Tìm kiếm trong bảng users theo cột name
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('name', nameOrId)
        .maybeSingle();

    if (error || !data) {
        console.warn(`[Webhook] Không tìm thấy hoặc có nhiều user với tên: ${nameOrId}`);
        return null;
    }
    
    return data.id;
}

async function handleLeadUpsert(data: any) {
    const { 
        name, phone, email, source, company, address, notes, assigned_to, lead_type,
        fb_thread_id, pancake_conversation_id, facebook_name, avatar_url,
        last_message_text, last_message_time, last_actor,
        ai_suggested_reply, customer_id: pancake_customer_id
    } = data;

    if (!name && !fb_thread_id && !pancake_conversation_id) {
        throw new ApiError('Lead cần có ít nhất tên hoặc thông tin định danh (Facebook ID/Pancake ID)', 400);
    }

    // 1. Kiểm tra lead đã tồn tại chưa (Duplicate Check theo ưu tiên)
    let existing: any = null;

    // Ưu tiên 1: Theo fb_thread_id
    if (fb_thread_id) {
        const { data } = await supabaseAdmin
            .from('leads')
            .select('id, assigned_to')
            .eq('fb_thread_id', fb_thread_id)
            .maybeSingle();
        if (data) existing = data;
    }

    // Ưu tiên 2: Theo phone (nếu chưa tìm thấy)
    if (!existing && phone) {
        const { data } = await supabaseAdmin
            .from('leads')
            .select('id, assigned_to')
            .eq('phone', phone)
            .maybeSingle();
        if (data) existing = data;
    }

    // Ưu tiên 3: Theo các ID Pancake khác (nếu vẫn chưa thấy)
    if (!existing && pancake_customer_id) {
        const { data } = await supabaseAdmin
            .from('leads')
            .select('id, assigned_to')
            .eq('pancake_customer_id', pancake_customer_id)
            .maybeSingle();
        if (data) existing = data;
    }

    if (!existing && pancake_conversation_id) {
        const { data } = await supabaseAdmin
            .from('leads')
            .select('id, assigned_to')
            .eq('pancake_conversation_id', pancake_conversation_id)
            .maybeSingle();
        if (data) existing = data;
    }

    if (existing) {
        // Nếu đã tồn tại, chuyển sang update thay vì skip hoàn toàn (hoặc chỉ skip tạo mới)
        console.log(`[Webhook] Lead đã tồn tại (ID: ${existing.id}), chuyển sang update...`);
        return await handleLeadUpdate({ id: existing.id, ...data });
    }

    // 2. Resolve assigned_to (Name -> UUID)
    const resolvedAssignedTo = await resolveUserByName(assigned_to);

    // 3. Tạo Lead mới
    const { data: lead, error } = await supabaseAdmin
        .from('leads')
        .insert({
            name: name || facebook_name || 'Khách hàng mới',
            phone: phone || null,
            email: email || null,
            source: source || 'n8n',
            company: company || null,
            address: address || null,
            notes: notes || null,
            status: 'new',
            assigned_to: resolvedAssignedTo,
            lead_type: lead_type || 'individual',
            fb_thread_id: fb_thread_id || null,
            pancake_conversation_id: pancake_conversation_id || null,
            pancake_customer_id: pancake_customer_id || null,
            ai_suggested_reply: ai_suggested_reply || null,
            fb_profile_name: facebook_name || null,
            facebook_name: facebook_name || null,
            avatar_url: avatar_url || null,
            last_message_text: last_message_text || null,
            last_message_time: last_message_time || new Date().toISOString(),
            last_actor: last_actor || null,
            t_last_inbound: last_actor === 'lead' ? (last_message_time || new Date().toISOString()) : null,
            t_last_outbound: last_actor === 'sale' ? (last_message_time || new Date().toISOString()) : null,
            assign_state: resolvedAssignedTo ? 'assigned' : 'unassigned',
        })
        .select()
        .single();

    if (error) {
        throw new ApiError('Lỗi khi tạo lead: ' + error.message, 500);
    }

    // 3. Log sự kiện tạo lead
    await logLeadActivity(lead.id, {
        type: 'lead_created',
        content: `Lead được tạo từ nguồn ${source || 'Pancake'}`,
        userName: 'Hệ thống'
    });

    // 4. Log sự kiện gán Sale nếu có
    if (resolvedAssignedTo) {
        await logLeadActivity(lead.id, {
            type: 'owner_assigned',
            content: `Lead được gán cho ${assigned_to}`,
            userId: resolvedAssignedTo,
            userName: assigned_to
        });
    }

    // 5. Log ghi chú ban đầu nếu có
    if (notes) {
        await logLeadActivity(lead.id, {
            type: 'note',
            content: notes,
            userId: resolvedAssignedTo || undefined,
            userName: assigned_to && !isUUID(assigned_to) ? assigned_to : 'n8n'
        });
    }

    // 6. Log gợi ý AI nếu có
    if (ai_suggested_reply) {
        await logLeadActivity(lead.id, {
            type: 'ai_suggestion',
            content: ai_suggested_reply,
            userName: 'AI Assistant'
        });
    }

    // 6. Log tin nhắn đầu tiên nếu có
    if (last_message_text) {
        await logLeadMessage(lead.id, {
            content: last_message_text,
            sender_type: last_actor || 'lead',
            sender_name: last_actor === 'lead' ? (name || facebook_name) : 'Sale',
            created_at: last_message_time
        });
    }

    return { lead };
}

async function handleLeadUpdate(data: any) {
    const { 
        id, phone, fb_thread_id, pancake_conversation_id, pancake_customer_id,
        last_message_text, last_message_time, last_actor,
        status, pipeline_stage, assigned_to, ai_suggested_reply, ...otherFields 
    } = data;

    // 1. Tìm leadId
    let leadId = id;
    let currentLead: any = null;

    if (!leadId) {
        let query = supabaseAdmin.from('leads').select('id, assigned_to, name, facebook_name');
        if (phone) query = query.eq('phone', phone);
        else if (pancake_customer_id) query = query.eq('pancake_customer_id', pancake_customer_id);
        else if (fb_thread_id) query = query.eq('fb_thread_id', fb_thread_id);
        else if (pancake_conversation_id) query = query.eq('pancake_conversation_id', pancake_conversation_id);
        
        const { data: found } = await query.maybeSingle();
        if (found) {
            leadId = found.id;
            currentLead = found;
        }
    }

    if (!leadId) {
        throw new ApiError('Không tìm thấy lead để cập nhật', 404);
    }

    // 2. Lấy thông tin hiện tại nếu chưa có (để check ownership)
    if (!currentLead) {
        const { data: found } = await supabaseAdmin
            .from('leads')
            .select('id, assigned_to, name, facebook_name')
            .eq('id', leadId)
            .single();
        currentLead = found;
    }

    // 3. Chuẩn bị dữ liệu update (Bỏ notes ra khỏi update trực tiếp)
    const { notes: incomingNotes, ...updateFields } = otherFields;

    const updateData: any = {
        ...updateFields,
        updated_at: new Date().toISOString(),
    };

    if (status) updateData.status = status;
    if (pipeline_stage) updateData.pipeline_stage = pipeline_stage;
    if (ai_suggested_reply) {
        updateData.ai_suggested_reply = ai_suggested_reply;

        // Log gợi ý AI
        await logLeadActivity(leadId, {
            type: 'ai_suggestion',
            content: ai_suggested_reply,
            userName: 'AI Assistant'
        });
    }
    if (pancake_customer_id) updateData.pancake_customer_id = pancake_customer_id;
    
    // Logic Ownership: Chỉ gán khi lead chưa có chủ
    if (assigned_to && !currentLead.assigned_to) {
        const resolvedId = await resolveUserByName(assigned_to);
        if (resolvedId) {
            updateData.assigned_to = resolvedId;
            updateData.assign_state = 'assigned';

            // Log sự kiện gán Sale
            await logLeadActivity(leadId, {
                type: 'owner_assigned',
                content: `Lead được gán cho ${assigned_to}`,
                userId: resolvedId,
                userName: assigned_to
            });
        }
    }

    // Cập nhật thông tin tin nhắn cuối và SLA
    if (last_message_text) {
        updateData.last_message_text = last_message_text;
        updateData.last_message_time = last_message_time || new Date().toISOString();
        updateData.last_actor = last_actor;

        if (last_actor === 'lead') {
            updateData.t_last_inbound = updateData.last_message_time;
            
            // Log tin nhắn khách
            await logLeadActivity(leadId, {
                type: 'customer_message',
                content: last_message_text,
                userName: currentLead.name || currentLead.facebook_name || 'Khách hàng'
            });
        } else if (last_actor === 'sale') {
            updateData.t_last_outbound = updateData.last_message_time;

            // Log câu trả lời của Sale
            await logLeadActivity(leadId, {
                type: 'sale_reply',
                content: last_message_text,
                userName: 'Sale'
            });
        }
    }

    const { data: lead, error } = await supabaseAdmin
        .from('leads')
        .update(updateData)
        .eq('id', leadId)
        .select()
        .single();

    if (error) {
        throw new ApiError('Lỗi khi cập nhật lead: ' + error.message, 500);
    }

    // 4. Lưu ghi chú vào lịch sử hoạt động nếu có
    if (incomingNotes) {
        await logLeadActivity(leadId, {
            type: 'note',
            content: incomingNotes,
            userId: currentLead?.assigned_to || undefined,
            userName: 'n8n'
        });
    }

    // 5. Lưu lịch sử tin nhắn
    if (last_message_text) {
        await logLeadMessage(leadId, {
            content: last_message_text,
            sender_type: last_actor || 'lead',
            sender_name: last_actor === 'lead' ? (currentLead?.name || currentLead?.facebook_name) : 'Sale',
            created_at: last_message_time
        });
    }

    return { lead };
}

/**
 * Helper: Lưu lịch sử tin nhắn vào bảng lead_messages
 */
async function logLeadMessage(leadId: string, messageData: any) {
    try {
        const { content, sender_type, sender_name, created_at, message_id, message_type, metadata } = messageData;
        
        await supabaseAdmin
            .from('lead_messages')
            .insert({
                lead_id: leadId,
                content,
                sender_type,
                sender_name: sender_name || null,
                message_id: message_id || null,
                message_type: message_type || 'text',
                metadata: metadata || {},
                created_at: created_at || new Date().toISOString()
            });
    } catch (err) {
        console.error('[Webhook] Lỗi khi lưu lead_messages:', err);
    }
}

async function handleCustomerCreate(data: any) {
    const { name, phone, email, company, address, source, type } = data;

    if (!name || !phone) {
        throw new ApiError('Customer cần có ít nhất "name" và "phone"', 400);
    }

    // Kiểm tra customer đã tồn tại chưa
    const { data: existing } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

    if (existing) {
        return { message: 'Customer với số điện thoại này đã tồn tại', customer_id: existing.id, skipped: true };
    }

    const { data: customer, error } = await supabaseAdmin
        .from('customers')
        .insert({
            name,
            phone,
            email: email || null,
            company: company || null,
            address: address || null,
            source: source || 'n8n',
            type: type || 'individual',
            status: 'active',
        })
        .select()
        .single();

    if (error) {
        throw new ApiError('Lỗi khi tạo customer: ' + error.message, 500);
    }

    return { customer };
}

async function handleOrderCreate(data: any) {
    const { customer_id, customer_phone, items, notes, total_amount } = data;

    let finalCustomerId = customer_id;

    // Tìm customer bằng phone nếu không có customer_id
    if (!finalCustomerId && customer_phone) {
        const { data: customer } = await supabaseAdmin
            .from('customers')
            .select('id')
            .eq('phone', customer_phone)
            .maybeSingle();

        if (customer) {
            finalCustomerId = customer.id;
        }
    }

    if (!finalCustomerId) {
        throw new ApiError('Cần có "customer_id" hoặc "customer_phone" hợp lệ', 400);
    }

    const { data: order, error } = await supabaseAdmin
        .from('orders')
        .insert({
            customer_id: finalCustomerId,
            notes: notes || null,
            total_amount: total_amount || 0,
            status: 'pending',
            source: 'n8n',
        })
        .select()
        .single();

    if (error) {
        throw new ApiError('Lỗi khi tạo order: ' + error.message, 500);
    }

    return { order };
}

/**
 * Helper: Lưu lịch sử hoạt động vào bảng lead_activities
 */
async function logLeadActivity(leadId: string, activityData: {
    type: string;
    content: string;
    userId?: string;
    userName?: string;
    metadata?: any;
}) {
    try {
        const { type, content, userId, userName, metadata } = activityData;
        
        await supabaseAdmin
            .from('lead_activities')
            .insert({
                lead_id: leadId,
                activity_type: type,
                content: content,
                created_by: userId || null,
                created_by_name: userName || 'Hệ thống',
                metadata: metadata || {},
                created_at: new Date().toISOString()
            });
    } catch (err) {
        console.error('[Webhook] Lỗi khi lưu lead_activities:', err);
    }
}

// ============================================================
// Log webhook events (optional - cần tạo bảng webhook_logs)
// ============================================================
async function logWebhookEvent(
    event: string,
    data: any,
    status: string = 'received',
    errorMessage?: string
) {
    try {
        await supabaseAdmin
            .from('webhook_logs')
            .insert({
                event,
                payload: data,
                status,
                error_message: errorMessage || null,
                source: 'n8n',
                created_at: new Date().toISOString(),
            });
    } catch (err) {
        // Nếu bảng webhook_logs chưa tồn tại, chỉ log ra console
        console.log(`[Webhook Log] Event: ${event}, Status: ${status}`, errorMessage || '');
    }
}

export default router;
