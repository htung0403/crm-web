import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit, Trash2, Check, X, Upload, FileText, Loader2, RefreshCw, Eye, ExternalLink, Image as ImageIcon } from 'lucide-react';
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
import { transactionsApi, ordersApi, requestsApi } from '@/lib/api';
import { formatCurrency, formatDate, cn, normalizeSearchText } from '@/lib/utils';
import type { User } from '@/types';

interface FinancePageProps {
    currentUser: User;
    initialTab?: 'income' | 'expense';
    onTabChange?: (tab: string) => void;
}

type TransactionType = 'income' | 'expense';
type TransactionStatus = 'pending' | 'approved' | 'cancelled';

interface Transaction {
    id: string;
    code: string;
    type: TransactionType;
    category: string;
    amount: number;
    payment_method: 'cash' | 'transfer' | 'zalopay';
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
    metadata?: any;
}

const statusLabels: Record<TransactionStatus, { label: string; variant: 'warning' | 'success' | 'danger' }> = {
    pending: { label: 'Chờ duyệt', variant: 'warning' },
    approved: { label: 'Đã duyệt', variant: 'success' },
    cancelled: { label: 'Đã huỷ', variant: 'danger' }
};

const paymentMethodLabels = {
    cash: 'Tiền mặt',
    transfer: 'Chuyển khoản',
    zalopay: 'Zalo Pay'
};

const incomeCategories = [
    'Thanh toán đơn hàng',
    'Đặt cọc',
    'Phí giao hàng',
    'Thu khác',
];

const expenseCategories = [
    'Lương nhân viên',
    'Tiền điện',
    'Tiền nước',
    'Tiền thuê mặt bằng',
    'Mua vật tư',
    'Chi phí vận hành',
    'Phí ship nhận hàng',
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
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'zalopay'>('cash');
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [imageUrl, setImageUrl] = useState('');
    const [orderCode, setOrderCode] = useState('');
    const [orderId, setOrderId] = useState<string | undefined>(undefined);
    const [orderSuggestions, setOrderSuggestions] = useState<any[]>([]);
    const [searchingOrders, setSearchingOrders] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        const searchOrders = async () => {
            if (orderCode.length < 1 || orderId) {
                if (!orderId) setOrderSuggestions([]);
                return;
            }

            setSearchingOrders(true);
            try {
                // Backend is accent-sensitive, so we map 'HD' to 'HĐ' for the request
                const searchParam = orderCode.replace(/HD/gi, 'HĐ');
                const response = await ordersApi.getAll({ search: searchParam, limit: 15 });

                // Local filtering to avoid "full-text search" results that don't match the code
                // and ensure 'HD' matches 'HĐ' interchangeably.
                const query = normalizeSearchText(orderCode);
                const filtered = (response.data.data?.orders || []).filter((order: any) => {
                    const code = normalizeSearchText(order.order_code || '');
                    return code.includes(query);
                });

                setOrderSuggestions(filtered.slice(0, 5));
            } catch (error) {
                console.error('Error searching orders:', error);
            } finally {
                setSearchingOrders(false);
            }
        };

        const timer = setTimeout(searchOrders, 300);
        return () => clearTimeout(timer);
    }, [orderCode, orderId]);

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
            order_code: orderCode || undefined,
            order_id: orderId,
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

                {/* Order Code - Only for specific income categories */}
                {type === 'income' && ['Thanh toán đơn hàng', 'Đặt cọc', 'Phí giao hàng'].includes(category) && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300 relative">
                        <Label>Mã đơn hàng</Label>
                        <div className="relative group/input">
                            <Input
                                placeholder="Nhập mã đơn hàng (VD: HĐ123)"
                                value={orderCode}
                                onChange={(e) => {
                                    setOrderCode(e.target.value.toUpperCase());
                                    setShowSuggestions(true);
                                    setOrderId(undefined);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                className={cn(
                                    "transition-all",
                                    orderId && "border-green-500 bg-green-50/30 focus-visible:ring-green-500"
                                )}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                {searchingOrders && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                {orderId && <Check className="h-4 w-4 text-green-500" />}
                            </div>
                        </div>

                        {showSuggestions && orderCode.length >= 1 && !orderId && (
                            <div className="absolute z-[100] w-full mt-1 bg-card border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                {searchingOrders ? (
                                    <div className="px-3 py-6 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        <span>Đang tìm kiếm đơn hàng...</span>
                                    </div>
                                ) : orderSuggestions.length > 0 ? (
                                    <>
                                        <div className="px-2 py-1.5 border-b bg-muted/30">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Đơn hàng gợi ý</p>
                                        </div>
                                        <ul className="py-1 max-h-[240px] overflow-y-auto custom-scrollbar">
                                            {orderSuggestions.map((order) => (
                                                <li
                                                    key={order.id}
                                                    className="px-3 py-2.5 text-sm hover:bg-accent cursor-pointer flex justify-between items-center group transition-colors"
                                                    onClick={() => {
                                                        setOrderCode(order.order_code);
                                                        setOrderId(order.id);
                                                        setShowSuggestions(false);
                                                    }}
                                                >
                                                    <div className="flex flex-col gap-0.5">
                                                        <p className="font-bold text-foreground group-hover:text-primary transition-colors">{order.order_code}</p>
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <span className="max-w-[120px] truncate">{order.customer?.name || 'Ẩn danh'}</span>
                                                            <span>•</span>
                                                            <span>{order.customer?.phone}</span>
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-primary">{formatCurrency(order.total_amount)}</p>
                                                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 uppercase font-bold">
                                                            {order.status}
                                                        </Badge>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                ) : (
                                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                                        Không tìm thấy đơn hàng: <span className="font-bold">{orderCode}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

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
                            <SelectItem value="zalopay">Zalo Pay</SelectItem>
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
    onDelete,
    onView,
    loading,
}: {
    transactions: Transaction[];
    userRole: string;
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
                                        {canEdit && (
                                            <>
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

                            {canEdit && (
                                <div className="flex gap-1">
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

export function FinancePage({ currentUser, initialTab = 'income', onTabChange }: FinancePageProps) {
    const [activeTab, setActiveTab] = useState<'income' | 'expense'>(initialTab);
    const [showForm, setShowForm] = useState<TransactionType | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Sync activeTab with initialTab when navigation changes
    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    // Handle tab change and notify parent (App.tsx) to update URL
    const handleTabChange = (tab: string) => {
        const typedTab = tab as 'income' | 'expense';
        setActiveTab(typedTab);
        if (onTabChange) {
            onTabChange(typedTab);
        }
    };

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
    const [associatedAccessory, setAssociatedAccessory] = useState<any | null>(null);
    const [fetchingAccessory, setFetchingAccessory] = useState(false);

    // Fetch related accessory or partner data when relevant transaction is selected
    useEffect(() => {
        const fetchRelatedData = async () => {
            const isAcc = selectedTransaction?.category === 'Mua phụ kiện' || selectedTransaction?.category === 'Phí ship nhận hàng';
            const isPartnerShip = selectedTransaction?.category === 'Phí ship gửi đối tác';

            if (!selectedTransaction || (!isAcc && !isPartnerShip)) {
                setAssociatedAccessory(null);
                return;
            }

            // Extract ID from notes like "(Yêu cầu #052fc03c)"
            const match = selectedTransaction.notes?.match(/\(Yêu cầu #([a-f0-9]+)\)/);
            if (!match) return;

            const shortId = match[1];
            setFetchingAccessory(true);
            try {
                if (isAcc) {
                    const res = await requestsApi.getAccessories();
                    const accessories = (res.data.data as any[]) || [];
                    const found = accessories.find((a: any) => a.id.startsWith(shortId));
                    if (found) setAssociatedAccessory(found);
                } else {
                    const res = await requestsApi.getPartners();
                    const partners = (res.data.data as any[]) || [];
                    const found = partners.find((p: any) => p.id.startsWith(shortId));
                    if (found) setAssociatedAccessory(found); // Reusing state name for simplicity as it stores 'request' data
                }
            } catch (err) {
                console.error('Error fetching associated data:', err);
            } finally {
                setFetchingAccessory(false);
            }
        };

        fetchRelatedData();
    }, [selectedTransaction]);

    // Fetch transactions
    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {};
            // Fetch all transactions to show counts in both tabs
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
            // If it's an income related to an order, use ordersApi.createPayment 
            // to ensure the order's remaining debt and payment status are updated.
            const isOrderIncome = data.type === 'income' &&
                data.order_id &&
                ['Thanh toán đơn hàng', 'Đặt cọc', 'Phí giao hàng'].includes(data.category);

            if (isOrderIncome) {
                await ordersApi.createPayment(data.order_id, {
                    content: data.category,
                    amount: data.amount,
                    payment_method: data.payment_method,
                    image_url: data.image_url,
                    notes: data.notes,
                });
            } else {
                await transactionsApi.create(data);
            }

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
                    <Tabs value={activeTab} onValueChange={handleTabChange}>
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

                            {/* Attachments - Specific Category Display (Accessories & Partners) */}
                            {(() => {
                                const isAccessoryPurchase = selectedTransaction.category === 'Mua phụ kiện';
                                const isAccessoryShipping = selectedTransaction.category === 'Phí ship nhận hàng';
                                const isPartnerShipping = selectedTransaction.category === 'Phí ship gửi đối tác';

                                if (!isAccessoryPurchase && !isAccessoryShipping && !isPartnerShipping) return null;

                                // Helper to parse metadata safely
                                const parseMeta = (meta: any) => {
                                    if (!meta) return {};
                                    if (typeof meta === 'object') return meta;
                                    try {
                                        const parsed = JSON.parse(meta);
                                        return typeof parsed === 'object' ? parsed : {};
                                    } catch (e) {
                                        console.error('Meta parse error:', e);
                                        return {};
                                    }
                                };

                                const rawMeta = parseMeta(selectedTransaction.metadata);
                                const associatedMeta = parseMeta(associatedAccessory?.metadata);

                                // Normalize photos from meta or associated request
                                const purchasePhotos = rawMeta.photos_purchase || rawMeta.purchase_photos || associatedMeta?.photos_purchase || associatedMeta?.purchase_photos || [];
                                const transferPhotos = rawMeta.photos_transfer || rawMeta.transfer_photos || associatedMeta?.photos_transfer || associatedMeta?.transfer_photos || [];
                                const arrivalPhotos = rawMeta.arrival_photos || rawMeta.photos_arrival || associatedMeta?.arrival_photos || associatedMeta?.photos_arrival || [];
                                const packagePhotos = rawMeta.package_photos || rawMeta.photos_package || associatedMeta?.package_photos || associatedMeta?.photos_package || [];

                                const hasAnyPhotos = purchasePhotos.length > 0 || transferPhotos.length > 0 || arrivalPhotos.length > 0 || packagePhotos.length > 0;

                                return (
                                    <div className="border rounded-2xl p-4 bg-slate-50/50 space-y-5 animate-in slide-in-from-bottom-2 border-slate-200">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 mb-2">
                                            <ImageIcon className="w-3.5 h-3.5" />
                                            {isAccessoryPurchase ? 'Chứng từ mua phụ kiện' :
                                                isAccessoryShipping ? 'Chứng từ phí ship nhận hàng' :
                                                    'Chứng từ gửi đối tác (Ảnh gói đồ)'}
                                            {fetchingAccessory && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                                            {(!fetchingAccessory && hasAnyPhotos) && (
                                                <Badge variant="success" className="ml-auto text-[8px] h-4 uppercase tracking-tighter bg-emerald-100 text-emerald-600 border-emerald-200">Đã liên kết</Badge>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            {/* Accessory Purchase & Partner Package share similar grid display */}
                                            {((isAccessoryPurchase || purchasePhotos.length > 0)) && (
                                                <div className="space-y-4">
                                                    <p className="text-[11px] font-black text-blue-600 uppercase tracking-tighter flex items-center gap-2 bg-blue-50 w-fit px-2 py-0.5 rounded-md border border-blue-100">
                                                        Ảnh mua hàng
                                                    </p>
                                                    {purchasePhotos.length > 0 ? (
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {purchasePhotos.map((url: string, i: number) => (
                                                                <div key={i} className="aspect-square rounded-xl border-2 border-white overflow-hidden bg-white group cursor-pointer relative shadow-sm transition-all hover:shadow-md hover:border-blue-200" onClick={() => window.open(url, '_blank')}>
                                                                    <img src={url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                        <Eye className="w-6 h-6 text-white" />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="h-24 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2 bg-white/50">
                                                            <ImageIcon className="w-5 h-5 opacity-20" />
                                                            <span className="text-[10px] font-medium uppercase tracking-tighter">Trống</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {((isAccessoryPurchase || transferPhotos.length > 0)) && (
                                                <div className="space-y-4">
                                                    <p className="text-[11px] font-black text-emerald-600 uppercase tracking-tighter flex items-center gap-2 bg-emerald-50 w-fit px-2 py-0.5 rounded-md border border-emerald-100">
                                                        Ảnh chuyển khoản
                                                    </p>
                                                    {transferPhotos.length > 0 ? (
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {transferPhotos.map((url: string, i: number) => (
                                                                <div key={i} className="aspect-square rounded-xl border-2 border-white overflow-hidden bg-white group cursor-pointer relative shadow-sm transition-all hover:shadow-md hover:border-emerald-200" onClick={() => window.open(url, '_blank')}>
                                                                    <img src={url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                        <Eye className="w-6 h-6 text-white" />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="h-24 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2 bg-white/50">
                                                            <ImageIcon className="w-5 h-5 opacity-20" />
                                                            <span className="text-[10px] font-medium uppercase tracking-tighter">Trống</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {isAccessoryShipping && (
                                                <div className="space-y-4 col-span-1 sm:col-span-2">
                                                    <p className="text-[11px] font-black text-amber-600 uppercase tracking-tighter flex items-center gap-2 bg-amber-50 w-fit px-2 py-0.5 rounded-md border border-amber-100">
                                                        Ảnh nhận hàng (Lúc về kho)
                                                    </p>
                                                    {arrivalPhotos.length > 0 ? (
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                            {arrivalPhotos.map((url: string, i: number) => (
                                                                <div key={i} className="aspect-square rounded-xl border-2 border-white overflow-hidden bg-white group cursor-pointer relative shadow-sm transition-all hover:shadow-md hover:border-amber-200" onClick={() => window.open(url, '_blank')}>
                                                                    <img src={url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                        <Eye className="w-6 h-6 text-white" />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="h-24 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2 bg-white/50">
                                                            <ImageIcon className="w-5 h-5 opacity-20" />
                                                            <span className="text-[10px] font-medium uppercase tracking-tighter">Trống</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {(isPartnerShipping || packagePhotos.length > 0) && (
                                                <div className="space-y-4 col-span-1 sm:col-span-2">
                                                    <p className="text-[11px] font-black text-indigo-600 uppercase tracking-tighter flex items-center gap-2 bg-indigo-50 w-fit px-2 py-0.5 rounded-md border border-indigo-100">
                                                        Ảnh gói hàng gửi đi
                                                    </p>
                                                    {packagePhotos.length > 0 ? (
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                            {packagePhotos.map((url: string, i: number) => (
                                                                <div key={i} className="aspect-square rounded-xl border-2 border-white overflow-hidden bg-white group cursor-pointer relative shadow-sm transition-all hover:shadow-md hover:border-indigo-200" onClick={() => window.open(url, '_blank')}>
                                                                    <img src={url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                        <Eye className="w-6 h-6 text-white" />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="h-24 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2 bg-white/50">
                                                            <ImageIcon className="w-5 h-5 opacity-20" />
                                                            <span className="text-[10px] font-medium uppercase tracking-tighter">Trống</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {(!fetchingAccessory && !hasAnyPhotos) && (
                                            <div className="text-center py-4 text-slate-400 italic text-[13px] border-t border-dashed mt-2">
                                                Chưa có ảnh đính kèm
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Fallback for single image_url if not already shown in specific categorical layouts */}
                            {selectedTransaction.image_url && !['Mua phụ kiện', 'Phí ship nhận hàng', 'Phí ship gửi đối tác'].includes(selectedTransaction.category) && (
                                <div>
                                    <p className="text-sm text-muted-foreground mb-2">Ảnh đính kèm</p>
                                    <img
                                        src={selectedTransaction.image_url}
                                        alt="Đính kèm"
                                        className="w-full rounded-lg border shadow-sm"
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
