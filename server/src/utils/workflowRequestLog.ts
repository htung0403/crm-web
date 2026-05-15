import { supabaseAdmin } from '../config/supabase.js';

export async function logWorkflowRequest(params: {
    entityId: string;
    action: string;
    stepName: string;
    notes?: string | null;
    reason?: string | null;
    createdBy?: string | null;
}): Promise<void> {
    try {
        await supabaseAdmin.from('order_workflow_step_log').insert({
            entity_id: params.entityId,
            order_item_step_id: null,
            action: params.action,
            step_name: params.stepName,
            notes: params.notes ?? null,
            reason: params.reason ?? null,
            created_by: params.createdBy ?? null,
        });
    } catch (err) {
        console.error('order_workflow_step_log insert error:', err);
    }
}

export function resolveRequestEntityId(row: {
    order_item_id?: string | null;
    order_product_service_id?: string | null;
}): string | null {
    return row.order_item_id || row.order_product_service_id || null;
}

export async function logPartnerStatusChange(
    row: { order_item_id?: string | null; order_product_service_id?: string | null },
    oldStatus: string | undefined,
    newStatus: string,
    notes: string | null | undefined,
    createdBy: string | null | undefined
): Promise<void> {
    const entityId = resolveRequestEntityId(row);
    if (!entityId || oldStatus === newStatus) return;

    if (newStatus === 'requested') {
        await logWorkflowRequest({
            entityId,
            action: 'partner_requested',
            stepName: 'Gửi đối tác',
            notes: notes || 'Yêu cầu gửi đối tác',
            createdBy,
        });
        return;
    }

    if (newStatus === 'rejected') {
        await logWorkflowRequest({
            entityId,
            action: 'partner_rejected',
            stepName: 'Gửi đối tác',
            notes: notes || 'QL từ chối yêu cầu gửi đối tác',
            reason: notes,
            createdBy,
        });
        return;
    }

    if (newStatus === 'ship_to_partner' && oldStatus === 'requested') {
        await logWorkflowRequest({
            entityId,
            action: 'partner_approved',
            stepName: 'Gửi đối tác',
            notes: notes || 'QL đã duyệt gửi đối tác',
            createdBy,
        });
    }
}

export async function logAccessoryStatusChange(
    row: { order_item_id?: string | null; order_product_service_id?: string | null },
    oldStatus: string | undefined,
    newStatus: string,
    notes: string | null | undefined,
    createdBy: string | null | undefined
): Promise<void> {
    const entityId = resolveRequestEntityId(row);
    if (!entityId || oldStatus === newStatus) return;

    if (newStatus === 'requested') {
        await logWorkflowRequest({
            entityId,
            action: 'accessory_requested',
            stepName: 'Yêu cầu mua phụ kiện',
            notes: notes || 'Yêu cầu mua phụ kiện',
            createdBy,
        });
        return;
    }

    if (newStatus === 'rejected') {
        await logWorkflowRequest({
            entityId,
            action: 'accessory_rejected',
            stepName: 'Mua phụ kiện',
            notes: notes || 'QL từ chối yêu cầu mua phụ kiện',
            reason: notes,
            createdBy,
        });
        return;
    }

    if (newStatus === 'need_buy' && oldStatus === 'requested') {
        await logWorkflowRequest({
            entityId,
            action: 'accessory_approved',
            stepName: 'Mua phụ kiện',
            notes: notes || 'QL đã duyệt mua phụ kiện',
            createdBy,
        });
    }
}

export async function logExtensionStatusChange(
    row: { order_item_id?: string | null; order_product_service_id?: string | null },
    oldStatus: string | undefined,
    newStatus: string,
    notes: string | null | undefined,
    createdBy: string | null | undefined
): Promise<void> {
    const entityId = resolveRequestEntityId(row);
    if (!entityId || oldStatus === newStatus) return;

    if (newStatus === 'requested') {
        await logWorkflowRequest({
            entityId,
            action: 'extension_requested',
            stepName: 'Xin gia hạn',
            notes: notes || 'Yêu cầu gia hạn',
            createdBy,
        });
        return;
    }

    if (newStatus === 'rejected') {
        await logWorkflowRequest({
            entityId,
            action: 'extension_rejected',
            stepName: 'Xin gia hạn',
            notes: notes || 'QL từ chối yêu cầu gia hạn',
            reason: notes,
            createdBy,
        });
        return;
    }

    if (newStatus === 'manager_approved' && oldStatus === 'requested') {
        await logWorkflowRequest({
            entityId,
            action: 'extension_approved',
            stepName: 'Xin gia hạn',
            notes: notes || 'QL đã duyệt gia hạn',
            createdBy,
        });
    }
}
