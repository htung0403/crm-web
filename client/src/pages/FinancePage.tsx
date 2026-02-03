import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit, Trash2, Check, X, Upload, FileText, Loader2, RefreshCw, Eye, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { transactionsApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { User } from '@/types';

interface FinancePageProps {
    currentUser: User;
}

type TransactionType = 'income' | 'expense';
type TransactionStatus = 'pending' | 'approved' | 'cancelled';

interface Transaction {
    id: string;
    code: string;
    type: TransactionType;
    category: string;
    amount: number;
    payment_method: 'cash' | 'transfer' | 'card';
    notes?: string;
    image_url?: string;
    date: string;
    status: TransactionStatus;
    order_id?: string;
    order_code?: string;
    created_by: string;
    created_by_user?: { id: string; name: string; avatar?: string };
    approved_by?: string;
    approved_by_user?: { id: string; name: string };
    created_at: string;
}

const statusLabels: Record<TransactionStatus, { label: string; variant: 'warning' | 'success' | 'danger' }> = {
    pending: { label: 'Chờ duyệt', variant: 'warning' },
    approved: { label: 'Đã duyệt', variant: 'success' },
    cancelled: { label: 'Đã huỷ', variant: 'danger' }
};

const paymentMethodLabels = {
    cash: 'Tiền mặt',
    transfer: 'Chuyển khoản',
    card: 'Thẻ'
};

const incomeCategories = [
    'Thanh toán đơn hàng',
    'Đặt cọc',
    'Thu khác',
];

const expenseCategories = [
    'Lương nhân viên',
    'Tiền điện',
    'Tiền nước',
    'Tiền thuê mặt bằng',
    'Mua vật tư',
    'Chi phí vận hành',
    'Chi khác',
];

interface TransactionFormProps {
    type: TransactionType;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    loading: boolean;
}

function TransactionForm({ type, onClose, onSubmit, loading }: TransactionFormProps) {
    const [category, setCategory] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [imageUrl, setImageUrl] = useState('');

    const categories = type === 'income' ? incomeCategories : expenseCategories;

    const handleSubmit = async () => {
        if (!category || amount <= 0) {
            toast.error('Vui lòng điền đầy đủ thông tin');
            return;
        }

        await onSubmit({
            type,
            category,
            amount,
            payment_method: paymentMethod,
            notes,
            date,
            image_url: imageUrl || undefined,
        });
    };

    // Format currency input
    const formatInputCurrency = (value: number): string => {
        if (value === 0) return '';
        return value.toLocaleString('vi-VN');
    };

    const parseInputCurrency = (value: string): number => {
        const cleaned = value.replace(/[^\d]/g, '');
        return parseInt(cleaned) || 0;
    };

    return (
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    {type === 'income' ? (
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                            <Plus className="h-4 w-4 text-green-600" />
                        </div>
                    ) : (
                        <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-red-600" />
                        </div>
                    )}
                    Tạo phiếu {type === 'income' ? 'thu' : 'chi'}
                </DialogTitle>
                <DialogDescription>
                    Nhập thông tin phiếu {type === 'income' ? 'thu' : 'chi'} mới
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
                {/* Date */}
                <div className="space-y-2">
                    <Label>Ngày</Label>
                    <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                </div>

                {/* Category */}
                <div className="space-y-2">
                    <Label>Loại {type === 'income' ? 'thu' : 'chi'} *</Label>
                    <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger>
                            <SelectValue placeholder="Chọn loại" />
                        </SelectTrigger>
                        <SelectContent>
                            {categories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Amount */}
                <div className="space-y-2">
                    <Label>Số tiền *</Label>
                    <div className="relative">
                        <Input
                            type="text"
                            value={formatInputCurrency(amount)}
                            onChange={(e) => setAmount(parseInputCurrency(e.target.value))}
                            className="pr-16"
                            placeholder="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                            VNĐ
                        </span>
                    </div>
                    {amount > 0 && (
                        <p className="text-sm text-muted-foreground">{formatCurrency(amount)}</p>
                    )}
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                    <Label>Phương thức</Label>
                    <Select value={paymentMethod} onValueChange={(v: typeof paymentMethod) => setPaymentMethod(v)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="cash">Tiền mặt</SelectItem>
                            <SelectItem value="transfer">Chuyển khoản</SelectItem>
                            <SelectItem value="card">Thẻ</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                    <Label>Ghi chú</Label>
                    <textarea
                        className="w-full min-h-[80px] px-3 py-2 text-sm rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        placeholder="Nhập ghi chú..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>

                {/* Image URL */}
                <div className="space-y-2">
                    <Label>Ảnh đính kèm</Label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="URL ảnh hoặc upload..."
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            className="flex-1"
                        />
                        <Button variant="outline" size="icon" disabled>
                            <Upload className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={onClose} disabled={loading}>Huỷ</Button>
                <Button
                    onClick={handleSubmit}
                    disabled={loading || !category || amount <= 0}
                    className={type === 'income' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                >
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Tạo phiếu
                </Button>
            </DialogFooter>
        </DialogContent>
    );
}

function TransactionTable({
    transactions,
    userRole,
    onApprove,
    onCancel,
    onDelete,
    onView,
    loading,
}: {
    transactions: Transaction[];
    userRole: string;
    onApprove: (id: string) => void;
    onCancel: (id: string) => void;
    onDelete: (id: string) => void;
    onView: (trans: Transaction) => void;
    loading: boolean;
}) {
    const canEdit = userRole === 'accountant' || userRole === 'manager' || userRole === 'admin';

    if (transactions.length === 0) {
        return (
            <div className="py-12 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Chưa có giao dịch nào</p>
            </div>
        );
    }

    return (
        <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-muted/50 border-y">
                        <tr>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Mã phiếu</th>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Ngày</th>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Loại</th>
                            <th className="p-3 text-right text-sm font-medium text-muted-foreground">Số tiền</th>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Người tạo</th>
                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Trạng thái</th>
                            <th className="p-3 text-right text-sm font-medium text-muted-foreground">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((trans) => (
                            <tr
                                key={trans.id}
                                className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                                onClick={() => onView(trans)}
                            >
                                <td className="p-3">
                                    <div>
                                        <p className="font-medium">{trans.code}</p>
                                        {trans.order_code && (
                                            <p className="text-xs text-muted-foreground">ĐH: {trans.order_code}</p>
                                        )}
                                    </div>
                                </td>
                                <td className="p-3 text-sm">{formatDate(trans.date)}</td>
                                <td className="p-3">
                                    <Badge variant="outline">{trans.category}</Badge>
                                </td>
                                <td className={`p-3 text-right font-semibold ${trans.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                    {trans.type === 'income' ? '+' : '-'}{formatCurrency(trans.amount)}
                                </td>
                                <td className="p-3">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-7 w-7">
                                            <AvatarImage src={trans.created_by_user?.avatar} />
                                            <AvatarFallback className="text-xs">
                                                {trans.created_by_user?.name?.charAt(0) || '?'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm">{trans.created_by_user?.name || 'N/A'}</span>
                                    </div>
                                </td>
                                <td className="p-3">
                                    <Badge variant={statusLabels[trans.status].variant}>
                                        {statusLabels[trans.status].label}
                                    </Badge>
                                </td>
                                <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-blue-600 hover:bg-blue-100"
                                            onClick={(e) => { e.stopPropagation(); onView(trans); }}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        {canEdit && trans.status === 'pending' && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-green-600 hover:bg-green-100"
                                                    onClick={(e) => { e.stopPropagation(); onApprove(trans.id); }}
                                                    disabled={loading}
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-600 hover:bg-red-100"
                                                    onClick={(e) => { e.stopPropagation(); onCancel(trans.id); }}
                                                    disabled={loading}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-600 hover:bg-red-100"
                                                    onClick={(e) => { e.stopPropagation(); onDelete(trans.id); }}
                                                    disabled={loading}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 p-4">
                {transactions.map((trans) => (
                    <div
                        key={trans.id}
                        className="p-4 rounded-lg border bg-card cursor-pointer"
                        onClick={() => onView(trans)}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <p className="font-semibold">{trans.code}</p>
                                <p className="text-sm text-muted-foreground">{formatDate(trans.date)}</p>
                            </div>
                            <Badge variant={statusLabels[trans.status].variant}>
                                {statusLabels[trans.status].label}
                            </Badge>
                        </div>

                        <div className="flex items-center justify-between mb-3">
                            <Badge variant="outline">{trans.category}</Badge>
                            <span className={`text-lg font-bold ${trans.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                {trans.type === 'income' ? '+' : '-'}{formatCurrency(trans.amount)}
                            </span>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src={trans.created_by_user?.avatar} />
                                    <AvatarFallback className="text-xs">
                                        {trans.created_by_user?.name?.charAt(0) || '?'}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-muted-foreground">{trans.created_by_user?.name || 'N/A'}</span>
                            </div>

                            {canEdit && trans.status === 'pending' && (
                                <div className="flex gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-green-600"
                                        onClick={() => onApprove(trans.id)}
                                        disabled={loading}
                                    >
                                        <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-600"
                                        onClick={() => onDelete(trans.id)}
                                        disabled={loading}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

export function FinancePage({ currentUser }: FinancePageProps) {
    const [activeTab, setActiveTab] = useState<'income' | 'expense'>('income');
    const [showForm, setShowForm] = useState<TransactionType | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Data states
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [summary, setSummary] = useState({
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        pendingIncomeCount: 0,
        pendingExpenseCount: 0,
    });
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

    // Fetch transactions
    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (activeTab) params.type = activeTab;
            if (statusFilter !== 'all') params.status = statusFilter;
            if (searchTerm) params.search = searchTerm;

            const response = await transactionsApi.getAll(params);
            setTransactions(response.data.data?.transactions || []);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    }, [activeTab, statusFilter, searchTerm]);

    // Fetch summary
    const fetchSummary = useCallback(async () => {
        try {
            const response = await transactionsApi.getSummary();
            setSummary(response.data.data || {
                totalIncome: 0,
                totalExpense: 0,
                balance: 0,
                pendingIncomeCount: 0,
                pendingExpenseCount: 0,
            });
        } catch (error) {
            console.error('Error fetching summary:', error);
        }
    }, []);

    useEffect(() => {
        fetchTransactions();
        fetchSummary();
    }, [fetchTransactions, fetchSummary]);

    // Create transaction
    const handleCreateTransaction = async (data: any) => {
        setActionLoading(true);
        try {
            await transactionsApi.create(data);
            toast.success(`Đã tạo phiếu ${data.type === 'income' ? 'thu' : 'chi'}`);
            setShowForm(null);
            fetchTransactions();
            fetchSummary();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi tạo phiếu');
        } finally {
            setActionLoading(false);
        }
    };

    // Approve transaction
    const handleApprove = async (id: string) => {
        setActionLoading(true);
        try {
            await transactionsApi.updateStatus(id, 'approved');
            toast.success('Đã duyệt phiếu');
            fetchTransactions();
            fetchSummary();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi duyệt phiếu');
        } finally {
            setActionLoading(false);
        }
    };

    // Cancel transaction
    const handleCancel = async (id: string) => {
        setActionLoading(true);
        try {
            await transactionsApi.updateStatus(id, 'cancelled');
            toast.success('Đã hủy phiếu');
            fetchTransactions();
            fetchSummary();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi hủy phiếu');
        } finally {
            setActionLoading(false);
        }
    };

    // Delete transaction
    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xóa phiếu này?')) return;

        setActionLoading(true);
        try {
            await transactionsApi.delete(id);
            toast.success('Đã xóa phiếu');
            fetchTransactions();
            fetchSummary();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi xóa phiếu');
        } finally {
            setActionLoading(false);
        }
    };

    const incomeTransactions = transactions.filter(t => t.type === 'income');
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    const currentTransactions = activeTab === 'income' ? incomeTransactions : expenseTransactions;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Thu Chi</h1>
                    <p className="text-muted-foreground">Quản lý phiếu thu và phiếu chi</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => { fetchTransactions(); fetchSummary(); }}
                            disabled={loading}
                            className="hidden sm:flex"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1 sm:hidden justify-center"
                            onClick={() => { fetchTransactions(); fetchSummary(); }}
                            disabled={loading}
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Làm mới
                        </Button>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button onClick={() => setShowForm('income')} className="flex-1 bg-green-600 hover:bg-green-700">
                            <Plus className="h-4 w-4 mr-2" />
                            Phiếu thu
                        </Button>
                        <Button onClick={() => setShowForm('expense')} className="flex-1 bg-red-600 hover:bg-red-700">
                            <Plus className="h-4 w-4 mr-2" />
                            Phiếu chi
                        </Button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <Card className="bg-green-50 border-green-200 shadow-sm">
                    <CardContent className="p-4 sm:p-5">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Tổng thu (đã duyệt)</p>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalIncome)}</p>
                        {summary.pendingIncomeCount > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 bg-white/50 w-fit px-2 py-0.5 rounded-full">
                                {summary.pendingIncomeCount} phiếu chờ duyệt
                            </p>
                        )}
                    </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200 shadow-sm">
                    <CardContent className="p-4 sm:p-5">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Tổng chi (đã duyệt)</p>
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalExpense)}</p>
                        {summary.pendingExpenseCount > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 bg-white/50 w-fit px-2 py-0.5 rounded-full">
                                {summary.pendingExpenseCount} phiếu chờ duyệt
                            </p>
                        )}
                    </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200 shadow-sm">
                    <CardContent className="p-4 sm:p-5">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Chênh lệch</p>
                        <p className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(summary.balance)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Card>
                <CardContent className="p-0">
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                        <div className="border-b px-4 pt-4">
                            <TabsList className="mb-4">
                                <TabsTrigger value="income" className="gap-2">
                                    <div className="h-2 w-2 rounded-full bg-green-500" />
                                    Phiếu thu
                                    <Badge variant="secondary" className="ml-1">{incomeTransactions.length}</Badge>
                                </TabsTrigger>
                                <TabsTrigger value="expense" className="gap-2">
                                    <div className="h-2 w-2 rounded-full bg-red-500" />
                                    Phiếu chi
                                    <Badge variant="secondary" className="ml-1">{expenseTransactions.length}</Badge>
                                </TabsTrigger>
                            </TabsList>

                            {/* Filters */}
                            <div className="flex flex-col sm:flex-row gap-3 pb-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Tìm theo mã, loại..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full sm:w-40">
                                        <SelectValue placeholder="Trạng thái" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tất cả</SelectItem>
                                        <SelectItem value="pending">Chờ duyệt</SelectItem>
                                        <SelectItem value="approved">Đã duyệt</SelectItem>
                                        <SelectItem value="cancelled">Đã huỷ</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <TabsContent value="income" className="m-0">
                            {loading ? (
                                <div className="py-12 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <TransactionTable
                                    transactions={currentTransactions}
                                    userRole={currentUser.role}
                                    onApprove={handleApprove}
                                    onCancel={handleCancel}
                                    onDelete={handleDelete}
                                    onView={setSelectedTransaction}
                                    loading={actionLoading}
                                />
                            )}
                        </TabsContent>

                        <TabsContent value="expense" className="m-0">
                            {loading ? (
                                <div className="py-12 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <TransactionTable
                                    transactions={currentTransactions}
                                    userRole={currentUser.role}
                                    onApprove={handleApprove}
                                    onCancel={handleCancel}
                                    onDelete={handleDelete}
                                    onView={setSelectedTransaction}
                                    loading={actionLoading}
                                />
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Create Transaction Dialog */}
            <Dialog open={!!showForm} onOpenChange={() => setShowForm(null)}>
                {showForm && (
                    <TransactionForm
                        type={showForm}
                        onClose={() => setShowForm(null)}
                        onSubmit={handleCreateTransaction}
                        loading={actionLoading}
                    />
                )}
            </Dialog>

            {/* Transaction Detail Dialog */}
            <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
                {selectedTransaction && (
                    <DialogContent className="max-w-lg w-full h-full sm:h-auto sm:max-h-[90vh] p-0 sm:p-6 flex flex-col gap-0">
                        <DialogHeader className="p-4 sm:p-0 border-b sm:border-none shrink-0">
                            <DialogTitle className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${selectedTransaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                                    }`}>
                                    <FileText className={`h-5 w-5 ${selectedTransaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                                        }`} />
                                </div>
                                <div>
                                    <p className="text-lg font-semibold">{selectedTransaction.code}</p>
                                    <p className="text-sm text-muted-foreground font-normal">
                                        Phiếu {selectedTransaction.type === 'income' ? 'thu' : 'chi'}
                                    </p>
                                </div>
                            </DialogTitle>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-4 sm:p-0 sm:pt-4 space-y-4">
                            {/* Amount */}
                            <div className={`text-center py-4 rounded-lg ${selectedTransaction.type === 'income' ? 'bg-green-50' : 'bg-red-50'
                                }`}>
                                <p className="text-sm text-muted-foreground mb-1">Số tiền</p>
                                <p className={`text-3xl font-bold ${selectedTransaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                    {selectedTransaction.type === 'income' ? '+' : '-'}
                                    {formatCurrency(selectedTransaction.amount)}
                                </p>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Ngày</p>
                                    <p className="font-medium">{formatDate(selectedTransaction.date)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Trạng thái</p>
                                    <Badge variant={statusLabels[selectedTransaction.status].variant}>
                                        {statusLabels[selectedTransaction.status].label}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Loại</p>
                                    <p className="font-medium">{selectedTransaction.category}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Phương thức</p>
                                    <p className="font-medium">{paymentMethodLabels[selectedTransaction.payment_method]}</p>
                                </div>
                            </div>

                            {/* Order Link */}
                            {selectedTransaction.order_code && (
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <p className="text-sm text-muted-foreground mb-1">Liên kết đơn hàng</p>
                                    <a
                                        href={`/orders/${selectedTransaction.order_id}`}
                                        className="flex items-center gap-2 text-primary hover:underline font-medium"
                                    >
                                        {selectedTransaction.order_code}
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                </div>
                            )}

                            {/* Notes */}
                            {selectedTransaction.notes && (
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Ghi chú</p>
                                    <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedTransaction.notes}</p>
                                </div>
                            )}

                            {/* Image */}
                            {selectedTransaction.image_url && (
                                <div>
                                    <p className="text-sm text-muted-foreground mb-2">Ảnh đính kèm</p>
                                    <img
                                        src={selectedTransaction.image_url}
                                        alt="Đính kèm"
                                        className="w-full rounded-lg border"
                                    />
                                </div>
                            )}

                            {/* Meta */}
                            <div className="pt-3 border-t grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Người tạo</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={selectedTransaction.created_by_user?.avatar} />
                                            <AvatarFallback className="text-xs">
                                                {selectedTransaction.created_by_user?.name?.charAt(0) || '?'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span>{selectedTransaction.created_by_user?.name || 'N/A'}</span>
                                    </div>
                                </div>
                                {selectedTransaction.approved_by_user && (
                                    <div>
                                        <p className="text-muted-foreground">Người duyệt</p>
                                        <p className="mt-1 font-medium">{selectedTransaction.approved_by_user.name}</p>
                                    </div>
                                )}
                            </div>
                        </div>


                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
