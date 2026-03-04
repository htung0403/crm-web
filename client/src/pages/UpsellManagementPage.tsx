import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Sparkles,
    Loader2,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Eye,
    MessageSquare,
    User,
    Calendar,
    DollarSign,
    Package,
    Wrench
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { upsellTicketsApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export function UpsellManagementPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [tickets, setTickets] = useState<any[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<any>(null);
    const [processing, setProcessing] = useState(false);

    const loadTickets = async () => {
        setLoading(true);
        try {
            const response = await upsellTicketsApi.getAll();
            setTickets(response.data?.data || []);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Không thể tải danh sách ticket');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTickets();
    }, []);

    const handleApprove = async (id: string) => {
        setProcessing(true);
        try {
            const response = await upsellTicketsApi.approve(id);
            if (response.data.status === 'success') {
                toast.success(response.data.message || 'Đã duyệt ticket thành công');
                setSelectedTicket(null);
                loadTickets();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi duyệt ticket');
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async (id: string) => {
        setProcessing(true);
        try {
            const response = await upsellTicketsApi.reject(id);
            if (response.data.status === 'success') {
                toast.success(response.data.message || 'Đã từ chối ticket');
                setSelectedTicket(null);
                loadTickets();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi từ chối ticket');
        } finally {
            setProcessing(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Chờ duyệt</Badge>;
            case 'approved':
                return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Đã duyệt</Badge>;
            case 'rejected':
                return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">Đã từ chối</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (loading && tickets.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Sparkles className="h-7 w-7 text-indigo-600" />
                        Quản lý Duyệt Upsell
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Xem và phê duyệt các yêu cầu thêm dịch vụ/sản phẩm vào đơn hàng từ nhân viên Sale.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadTickets} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Tải lại
                </Button>
            </div>

            <div className="grid gap-4">
                {tickets.length === 0 ? (
                    <Card className="border-dashed py-12">
                        <CardContent className="flex flex-col items-center justify-center text-center">
                            <div className="bg-slate-100 p-4 rounded-full mb-4">
                                <Sparkles className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900">Chưa có yêu cầu nào</h3>
                            <p className="text-slate-500 max-w-sm">Tất cả các yêu cầu upsell sẽ được hiển thị ở đây để quản lý kiểm duyệt.</p>
                        </CardContent>
                    </Card>
                ) : (
                    tickets.map((ticket) => (
                        <Card key={ticket.id} className="overflow-hidden hover:shadow-md transition-shadow">
                            <div className="flex flex-col md:flex-row">
                                <div className="flex-1 p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-lg text-indigo-700">Ticket #{ticket.id.slice(0, 8)}</span>
                                                {getStatusBadge(ticket.status)}
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {formatDateTime(ticket.created_at)}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    Sale: {ticket.sales_user?.name || '—'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Tổng giá trị</span>
                                            <span className="text-xl font-black text-indigo-600">{formatCurrency(ticket.total_amount)}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 py-3 border-y border-slate-50 bg-slate-50/30 px-3 rounded-lg mb-4">
                                        <div className="flex items-center gap-2">
                                            <Package className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-medium">Đơn hàng: </span>
                                            <Button
                                                variant="link"
                                                className="p-0 h-auto text-indigo-600 font-bold"
                                                onClick={() => navigate(`/orders/${ticket.order_id}`)}
                                            >
                                                {ticket.order?.order_code || '—'}
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-slate-400" />
                                            <span className="text-sm font-medium">Khách hàng: </span>
                                            <span className="text-sm font-bold">{ticket.customer?.name || '—'}</span>
                                        </div>
                                    </div>

                                    {ticket.notes && (
                                        <div className="flex gap-2 mb-4 bg-amber-50/50 p-2 rounded border border-amber-100/50">
                                            <MessageSquare className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                            <p className="text-xs text-amber-800 leading-relaxed"><span className="font-bold">Ghi chú:</span> {ticket.notes}</p>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 gap-1"
                                            onClick={() => setSelectedTicket(ticket)}
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                            Chi tiết hạng mục
                                        </Button>
                                    </div>
                                </div>

                                {ticket.status === 'pending' && (
                                    <div className="bg-slate-50 md:w-48 border-l border-slate-100 p-5 flex flex-col justify-center gap-3">
                                        <Button
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 h-10 font-bold shadow-sm"
                                            onClick={() => handleApprove(ticket.id)}
                                            disabled={processing}
                                        >
                                            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                            Duyệt
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 h-10 font-bold"
                                            onClick={() => handleReject(ticket.id)}
                                            disabled={processing}
                                        >
                                            <XCircle className="h-4 w-4 mr-2" />
                                            Từ chối
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Detail Dialog */}
            <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="px-6 py-4 bg-indigo-600 text-white">
                        <DialogTitle className="flex items-center gap-2">
                            <Eye className="h-5 w-5" />
                            Chi tiết hạng mục Upsell
                        </DialogTitle>
                        <DialogDescription className="text-indigo-100">
                            Chi tiết các thay đổi được yêu cầu cho đơn hàng {selectedTicket?.order?.order_code}
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-1 p-6 bg-slate-50">
                        <div className="space-y-6">
                            {/* Customer Items */}
                            {selectedTicket?.data?.customer_items?.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                                        <Wrench className="h-4 w-4" />
                                        Sản phẩm khách gửi & Dịch vụ
                                    </h3>
                                    <div className="space-y-3">
                                        {selectedTicket.data.customer_items.map((item: any, idx: number) => (
                                            <Card key={idx} className="border-none shadow-sm overflow-hidden bg-white">
                                                <div className="bg-slate-100/50 px-3 py-1.5 border-b text-[10px] font-bold text-slate-500 uppercase">
                                                    Hạng mục #{idx + 1}: {item.name} ({item.type})
                                                </div>
                                                <CardContent className="p-3">
                                                    <div className="space-y-2">
                                                        {item.services.map((svc: any, sIdx: number) => (
                                                            <div key={sIdx} className="flex items-center justify-between text-sm py-1 border-b border-slate-50 last:border-0">
                                                                <span className="font-medium">{svc.name}</span>
                                                                <span className="font-bold text-indigo-600">{formatCurrency(svc.price)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Sale Items */}
                            {selectedTicket?.data?.sale_items?.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                                        <Package className="h-4 w-4" />
                                        Sản phẩm bán thêm (Retail)
                                    </h3>
                                    <Card className="border-none shadow-sm overflow-hidden bg-white">
                                        <CardContent className="p-0">
                                            <div className="divide-y divide-slate-50">
                                                {selectedTicket.data.sale_items.map((item: any, idx: number) => (
                                                    <div key={idx} className="p-4 flex items-center justify-between">
                                                        <div className="space-y-1">
                                                            <p className="text-sm font-bold">{item.name}</p>
                                                            <p className="text-xs text-slate-500">Số lượng: {item.quantity}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs text-slate-400">Đơn giá: {formatCurrency(item.unit_price)}</p>
                                                            <p className="text-sm font-bold text-emerald-600">{formatCurrency(item.unit_price * item.quantity)}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                                <span className="text-sm font-bold text-indigo-900 uppercase tracking-tight">Tổng số tiền tăng thêm:</span>
                                <span className="text-2xl font-black text-indigo-700">{formatCurrency(selectedTicket?.total_amount)}</span>
                            </div>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="px-6 py-4 bg-white border-t gap-3 flex sm:justify-end">
                        <Button variant="outline" onClick={() => setSelectedTicket(null)}>
                            Đóng
                        </Button>
                        {selectedTicket?.status === 'pending' && (
                            <>
                                <Button
                                    variant="outline"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => handleReject(selectedTicket.id)}
                                    disabled={processing}
                                >
                                    Từ chối
                                </Button>
                                <Button
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => handleApprove(selectedTicket.id)}
                                    disabled={processing}
                                >
                                    Phê duyệt & Cập nhật đơn hàng
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
