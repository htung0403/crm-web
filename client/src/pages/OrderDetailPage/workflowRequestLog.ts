export const WORKFLOW_REQUEST_LOG_ACTIONS = [
    'accessory_requested',
    'accessory_approved',
    'accessory_rejected',
    'partner_requested',
    'partner_approved',
    'partner_rejected',
    'extension_requested',
    'extension_approved',
    'extension_rejected',
] as const;

export type WorkflowRequestLogAction = (typeof WORKFLOW_REQUEST_LOG_ACTIONS)[number];

export function isWorkflowRequestLogAction(action: string): boolean {
    return (WORKFLOW_REQUEST_LOG_ACTIONS as readonly string[]).includes(action);
}

const DISPLAY: Record<
    WorkflowRequestLogAction,
    { emoji: string; label: string; listClass: string; boxClass: string }
> = {
    accessory_requested: {
        emoji: '',
        label: 'Yêu cầu mua phụ kiện',
        listClass: 'text-amber-600',
        boxClass: 'bg-amber-50 border-amber-100 text-amber-700',
    },
    accessory_approved: {
        emoji: '',
        label: 'QL duyệt mua phụ kiện',
        listClass: 'text-green-600',
        boxClass: 'bg-green-50 border-green-100 text-green-700',
    },
    accessory_rejected: {
        emoji: '',
        label: 'QL từ chối mua phụ kiện',
        listClass: 'text-red-600',
        boxClass: 'bg-red-50 border-red-100 text-red-700',
    },
    partner_requested: {
        emoji: '',
        label: 'Yêu cầu gửi đối tác',
        listClass: 'text-purple-600',
        boxClass: 'bg-purple-50 border-purple-100 text-purple-700',
    },
    partner_approved: {
        emoji: '',
        label: 'QL duyệt gửi đối tác',
        listClass: 'text-green-600',
        boxClass: 'bg-green-50 border-green-100 text-green-700',
    },
    partner_rejected: {
        emoji: '',
        label: 'QL từ chối gửi đối tác',
        listClass: 'text-red-600',
        boxClass: 'bg-red-50 border-red-100 text-red-700',
    },
    extension_requested: {
        emoji: '',
        label: 'Xin gia hạn',
        listClass: 'text-blue-600',
        boxClass: 'bg-blue-50 border-blue-100 text-blue-700',
    },
    extension_approved: {
        emoji: '',
        label: 'QL duyệt gia hạn',
        listClass: 'text-green-600',
        boxClass: 'bg-green-50 border-green-100 text-green-700',
    },
    extension_rejected: {
        emoji: '',
        label: 'QL từ chối gia hạn',
        listClass: 'text-red-600',
        boxClass: 'bg-red-50 border-red-100 text-red-700',
    },
};

export function getWorkflowRequestLogDisplay(action: string) {
    return DISPLAY[action as WorkflowRequestLogAction];
}
