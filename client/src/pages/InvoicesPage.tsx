import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Search, AlertCircle, FileText, X, Calculator, Loader2, Eye, CheckCircle, XCircle, Clock, Package, Gift } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { invoicesApi, ordersApi } from '@/lib/api';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { User } from '@/types';

interface Invoice {
    id: string;
    invoice_code: string;
    order_id: string;
    customer_id: string;
    customer?: { id: string; name: string; phone: string; email?: string };
    order?: { id: string; order_code: string; items?: any[] };
    subtotal: number;
    discount: number;
    total_amount: number;
    payment_method: string;
    status: string;
    notes?: string;
    paid_at?: string;
    created_at: string;
    created_user?: { id: string; name: string };
}

interface Order {
    id: string;
    order_code: string;
    customer?: { id: string; name: string; phone: string };
    total_amount: number;
    status: string;
}

interface InvoicesPageProps {
    currentUser: User;
}

// Create Invoice Dialog
function CreateInvoiceDialog({
    open,
    onClose,
    onSuccess,
    orders
}: {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    orders: Order[];
}) {
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Filter completed orders that don't have invoices yet
    const availableOrders = orders.filter(o => o.status === 'completed');

    const selectedOrder = availableOrders.find(o => o.id === selectedOrderId);

    const handleSubmit = async () => {
        if (!selectedOrderId) {
            toast.error('Vui lòng chọn đơn hàng');
            return;
        }

        setSubmitting(true);
        try {
            await invoicesApi.create({
                order_id: selectedOrderId,
                payment_method: paymentMethod,
                notes: notes || undefined
            });
            toast.success('Đã tạo hóa đơn thành công!');
            onSuccess();
            onClose();
            // Reset form
            setSelectedOrderId('');
            setPaymentMethod('cash');
            setNotes('');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi tạo hóa đơn');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Tạo hóa đơn mới
                    </DialogTitle>
                    <DialogDescription>
                        Chọn đơn hàng đã hoàn thành để tạo hóa đơn
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Order Selection */}
                    <div className="space-y-2">
                        <Label>Đơn hàng *</Label>
                        <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Chọn đơn hàng..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableOrders.length === 0 ? (
                                    <div className="p-3 text-center text-muted-foreground text-sm">
                                        Không có đơn hàng hoàn thành
                                    </div>
                                ) : (
                                    availableOrders.map(order => (
                                        <SelectItem key={order.id} value={order.id}>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{order.order_code}</span>
                                                <span className="text-muted-foreground">-</span>
                                                <span>{order.customer?.name}</span>
                                                <span className="text-primary font-semibold">
                                                    {formatCurrency(order.total_amount)}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Selected Order Info */}
                    {selectedOrder && (
                        <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Mã đơn:</span>
                                <span className="font-medium">{selectedOrder.order_code}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Khách hàng:</span>
                                <span className="font-medium">{selectedOrder.customer?.name}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold">
                                <span>Tổng tiền:</span>
                                <span className="text-primary">{formatCurrency(selectedOrder.total_amount)}</span>
                            </div>
                        </div>
                    )}

                    {/* Payment Method */}
                    <div className="space-y-2">
                        <Label>Phương thức thanh toán</Label>
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
                            className="w-full min-h-[80px] px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                            placeholder="Nhập ghi chú..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={submitting}>
                        Hủy
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || !selectedOrderId}>
                        {submitting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Đang tạo...
                            </>
                        ) : (
                            <>
                                <FileText className="h-4 w-4 mr-2" />
                                Tạo hóa đơn
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Invoice Detail Dialog
function InvoiceDetailDialog({
    invoice,
    open,
    onClose,
    onStatusChange,
    canEdit
}: {
    invoice: Invoice | null;
    open: boolean;
    onClose: () => void;
    onStatusChange: (id: string, status: string) => void;
    canEdit: boolean;
}) {
    if (!invoice) return null;

    const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'secondary' | 'info' }> = {
        draft: { label: 'Nháp', variant: 'secondary' },
        pending: { label: 'Chờ thanh toán', variant: 'warning' },
        paid: { label: 'Đã thanh toán', variant: 'success' },
        cancelled: { label: 'Đã hủy', variant: 'danger' }
    };

    const paymentMethodLabels: Record<string, string> = {
        cash: 'Tiền mặt',
        transfer: 'Chuyển khoản',
        card: 'Thẻ'
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="font-bold">{invoice.invoice_code}</span>
                        <Badge variant={statusConfig[invoice.status]?.variant || 'secondary'}>
                            {statusConfig[invoice.status]?.label || invoice.status}
                        </Badge>
                    </DialogTitle>
                    <DialogDescription>Chi tiết hóa đơn</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4">
                    {/* Customer Info */}
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Avatar className="h-12 w-12">
                            <AvatarFallback className="bg-primary text-white">
                                {invoice.customer?.name?.charAt(0) || 'K'}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <p className="font-semibold">{invoice.customer?.name || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground">{invoice.customer?.phone || 'Không có SĐT'}</p>
                        </div>
                    </div>

                    {/* Order Info */}
                    {invoice.order && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-sm text-blue-600 font-medium">
                                Đơn hàng: {invoice.order.order_code}
                            </p>
                        </div>
                    )}

                    {/* Items Table */}
                    {invoice.order?.items && invoice.order.items.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                <Package className="h-4 w-4" />
                                Chi tiết sản phẩm/dịch vụ ({invoice.order.items.length})
                            </p>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="text-left p-3 font-medium">Loại</th>
                                            <th className="text-left p-3 font-medium">Tên</th>
                                            <th className="text-center p-3 font-medium">SL</th>
                                            <th className="text-right p-3 font-medium">Đơn giá</th>
                                            <th className="text-right p-3 font-medium">Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {invoice.order.items.map((item: any, i: number) => {
                                            const getItemTypeLabel = (type: string) => {
                                                switch (type) {
                                                    case 'product': return 'Sản phẩm';
                                                    case 'service': return 'Dịch vụ';
                                                    case 'package': return 'Gói dịch vụ';
                                                    case 'voucher': return 'Voucher';
                                                    default: return type;
                                                }
                                            };
                                            const getItemTypeColor = (type: string) => {
                                                switch (type) {
                                                    case 'product': return 'bg-blue-100 text-blue-700';
                                                    case 'service': return 'bg-purple-100 text-purple-700';
                                                    case 'package': return 'bg-emerald-100 text-emerald-700';
                                                    case 'voucher': return 'bg-amber-100 text-amber-700';
                                                    default: return 'bg-gray-100 text-gray-700';
                                                }
                                            };
                                            return (
                                                <tr key={i} className="hover:bg-muted/30">
                                                    <td className="p-3">
                                                        <Badge className={getItemTypeColor(item.item_type)}>
                                                            {getItemTypeLabel(item.item_type)}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-3 font-medium">{item.item_name}</td>
                                                    <td className="p-3 text-center">{item.quantity}</td>
                                                    <td className="p-3 text-right text-muted-foreground">
                                                        {formatCurrency(item.unit_price)}
                                                    </td>
                                                    <td className="p-3 text-right font-semibold">
                                                        {formatCurrency(item.total_price)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Summary */}
                    <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/10 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Tạm tính:</span>
                            <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
                        </div>
                        {invoice.discount > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                                <span className="flex items-center gap-1">
                                    <Gift className="h-3.5 w-3.5" />
                                    Giảm giá:
                                </span>
                                <span className="font-medium">-{formatCurrency(invoice.discount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-lg font-bold pt-2 border-t border-primary/20">
                            <span>Tổng thanh toán:</span>
                            <span className="text-primary">{formatCurrency(invoice.total_amount)}</span>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">Ngày tạo</p>
                            <p className="font-medium">{formatDateTime(invoice.created_at)}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Phương thức TT</p>
                            <p className="font-medium">{paymentMethodLabels[invoice.payment_method] || invoice.payment_method}</p>
                        </div>
                        {invoice.paid_at && (
                            <div>
                                <p className="text-muted-foreground">Ngày thanh toán</p>
                                <p className="font-medium">{formatDateTime(invoice.paid_at)}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-muted-foreground">Người tạo</p>
                            <p className="font-medium">{invoice.created_user?.name || 'N/A'}</p>
                        </div>
                    </div>

                    {/* Notes */}
                    {invoice.notes && (
                        <div>
                            <p className="text-sm text-muted-foreground mb-1">Ghi chú</p>
                            <p className="text-sm p-3 bg-muted/50 rounded-lg">{invoice.notes}</p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                {canEdit && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                    <div className="flex gap-2 pt-4 border-t">
                        <Button
                            variant="outline"
                            className="flex-1 text-red-600 hover:bg-red-50"
                            onClick={() => {
                                onStatusChange(invoice.id, 'cancelled');
                                onClose();
                            }}
                        >
                            <XCircle className="h-4 w-4 mr-2" />
                            Hủy hóa đơn
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={() => {
                                onStatusChange(invoice.id, 'paid');
                                onClose();
                            }}
                        >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Xác nhận thanh toán
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

export function InvoicesPage({ currentUser }: InvoicesPageProps) {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const canEdit = ['manager', 'admin', 'accountant'].includes(currentUser.role);

    // Fetch invoices
    const fetchInvoices = useCallback(async () => {
        try {
            const params: any = {};
            if (statusFilter !== 'all') params.status = statusFilter;

            const response = await invoicesApi.getAll(params);
            setInvoices(response.data.data?.invoices || []);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Lỗi khi tải danh sách hóa đơn');
        }
    }, [statusFilter]);

    // Fetch orders for creating new invoices
    const fetchOrders = useCallback(async () => {
        try {
            const response = await ordersApi.getAll({ status: 'completed' });
            setOrders(response.data.data?.orders || []);
        } catch (err) {
            console.error('Error fetching orders:', err);
        }
    }, []);

    // Fetch full invoice detail with order items
    const fetchInvoiceDetail = async (invoiceId: string) => {
        setLoadingDetail(true);
        try {
            const response = await invoicesApi.getById(invoiceId);
            const invoice = response.data.data?.invoice;
            if (invoice) {
                setSelectedInvoice(invoice);
            }
        } catch (err: any) {
            toast.error('Lỗi khi tải chi tiết hóa đơn');
        } finally {
            setLoadingDetail(false);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([fetchInvoices(), fetchOrders()]);
            setLoading(false);
        };
        loadData();
    }, [fetchInvoices, fetchOrders]);

    // Update invoice status
    const handleStatusChange = async (id: string, status: string) => {
        try {
            await invoicesApi.updateStatus(id, status);
            toast.success(status === 'paid' ? 'Đã xác nhận thanh toán!' : 'Đã hủy hóa đơn!');
            fetchInvoices();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái');
        }
    };

    // Filter invoices by search
    const filteredInvoices = useMemo(() => {
        if (!searchQuery) return invoices;
        const query = searchQuery.toLowerCase();
        return invoices.filter(inv =>
            inv.invoice_code.toLowerCase().includes(query) ||
            inv.customer?.name?.toLowerCase().includes(query) ||
            inv.customer?.phone?.includes(query)
        );
    }, [invoices, searchQuery]);

    // Stats
    const stats = useMemo(() => {
        return {
            total: invoices.length,
            draft: invoices.filter(i => i.status === 'draft').length,
            pending: invoices.filter(i => i.status === 'pending').length,
            paid: invoices.filter(i => i.status === 'paid').length,
            cancelled: invoices.filter(i => i.status === 'cancelled').length,
            totalAmount: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_amount, 0)
        };
    }, [invoices]);

    const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'secondary' | 'info'; icon: any }> = {
        draft: { label: 'Nháp', variant: 'secondary', icon: FileText },
        pending: { label: 'Chờ TT', variant: 'warning', icon: Clock },
        paid: { label: 'Đã TT', variant: 'success', icon: CheckCircle },
        cancelled: { label: 'Đã hủy', variant: 'danger', icon: XCircle }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <Toaster position="top-right" richColors />
            <div className="space-y-6 animate-fade-in">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Hóa đơn</h1>
                        <p className="text-muted-foreground">Quản lý hóa đơn bán hàng</p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-blue-600 font-medium">Tổng cộng</p>
                                    <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
                                </div>
                                <FileText className="h-8 w-8 text-blue-400" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-amber-600 font-medium">Chờ TT</p>
                                    <p className="text-2xl font-bold text-amber-700">{stats.pending + stats.draft}</p>
                                </div>
                                <Clock className="h-8 w-8 text-amber-400" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-green-600 font-medium">Đã TT</p>
                                    <p className="text-2xl font-bold text-green-700">{stats.paid}</p>
                                </div>
                                <CheckCircle className="h-8 w-8 text-green-400" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200 hidden sm:block">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-red-600 font-medium">Đã hủy</p>
                                    <p className="text-2xl font-bold text-red-700">{stats.cancelled}</p>
                                </div>
                                <XCircle className="h-8 w-8 text-red-400" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-primary/5 to-primary/15 border-primary/20 col-span-2 sm:col-span-1">
                        <CardContent className="p-4">
                            <div>
                                <p className="text-sm text-primary font-medium">Doanh thu</p>
                                <p className="text-xl font-bold text-primary">{formatCurrency(stats.totalAmount)}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Error */}
                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        {error}
                    </div>
                )}

                {/* Filters */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Tìm theo mã hóa đơn, tên KH, SĐT..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full sm:w-48">
                                    <SelectValue placeholder="Trạng thái" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả</SelectItem>
                                    <SelectItem value="draft">Nháp</SelectItem>
                                    <SelectItem value="pending">Chờ thanh toán</SelectItem>
                                    <SelectItem value="paid">Đã thanh toán</SelectItem>
                                    <SelectItem value="cancelled">Đã hủy</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Invoice List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Danh sách hóa đơn ({filteredInvoices.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {filteredInvoices.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                <p>Chưa có hóa đơn nào</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredInvoices.map((invoice) => {
                                    const config = statusConfig[invoice.status];
                                    const StatusIcon = config?.icon || FileText;

                                    return (
                                        <div
                                            key={invoice.id}
                                            onClick={() => fetchInvoiceDetail(invoice.id)}
                                            className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted/30 hover:border-primary/30 transition-all cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                                    <StatusIcon className="h-6 w-6 text-primary" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold">{invoice.invoice_code}</p>
                                                        <Badge variant={config?.variant || 'secondary'} className="text-xs">
                                                            {config?.label || invoice.status}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {invoice.customer?.name} • {formatDate(invoice.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-lg text-primary">
                                                    {formatCurrency(invoice.total_amount)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {invoice.order?.order_code}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Create Invoice Dialog */}
                <CreateInvoiceDialog
                    open={showCreateDialog}
                    onClose={() => setShowCreateDialog(false)}
                    onSuccess={() => {
                        fetchInvoices();
                        fetchOrders();
                    }}
                    orders={orders}
                />

                {/* Invoice Detail Dialog */}
                <InvoiceDetailDialog
                    invoice={selectedInvoice}
                    open={!!selectedInvoice}
                    onClose={() => setSelectedInvoice(null)}
                    onStatusChange={handleStatusChange}
                    canEdit={canEdit}
                />
            </div>
        </>
    );
}
