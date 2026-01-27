import type { Product as APIProduct, Service as APIService } from '@/hooks/useProducts';
import type { Package as APIPackage, Voucher as APIVoucher } from '@/types';

// Extended types for products
export interface Product extends APIProduct {
    hasInventory?: boolean;
}

export interface ConsumableMaterial {
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
}

export interface Service extends APIService {
    slaDefault?: number;
    commissionSale?: number;
    commissionTech?: number;
    consumables?: ConsumableMaterial[];
    department?: string;
}

export interface ServicePackage extends APIPackage {
    validityDays?: number;
    commissionSale?: number;
    commissionTech?: number;
    totalPrice?: number;
    discountedPrice?: number;
}

export type { APIVoucher };

export const unitOptions = ['cái', 'bộ', 'gói', 'module', 'user/tháng', 'tháng', 'năm', 'lần', 'buổi', 'ngày'];
