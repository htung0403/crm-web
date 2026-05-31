import { supabaseAdmin } from '../config/supabase.js';

export function isPaymentSchemaColumnError(error: { message?: string; code?: string } | null): boolean {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return (
        error.code === 'PGRST204' ||
        msg.includes('order_product_id') ||
        msg.includes('payment_kind') ||
        msg.includes('could not find') ||
        (msg.includes('column') && msg.includes('payment_records'))
    );
}

type PaymentInsertPayload = {
    order_id: string;
    order_code: string;
    content: string;
    amount: number;
    payment_method: string;
    notes?: string | null;
    transaction_type: string;
    transaction_category: string;
    transaction_status: string;
    created_by: string;
    order_product_id?: string | null;
    payment_kind?: string | null;
    image_url?: string | null;
};

export async function insertPaymentRecord(payload: PaymentInsertPayload) {
    const extendedPayload = {
        ...payload,
        order_product_id: payload.order_product_id ?? null,
        payment_kind: payload.payment_kind ?? 'payment',
    };

    let result = await supabaseAdmin
        .from('payment_records')
        .insert(extendedPayload)
        .select()
        .single();

    if (result.error && isPaymentSchemaColumnError(result.error)) {
        const { order_product_id: _op, payment_kind: _pk, ...legacyPayload } = extendedPayload;
        result = await supabaseAdmin
            .from('payment_records')
            .insert(legacyPayload)
            .select()
            .single();
    }

    return result;
}

export async function fetchOrderPaymentRecords(orderId: string) {
    const extendedSelect =
        '*, created_by_user:users!payment_records_created_by_fkey(id, name, avatar), order_product:order_products(id, product_code, name, images)';

    let result = await supabaseAdmin
        .from('payment_records')
        .select(extendedSelect)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

    if (result.error && isPaymentSchemaColumnError(result.error)) {
        result = await supabaseAdmin
            .from('payment_records')
            .select('*, created_by_user:users!payment_records_created_by_fkey(id, name, avatar)')
            .eq('order_id', orderId)
            .order('created_at', { ascending: false });
    }

    return result;
}

export async function sumPaidAmountByProduct(orderIds: string[]): Promise<Record<string, number>> {
    const paidByProduct: Record<string, number> = {};
    if (orderIds.length === 0) return paidByProduct;

    const { data, error } = await supabaseAdmin
        .from('payment_records')
        .select('order_product_id, amount')
        .in('order_id', orderIds)
        .not('order_product_id', 'is', null);

    if (error) {
        if (isPaymentSchemaColumnError(error)) return paidByProduct;
        console.warn('[paymentRecords] sumPaidAmountByProduct:', error.message);
        return paidByProduct;
    }

    for (const pay of data || []) {
        if (!pay.order_product_id) continue;
        paidByProduct[pay.order_product_id] =
            (paidByProduct[pay.order_product_id] || 0) + (Number(pay.amount) || 0);
    }

    return paidByProduct;
}
