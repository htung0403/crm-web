import { useState, useCallback } from 'react';
import { salaryApi } from '@/lib/api';

export interface SalaryRecord {
    id: string;
    user_id: string;
    user?: { id: string; name: string; email: string; department?: string; role?: string };
    month: number;
    year: number;
    base_salary: number;
    hourly_wage: number;
    overtime_pay: number;
    commission: number;
    bonus: number;
    deduction: number;
    net_salary: number;
    total_hours: number;
    overtime_hours: number;
    status: string;
    payment_method?: string;
    approved_by?: string;
    approved_at?: string;
    paid_at?: string;
    created_at: string;
}

export function useSalary() {
    const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSalaries = useCallback(async (params?: { month?: number; year?: number; status?: string }) => {
        setLoading(true);
        try {
            const response = await salaryApi.getAll(params);
            setSalaries(response.data.data?.salaries || []);
            setSummary(response.data.data?.summary || null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Lỗi khi tải bảng lương');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUserSalary = useCallback(async (userId: string, year?: number) => {
        setLoading(true);
        try {
            const response = await salaryApi.getByUser(userId, year);
            return response.data.data?.salaries || [];
        } catch (err: any) {
            setError(err.response?.data?.message || 'Lỗi khi tải lương');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const calculateSalary = useCallback(async (data: { user_id: string; month: number; year: number }) => {
        const response = await salaryApi.calculate(data);
        const salary = response.data.data?.salary;
        if (salary) {
            setSalaries(prev => {
                const exists = prev.find(s => s.id === salary.id);
                if (exists) {
                    return prev.map(s => s.id === salary.id ? salary : s);
                }
                return [salary, ...prev];
            });
        }
        return salary;
    }, []);

    const approveSalary = useCallback(async (id: string) => {
        const response = await salaryApi.approve(id);
        const updated = response.data.data?.salary;
        setSalaries(prev => prev.map(s => s.id === id ? updated : s));
        return updated;
    }, []);

    const paySalary = useCallback(async (id: string, payment_method?: string) => {
        const response = await salaryApi.pay(id, payment_method);
        const updated = response.data.data?.salary;
        setSalaries(prev => prev.map(s => s.id === id ? updated : s));
        return updated;
    }, []);

    return {
        salaries,
        summary,
        loading,
        error,
        fetchSalaries,
        fetchUserSalary,
        calculateSalary,
        approveSalary,
        paySalary,
    };
}
