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
            case 'lead.create':
                result = await handleLeadCreate(data);
                break;
            case 'lead.update':
                result = await handleLeadUpdate(data);
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

async function handleLeadCreate(data: any) {
    const { name, phone, email, source, company, address, notes, assigned_to, lead_type } = data;

    if (!name || !phone) {
        throw new ApiError('Lead cần có ít nhất "name" và "phone"', 400);
    }

    // Kiểm tra lead đã tồn tại chưa (theo phone)
    const { data: existing } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

    if (existing) {
        return { message: 'Lead với số điện thoại này đã tồn tại', lead_id: existing.id, skipped: true };
    }

    const { data: lead, error } = await supabaseAdmin
        .from('leads')
        .insert({
            name,
            phone,
            email: email || null,
            source: source || 'n8n',
            company: company || null,
            address: address || null,
            notes: notes || null,
            status: 'new',
            assigned_to: assigned_to || null,
            lead_type: lead_type || 'individual',
        })
        .select()
        .single();

    if (error) {
        throw new ApiError('Lỗi khi tạo lead: ' + error.message, 500);
    }

    return { lead };
}

async function handleLeadUpdate(data: any) {
    const { id, phone, ...updateFields } = data;

    // Tìm lead bằng id hoặc phone
    let leadId = id;

    if (!leadId && phone) {
        const { data: existing } = await supabaseAdmin
            .from('leads')
            .select('id')
            .eq('phone', phone)
            .maybeSingle();

        if (!existing) {
            throw new ApiError('Không tìm thấy lead với số điện thoại: ' + phone, 404);
        }
        leadId = existing.id;
    }

    if (!leadId) {
        throw new ApiError('Cần có "id" hoặc "phone" để tìm lead cần cập nhật', 400);
    }

    const { data: lead, error } = await supabaseAdmin
        .from('leads')
        .update({
            ...updateFields,
            updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)
        .select()
        .single();

    if (error) {
        throw new ApiError('Lỗi khi cập nhật lead: ' + error.message, 500);
    }

    return { lead };
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
