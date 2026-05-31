import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase.js';
import { fireCrmMasterWebhook } from './webhookNotifier.js';

type StaffRole = 'technician' | 'sale' | 'manager' | 'accountant' | string;
type Channel = 'telegram' | 'zalo';

export type CrmMasterEventPayload = {
    target_user_id: string;
    target_role: StaffRole;
    channel?: Channel;
    order?: Record<string, any> | null;
    item?: Record<string, any> | null;
    customer?: Record<string, any> | null;
    staff?: Record<string, any> | null;
    product_image_url?: string | null;
    links?: Record<string, any> | null;
    [key: string]: any;
};

function firstRelation<T = any>(value: T | T[] | null | undefined): T | null {
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export function getFirstImage(images: unknown): string | null {
    if (Array.isArray(images)) return typeof images[0] === 'string' ? images[0] : null;
    if (typeof images === 'string') {
        try {
            const parsed = JSON.parse(images);
            return Array.isArray(parsed) && typeof parsed[0] === 'string' ? parsed[0] : null;
        } catch {
            return images || null;
        }
    }
    return null;
}

export function buildCrmOrderUrl(orderCodeOrId?: string | null): string | null {
    if (!orderCodeOrId) return null;
    const baseUrl = process.env.CRM_WEB_URL || 'https://crm-web-sepia-nine.vercel.app';
    return `${baseUrl.replace(/\/$/, '')}/orders/${orderCodeOrId}`;
}

export function notifyCrmMasterUser(event: string, payload: CrmMasterEventPayload): void {
    const body = {
        event,
        event_id: uuidv4(),
        created_at: new Date().toISOString(),
        channel: payload.channel || 'telegram',
        ...payload,
    };

    fireCrmMasterWebhook(event, body).catch((err) => {
        console.error(`[CrmMasterEvent] Failed to fire ${event}:`, err);
    });
}

export async function getManagerRecipients(): Promise<any[]> {
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, name, role, telegram_chat_id')
        .in('role', ['admin', 'manager']);

    if (error) {
        console.error('[CrmMasterEvent] Failed to resolve managers:', error.message);
        return [];
    }

    return data || [];
}

export async function getServiceNotificationContext(serviceId: string) {
    const { data, error } = await supabaseAdmin
        .from('order_product_services')
        .select(`
            id, item_name, status, notes, technician_id, assigned_at, completed_at,
            order_product:order_products(
                id, order_id, product_code, name, images, due_at,
                order:orders(
                    id, order_code, due_at, sales_id,
                    customer:customers(id, name, phone, zalo_user_id, customer_zalo_user_id),
                    sales_user:users!orders_sales_id_fkey(id, name, role, telegram_chat_id)
                )
            ),
            technician:users!order_product_services_technician_id_fkey(id, name, role, telegram_chat_id)
        `)
        .eq('id', serviceId)
        .maybeSingle();

    if (error || !data) {
        if (error) console.error('[CrmMasterEvent] Failed to load service context:', error.message);
        return null;
    }

    const orderProduct = firstRelation(data.order_product);
    const order = firstRelation(orderProduct?.order);
    const customer = firstRelation(order?.customer);
    const salesUser = firstRelation(order?.sales_user);
    const technician = firstRelation(data.technician);

    return {
        service: data,
        orderProduct,
        order,
        customer,
        salesUser,
        technician,
        productImageUrl: getFirstImage(orderProduct?.images),
    };
}

export function buildServiceEventBase(context: any) {
    const orderCodeOrId = context.order?.order_code || context.order?.id;
    return {
        order: context.order ? {
            id: context.order.id,
            order_code: context.order.order_code,
            return_due_at: context.orderProduct?.due_at || context.order?.due_at || null,
        } : null,
        item: {
            id: context.service.id,
            service_name: context.service.item_name || context.orderProduct?.name || null,
            product_name: context.orderProduct?.name || null,
            product_code: context.orderProduct?.product_code || null,
            deadline_at: context.orderProduct?.due_at || context.order?.due_at || null,
            note: context.service.notes || null,
        },
        customer: context.customer ? {
            name: context.customer.name,
            phone: context.customer.phone,
            zalo_user_id: context.customer.zalo_user_id || context.customer.customer_zalo_user_id || null,
        } : null,
        product_image_url: context.productImageUrl,
        links: {
            crm_url: buildCrmOrderUrl(orderCodeOrId),
        },
    };
}


