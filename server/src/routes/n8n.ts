import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || 'crm-n8n-webhook-secret-2026';

const verifyN8nSecret = (req: Request, res: Response, next: NextFunction) => {
    const secret = req.headers['x-webhook-secret'];

    if (secret !== N8N_WEBHOOK_SECRET) {
        return res.status(401).json({
            status: 'error',
            message: 'Unauthorized - Invalid webhook secret',
        });
    }

    next();
};

function getDateWindow(req: Request) {
    const now = new Date();
    const offsetDays = Number(req.query.offset_days ?? req.query.offsetDays ?? 0);

    if (req.query.from || req.query.to) {
        const from = req.query.from ? new Date(String(req.query.from)) : new Date(now);
        const to = req.query.to ? new Date(String(req.query.to)) : new Date(from);

        if (!req.query.to) {
            to.setDate(to.getDate() + 1);
        }

        return { from, to };
    }

    const target = req.query.date ? new Date(String(req.query.date)) : new Date(now);
    target.setDate(target.getDate() + offsetDays);
    target.setHours(0, 0, 0, 0);

    const to = new Date(target);
    to.setDate(to.getDate() + 1);

    return { from: target, to };
}

function assertValidDateWindow(from: Date, to: Date) {
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        throw new ApiError('Invalid date window. Use date=YYYY-MM-DD or from/to ISO timestamps.', 400);
    }

    if (from >= to) {
        throw new ApiError('Invalid date window. "from" must be before "to".', 400);
    }
}

router.get('/cron-data', verifyN8nSecret, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { from, to } = getDateWindow(req);
        assertValidDateWindow(from, to);

        const fromIso = from.toISOString();
        const toIso = to.toISOString();

        const { data: products, error } = await supabaseAdmin
            .from('order_products')
            .select(`
                id, order_id, product_code, name, type, status,
                after_sale_stage, care_warranty_flow, care_warranty_stage,
                current_phase, phase_stage, delivery_code, delivery_carrier,
                delivery_type, due_at,
                order:orders(
                    id, order_code, sales_id, status,
                    customer:customers(id, name, phone),
                    sales_user:users!orders_sales_id_fkey(id, name, telegram_chat_id)
                )
            `)
            .gte('due_at', fromIso)
            .lt('due_at', toIso)
            .not('after_sale_stage', 'eq', 'after4')
            .order('due_at', { ascending: true });

        if (error) {
            throw new ApiError('Lỗi truy vấn sản phẩm theo hạn trả: ' + error.message, 500);
        }

        const productRows = products || [];

        res.json({
            status: 'success',
            server_time: new Date().toISOString(),
            filters: {
                from: fromIso,
                to: toIso,
                source: 'order_products.due_at',
            },
            counts: {
                items: 0,
                orders: productRows.length,
            },
            data: {
                items: [],
                orders: productRows,
            },
        });
    } catch (error) {
        next(error);
    }
});

export default router;
