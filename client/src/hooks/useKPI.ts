import { useState, useCallback } from 'react';
import { kpiApi, api } from '@/lib/api';

export interface KPIRecord {
    id: string;
    user_id: string;
    user?: { id: string; name: string; email: string; avatar?: string; department?: string };
    month: number;
    year: number;
    target_type: string;
    target: number;
    actual: number;
    achievement_rate: number;
    created_at: string;
}

export interface KPIMetrics {
    revenue: { target: number; actual: number };
    orders: { target: number; actual: number };
    leads: { target: number; actual: number };
    conversion: { target: number; actual: number };
    customerSatisfaction: { target: number; actual: number };
    avgResponseTime: { target: number; actual: number };
}

export interface KPIData {
    employeeId: string;
    employeeName: string;
    avatar?: string;
    role: string;
    department?: string;
    metrics: KPIMetrics;
    commission: number;
    bonus: number;
}

export interface KPISummary {
    totalRevenue: number;
    totalTarget: number;
    totalCommission: number;
    avgAchievement: number;
    topPerformers: number;
    totalEmployees: number;
}

export function useKPI() {
    const [kpis, setKpis] = useState<KPIRecord[]>([]);
    const [kpiData, setKpiData] = useState<KPIData[]>([]);
    const [leaderboard, setLeaderboard] = useState<KPIRecord[]>([]);
    const [summary, setSummary] = useState<KPISummary | null>(null);
    const [roleLabels, setRoleLabels] = useState<Record<string, string>>({
        sale: 'Sale',
        technician: 'Kỹ thuật viên',
        manager: 'Quản lý',
        accountant: 'Kế toán',
        admin: 'Admin'
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSummary = useCallback(async (params?: { period?: string; role?: string }) => {
        setLoading(true);
        setError(null);
        try {
            const queryParams = new URLSearchParams();
            if (params?.period) queryParams.set('period', params.period);
            if (params?.role) queryParams.set('role', params.role);

            const url = `/kpi/summary${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
            const response = await api.get(url);

            const responseData = response?.data ?? response;
            const data = responseData?.data ?? responseData;

            setKpiData(Array.isArray(data?.kpiData) ? data.kpiData : []);
            setSummary(data?.summary || null);
            if (data?.roleLabels) {
                setRoleLabels(data.roleLabels);
            }
        } catch (err: any) {
            const message = err?.response?.data?.message || err?.message || 'Lỗi khi tải dữ liệu KPI';
            setError(message);
            console.error('Error fetching KPI summary:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchOverview = useCallback(async (params?: { month?: number; year?: number }) => {
        setLoading(true);
        try {
            const response = await kpiApi.getOverview(params);
            setKpis(response.data.data?.kpis || []);
            setSummary(response.data.data?.summary || null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Lỗi khi tải KPI');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchLeaderboard = useCallback(async (params?: { month?: number; year?: number; limit?: number }) => {
        try {
            const response = await kpiApi.getLeaderboard(params);
            setLeaderboard(response.data.data?.leaderboard || []);
        } catch (err) {
            console.error('Error fetching leaderboard:', err);
        }
    }, []);

    const fetchUserKPI = useCallback(async (userId: string, year?: number) => {
        setLoading(true);
        try {
            const response = await kpiApi.getByUser(userId, year);
            return response.data.data?.kpis || [];
        } catch (err: any) {
            setError(err.response?.data?.message || 'Lỗi khi tải KPI');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const setTarget = useCallback(async (data: { user_id: string; month: number; year: number; target: number; target_type?: string }) => {
        const response = await kpiApi.setTarget(data);
        return response.data.data?.kpi;
    }, []);

    return {
        kpis,
        kpiData,
        leaderboard,
        summary,
        roleLabels,
        loading,
        error,
        fetchSummary,
        fetchOverview,
        fetchLeaderboard,
        fetchUserKPI,
        setTarget,
    };
}
