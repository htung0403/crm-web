export type UserRole = 'admin' | 'manager' | 'accountant' | 'sale' | 'technician';

export interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    role: UserRole;
    phone?: string;
    department?: string;
    status?: 'active' | 'inactive' | 'onleave';
    created_at?: string;
    last_login?: string;
    salary?: number;
    commission?: number;
    bankAccount?: string;
    bankName?: string;
}

export interface Lead {
    id: string;
    customerName: string;
    phone: string;
    source: 'Facebook' | 'Google' | 'Zalo' | 'Website' | 'Referral' | 'Walk-in';
    status: 'new' | 'nurturing' | 'closed' | 'cancelled';
    assignedTo: User;
    createdAt: string;
    notes?: string;
    history: LeadHistoryItem[];
}

export interface LeadHistoryItem {
    id: string;
    type: 'created' | 'assigned' | 'note' | 'call' | 'closed' | 'cancelled';
    content: string;
    createdAt: string;
    createdBy: User;
}

export type OrderStatus = 'before_sale' | 'in_progress' | 'done' | 'after_sale' | 'cancelled';

export interface Order {
    id: string;
    orderCode: string;
    customerId: string;
    customerName: string;
    customerAvatar?: string;
    totalAmount: number;
    status: OrderStatus;
    assignedTo: User;
    services: string[];
    products: string[];
    createdAt: string;
    slaDeadline: string;
    notes?: string;
    /** Bảo hành (warranty) hoặc Chăm sóc (care) – từ Khách chê/Khách khen */
    care_warranty_flow?: string | null;
    /** war1-war3 (Bảo hành), care6/care12/care-custom (Chăm sóc) */
    care_warranty_stage?: string | null;
}

export interface Product {
    id: string;
    name: string;
    code: string;
    price: number;
    category: 'product' | 'service' | 'package' | 'voucher';
    unit: string;
    stock?: number;
}

export interface Service {
    id: string;
    name: string;
    code: string;
    price: number;
    category: string;
    unit: string;
    image?: string;
    commission_rate?: number;
    applicable_product_types?: string[];
}

export interface PackageItem {
    id?: string;
    service_id: string;
    service_name?: string;
    quantity: number;
}

export interface Package {
    id: string;
    name: string;
    code: string;
    price: number;
    description?: string;
    image?: string;
    items?: PackageItem[];
    commission_sale?: number;
    commission_tech?: number;
    status?: 'active' | 'inactive';
}

export interface Voucher {
    id: string;
    name: string;
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    min_order_value?: number;
    max_discount?: number;
    quantity: number;
    used_count?: number;
    image?: string;
    start_date: string;
    end_date: string;
    status?: 'active' | 'inactive' | 'expired';
}

export interface InvoiceItem {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface CommissionEntry {
    id: string;
    employeeId: string;
    employeeName: string;
    role: 'Sale' | 'Technician' | 'Consultant';
    percentage: number;
    amount: number;
}

export interface Invoice {
    id: string;
    invoiceCode: string;
    customerId: string;
    customerName: string;
    invoiceDate: string;
    type: 'service' | 'product' | 'package' | 'voucher';
    items: InvoiceItem[];
    commissions: CommissionEntry[];
    subtotal: number;
    discount: number;
    discountType: 'amount' | 'percent';
    total: number;
    paymentMethod: 'cash' | 'transfer' | 'card';
    status: 'draft' | 'completed' | 'cancelled';
    notes?: string;
    createdAt: string;
    createdBy: User;
}

export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'pending' | 'approved' | 'cancelled';

export interface Transaction {
    id: string;
    code: string;
    date: string;
    type: TransactionType;
    category: string;
    amount: number;
    paymentMethod: 'cash' | 'transfer' | 'card';
    status: TransactionStatus;
    notes?: string;
    attachments?: string[];
    createdBy: User;
    approvedBy?: User;
    createdAt: string;
}

export interface DashboardStats {
    openingBalance: number;
    totalIncome: number;
    totalExpense: number;
    closingBalance: number;
    netRevenue: number;
    incomeGrowth: number;
    expenseGrowth: number;
    revenueGrowth: number;
}

export interface MenuItem {
    id: string;
    label: string;
    icon: string;
    path: string;
    children?: MenuItem[];
    roles?: UserRole[];
}
