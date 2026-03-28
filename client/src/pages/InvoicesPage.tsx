import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Search, AlertCircle, FileText, X, Calculator, Loader2, Eye, CheckCircle, XCircle, Clock, Package, Gift, CreditCard } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate, formatDateTime, cn } from '@/lib/utils';
import { PaymentRecordDialog } from '@/components/orders/PaymentRecordDialog';

import type { User } from '@/types';

import { InvoiceDetailDialog, type Invoice } from '@/components/invoices/InvoiceDetailDialog';

interface Order {
    id: string;
    order_code: string;
    customer?: { id: string; name: string; phone: string };
    total_amount: number;
    status: string;
    remaining_debt?: number;
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
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'zalopay'>('cash');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

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

                    <div className="space-y-2">
                        <Label>Phương thức thanh toán</Label>
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


export function InvoicesPage({ currentUser }: InvoicesPageProps) {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);
    const [showPaymentRecordDialog, setShowPaymentRecordDialog] = useState(false);
    const [paymentRecordData, setPaymentRecordData] = useState<{orderId: string, orderCode: string, remainingDebt: number} | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const canEdit = ['manager', 'admin', 'accountant'].includes(currentUser.role);

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

    const fetchOrders = useCallback(async () => {
        try {
            const response = await ordersApi.getAll({ status: 'completed' });
            setOrders(response.data.data?.orders || []);
        } catch (err) {
            console.error('Error fetching orders:', err);
        }
    }, []);

    const fetchInvoiceDetail = async (invoiceId: string) => {
        setLoadingDetail(true);
        try {
            const response = await invoicesApi.getById(invoiceId);
            const invoice = response.data.data?.invoice;
            if (invoice) {
                setSelectedInvoice(invoice);
                setShowInvoiceDetail(true);
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

    const handleStatusChange = async (id: string, status: string) => {
        try {
            await invoicesApi.updateStatus(id, status);
            toast.success(status === 'paid' ? 'Đã xác nhận thanh toán!' : 'Đã hủy hóa đơn!');
            fetchInvoices();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái');
        }
    };

    const handlePayButtonClick = (invoice: Invoice) => {
        if (!invoice.order) return;
        setPaymentRecordData({
            orderId: invoice.order_id,
            orderCode: invoice.order.order_code,
            remainingDebt: invoice.order.remaining_debt ?? invoice.total_amount
        });
        setShowPaymentRecordDialog(true);
    };

    const handlePaymentSuccess = async () => {
        if (selectedInvoice) {
            await handleStatusChange(selectedInvoice.id, 'paid');
            fetchInvoices();
        }
    };

    const filteredInvoices = useMemo(() => {
        if (!searchQuery) return invoices;
        const query = searchQuery.toLowerCase();
        return invoices.filter(inv =>
            inv.invoice_code.toLowerCase().includes(query) ||
            inv.customer?.name?.toLowerCase().includes(query) ||
            inv.customer?.phone?.includes(query)
        );
    }, [invoices, searchQuery]);

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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Hóa đơn</h1>
                        <p className="text-muted-foreground">Quản lý hóa đơn bán hàng</p>
                    </div>
                    <Button onClick={() => setShowCreateDialog(true)} className="w-full sm:w-auto shadow-sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Tạo hóa đơn
                    </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-600 font-medium truncate">Tổng cộng</p>
                                <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
                            </div>
                            <FileText className="h-8 w-8 text-blue-400 opacity-50" />
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-amber-600 font-medium truncate">Chờ TT</p>
                                <p className="text-2xl font-bold text-amber-700">{stats.pending + stats.draft}</p>
                            </div>
                            <Clock className="h-8 w-8 text-amber-400 opacity-50" />
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-600 font-medium truncate">Đã TT</p>
                                <p className="text-2xl font-bold text-green-700">{stats.paid}</p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-400 opacity-50" />
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-red-600 font-medium truncate">Đã hủy</p>
                                <p className="text-2xl font-bold text-red-700">{stats.cancelled}</p>
                            </div>
                            <XCircle className="h-8 w-8 text-red-400 opacity-50" />
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-primary/5 to-primary/15 border-primary/20">
                        <CardContent className="p-4">
                                <p className="text-sm text-primary font-medium truncate">Doanh thu</p>
                                <p className="text-lg font-bold text-primary truncate">{formatCurrency(stats.totalAmount)}</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row gap-4 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Tìm kiếm mã hóa đơn, khách hàng..."
                                    className="pl-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="Trạng thái" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả trạng thái</SelectItem>
                                    <SelectItem value="draft">Nháp</SelectItem>
                                    <SelectItem value="pending">Chờ thanh toán</SelectItem>
                                    <SelectItem value="paid">Đã thanh toán</SelectItem>
                                    <SelectItem value="cancelled">Đã hủy</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="rounded-md border overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr className="border-b">
                                        <th className="p-4 text-left font-medium">Mã hóa đơn</th>
                                        <th className="p-4 text-left font-medium">Khách hàng</th>
                                        <th className="p-4 text-left font-medium">Đơn hàng</th>
                                        <th className="p-4 text-right font-medium">Tổng tiền</th>
                                        <th className="p-4 text-center font-medium">Trạng thái</th>
                                        <th className="p-4 text-center font-medium">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInvoices.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-muted-foreground italic">
                                                Không có hóa đơn nào
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredInvoices.map((inv) => (
                                            <tr key={inv.id} className="border-b hover:bg-muted/30 transition-colors">
                                                <td className="p-4 font-medium">{inv.invoice_code}</td>
                                                <td className="p-4">
                                                    <div>
                                                        <p className="font-medium">{inv.customer?.name}</p>
                                                        <p className="text-xs text-muted-foreground">{inv.customer?.phone}</p>
                                                    </div>
                                                </td>
                                                <td className="p-4">{inv.order?.order_code || 'N/A'}</td>
                                                <td className="p-4 text-right font-bold text-primary">{formatCurrency(inv.total_amount)}</td>
                                                <td className="p-4 text-center">
                                                    <Badge variant={
                                                        inv.status === 'paid' ? 'success' :
                                                        inv.status === 'pending' ? 'warning' :
                                                        inv.status === 'draft' ? 'secondary' : 'danger'
                                                    }>{
                                                        inv.status === 'paid' ? 'Đã thanh toán' :
                                                        inv.status === 'pending' ? 'Chờ thanh toán' :
                                                        inv.status === 'draft' ? 'Nháp' : 'Đã hủy'
                                                    }</Badge>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <Button variant="ghost" size="sm" onClick={() => fetchInvoiceDetail(inv.id)}>
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <CreateInvoiceDialog
                open={showCreateDialog}
                onClose={() => setShowCreateDialog(false)}
                onSuccess={fetchInvoices}
                orders={orders}
            />

            <InvoiceDetailDialog
                invoice={selectedInvoice}
                open={showInvoiceDetail}
                onClose={() => setShowInvoiceDetail(false)}
                onStatusChange={handleStatusChange}
                onPayButtonClick={handlePayButtonClick}
                canEdit={canEdit}
            />

            {paymentRecordData && (
                <PaymentRecordDialog
                    open={showPaymentRecordDialog}
                    onOpenChange={setShowPaymentRecordDialog}
                    orderId={paymentRecordData.orderId}
                    orderCode={paymentRecordData.orderCode}
                    remainingDebt={paymentRecordData.remainingDebt}
                    initialAmount={paymentRecordData.remainingDebt}
                    initialContent="Thanh toán hết"
                    onSuccess={handlePaymentSuccess}
                />
            )}
        </>
    );
}
