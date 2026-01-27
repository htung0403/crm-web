import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/types';

interface CreateUserData {
    email: string;
    password: string;
    name: string;
    phone?: string;
    role: string;
    department?: string;
    salary?: number;
    commission?: number;
    bankAccount?: string;
    bankName?: string;
}

interface UpdateUserData {
    name?: string;
    phone?: string;
    role?: string;
    department?: string;
    status?: string;
    salary?: number;
    commission?: number;
    bankAccount?: string;
    bankName?: string;
}

interface UseUsersReturn {
    users: User[];
    technicians: User[];
    loading: boolean;
    error: string | null;
    fetchUsers: (params?: { role?: string }) => Promise<void>;
    fetchTechnicians: () => Promise<void>;
    createUser: (data: CreateUserData) => Promise<User>;
    updateUser: (id: string, data: UpdateUserData) => Promise<User>;
    deleteUser: (id: string) => Promise<void>;
}

export function useUsers(): UseUsersReturn {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchUsers = useCallback(async (params?: { role?: string }) => {
        setLoading(true);
        setError(null);
        try {
            const queryParams = new URLSearchParams();
            if (params?.role) queryParams.set('role', params.role);

            const url = `/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
            const response = await api.get(url);

            // Handle API response format: { status: 'success', data: { users: [...] } }
            const responseData = response?.data ?? response;
            const usersData = responseData?.data?.users ?? responseData?.users ?? responseData;

            setUsers(Array.isArray(usersData) ? usersData : []);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Lỗi khi tải danh sách người dùng';
            setError(message);
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchTechnicians = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/users?role=technician');

            // Handle API response format
            const responseData = response?.data ?? response;
            const usersData = responseData?.data?.users ?? responseData?.users ?? responseData;

            setUsers(Array.isArray(usersData) ? usersData : []);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Lỗi khi tải danh sách kỹ thuật viên';
            setError(message);
            console.error('Error fetching technicians:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const createUser = useCallback(async (data: CreateUserData): Promise<User> => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.post('/users', data);
            const responseData = response?.data ?? response;
            const newUser = responseData?.data?.user ?? responseData?.user ?? responseData;

            setUsers(prev => [newUser, ...prev]);
            return newUser;
        } catch (err: any) {
            const message = err?.response?.data?.message || err?.message || 'Lỗi khi tạo người dùng';
            setError(message);
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateUser = useCallback(async (id: string, data: UpdateUserData): Promise<User> => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.put(`/users/${id}`, data);
            const responseData = response?.data ?? response;
            const updatedUser = responseData?.data?.user ?? responseData?.user ?? responseData;

            setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updatedUser } : u));
            return updatedUser;
        } catch (err: any) {
            const message = err?.response?.data?.message || err?.message || 'Lỗi khi cập nhật người dùng';
            setError(message);
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteUser = useCallback(async (id: string): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            await api.delete(`/users/${id}`);
            setUsers(prev => prev.filter(u => u.id !== id));
        } catch (err: any) {
            const message = err?.response?.data?.message || err?.message || 'Lỗi khi xóa người dùng';
            setError(message);
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Filter technicians from users
    const technicians = Array.isArray(users) ? users.filter(u => u.role === 'technician') : [];

    return {
        users,
        technicians,
        loading,
        error,
        fetchUsers,
        fetchTechnicians,
        createUser,
        updateUser,
        deleteUser
    };
}
