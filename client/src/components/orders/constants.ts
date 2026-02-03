import type { OrderStatus, Package as PackageType, Voucher } from '@/types';
import type { Order } from '@/hooks/useOrders';

export interface KanbanColumn {
    id: OrderStatus;
    title: string;
    color: string;
    bgColor: string;
    borderColor: string;
}

/** Kanban Kỹ thuật: 3 phòng cố định. step_order 1 → Phòng Mạ, 2 → Dán đế, 3 → Phòng Da */
export const TECH_ROOM_IDS = ['phong_ma', 'phong_dan_de', 'phong_da'] as const;
export type TechRoomId = (typeof TECH_ROOM_IDS)[number];
export const TECH_ROOMS: { id: TechRoomId; title: string; stepOrder: number }[] = [
    { id: 'phong_ma', title: 'Phòng Mạ', stepOrder: 1 },
    { id: 'phong_dan_de', title: 'Phòng Dán đế', stepOrder: 2 },
    { id: 'phong_da', title: 'Phòng Da', stepOrder: 3 },
];
export function getTechRoomByStepOrder(stepOrder: number): TechRoomId {
    if (stepOrder <= 1) return 'phong_ma';
    if (stepOrder === 2) return 'phong_dan_de';
    return 'phong_da';
}

export const columns: KanbanColumn[] = [
    { id: 'pending', title: 'Đơn nháp', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    { id: 'confirmed', title: 'Đã xác nhận', color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
    { id: 'processing', title: 'Đang thực hiện', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
    { id: 'completed', title: 'Hoàn thành', color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
    { id: 'cancelled', title: 'Đã huỷ', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' }
];

export function calculateSLAProgress(deadline: string | undefined, createdAt: string): { percentage: number; label: string; color: string } {
    if (!deadline) {
        return { percentage: 0, label: 'N/A', color: 'bg-gray-500' };
    }
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const createdDate = new Date(createdAt);

    const total = deadlineDate.getTime() - createdDate.getTime();
    const elapsed = now.getTime() - createdDate.getTime();
    const percentage = Math.min(100, Math.max(0, (elapsed / total) * 100));

    const hoursLeft = Math.max(0, (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60));

    let label: string;
    let color: string;

    if (hoursLeft <= 0) {
        label = 'Quá hạn';
        color = 'bg-red-500';
    } else if (hoursLeft <= 2) {
        label = `${Math.round(hoursLeft * 60)} phút`;
        color = 'bg-red-500';
    } else if (hoursLeft <= 8) {
        label = `${Math.round(hoursLeft)} giờ`;
        color = 'bg-amber-500';
    } else {
        label = `${Math.round(hoursLeft)} giờ`;
        color = 'bg-emerald-500';
    }

    return { percentage, label, color };
}

export function getItemTypeLabel(type: string): string {
    switch (type) {
        case 'product': return 'SP';
        case 'service': return 'DV';
        case 'package': return 'Gói';
        case 'voucher': return 'VC';
        default: return type;
    }
}

export function getItemTypeColor(type: string): string {
    switch (type) {
        case 'product': return 'bg-blue-100 text-blue-700';
        case 'service': return 'bg-purple-100 text-purple-700';
        case 'package': return 'bg-emerald-100 text-emerald-700';
        case 'voucher': return 'bg-amber-100 text-amber-700';
        default: return 'bg-gray-100 text-gray-700';
    }
}

// Shared types for dialogs
export interface TechnicianAssignment {
    technician_id: string;
    technician_name?: string;
    commission_rate: number; // Percentage 0-100
}

export interface PackageServiceAssignment {
    service_id: string;
    service_name: string;
    department?: string;
    technicians?: TechnicianAssignment[]; // Multiple technicians with commission
}

export interface OrderItem {
    type: 'product' | 'service' | 'package';
    item_id: string;
    item_code?: string; // Temporary unique code for QR generation
    name: string;
    quantity: number;
    unit_price: number;
    commission_sale?: number; // Sales commission percentage
    commission_tech?: number; // Technician commission percentage
    technicians?: TechnicianAssignment[]; // Multiple technicians with commission
    department?: string; // Department of the service
    package_services?: PackageServiceAssignment[]; // Services in package for technician assignment
}

export interface CreateOrderData {
    customer_id: string;
    items: Array<{
        type: string;
        item_id: string;
        name: string;
        quantity: number;
        unit_price: number;
        technicians?: TechnicianAssignment[];
    }>;
    notes?: string;
    discount?: number;
}

export interface UpdateOrderData {
    items: Array<{
        type: string;
        item_id: string;
        name: string;
        quantity: number;
        unit_price: number;
        technicians?: TechnicianAssignment[];
    }>;
    notes?: string;
    discount?: number;
}

export interface OrderDialogProps {
    products: { id: string; name: string; price: number }[];
    services: { id: string; name: string; price: number; department?: string }[];
    packages: PackageType[];
    vouchers: Voucher[];
}

export interface CustomerOption {
    id: string;
    name: string;
    phone: string;
    status?: string;
}
