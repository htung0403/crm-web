// Constants and label mappings for OrderDetailPage

export const ACCESSORY_LABELS: Record<string, string> = {
    need_buy: 'Cần mua',
    bought: 'Đã mua',
    waiting_ship: 'Chờ ship',
    shipped: 'Ship tới',
    delivered_to_tech: 'Giao KT',
};

export const PARTNER_LABELS: Record<string, string> = {
    ship_to_partner: 'Ship ĐT',
    partner_doing: 'ĐT làm',
    ship_back: 'Ship về',
    done: 'Done',
};

export const EXTENSION_LABELS: Record<string, string> = {
    requested: 'Đã yêu cầu',
    sale_contacted: 'Sale đã liên hệ',
    manager_approved: 'QL đã duyệt',
    notified_tech: 'Đã báo KT',
    kpi_recorded: 'Đã ghi KPI',
};

export const SALES_STEPS = [
    { id: 'step1', label: '1. Nhận đồ', title: 'Nhận đồ', color: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    { id: 'step2', label: '2. Gắn Tag', title: 'Gắn Tag', color: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    { id: 'step3', label: '3. Trao đổi KT', title: 'Trao đổi KT', color: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    { id: 'step4', label: '4. Phê duyệt', title: 'Phê duyệt', color: 'text-red-500', bgColor: 'bg-red-50', borderColor: 'border-red-200', isAlert: true },
    { id: 'step5', label: '5. Chốt đơn', title: 'Chốt đơn', color: 'text-green-500', bgColor: 'bg-green-50', borderColor: 'border-green-200', isSuccess: true },
];

export const SALES_STATUS_LABELS: Record<string, string> = {
    pending: 'Đơn nháp',
    step1: '1. Nhận đồ',
    step2: '2. Gắn Tag',
    step3: '3. Trao đổi KT',
    step4: '4. Phê duyệt',
    step5: '5. Chốt đơn',
    assigned: 'Đã phân công',
    in_progress: 'Đang thực hiện',
    completed: 'Hoàn thành',
    cancelled: 'Đã huỷ',
};

export const AFTER_SALE_STAGE_LABELS: Record<string, string> = {
    after1: 'Kiểm nợ & Ảnh hoàn thiện',
    after2: 'Đóng gói & Giao hàng',
    after3: 'Nhắn HD & Feedback',
    after4: 'Lưu Trữ',
};

export const CARE_WARRANTY_STAGE_LABELS: Record<string, string> = {
    war1: '1. Tiếp nhận',
    war2: '2. Xử lý',
    war3: '3. Hoàn tất',
    care6: 'Mốc 6 Tháng',
    care12: 'Mốc 12 Tháng',
    'care-custom': 'Lịch Riêng',
};

export const TECH_ROOMS = [
    { id: 'room1', title: 'Phòng Kỹ thuật 1' },
    { id: 'room2', title: 'Phòng Kỹ thuật 2' },
    { id: 'room3', title: 'Phòng Kỹ thuật 3' },
    { id: 'room4', title: 'Phòng Kỹ thuật 4' },
];

export const columns = [
    { id: 'before_sale', title: 'Đang lên đơn' },
    { id: 'in_progress', title: 'Đang thực hiện' },
    { id: 'done', title: 'Hoàn thành' },
    { id: 'after_sale', title: 'After sale' },
    { id: 'cancelled', title: 'Đã huỷ' },
];

export function getSalesStatusLabel(value: string | null | undefined): string {
    if (value == null || value === '') return '—';
    return SALES_STATUS_LABELS[value] ?? value;
}

export function getAfterSaleStageLabel(value: string | null | undefined): string {
    if (value == null || value === '') return '—';
    return AFTER_SALE_STAGE_LABELS[value] ?? value;
}

export function getCareWarrantyStageLabel(value: string | null | undefined): string {
    if (value == null || value === '') return '—';
    return CARE_WARRANTY_STAGE_LABELS[value] ?? value;
}
