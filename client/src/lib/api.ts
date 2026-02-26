import axios from 'axios';
import type { AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance
export const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - handle errors
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // Only redirect if not already on login page
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// API Response types
export interface ApiResponse<T> {
    status: 'success' | 'fail' | 'error';
    data?: T;
    message?: string;
}

export interface PaginationInfo {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
    data: T & { pagination: PaginationInfo };
}

// Auth API
export const authApi = {
    login: (email: string, password: string) =>
        api.post<ApiResponse<{ user: any; token: string }>>('/auth/login', { email, password }),

    register: (data: { email: string; password: string; name: string; role: string; phone?: string; department?: string }) =>
        api.post<ApiResponse<{ user: any }>>('/auth/register', data),

    getMe: () =>
        api.get<ApiResponse<{ user: any }>>('/auth/me'),

    changePassword: (currentPassword: string, newPassword: string) =>
        api.post<ApiResponse<null>>('/auth/change-password', { currentPassword, newPassword }),

    logout: () =>
        api.post<ApiResponse<null>>('/auth/logout'),
};

// Leads API
export const leadsApi = {
    getAll: (params?: { status?: string; source?: string; search?: string; page?: number; limit?: number }) =>
        api.get<PaginatedResponse<{ leads: any[] }>>('/leads', { params }),

    getById: (id: string) =>
        api.get<ApiResponse<{ lead: any }>>(`/leads/${id}`),

    create: (data: any) =>
        api.post<ApiResponse<{ lead: any }>>('/leads', data),

    update: (id: string, data: any) =>
        api.put<ApiResponse<{ lead: any }>>(`/leads/${id}`, data),

    delete: (id: string) =>
        api.delete<ApiResponse<null>>(`/leads/${id}`),

    convert: (id: string) =>
        api.post<ApiResponse<{ customer: any }>>(`/leads/${id}/convert`),

    // Activities/History
    getActivities: (id: string, limit?: number) =>
        api.get<ApiResponse<{ activities: any[] }>>(`/leads/${id}/activities`, { params: { limit } }),

    addActivity: (id: string, data: { activity_type: string; content?: string; old_status?: string; new_status?: string; metadata?: any }) =>
        api.post<ApiResponse<{ activity: any }>>(`/leads/${id}/activities`, data),
};

// Customers API
export const customersApi = {
    getAll: (params?: { type?: string; status?: string; search?: string; page?: number; limit?: number }) =>
        api.get<PaginatedResponse<{ customers: any[] }>>('/customers', { params }),

    getById: (id: string) =>
        api.get<ApiResponse<{ customer: any }>>(`/customers/${id}`),

    create: (data: any) =>
        api.post<ApiResponse<{ customer: any }>>('/customers', data),

    update: (id: string, data: any) =>
        api.put<ApiResponse<{ customer: any }>>(`/customers/${id}`, data),

    delete: (id: string) =>
        api.delete<ApiResponse<null>>(`/customers/${id}`),
};

// Orders API
export const ordersApi = {
    getAll: (params?: { status?: string; customer_id?: string; search?: string; page?: number; limit?: number }) =>
        api.get<PaginatedResponse<{ orders: any[] }>>('/orders', { params }),

    getById: (id: string) =>
        api.get<ApiResponse<{ order: any }>>(`/orders/${id}`),

    create: (data: {
        customer_id: string;
        customer_items?: any[];
        sale_items?: any[];
        notes?: string;
        discount?: number;
        discount_type?: 'amount' | 'percent';
        discount_value?: number;
        surcharges?: any[];
        paid_amount?: number;
        status?: string;
        due_at?: string;
    }) => api.post<ApiResponse<{ order: any }>>('/orders', data),

    /** @deprecated Use create() with customer_items and sale_items */
    createV2: (data: any) => api.post<ApiResponse<{ order: any; products: any[] }>>('/orders', data),

    update: (id: string, data: any) =>
        api.put<ApiResponse<{ order: any }>>(`/orders/${id}`, data),

    updateFull: (id: string, data: any) =>
        api.put<ApiResponse<{ order: any }>>(`/orders/${id}/full`, data),

    patch: (id: string, data: {
        due_at?: string | null;
        after_sale_stage?: string | null;
        completion_photos?: string[];
        debt_checked?: boolean;
        debt_checked_notes?: string | null;
        packaging_photos?: string[];
        delivery_carrier?: string | null;
        delivery_address?: string | null;
        delivery_self_pickup?: boolean;
        delivery_notes?: string | null;
        hd_sent?: boolean;
        feedback_requested?: boolean;
        care_warranty_flow?: string | null;
        care_warranty_stage?: string | null;
    }) => api.patch<ApiResponse<{ order: any }>>(`/orders/${id}`, data),

    updateAfterSaleStage: (orderId: string, stage: string | null) =>
        api.patch<ApiResponse<{ order: any }>>(`/orders/${orderId}`, { after_sale_stage: stage }),

    updateStatus: (id: string, status: string) =>
        api.patch<ApiResponse<{ order: any }>>(`/orders/${id}/status`, { status }),

    delete: (id: string) =>
        api.delete<ApiResponse<null>>(`/orders/${id}`),

    createExtensionRequest: (orderId: string, data: { reason: string }) =>
        api.post<ApiResponse<any>>(`/orders/${orderId}/extension-request`, data),

    updateExtensionRequest: (orderId: string, data: { customer_result?: string; new_due_at?: string; valid_reason?: boolean; status?: string }) =>
        api.patch<ApiResponse<any>>(`/orders/${orderId}/extension-request`, data),

    getKanbanLogs: (orderId: string, tab: 'sales' | 'workflow' | 'aftersale' | 'care') =>
        api.get<ApiResponse<{ logs: any[] }>>(`/orders/${orderId}/kanban-logs`, { params: { tab } }),

    // Payment records
    getPayments: (orderId: string) =>
        api.get<ApiResponse<{ payments: any[] }>>(`/orders/${orderId}/payments`),

    createPayment: (orderId: string, data: {
        content: string;
        amount: number;
        payment_method?: 'cash' | 'transfer' | 'card';
        image_url?: string;
        notes?: string;
    }) => api.post<ApiResponse<{ payment: any; order: any }>>(`/orders/${orderId}/payments`, data),
};

// Order Products API (Customer's products: shoes, bags, etc.)
export const orderProductsApi = {
    // Get product by QR code
    getByCode: (code: string) =>
        api.get<ApiResponse<any>>(`/order-products/code/${code}`),

    // Get product by ID
    getById: (id: string) =>
        api.get<ApiResponse<any>>(`/order-products/${id}`),

    // Update product status
    updateStatus: (id: string, status: string) =>
        api.patch<ApiResponse<any>>(`/order-products/${id}/status`, { status }),

    // Assign technician to a service
    assignService: (serviceId: string, technician_id: string) =>
        api.patch<ApiResponse<any>>(`/order-products/services/${serviceId}/assign`, { technician_id }),

    // Start a service
    startService: (serviceId: string) =>
        api.patch<ApiResponse<any>>(`/order-products/services/${serviceId}/start`),

    // Complete a service
    completeService: (serviceId: string, notes?: string) =>
        api.patch<ApiResponse<{ allServicesCompleted: boolean }>>(`/order-products/services/${serviceId}/complete`, { notes }),

    // Get status summary with unified timeline
    getStatusSummary: (id: string) =>
        api.get<ApiResponse<{
            product_id: string;
            product_name: string;
            product_code: string;
            completion_percentage: number;
            overall_status: string;
            total_steps: number;
            completed_steps: number;
            earliest_started_at?: string;
            latest_completed_at?: string;
            total_duration_minutes?: number;
            estimated_duration_minutes?: number;
            services: Array<{
                id: string;
                name: string;
                status: string;
                completion_percentage: number;
                started_at?: string;
                completed_at?: string;
                steps: any[];
            }>;
            timeline: Array<{
                step_id: string;
                step_order: number;
                step_name: string;
                service_id: string;
                service_name: string;
                department_id?: string;
                department_name?: string;
                technician_id?: string;
                technician_name?: string;
                status: string;
                estimated_duration?: number;
                started_at?: string;
                completed_at?: string;
                notes?: string;
            }>;
        }>>(`/order-products/${id}/status-summary`),

    // Recalculate product status manually
    recalculateStatus: (id: string) =>
        api.post<ApiResponse<any>>(`/order-products/${id}/recalculate-status`),
};

// Order Items API
export const orderItemsApi = {
    getById: (id: string) =>
        api.get<ApiResponse<any>>(`/order-items/${id}`),

    assignTechnician: (id: string, data: string | { technician_id: string; commission: number }[]) => {
        const payload = Array.isArray(data) ? { assignments: data } : { technician_id: data };
        return api.patch<ApiResponse<any>>(`/order-items/${id}/assign`, payload);
    },

    assignSale: (id: string, data: string | { sale_id: string; commission: number }[]) => {
        const payload = Array.isArray(data) ? { assignments: data } : { sale_id: data };
        return api.patch<ApiResponse<any>>(`/order-items/${id}/assign-sale`, payload);
    },

    start: (id: string) =>
        api.patch<ApiResponse<any>>(`/order-items/${id}/start`),

    complete: (id: string, notes?: string) =>
        api.patch<ApiResponse<{ allItemsCompleted: boolean }>>(`/order-items/${id}/complete`, { notes }),

    updateStatus: (id: string, status: string) =>
        api.patch<ApiResponse<any>>(`/order-items/${id}/status`, { status }),

    // Order Item Steps (Workflow Steps)
    getSteps: (orderItemId: string) =>
        api.get<ApiResponse<any[]>>(`/order-items/${orderItemId}/steps`),

    assignStep: (stepId: string, technician_id: string) =>
        api.patch<ApiResponse<any>>(`/order-items/steps/${stepId}/assign`, { technician_id }),

    startStep: (stepId: string) =>
        api.patch<ApiResponse<any>>(`/order-items/steps/${stepId}/start`),

    completeStep: (stepId: string, notes?: string) =>
        api.patch<ApiResponse<{ allStepsCompleted: boolean }>>(`/order-items/steps/${stepId}/complete`, { notes }),

    skipStep: (stepId: string, notes?: string) =>
        api.patch<ApiResponse<any>>(`/order-items/steps/${stepId}/skip`, { notes }),

    updateAccessory: (orderItemId: string, data: { status: string; notes?: string }) =>
        api.patch<ApiResponse<any>>(`/order-items/${orderItemId}/accessory`, data),

    updatePartner: (orderItemId: string, data: { status: string; notes?: string }) =>
        api.patch<ApiResponse<any>>(`/order-items/${orderItemId}/partner`, data),

    updateSalesStepData: (orderItemId: string, data: Record<string, any>) =>
        api.patch<ApiResponse<any>>(`/order-items/${orderItemId}/sales-step-data`, { sales_step_data: data }),

    // New Kanban Actions
    fail: (id: string, reason: string) =>
        api.patch<ApiResponse<any>>(`/order-items/${id}/fail`, { reason }),

    changeRoom: (id: string, data: { targetRoomId: string; reason: string; deadline_days: number }) =>
        api.patch<ApiResponse<any>>(`/order-items/${id}/change-room`, data),
};

// Requests API (admin/manager - Mua phụ kiện, Gửi Đối Tác, Xin gia hạn)
export const requestsApi = {
    getAccessories: () =>
        api.get<ApiResponse<any[]>>('/requests/accessories'),
    getPartners: () =>
        api.get<ApiResponse<any[]>>('/requests/partners'),
    getExtensions: () =>
        api.get<ApiResponse<any[]>>('/requests/extensions'),
};

// Invoices API
export const invoicesApi = {
    getAll: (params?: { status?: string; customer_id?: string; page?: number; limit?: number }) =>
        api.get<PaginatedResponse<{ invoices: any[] }>>('/invoices', { params }),

    getById: (id: string) =>
        api.get<ApiResponse<{ invoice: any }>>(`/invoices/${id}`),

    create: (data: any) =>
        api.post<ApiResponse<{ invoice: any }>>('/invoices', data),

    updateStatus: (id: string, status: string) =>
        api.patch<ApiResponse<{ invoice: any }>>(`/invoices/${id}/status`, { status }),
};

// Products API
export const productsApi = {
    getAll: (params?: { category?: string; status?: string; search?: string }) =>
        api.get<ApiResponse<{ products: any[] }>>('/products', { params }),

    getById: (id: string) =>
        api.get<ApiResponse<{ product: any }>>(`/products/${id}`),

    create: (data: any) =>
        api.post<ApiResponse<{ product: any }>>('/products', data),

    update: (id: string, data: any) =>
        api.put<ApiResponse<{ product: any }>>(`/products/${id}`, data),

    delete: (id: string) =>
        api.delete<ApiResponse<null>>(`/products/${id}`),
};

// Services API
export const servicesApi = {
    getAll: (params?: { category?: string; status?: string; search?: string }) =>
        api.get<ApiResponse<{ services: any[] }>>('/services', { params }),

    getById: (id: string) =>
        api.get<ApiResponse<{ service: any }>>(`/services/${id}`),

    create: (data: any) =>
        api.post<ApiResponse<{ service: any }>>('/services', data),

    update: (id: string, data: any) =>
        api.put<ApiResponse<{ service: any }>>(`/services/${id}`, data),

    delete: (id: string) =>
        api.delete<ApiResponse<null>>(`/services/${id}`),
};

// Packages API
export const packagesApi = {
    getAll: (params?: { status?: string; search?: string }) =>
        api.get<ApiResponse<{ packages: any[] }>>('/packages', { params }),

    getById: (id: string) =>
        api.get<ApiResponse<{ package: any }>>(`/packages/${id}`),

    create: (data: any) =>
        api.post<ApiResponse<{ package: any }>>('/packages', data),

    update: (id: string, data: any) =>
        api.put<ApiResponse<{ package: any }>>(`/packages/${id}`, data),

    delete: (id: string) =>
        api.delete<ApiResponse<null>>(`/packages/${id}`),
};

// Vouchers API
export const vouchersApi = {
    getAll: (params?: { status?: string; search?: string }) =>
        api.get<ApiResponse<{ vouchers: any[] }>>('/vouchers', { params }),

    getById: (id: string) =>
        api.get<ApiResponse<{ voucher: any }>>(`/vouchers/${id}`),

    create: (data: any) =>
        api.post<ApiResponse<{ voucher: any }>>('/vouchers', data),

    update: (id: string, data: any) =>
        api.put<ApiResponse<{ voucher: any }>>(`/vouchers/${id}`, data),

    delete: (id: string) =>
        api.delete<ApiResponse<null>>(`/vouchers/${id}`),
};

// Finance API
export const financeApi = {
    getTransactions: (params?: { type?: string; status?: string; category?: string; from_date?: string; to_date?: string; page?: number; limit?: number }) =>
        api.get<PaginatedResponse<{ transactions: any[] }>>('/finance/transactions', { params }),

    createIncome: (data: any) =>
        api.post<ApiResponse<{ transaction: any }>>('/finance/income', data),

    createExpense: (data: any) =>
        api.post<ApiResponse<{ transaction: any }>>('/finance/expense', data),

    approveTransaction: (id: string) =>
        api.patch<ApiResponse<{ transaction: any }>>(`/finance/transactions/${id}/approve`),

    rejectTransaction: (id: string, reason: string) =>
        api.patch<ApiResponse<{ transaction: any }>>(`/finance/transactions/${id}/reject`, { reason }),

    getSummary: (params?: { from_date?: string; to_date?: string }) =>
        api.get<ApiResponse<{ totalIncome: number; totalExpense: number; profit: number; profitMargin: number }>>('/finance/summary', { params }),
};

// KPI API
export const kpiApi = {
    getOverview: (params?: { month?: number; year?: number }) =>
        api.get<ApiResponse<{ kpis: any[]; summary: any }>>('/kpi/overview', { params }),

    getByUser: (userId: string, year?: number) =>
        api.get<ApiResponse<{ kpis: any[] }>>(`/kpi/user/${userId}`, { params: { year } }),

    setTarget: (data: { user_id: string; month: number; year: number; target: number; target_type?: string }) =>
        api.post<ApiResponse<{ kpi: any }>>('/kpi/target', data),

    updateActual: (userId: string, data: { month: number; year: number; actual: number }) =>
        api.patch<ApiResponse<{ kpi: any }>>(`/kpi/update/${userId}`, data),

    getLeaderboard: (params?: { month?: number; year?: number; limit?: number }) =>
        api.get<ApiResponse<{ leaderboard: any[] }>>('/kpi/leaderboard', { params }),
};

// Salary API
export const salaryApi = {
    getAll: (params?: { month?: number; year?: number; status?: string }) =>
        api.get<ApiResponse<{ salaries: any[]; summary: any }>>('/salary', { params }),

    getByUser: (userId: string, year?: number) =>
        api.get<ApiResponse<{ salaries: any[] }>>(`/salary/user/${userId}`, { params: { year } }),

    calculate: (data: { user_id: string; month: number; year: number }) =>
        api.post<ApiResponse<{ salary: any }>>('/salary/calculate', data),

    approve: (id: string) =>
        api.patch<ApiResponse<{ salary: any }>>(`/salary/${id}/approve`),

    pay: (id: string, payment_method?: string) =>
        api.patch<ApiResponse<{ salary: any }>>(`/salary/${id}/pay`, { payment_method }),
};

// Reports API
export const reportsApi = {
    getRevenue: (params?: { from_date?: string; to_date?: string; group_by?: string }) =>
        api.get<ApiResponse<any>>('/reports/revenue', { params }),

    getSales: (params?: { from_date?: string; to_date?: string }) =>
        api.get<ApiResponse<any>>('/reports/sales', { params }),

    getCustomers: (params?: { from_date?: string; to_date?: string }) =>
        api.get<ApiResponse<any>>('/reports/customers', { params }),

    getFinancial: (params?: { from_date?: string; to_date?: string }) =>
        api.get<ApiResponse<any>>('/reports/financial', { params }),
};

// Interactions API
export const interactionsApi = {
    getAll: (params?: { customer_id?: string; lead_id?: string; type?: string; result?: string; created_by?: string; page?: number; limit?: number }) =>
        api.get<PaginatedResponse<{ interactions: any[] }>>('/interactions', { params }),

    getById: (id: string) =>
        api.get<ApiResponse<{ interaction: any }>>(`/interactions/${id}`),

    create: (data: any) =>
        api.post<ApiResponse<{ interaction: any }>>('/interactions', data),

    update: (id: string, data: any) =>
        api.put<ApiResponse<{ interaction: any }>>(`/interactions/${id}`, data),

    delete: (id: string) =>
        api.delete<ApiResponse<null>>(`/interactions/${id}`),

    getPendingFollowups: () =>
        api.get<ApiResponse<{ followups: any[] }>>('/interactions/followups/pending'),
};

// Users API
export const usersApi = {
    getAll: (params?: { role?: string; department?: string; status?: string; search?: string }) =>
        api.get<ApiResponse<{ users: any[] }>>('/users', { params }),

    getById: (id: string) =>
        api.get<ApiResponse<{ user: any }>>(`/users/${id}`),

    update: (id: string, data: any) =>
        api.put<ApiResponse<{ user: any }>>(`/users/${id}`, data),

    delete: (id: string) =>
        api.delete<ApiResponse<null>>(`/users/${id}`),
};

// Transactions API (Thu Chi)
export const transactionsApi = {
    getAll: (params?: {
        type?: 'income' | 'expense';
        status?: 'pending' | 'approved' | 'cancelled';
        search?: string;
        start_date?: string;
        end_date?: string;
        page?: number;
        limit?: number;
    }) => api.get<PaginatedResponse<{ transactions: any[] }>>('/transactions', { params }),

    getSummary: (params?: { start_date?: string; end_date?: string }) =>
        api.get<ApiResponse<{
            totalIncome: number;
            totalExpense: number;
            balance: number;
            pendingIncomeCount: number;
            pendingExpenseCount: number;
        }>>('/transactions/summary', { params }),

    getById: (id: string) =>
        api.get<ApiResponse<{ transaction: any }>>(`/transactions/${id}`),

    create: (data: {
        type: 'income' | 'expense';
        category: string;
        amount: number;
        payment_method?: 'cash' | 'transfer' | 'card';
        notes?: string;
        image_url?: string;
        date?: string;
        order_id?: string;
        order_code?: string;
    }) => api.post<ApiResponse<{ transaction: any }>>('/transactions', data),

    updateStatus: (id: string, status: 'pending' | 'approved' | 'cancelled') =>
        api.patch<ApiResponse<{ transaction: any }>>(`/transactions/${id}/status`, { status }),

    update: (id: string, data: any) =>
        api.put<ApiResponse<{ transaction: any }>>(`/transactions/${id}`, data),

    delete: (id: string) =>
        api.delete<ApiResponse<null>>(`/transactions/${id}`),
};

// Product Types API
export const productChatsApi = {
    getMessages: (entityId: string, roomId: string) => api.get(`/product-chats/${entityId}/${roomId}`),
    sendMessage: (data: { entity_id: string; entity_type: string; room_id: string; content: string }) =>
        api.post('/product-chats', data),
};

export const productTypesApi = {
    getAll: () =>
        api.get<ApiResponse<any[]>>('/product-types'),

    create: (data: any) =>
        api.post<ApiResponse<any>>('/product-types', data),

    update: (id: string, data: any) =>
        api.put<ApiResponse<any>>(`/product-types/${id}`, data),

    delete: (id: string) =>
        api.delete<ApiResponse<null>>(`/product-types/${id}`),
};

export default api;
