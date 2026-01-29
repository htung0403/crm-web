import { useState, useCallback } from 'react';
import { ordersApi } from '@/lib/api';

export interface OrderItem {
    id: string;
    order_id: string;
    product_id?: string;
    service_id?: string;
    item_type: string;
    item_name: string;
    image?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
}

export interface Order {
    id: string;
    order_code: string;
    customer_id: string;
    customer?: { id: string; name: string; phone: string; email?: string };
    sales_id: string;
    sales_user?: { id: string; name: string };
    subtotal: number;
    discount: number;
    total_amount: number;
    paid_amount?: number;
    status: string;
    notes?: string;
    items?: OrderItem[];
    completed_at?: string;
    created_at: string;
    updated_at?: string;
}

export function useOrders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });

    const fetchOrders = useCallback(async (params?: {
        status?: string;
        customer_id?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) => {
        setLoading(true);
        setError(null);
        try {
            const response = await ordersApi.getAll(params);
            const data = response.data.data;
            setOrders(data.orders || []);
            if (data.pagination) {
                setPagination({
                    ...data.pagination,
                    totalPages: data.pagination.totalPages || 0,
                });
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Lỗi khi tải danh sách đơn hàng');
        } finally {
            setLoading(false);
        }
    }, []);

    const getOrder = useCallback(async (id: string): Promise<Order> => {
        setLoading(true);
        try {
            const response = await ordersApi.getById(id);
            return response.data.data!.order;
        } catch (err: any) {
            const message = err.response?.data?.message || 'Lỗi khi tải thông tin đơn hàng';
            setError(message);
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const createOrder = useCallback(async (data: {
        customer_id: string;
        items: Array<{ type: string; item_id: string; name: string; quantity: number; unit_price: number }>;
        notes?: string;
        discount?: number;
    }): Promise<Order> => {
        setLoading(true);
        try {
            const response = await ordersApi.create(data);
            const newOrder = response.data.data!.order;
            setOrders(prev => [newOrder, ...prev]);
            return newOrder;
        } catch (err: any) {
            const message = err.response?.data?.message || 'Lỗi khi tạo đơn hàng';
            setError(message);
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateOrderStatus = useCallback(async (id: string, status: string): Promise<Order> => {
        setLoading(true);
        try {
            const response = await ordersApi.updateStatus(id, status);
            const updated = response.data.data!.order;
            setOrders(prev => prev.map(o => o.id === id ? { ...o, status: updated.status } : o));
            return updated;
        } catch (err: any) {
            const message = err.response?.data?.message || 'Lỗi khi cập nhật trạng thái';
            setError(message);
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateOrder = useCallback(async (id: string, data: {
        items: Array<{ type: string; item_id: string; name: string; quantity: number; unit_price: number }>;
        notes?: string;
        discount?: number;
    }): Promise<Order> => {
        setLoading(true);
        try {
            const response = await ordersApi.update(id, data);
            const updated = response.data.data!.order;
            setOrders(prev => prev.map(o => o.id === id ? updated : o));
            return updated;
        } catch (err: any) {
            const message = err.response?.data?.message || 'Lỗi khi cập nhật đơn hàng';
            setError(message);
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteOrder = useCallback(async (id: string): Promise<void> => {
        setLoading(true);
        try {
            await ordersApi.delete(id);
            setOrders(prev => prev.filter(o => o.id !== id));
        } catch (err: any) {
            const message = err.response?.data?.message || 'Lỗi khi xóa đơn hàng';
            setError(message);
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        orders,
        loading,
        error,
        pagination,
        fetchOrders,
        getOrder,
        createOrder,
        updateOrder,
        updateOrderStatus,
        deleteOrder,
    };
}
