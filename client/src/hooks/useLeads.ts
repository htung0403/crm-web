import { useState, useCallback } from 'react';
import { leadsApi } from '@/lib/api';

export interface Lead {
    id: string;
    name: string;
    phone: string;
    email?: string;
    company?: string;
    address?: string;
    source: string;
    status: string;
    assigned_to?: string;
    assigned_user?: { id: string; name: string; email: string };
    notes?: string;
    last_contact?: string;
    created_at: string;
    updated_at?: string;
}

export interface UseLeadsReturn {
    leads: Lead[];
    loading: boolean;
    error: string | null;
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    fetchLeads: (params?: {
        status?: string;
        source?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) => Promise<void>;
    createLead: (data: Partial<Lead>) => Promise<Lead>;
    updateLead: (id: string, data: Partial<Lead>) => Promise<Lead>;
    deleteLead: (id: string) => Promise<void>;
    convertLead: (id: string) => Promise<any>;
}

export function useLeads(): UseLeadsReturn {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });

    const fetchLeads = useCallback(async (params?: {
        status?: string;
        source?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) => {
        setLoading(true);
        setError(null);
        try {
            const response = await leadsApi.getAll(params);
            const data = response.data.data;
            setLeads(data.leads || []);
            if (data.pagination) {
                setPagination(data.pagination);
            }
        } catch (err: any) {
            const message = err.response?.data?.message || 'Lỗi khi tải danh sách leads';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const createLead = useCallback(async (data: Partial<Lead>): Promise<Lead> => {
        setLoading(true);
        setError(null);
        try {
            const response = await leadsApi.create(data);
            const newLead = response.data.data!.lead;
            setLeads(prev => [newLead, ...prev]);
            return newLead;
        } catch (err: any) {
            const message = err.response?.data?.message || 'Lỗi khi tạo lead';
            setError(message);
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateLead = useCallback(async (id: string, data: Partial<Lead>): Promise<Lead> => {
        setLoading(true);
        setError(null);
        try {
            const response = await leadsApi.update(id, data);
            const updatedLead = response.data.data!.lead;
            setLeads(prev => prev.map(l => l.id === id ? updatedLead : l));
            return updatedLead;
        } catch (err: any) {
            const message = err.response?.data?.message || 'Lỗi khi cập nhật lead';
            setError(message);
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteLead = useCallback(async (id: string): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            await leadsApi.delete(id);
            setLeads(prev => prev.filter(l => l.id !== id));
        } catch (err: any) {
            const message = err.response?.data?.message || 'Lỗi khi xóa lead';
            setError(message);
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const convertLead = useCallback(async (id: string): Promise<any> => {
        setLoading(true);
        setError(null);
        try {
            const response = await leadsApi.convert(id);
            // Update lead status in local state
            setLeads(prev => prev.map(l => l.id === id ? { ...l, status: 'converted' } : l));
            return response.data.data!.customer;
        } catch (err: any) {
            const message = err.response?.data?.message || 'Lỗi khi chuyển đổi lead';
            setError(message);
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        leads,
        loading,
        error,
        pagination,
        fetchLeads,
        createLead,
        updateLead,
        deleteLead,
        convertLead,
    };
}
