import { useState, useCallback } from 'react';
import { kpiApi } from '@/lib/api';

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

export function useKPI() {
    const [kpis, setKpis] = useState<KPIRecord[]>([]);
    const [leaderboard, setLeaderboard] = useState<KPIRecord[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        leaderboard,
        summary,
        loading,
        error,
        fetchOverview,
        fetchLeaderboard,
        fetchUserKPI,
        setTarget,
    };
}
