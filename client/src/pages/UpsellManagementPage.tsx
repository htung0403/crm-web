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
    Wrench,
    Truck,
    Clock,
    AlertCircle,
    ChevronRight,
    Search,
    Banknote
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { upsellTicketsApi, requestsApi, leaveRequestsApi, transactionsApi } from '@/lib/api';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export function UpsellManagementPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('upsell');
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    // Data states
    const [upsellTickets, setUpsellTickets] = useState<any[]>([]);
    const [accessoryRequests, setAccessoryRequests] = useState<any[]>([]);
    const [partnerRequests, setPartnerRequests] = useState<any[]>([]);
    const [extensionRequests, setExtensionRequests] = useState<any[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
    const [pendingVouchers, setPendingVouchers] = useState<any[]>([]);
    const [totalAccessoriesCount, setTotalAccessoriesCount] = useState(0);

    // UI States
    const [selectedTicket, setSelectedTicket] = useState<any>(null);
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [rejectItem, setRejectItem] = useState<{ id: string; type: 'upsell' | 'accessory' | 'partner' | 'extension' | 'leave' | 'voucher' } | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const [upsellRes, accRes, partRes, extRes, leaveRes, voucherRes] = await Promise.all([
                upsellTicketsApi.getAll(),
                requestsApi.getAccessories(),
                requestsApi.getPartners(),
                requestsApi.getExtensions(),
                leaveRequestsApi.getAll({ role: user?.role }),
                transactionsApi.getAll({ status: 'pending' })
            ]);

            setUpsellTickets(upsellRes.data?.data?.filter((t: any) => t.status === 'pending') || []);
            setAccessoryRequests(accRes.data?.data?.filter((a: any) => a.status === 'requested' || a.status === 'need_buy') || []);
            setPartnerRequests(partRes.data?.data?.filter((p: any) => p.status === 'requested' || p.status === 'ship_to_partner') || []);
            setExtensionRequests(extRes.data?.data?.filter((e: any) => e.status === 'requested') || []);
            setLeaveRequests(leaveRes.data?.filter((l: any) => l.status === 'pending') || []);
            setPendingVouchers(voucherRes.data?.data?.transactions || []);
            setTotalAccessoriesCount(accRes.data?.data?.length || 0);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Không thể tải danh sách phê duyệt');
        } finally {
            setLoading(false);
        }
    };

    const getOrderCode = (req: any) => {
        if (!req) return '—';
        return req.order?.order_code ||
            req.order_code ||
            req.metadata?.order_code ||
            req.order_item?.order?.order_code ||
            req.order_product?.order?.order_code ||
            req.order_product_service?.order_product?.order?.order_code ||
            '—';
    };

    const getOrderId = (req: any) => {
        if (!req) return '';
        return req.order_id ||
            req.order?.id ||
            req.order_item?.order?.id ||
            req.order_product?.order?.id ||
            req.order_product_service?.order_product?.order?.id ||
            req.metadata?.order_id;
    };

    useEffect(() => {
        loadData();
    }, []);

    // Handlers
    const handleApproveUpsell = async (id: string) => {
        setProcessing(true);
        try {
            await upsellTicketsApi.approve(id);
            toast.success('Đã duyệt yêu cầu Upsell');
            loadData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi duyệt');
        } finally {
            setProcessing(false);
        }
    };

    const handleApproveAccessory = async (id: string) => {
        setProcessing(true);
        try {
            await requestsApi.updateAccessory(id, { status: 'need_buy' });
            toast.success('Đã duyệt yêu cầu mua phụ kiện');
            loadData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi duyệt');
        } finally {
            setProcessing(false);
        }
    };

    const handleApprovePartner = async (id: string) => {
        setProcessing(true);
        try {
            await requestsApi.updatePartner(id, { status: 'ship_to_partner' });
            toast.success('Đã duyệt yêu cầu gửi đối tác');
            loadData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi duyệt');
        } finally {
            setProcessing(false);
        }
    };

    const handleApproveExtension = async (id: string, new_due_at?: string) => {
        setProcessing(true);
        try {
            await requestsApi.updateExtension(id, { status: 'manager_approved', new_due_at });
            toast.success('Đã duyệt yêu cầu gia hạn');
            loadData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi duyệt');
        } finally {
            setProcessing(false);
        }
    };

    const handleApproveLeave = async (id: string) => {
        if (!user) return;
        setProcessing(true);
        try {
            await leaveRequestsApi.updateStatus(id, 'approved', user.id);
            toast.success('Đã duyệt yêu cầu nghỉ/muộn');
            loadData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi duyệt');
        } finally {
            setProcessing(false);
        }
    };

    const handleApproveVoucher = async (id: string) => {
        setProcessing(true);
        try {
            await transactionsApi.updateStatus(id, 'approved');
            toast.success('Đã duyệt phiếu thu/chi');
            loadData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi duyệt');
        } finally {
            setProcessing(false);
        }
    };

    const onRejectClick = (id: string, type: 'upsell' | 'accessory' | 'partner' | 'extension' | 'leave' | 'voucher') => {
        setRejectItem({ id, type });
        setRejectionReason('');
        setShowRejectDialog(true);
    };

    const handleConfirmReject = async () => {
        if (!rejectItem) return;
        if (!rejectionReason.trim()) {
            toast.error('Vui lòng nhập lý do từ chôi');
            return;
        }

        setProcessing(true);
        try {
            switch (rejectItem.type) {
                case 'upsell':
                    await upsellTicketsApi.reject(rejectItem.id);
                    break;
                case 'accessory':
                    await requestsApi.updateAccessory(rejectItem.id, { status: 'rejected', notes: rejectionReason });
                    break;
                case 'partner':
                    await requestsApi.updatePartner(rejectItem.id, { status: 'rejected', notes: rejectionReason });
                    break;
                case 'extension':
                    await requestsApi.updateExtension(rejectItem.id, { status: 'rejected', customer_result: rejectionReason });
                    break;
                case 'leave':
                    await leaveRequestsApi.updateStatus(rejectItem.id, 'rejected', user!.id);
                    break;
                case 'voucher':
                    await transactionsApi.updateStatus(rejectItem.id, 'cancelled');
                    break;
            }
            toast.success('Đã từ chối yêu cầu');
            setShowRejectDialog(false);
            loadData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi từ chối');
        } finally {
            setProcessing(false);
        }
    };

    const emptyState = (title: string, desc: string, icon: React.ReactNode) => (
        <Card className="border-dashed py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="bg-slate-100 p-4 rounded-full mb-4">
                    {icon}
                </div>
                <h3 className="text-lg font-medium text-slate-900">{title}</h3>
                <p className="text-slate-500 max-w-sm">{desc}</p>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <CheckCircle2 className="h-7 w-7 text-indigo-600" />
                        Mục phê duyệt
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Trung tâm phê duyệt tập trung cho các yêu cầu Upsell, Phụ kiện, Đối tác, Gia hạn và Nghỉ/Muộn.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Tải lại ({upsellTickets.length + accessoryRequests.length + partnerRequests.length + extensionRequests.length + pendingVouchers.length})
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-slate-100 p-1 h-12 w-full justify-start overflow-x-auto no-scrollbar md:w-auto md:overflow-visible rounded-xl mb-4">
                    <TabsTrigger value="upsell" className="gap-2 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Sparkles className="h-4 w-4" />
                        Duyệt Upsell
                        {upsellTickets.length > 0 && <Badge variant="secondary" className="ml-1 bg-indigo-100 text-indigo-700">{upsellTickets.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="accessory" className="gap-2 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Package className="h-4 w-4" />
                        Phụ kiện
                        {accessoryRequests.length > 0 && <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-700">{accessoryRequests.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="partner" className="gap-2 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Truck className="h-4 w-4" />
                        Đối tác
                        {partnerRequests.length > 0 && <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700">{partnerRequests.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="extension" className="gap-2 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Clock className="h-4 w-4" />
                        Gia hạn
                        {extensionRequests.length > 0 && <Badge variant="secondary" className="ml-1 bg-purple-100 text-purple-700">{extensionRequests.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="leave" className="gap-2 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Calendar className="h-4 w-4" />
                        Nghỉ/Muộn
                        {leaveRequests.length > 0 && <Badge variant="secondary" className="ml-1 bg-rose-100 text-rose-700">{leaveRequests.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="voucher" className="gap-2 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Banknote className="h-4 w-4" />
                        Thu Chi
                        {pendingVouchers.length > 0 && <Badge variant="secondary" className="ml-1 bg-green-100 text-green-700">{pendingVouchers.length}</Badge>}
                    </TabsTrigger>
                </TabsList>

                {/* Upsell Tab */}
                <TabsContent value="upsell" className="mt-0">
                    <div className="grid gap-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
                        ) : upsellTickets.length === 0 ? (
                            emptyState("Chưa có yêu cầu Upsell", "Tất cả các yêu cầu thêm dịch vụ/sản phẩm mới sẽ hiện ở đây.", <Sparkles className="h-8 w-8 text-slate-400" />)
                        ) : (
                            upsellTickets.map((ticket) => (
                                <Card key={ticket.id} className="overflow-hidden hover:shadow-md transition-shadow border-indigo-100">
                                    <div className="flex flex-col md:flex-row">
                                        <div className="flex-1 p-5">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-lg text-indigo-700 text-sm">Ticket #{ticket.id.slice(0, 8)}</span>
                                                        <Badge className="bg-amber-50 text-amber-600 border-amber-200 uppercase text-[10px]">Chờ duyệt</Badge>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-slate-500">
                                                        <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDateTime(ticket.created_at)}</div>
                                                        <div className="flex items-center gap-1"><User className="h-3 w-3" /> Sale: {ticket.sales_user?.name || '—'}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Tổng giá trị</span>
                                                    <span className="text-xl font-black text-indigo-600">{formatCurrency(ticket.total_amount)}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-4 py-3 bg-slate-50/50 px-3 rounded-lg border border-slate-100 mb-4">
                                                <div className="flex items-center gap-2"><Package className="h-3.5 w-3.5 text-slate-400" /> <span className="text-xs font-medium">Đơn hàng: </span> <Button variant="link" className="p-0 h-auto text-indigo-600 font-bold text-xs" onClick={() => navigate(`/orders/${getOrderId(ticket)}`)}>{getOrderCode(ticket)}</Button></div>
                                                <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-slate-400" /> <span className="text-xs font-medium">Khách hàng: </span> <span className="text-xs font-bold">{ticket.customer?.name || '—'}</span></div>
                                            </div>
                                            <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1 rounded-lg" onClick={() => setSelectedTicket(ticket)}><Eye className="h-3.5 w-3.5" /> Xem chi tiết hạng mục</Button>
                                        </div>
                                        <div className="bg-slate-50 md:w-32 border-l border-slate-100 p-4 flex flex-col justify-center gap-2">
                                            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-9 text-xs font-bold" onClick={() => handleApproveUpsell(ticket.id)} disabled={processing}>Duyệt</Button>
                                            <Button variant="outline" className="w-full text-red-600 border-red-200 h-9 text-xs font-bold" onClick={() => onRejectClick(ticket.id, 'upsell')} disabled={processing}>Từ chối</Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>

                {/* Accessory Tab */}
                <TabsContent value="accessory" className="mt-0">
                    <div className="grid gap-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
                        ) : accessoryRequests.length === 0 ? (
                            emptyState("Chưa có yêu cầu Phụ kiện", "Kỹ thuật chưa gửi yêu cầu mua linh kiện/phụ kiện mới.", <Package className="h-8 w-8 text-slate-400" />)
                        ) : (
                            accessoryRequests.map((req) => (
                                <Card key={req.id} className="overflow-hidden hover:shadow-md transition-shadow border-blue-100">
                                    <div className="flex flex-col md:flex-row">
                                        <div className="flex-1 p-5">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="space-y-1">
                                                    <h3 className="font-bold text-base text-slate-800">{req.metadata?.item_name || 'Phụ kiện không tên'}</h3>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                                        <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDateTime(req.created_at)}</div>
                                                        <div className="flex items-center gap-1"><User className="h-3 w-3" /> KT: {req.technician?.name || '—'}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Giá</span>
                                                    <span className="text-lg font-black text-blue-600">{req.metadata?.price_estimate ? formatCurrency(Number(req.metadata.price_estimate.replace(/\D/g, ''))) : '—'}</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-3 bg-blue-50/30 px-3 rounded-lg border border-blue-50 mb-3">
                                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Số lượng</p><p className="text-sm font-black text-slate-700">{req.metadata?.quantity || '1'}</p></div>
                                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Đơn hàng</p><Button variant="link" className="p-0 h-auto text-blue-600 font-bold text-xs" onClick={() => navigate(`/orders/${getOrderId(req)}`)}>{getOrderCode(req)}</Button></div>
                                                <div className="col-span-2 md:col-span-1"><p className="text-[10px] font-bold text-slate-400 uppercase">Ghi chú KT</p><p className="text-xs text-slate-600 italic line-clamp-1">{req.notes || 'Không có'}</p></div>
                                            </div>
                                            {req.metadata?.photos?.length > 0 && (
                                                <div className="flex gap-2 overflow-x-auto pb-1">
                                                    {req.metadata.photos.map((url: string, i: number) => (
                                                        <img key={i} src={url} alt="PK" className="h-10 w-10 object-cover rounded border" onClick={() => window.open(url, '_blank')} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-slate-50 md:w-32 border-l border-slate-100 p-4 flex flex-col justify-center gap-2">
                                            <Button className="w-full bg-blue-600 hover:bg-blue-700 h-9 text-xs font-bold" onClick={() => handleApproveAccessory(req.id)} disabled={processing}>Duyệt</Button>
                                            <Button variant="outline" className="w-full text-red-600 border-red-200 h-9 text-xs font-bold" onClick={() => onRejectClick(req.id, 'accessory')} disabled={processing}>Từ chối</Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>

                {/* Partner Tab */}
                <TabsContent value="partner" className="mt-0">
                    <div className="grid gap-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-600" /></div>
                        ) : partnerRequests.length === 0 ? (
                            emptyState("Chưa có yêu cầu Đối tác", "Kỹ thuật chưa gửi yêu cầu gia công ngoài.", <Truck className="h-8 w-8 text-slate-400" />)
                        ) : (
                            partnerRequests.map((req) => (
                                <Card key={req.id} className="overflow-hidden hover:shadow-md transition-shadow border-amber-100">
                                    <div className="flex flex-col md:flex-row">
                                        <div className="flex-1 p-5">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="space-y-1">
                                                    <h3 className="font-bold text-base text-slate-800">{req.order_item?.item_name || 'Hạng mục gửi đối tác'}</h3>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                                        <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDateTime(req.created_at)}</div>
                                                        <div className="flex items-center gap-1"><User className="h-3 w-3" /> KT: {req.technician?.name || '—'}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Trạng thái</span>
                                                    <Badge className="bg-amber-50 text-amber-600 border-amber-200">Chờ duyệt</Badge>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 py-3 bg-amber-50/30 px-3 rounded-lg border border-amber-100 mb-3">
                                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Đơn hàng</p><Button variant="link" className="p-0 h-auto text-amber-600 font-bold text-xs" onClick={() => navigate(`/orders/${getOrderId(req)}`)}>{getOrderCode(req)}</Button></div>
                                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Lý do / Mô tả</p><p className="text-xs text-slate-600 italic line-clamp-2">{req.notes || 'Không có ghi chú'}</p></div>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 md:w-32 border-l border-slate-100 p-4 flex flex-col justify-center gap-2">
                                            <Button className="w-full bg-amber-600 hover:bg-amber-700 h-9 text-xs font-bold shadow-sm" onClick={() => handleApprovePartner(req.id)} disabled={processing}>Duyệt</Button>
                                            <Button variant="outline" className="w-full text-red-600 border-red-200 h-9 text-xs font-bold" onClick={() => onRejectClick(req.id, 'partner')} disabled={processing}>Từ chối</Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>

                {/* Extension Tab */}
                <TabsContent value="extension" className="mt-0">
                    <div className="grid gap-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>
                        ) : extensionRequests.length === 0 ? (
                            emptyState("Chưa có yêu cầu Gia hạn", "Toàn bộ yêu cầu gia hạn đã được xử lý.", <Clock className="h-8 w-8 text-slate-400" />)
                        ) : (
                            extensionRequests.map((req) => (
                                <Card key={req.id} className="overflow-hidden hover:shadow-md transition-shadow border-purple-100">
                                    <div className="flex flex-col md:flex-row">
                                        <div className="flex-1 p-5">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="space-y-1">
                                                    <h3 className="font-bold text-base text-slate-800">{req.order_item?.item_name || 'Hạng mục gia hạn'}</h3>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                                        <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDateTime(req.created_at)}</div>
                                                        <div className="flex items-center gap-1"><User className="h-3 w-3" /> KT: {req.requested_by_user?.name || req.technician?.name || req.requested_by || '—'}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Hạn mới đề xuất</span>
                                                    <span className="text-base font-black text-purple-600">{formatDateTime(req.new_due_at)}</span>
                                                </div>
                                            </div>
                                            <div className="py-3 bg-purple-50/30 px-3 rounded-lg border border-purple-100 mb-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge variant="outline" className="bg-white text-indigo-700 text-[10px] h-5 cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/orders/${getOrderId(req)}`)}>Đơn: {getOrderCode(req)}</Badge>
                                                    <Badge variant="outline" className="bg-white text-emerald-700 text-[10px] h-5">Hạn hiện tại: {formatDateTime(req.order_item?.due_at)}</Badge>
                                                </div>
                                                <div className="flex gap-2">
                                                    <AlertCircle className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                                                    <p className="text-xs text-slate-600 leading-relaxed"><span className="font-bold">Lý do xin gia hạn:</span> {req.reason}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 md:w-40 border-l border-slate-100 p-4 flex flex-col justify-center gap-2">
                                            <Button className="w-full bg-purple-600 hover:bg-purple-700 h-9 text-xs font-bold shadow-sm" onClick={() => handleApproveExtension(req.id, req.new_due_at)} disabled={processing}>Duyệt</Button>
                                            <Button variant="outline" className="w-full text-red-600 border-red-200 h-9 text-xs font-bold" onClick={() => onRejectClick(req.id, 'extension')} disabled={processing}>Từ chối</Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>

                {/* Leave Requests Tab */}
                <TabsContent value="leave" className="mt-0">
                    <div className="grid gap-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-rose-600" /></div>
                        ) : leaveRequests.length === 0 ? (
                            emptyState("Chưa có yêu cầu Nghỉ/Muộn", "Tất cả yêu cầu xin nghỉ hoặc đi muộn đã được xử lý.", <Calendar className="h-8 w-8 text-slate-400" />)
                        ) : (
                            leaveRequests.map((req) => (
                                <Card key={req.id} className="overflow-hidden hover:shadow-md transition-shadow border-rose-100">
                                    <div className="flex flex-col md:flex-row">
                                        <div className="flex-1 p-5">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="space-y-1">
                                                    <h3 className="font-bold text-base text-slate-800">{req.type === 'leave' ? 'Yêu cầu xin nghỉ' : 'Yêu cầu xin đi muộn'}</h3>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                                        <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDateTime(req.created_at)}</div>
                                                        <div className="flex items-center gap-1"><User className="h-3 w-3" /> NV: {req.users?.name || '—'}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <Badge className={req.type === 'leave' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-blue-50 text-blue-600 border-blue-200'}>
                                                        {req.sub_type === 'annual' ? 'Nghỉ phép' :
                                                            req.sub_type === 'unexpected_leave' ? 'Nghỉ đột xuất' :
                                                                req.sub_type === 'planned_late' ? 'Muộn có kế hoạch' : 'Muộn đột xuất'}
                                                    </Badge>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3 bg-rose-50/30 px-3 rounded-lg border border-rose-100 mb-3">
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Thời gian</p>
                                                    <p className="text-xs font-medium text-slate-700">
                                                        Từ: {new Date(req.start_time).toLocaleString('vi-VN')}
                                                        {req.end_time && <span><br />Đến: {new Date(req.end_time).toLocaleString('vi-VN')}</span>}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Lý do</p>
                                                    <p className="text-xs text-slate-600 italic line-clamp-2">{req.reason || 'Không có lý do'}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 md:w-32 border-l border-slate-100 p-4 flex flex-col justify-center gap-2">
                                            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-9 text-xs font-bold" onClick={() => handleApproveLeave(req.id)} disabled={processing}>Duyệt</Button>
                                            <Button variant="outline" className="w-full text-rose-600 border-rose-200 h-9 text-xs font-bold" onClick={() => onRejectClick(req.id, 'leave')} disabled={processing}>Từ chối</Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>

                {/* Vouchers Tab */}
                <TabsContent value="voucher" className="mt-0">
                    <div className="grid gap-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-green-600" /></div>
                        ) : pendingVouchers.length === 0 ? (
                            emptyState("Chưa có phiếu Thu/Chi", "Tất cả các phiếu thu/chi đã được xử lý hoặc chưa được tạo.", <Banknote className="h-8 w-8 text-slate-400" />)
                        ) : (
                            pendingVouchers.map((voucher) => (
                                <Card key={voucher.id} className={cn(
                                    "overflow-hidden hover:shadow-md transition-shadow",
                                    voucher.type === 'income' ? "border-emerald-100" : "border-rose-100"
                                )}>
                                    <div className="flex flex-col md:flex-row">
                                        <div className="flex-1 p-5">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-base text-slate-800">{voucher.code}</h3>
                                                        <Badge className={cn(
                                                            "uppercase text-[10px]",
                                                            voucher.type === 'income' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                                                        )}>
                                                            {voucher.type === 'income' ? 'Phiếu thu' : 'Phiếu chi'}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                                        <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(voucher.date).toLocaleDateString('vi-VN')}</div>
                                                        <div className="flex items-center gap-1"><User className="h-3 w-3" /> Tạo bởi: {voucher.created_by_user?.name || '—'}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Số tiền</span>
                                                    <span className={cn(
                                                        "text-xl font-black",
                                                        voucher.type === 'income' ? "text-emerald-600" : "text-rose-600"
                                                    )}>
                                                        {voucher.type === 'income' ? '+' : '-'}{formatCurrency(voucher.amount)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-3 bg-slate-50 px-3 rounded-lg border border-slate-100 mb-3">
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Hạng mục</p>
                                                    <p className="text-sm font-black text-slate-700">{voucher.category}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Phương thức</p>
                                                    <p className="text-sm font-bold text-slate-700 capitalize">
                                                        {voucher.payment_method === 'cash' ? 'Tiền mặt' :
                                                         voucher.payment_method === 'transfer' ? 'Chuyển khoản' : 'Zalo Pay'}
                                                    </p>
                                                </div>
                                                <div className="col-span-2 md:col-span-1">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Đơn hàng</p>
                                                    <p className="text-sm font-bold text-indigo-600">{voucher.order_code || '—'}</p>
                                                </div>
                                            </div>

                                            {voucher.notes && (
                                                <div className="flex gap-2 mb-3">
                                                    <MessageSquare className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                                    <p className="text-xs text-slate-600 italic line-clamp-2">{voucher.notes}</p>
                                                </div>
                                            )}

                                            {voucher.image_url && (
                                                <div className="mt-2">
                                                    <img
                                                        src={voucher.image_url}
                                                        alt="Minh chứng"
                                                        className="h-12 w-20 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => window.open(voucher.image_url, '_blank')}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-slate-50 md:w-32 border-l border-slate-100 p-4 flex flex-col justify-center gap-2">
                                            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-9 text-xs font-bold" onClick={() => handleApproveVoucher(voucher.id)} disabled={processing}>Duyệt</Button>
                                            <Button variant="outline" className="w-full text-rose-600 border-rose-200 h-9 text-xs font-bold" onClick={() => onRejectClick(voucher.id, 'voucher')} disabled={processing}>Từ chối</Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Upsell Detail Dialog */}
            <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="px-6 py-4 bg-indigo-600 text-white">
                        <DialogTitle className="flex items-center gap-2">
                            <Eye className="h-5 w-5" />
                            Chi tiết hạng mục Upsell
                        </DialogTitle>
                        <DialogDescription className="text-indigo-100">
                            Chi tiết các thay đổi được yêu cầu cho đơn hàng {getOrderCode(selectedTicket)}
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
                        <Button variant="outline" onClick={() => setSelectedTicket(null)}>Đóng</Button>
                        <Button variant="outline" className="text-red-600 border-red-200" onClick={() => onRejectClick(selectedTicket.id, 'upsell')} disabled={processing}>Từ chối</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 font-bold" onClick={() => handleApproveUpsell(selectedTicket.id)} disabled={processing}>Phê duyệt & Cập nhật đơn hàng</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Reason Dialog */}
            <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="p-6 pb-4 bg-red-50/50 border-b">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-red-700">
                            <XCircle className="w-6 h-6" />
                            Từ chối yêu cầu
                        </DialogTitle>
                        <DialogDescription>Nhập lý do tại sao bạn không chấp thuận yêu cầu này.</DialogDescription>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-bold text-slate-700">Lý do từ chối *</Label>
                            <Textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Ví dụ: Giá nhập quá cao, Không cần thiết cho đơn hàng này..."
                                className="min-h-[120px] rounded-xl focus:ring-red-500/20 border-slate-200"
                            />
                        </div>
                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 flex gap-2">
                            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-amber-800">Thông báo từ chối và lý do sẽ được gửi trực tiếp đến nhân viên liên quan và hiển thị tại chi tiết đơn hàng.</p>
                        </div>
                    </div>
                    <DialogFooter className="p-6 pt-2 bg-slate-50 border-t gap-3 flex sm:justify-end">
                        <Button variant="ghost" onClick={() => setShowRejectDialog(false)} disabled={processing}>Hủy</Button>
                        <Button className="bg-red-600 hover:bg-red-700 font-bold px-6" onClick={handleConfirmReject} disabled={processing}>
                            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Xác nhận từ chối
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
