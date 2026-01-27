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

    create: (data: any) =>
        api.post<ApiResponse<{ order: any }>>('/orders', data),

    update: (id: string, data: any) =>
        api.put<ApiResponse<{ order: any }>>(`/orders/${id}`, data),

    updateStatus: (id: string, status: string) =>
        api.patch<ApiResponse<{ order: any }>>(`/orders/${id}/status`, { status }),

    delete: (id: string) =>
        api.delete<ApiResponse<null>>(`/orders/${id}`),
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
    getAll: (params?: { customer_id?: string; lead_id?: string; type?: string; result?: string; page?: number; limit?: number }) =>
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

export default api;
