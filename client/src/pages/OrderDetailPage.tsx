import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Package, Gift, Sparkles, ShoppingBag, CreditCard, Printer,
    Wrench, Loader2, Calendar, User as UserIcon, FileText, Clock, CheckCircle, XCircle,
    ArrowRight, Building2, Users, Phone, CircleDot, UserPlus, Timer, Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { ordersApi, orderItemsApi } from '@/lib/api';
import type { Order, OrderItem } from '@/hooks/useOrders';
import type { User } from '@/types';
import { useOrders } from '@/hooks/useOrders';
import { useUsers } from '@/hooks/useUsers';
import { columns } from '@/components/orders/constants';
import { WorkflowStepsTimeline } from "@/components/orders/WorkflowStepsTimeline";
import { PrintQRDialog } from '@/components/orders/PrintQRDialog';
import { EditOrderDialog } from '@/components/orders/EditOrderDialog';
import { PaymentDialog } from '@/components/orders/PaymentDialog';
import { useProducts } from '@/hooks/useProducts';
import { usePackages } from '@/hooks/usePackages';
import { useVouchers } from '@/hooks/useVouchers';
import { useDepartments } from '@/hooks/useDepartments';

export function OrderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { updateOrderStatus, updateOrder, fetchOrders } = useOrders();
    const { products, services, fetchProducts, fetchServices } = useProducts();
    const { packages, fetchPackages } = usePackages();
    const { vouchers, fetchVouchers } = useVouchers();
    const { users: technicians, fetchTechnicians } = useUsers();
    const { departments, fetchDepartments } = useDepartments();

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPrintDialog, setShowPrintDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);

    // Assign technician dialog state
    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
    const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('');
    const [assignLoading, setAssignLoading] = useState(false);

    // Workflow steps for department kanban
    const [allWorkflowSteps, setAllWorkflowSteps] = useState<any[]>([]);
    const [stepsLoading, setStepsLoading] = useState(false);

    // Reload order data
    const reloadOrder = useCallback(async () => {
        if (!id) return;
        try {
            const response = await ordersApi.getById(id);
            const orderData = response.data?.data?.order;
            if (orderData && orderData.id) {
                setOrder(orderData);
            }
        } catch {
            console.error('Error reloading order');
        }
    }, [id]);

    useEffect(() => {
        if (!id) {
            navigate('/orders');
            return;
        }

        const fetchOrder = async () => {
            setLoading(true);
            try {
                const response = await ordersApi.getById(id);
                const orderData = response.data?.data?.order;
                if (orderData && orderData.id) {
                    setOrder(orderData);
                } else {
                    toast.error('Không tìm thấy đơn hàng');
                    navigate('/orders');
                }
            } catch {
                toast.error('Lỗi khi tải thông tin đơn hàng');
                navigate('/orders');
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
        fetchProducts({ status: 'active' });
        fetchServices({ status: 'active' });
        fetchPackages();
        fetchVouchers();
        fetchTechnicians();
    }, [id, navigate, fetchProducts, fetchServices, fetchPackages, fetchVouchers, fetchTechnicians]);

    // Fetch departments
    useEffect(() => {
        fetchDepartments({ status: 'active' });
    }, [fetchDepartments]);

    // Fetch all workflow steps for this order's items
    useEffect(() => {
        const fetchAllSteps = async () => {
            if (!order?.items || order.items.length === 0) return;

            setStepsLoading(true);
            try {
                const allSteps: any[] = [];
                for (const item of order.items) {
                    if (item.item_type === 'service') {
                        try {
                            const response = await orderItemsApi.getSteps(item.id);
                            if (response.data?.data) {
                                const stepsWithItem = (response.data.data as any[]).map(step => ({
                                    ...step,
                                    item_name: item.item_name,
                                    item_id: item.id
                                }));
                                allSteps.push(...stepsWithItem);
                            }
                        } catch (e) {
                            console.error('Error fetching steps for item:', item.id, e);
                        }
                    }
                }
                setAllWorkflowSteps(allSteps);
            } catch (error) {
                console.error('Error fetching workflow steps:', error);
            } finally {
                setStepsLoading(false);
            }
        };

        fetchAllSteps();
    }, [order?.items]);

    // Auto-refresh when window regains focus (e.g., after completing task in another tab)
    useEffect(() => {
        const handleFocus = () => {
            reloadOrder();
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [reloadOrder]);

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

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'completed': return 'success';
            case 'cancelled': return 'danger';
            case 'processing': return 'warning';
            case 'confirmed': return 'purple';
            default: return 'info';
        }
    };

    // Format elapsed time for timer display
    const formatElapsedTime = (startTime: string | undefined) => {
        if (!startTime) return '--:--:--';
        const start = new Date(startTime).getTime();
        const now = Date.now();
        const elapsed = Math.max(0, now - start);
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // Open assign dialog
    const handleOpenAssignDialog = (item: OrderItem) => {
        setSelectedItem(item);
        setSelectedTechnicianId('');
        setShowAssignDialog(true);
    };

    // Assign technician to item
    const handleAssignTechnician = async () => {
        if (!selectedItem || !selectedTechnicianId) return;

        setAssignLoading(true);
        try {
            await orderItemsApi.assignTechnician(selectedItem.id, selectedTechnicianId);
            toast.success('Đã phân công kỹ thuật viên thành công!');
            await reloadOrder();
            setShowAssignDialog(false);
        } catch {
            toast.error('Lỗi khi phân công kỹ thuật viên');
        } finally {
            setAssignLoading(false);
        }
    };

    const handleUpdateOrder = async (orderId: string, data: {
        items: Array<{ type: string; item_id: string; name: string; quantity: number; unit_price: number }>;
        notes?: string;
        discount?: number;
    }) => {
        try {
            await updateOrder(orderId, data);
            toast.success('Đã cập nhật đơn hàng!');
            // Refetch order data
            const response = await ordersApi.getById(orderId);
            if (response.data?.data?.order) {
                setOrder(response.data.data.order);
            }
            setShowEditDialog(false);
        } catch {
            toast.error('Lỗi khi cập nhật đơn hàng');
        }
    };

    const handlePaymentSuccess = async () => {
        try {
            if (order) {
                await updateOrderStatus(order.id, 'completed');
                toast.success('Thanh toán thành công! Đơn hàng đã hoàn thành.');
                // Refetch order data
                const response = await ordersApi.getById(order.id);
                if (response.data?.data?.order) {
                    setOrder(response.data.data.order);
                }
                await fetchOrders();
            }
        } catch {
            toast.error('Lỗi khi cập nhật trạng thái đơn hàng');
        } finally {
            setShowPaymentDialog(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                    <p className="mt-4 text-muted-foreground">Đang tải thông tin đơn hàng...</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Không tìm thấy đơn hàng</h2>
                    <p className="text-muted-foreground mb-4">Đơn hàng này không tồn tại hoặc đã bị xóa.</p>
                    <Button onClick={() => navigate('/orders')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Quay lại
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-3">
                                <ShoppingBag className="h-6 w-6 text-primary" />
                                {order.order_code}
                                <Badge variant={getStatusVariant(order.status) as 'success' | 'danger' | 'warning' | 'info' | 'purple'}>
                                    {columns.find(c => c.id === order.status)?.title}
                                </Badge>
                            </h1>
                            <p className="text-muted-foreground">Chi tiết đơn hàng</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowPrintDialog(true)}>
                            <Printer className="h-4 w-4 mr-2" />
                            In phiếu
                        </Button>
                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                            <Button variant="outline" onClick={() => setShowEditDialog(true)}>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Sửa đơn
                            </Button>
                        )}
                        {order.status === 'processing' && (
                            <Button
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => setShowPaymentDialog(true)}
                            >
                                <CreditCard className="h-4 w-4 mr-2" />
                                Thanh toán
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tabs for Detail and Workflow */}
                <Tabs defaultValue="detail" className="w-full">
                    <TabsList className="mb-4">
                        <TabsTrigger value="detail" className="gap-2">
                            <FileText className="h-4 w-4" />
                            Chi tiết
                        </TabsTrigger>
                        <TabsTrigger value="workflow" className="gap-2">
                            <CircleDot className="h-4 w-4" />
                            Tiến trình
                        </TabsTrigger>
                        <TabsTrigger value="workflow-steps" className="gap-2">
                            <Layers className="h-4 w-4" />
                            Quy trình
                        </TabsTrigger>
                    </TabsList>

                    {/* Detail Tab */}
                    <TabsContent value="detail">
                        {/* Main Content - 2 Column Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Column - Order Items (2/3) */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Customer Info */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <UserIcon className="h-4 w-4 text-primary" />
                                            Thông tin khách hàng
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-14 w-14">
                                                <AvatarFallback className="bg-primary text-white text-lg">
                                                    {order.customer?.name?.charAt(0) || 'C'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <p className="font-semibold text-lg">{order.customer?.name || 'N/A'}</p>
                                                <p className="text-muted-foreground">{order.customer?.phone || 'Không có SĐT'}</p>
                                            </div>
                                            {order.customer && (
                                                <Button variant="outline" size="sm" onClick={() => navigate(`/customers?id=${order.customer?.id}`)}>
                                                    Xem hồ sơ
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Items Table */}
                                {order.items && order.items.length > 0 && (
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Package className="h-4 w-4 text-primary" />
                                                Chi tiết sản phẩm/dịch vụ ({order.items.length})
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-muted/50">
                                                        <tr>
                                                            <th className="text-left p-4 font-medium w-16">Ảnh</th>
                                                            <th className="text-left p-4 font-medium">Loại</th>
                                                            <th className="text-left p-4 font-medium">Tên</th>
                                                            <th className="text-center p-4 font-medium">SL</th>
                                                            <th className="text-right p-4 font-medium">Đơn giá</th>
                                                            <th className="text-right p-4 font-medium">Thành tiền</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {order.items.map((item, i) => (
                                                            <tr key={i} className="hover:bg-muted/30">
                                                                <td className="p-4">
                                                                    {(item.product?.image || item.service?.image) ? (
                                                                        <img src={item.product?.image || item.service?.image} alt={item.item_name} className="w-12 h-12 rounded-lg object-cover border" />
                                                                    ) : (
                                                                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                                                            {item.item_type === 'product' ? <ShoppingBag className="h-5 w-5 text-muted-foreground" /> :
                                                                                item.item_type === 'service' ? <Wrench className="h-5 w-5 text-muted-foreground" /> :
                                                                                    item.item_type === 'package' ? <Gift className="h-5 w-5 text-muted-foreground" /> :
                                                                                        <CreditCard className="h-5 w-5 text-muted-foreground" />}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="p-4">
                                                                    <Badge className={getItemTypeColor(item.item_type)}>
                                                                        {getItemTypeLabel(item.item_type)}
                                                                    </Badge>
                                                                </td>
                                                                <td className="p-4 font-medium">{item.item_name}</td>
                                                                <td className="p-4 text-center">{item.quantity}</td>
                                                                <td className="p-4 text-right text-muted-foreground">
                                                                    {formatCurrency(item.unit_price)}
                                                                </td>
                                                                <td className="p-4 text-right font-semibold">
                                                                    {formatCurrency(item.total_price)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Notes */}
                                {order.notes && (
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-primary" />
                                                Ghi chú
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm bg-muted/50 p-4 rounded-lg">{order.notes}</p>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            {/* Right Column - Summary (1/3) */}
                            <div className="lg:col-span-1 space-y-4">
                                {/* Order Summary */}
                                <Card className="border-primary/20">
                                    <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-primary/10">
                                        <CardTitle className="text-base">Tổng đơn hàng</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 pt-4">
                                        <div className="flex justify-between text-sm">
                                            <span>Tạm tính:</span>
                                            <span className="font-medium">{formatCurrency(order.subtotal)}</span>
                                        </div>
                                        {order.discount > 0 && (
                                            <div className="flex justify-between text-sm text-green-600">
                                                <span className="flex items-center gap-1">
                                                    <Gift className="h-3.5 w-3.5" />
                                                    Giảm giá:
                                                </span>
                                                <span className="font-medium">-{formatCurrency(order.discount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-xl font-bold pt-3 border-t">
                                            <span>Tổng:</span>
                                            <span className="text-primary">{formatCurrency(order.total_amount)}</span>
                                        </div>
                                        {order.paid_amount !== undefined && order.paid_amount >= 0 && (
                                            <div className="flex justify-between text-sm pt-3 border-t">
                                                <span>Đã thanh toán:</span>
                                                <span className={`font-medium ${order.paid_amount >= order.total_amount ? 'text-green-600' : 'text-amber-600'}`}>
                                                    {formatCurrency(order.paid_amount)}
                                                </span>
                                            </div>
                                        )}
                                        {order.paid_amount !== undefined && order.paid_amount < order.total_amount && (
                                            <div className="flex justify-between text-sm text-amber-600">
                                                <span>Còn lại:</span>
                                                <span className="font-medium">{formatCurrency(order.total_amount - order.paid_amount)}</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Order Status */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-primary" />
                                            Trạng thái
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex items-center justify-center py-4">
                                            <Badge
                                                variant={getStatusVariant(order.status) as 'success' | 'danger' | 'warning' | 'info' | 'purple'}
                                                className="text-base px-4 py-2"
                                            >
                                                {columns.find(c => c.id === order.status)?.title}
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Order Details */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-primary" />
                                            Thông tin đơn hàng
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Ngày tạo</p>
                                            <p className="font-medium flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                {formatDateTime(order.created_at)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Hoàn thành</p>
                                            <p className="font-medium">
                                                {order.completed_at ? formatDateTime(order.completed_at) : 'Chưa hoàn thành'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Nhân viên phụ trách</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback className="text-xs">{order.sales_user?.name?.charAt(0) || 'N'}</AvatarFallback>
                                                </Avatar>
                                                <span className="font-medium">{order.sales_user?.name || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Quick Actions */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">Thao tác nhanh</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start"
                                            onClick={() => setShowPrintDialog(true)}
                                        >
                                            <Printer className="h-4 w-4 mr-2" />
                                            In phiếu QR
                                        </Button>
                                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                                            <Button
                                                variant="outline"
                                                className="w-full justify-start"
                                                onClick={() => setShowEditDialog(true)}
                                            >
                                                <Sparkles className="h-4 w-4 mr-2" />
                                                Chỉnh sửa đơn hàng
                                            </Button>
                                        )}
                                        {order.status === 'processing' && (
                                            <Button
                                                className="w-full justify-start bg-green-600 hover:bg-green-700"
                                                onClick={() => setShowPaymentDialog(true)}
                                            >
                                                <CreditCard className="h-4 w-4 mr-2" />
                                                Thanh toán ngay
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Workflow Tab - Item-level Kanban */}
                    <TabsContent value="workflow">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CircleDot className="h-5 w-5 text-primary" />
                                    Tiến trình xử lý từng hạng mục
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Theo dõi trạng thái xử lý của từng sản phẩm/dịch vụ trong đơn hàng
                                </p>
                            </CardHeader>
                            <CardContent>
                                {/* Order Status Summary */}
                                <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground">Trạng thái đơn:</span>
                                            <Badge variant={getStatusVariant(order.status) as 'success' | 'danger' | 'warning' | 'info' | 'purple'}>
                                                {columns.find(c => c.id === order.status)?.title}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground">Nhân viên Sale:</span>
                                            <span className="font-medium">{order.sales_user?.name || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground">Tổng hạng mục:</span>
                                            <span className="font-medium">{order.items?.length || 0}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Item-level Kanban Board */}
                                <div className="overflow-x-auto pb-4">
                                    <div className="grid grid-cols-4 gap-4 min-w-[900px]">
                                        {/* Column 1: Pending */}
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                                                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                                                <h3 className="font-semibold text-sm">Chờ phân công</h3>
                                                <Badge variant="secondary" className="ml-auto">
                                                    {order.items?.filter(item => !item.status || item.status === 'pending').length || 0}
                                                </Badge>
                                            </div>
                                            <div className="space-y-2">
                                                {order.items?.filter(item => !item.status || item.status === 'pending').map((item, i) => (
                                                    <div
                                                        key={i}
                                                        className="bg-white rounded-lg p-3 border shadow-sm cursor-pointer hover:border-primary hover:shadow-md transition-all group"
                                                        onClick={() => handleOpenAssignDialog(item)}
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                                                                {item.item_type === 'service' ? <Wrench className="h-4 w-4 text-muted-foreground" /> :
                                                                    item.item_type === 'package' ? <Gift className="h-4 w-4 text-muted-foreground" /> :
                                                                        <Package className="h-4 w-4 text-muted-foreground" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-sm truncate">{item.item_name}</p>
                                                                <p className="text-xs text-muted-foreground">SL: {item.quantity}</p>
                                                            </div>
                                                            <UserPlus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                        </div>
                                                        <div className="flex items-center justify-between mt-2">
                                                            <Badge className="bg-gray-100 text-gray-600 text-xs">
                                                                {getItemTypeLabel(item.item_type)}
                                                            </Badge>
                                                            <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                                                Click để phân công
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {(!order.items || order.items.filter(item => !item.status || item.status === 'pending').length === 0) && (
                                                    <p className="text-xs text-muted-foreground text-center py-4">Không có hạng mục</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Column 2: Assigned */}
                                        <div className="bg-amber-50 rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-200">
                                                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                                                <h3 className="font-semibold text-sm">Đã phân công</h3>
                                                <Badge variant="warning" className="ml-auto">
                                                    {order.items?.filter(item => item.status === 'assigned').length || 0}
                                                </Badge>
                                            </div>
                                            <div className="space-y-2">
                                                {order.items?.filter(item => item.status === 'assigned').map((item, i) => (
                                                    <div key={i} className="bg-white rounded-lg p-3 border border-amber-200 shadow-sm">
                                                        <div className="flex items-start gap-2">
                                                            <div className="w-8 h-8 rounded bg-amber-100 flex items-center justify-center shrink-0">
                                                                {item.item_type === 'service' ? <Wrench className="h-4 w-4 text-amber-600" /> :
                                                                    item.item_type === 'package' ? <Gift className="h-4 w-4 text-amber-600" /> :
                                                                        <Package className="h-4 w-4 text-amber-600" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-sm truncate">{item.item_name}</p>
                                                                <p className="text-xs text-muted-foreground">SL: {item.quantity}</p>
                                                            </div>
                                                        </div>
                                                        {/* Display multiple technicians */}
                                                        {((item as any).technicians?.length > 0 || (item as any).technician) && (
                                                            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                                                {(item as any).technicians?.length > 0 ? (
                                                                    <>
                                                                        <div className="flex -space-x-2">
                                                                            {(item as any).technicians.slice(0, 3).map((t: any, idx: number) => (
                                                                                <Avatar key={idx} className="h-5 w-5 border-2 border-white">
                                                                                    <AvatarFallback className="text-xs bg-amber-200">
                                                                                        {t.technician?.name?.charAt(0) || '?'}
                                                                                    </AvatarFallback>
                                                                                </Avatar>
                                                                            ))}
                                                                        </div>
                                                                        <span className="text-xs truncate">
                                                                            {(item as any).technicians.map((t: any) => t.technician?.name || 'N/A').join(', ')}
                                                                        </span>
                                                                    </>
                                                                ) : (item as any).technician && (
                                                                    <>
                                                                        <Avatar className="h-5 w-5">
                                                                            <AvatarFallback className="text-xs bg-amber-200">{(item as any).technician.name?.charAt(0)}</AvatarFallback>
                                                                        </Avatar>
                                                                        <span className="text-xs truncate">{(item as any).technician.name}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                        {/* Timer for assigned */}
                                                        <div className="mt-2 flex items-center justify-between">
                                                            <Badge className="bg-amber-100 text-amber-700 text-xs">
                                                                {getItemTypeLabel(item.item_type)}
                                                            </Badge>
                                                            <div className="flex items-center gap-1 text-xs text-amber-600">
                                                                <Timer className="h-3 w-3" />
                                                                <span className="font-mono">{formatElapsedTime((item as any).assigned_at)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {order.items?.filter(item => item.status === 'assigned').length === 0 && (
                                                    <p className="text-xs text-muted-foreground text-center py-4">Không có hạng mục</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Column 3: In Progress */}
                                        <div className="bg-blue-50 rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-200">
                                                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                                                <h3 className="font-semibold text-sm">Đang thực hiện</h3>
                                                <Badge variant="info" className="ml-auto">
                                                    {order.items?.filter(item => item.status === 'in_progress').length || 0}
                                                </Badge>
                                            </div>
                                            <div className="space-y-2">
                                                {order.items?.filter(item => item.status === 'in_progress').map((item, i) => (
                                                    <div key={i} className="bg-white rounded-lg p-3 border border-blue-200 shadow-sm ring-2 ring-blue-100">
                                                        <div className="flex items-start gap-2">
                                                            <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center shrink-0">
                                                                {item.item_type === 'service' ? <Wrench className="h-4 w-4 text-blue-600" /> :
                                                                    item.item_type === 'package' ? <Gift className="h-4 w-4 text-blue-600" /> :
                                                                        <Package className="h-4 w-4 text-blue-600" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-sm truncate">{item.item_name}</p>
                                                                <p className="text-xs text-muted-foreground">SL: {item.quantity}</p>
                                                            </div>
                                                        </div>
                                                        {/* Display multiple technicians */}
                                                        {((item as any).technicians?.length > 0 || (item as any).technician) && (
                                                            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                                                {(item as any).technicians?.length > 0 ? (
                                                                    <>
                                                                        <div className="flex -space-x-2">
                                                                            {(item as any).technicians.slice(0, 3).map((t: any, idx: number) => (
                                                                                <Avatar key={idx} className="h-5 w-5 border-2 border-white">
                                                                                    <AvatarFallback className="text-xs bg-blue-200">
                                                                                        {t.technician?.name?.charAt(0) || '?'}
                                                                                    </AvatarFallback>
                                                                                </Avatar>
                                                                            ))}
                                                                        </div>
                                                                        <span className="text-xs truncate">
                                                                            {(item as any).technicians.map((t: any) => t.technician?.name || 'N/A').join(', ')}
                                                                        </span>
                                                                    </>
                                                                ) : (item as any).technician && (
                                                                    <>
                                                                        <Avatar className="h-5 w-5">
                                                                            <AvatarFallback className="text-xs bg-blue-200">{(item as any).technician.name?.charAt(0)}</AvatarFallback>
                                                                        </Avatar>
                                                                        <span className="text-xs truncate">{(item as any).technician.name}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                        {/* Timer for in progress */}
                                                        <div className="mt-2 flex items-center justify-between">
                                                            <Badge className="bg-blue-500 text-white text-xs animate-pulse">
                                                                Đang xử lý
                                                            </Badge>
                                                            <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold">
                                                                <Timer className="h-3 w-3 animate-spin" />
                                                                <span className="font-mono">{formatElapsedTime(item.started_at)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {order.items?.filter(item => item.status === 'in_progress').length === 0 && (
                                                    <p className="text-xs text-muted-foreground text-center py-4">Không có hạng mục</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Column 4: Completed */}
                                        <div className="bg-green-50 rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-green-200">
                                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                <h3 className="font-semibold text-sm">Hoàn thành</h3>
                                                <Badge variant="success" className="ml-auto">
                                                    {order.items?.filter(item => item.status === 'completed').length || 0}
                                                </Badge>
                                            </div>
                                            <div className="space-y-2">
                                                {order.items?.filter(item => item.status === 'completed').map((item, i) => (
                                                    <div key={i} className="bg-white rounded-lg p-3 border border-green-200 shadow-sm">
                                                        <div className="flex items-start gap-2">
                                                            <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center shrink-0">
                                                                <CheckCircle className="h-4 w-4 text-green-600" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-sm truncate">{item.item_name}</p>
                                                                <p className="text-xs text-muted-foreground">SL: {item.quantity}</p>
                                                            </div>
                                                        </div>
                                                        {/* Display multiple technicians */}
                                                        {((item as any).technicians?.length > 0 || item.technician) && (
                                                            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                                                {(item as any).technicians?.length > 0 ? (
                                                                    <>
                                                                        <div className="flex -space-x-2">
                                                                            {(item as any).technicians.slice(0, 3).map((t: any, idx: number) => (
                                                                                <Avatar key={idx} className="h-5 w-5 border-2 border-white">
                                                                                    <AvatarFallback className="text-xs bg-green-200">
                                                                                        {t.technician?.name?.charAt(0) || '?'}
                                                                                    </AvatarFallback>
                                                                                </Avatar>
                                                                            ))}
                                                                        </div>
                                                                        <span className="text-xs truncate">
                                                                            {(item as any).technicians.map((t: any) => t.technician?.name || 'N/A').join(', ')}
                                                                        </span>
                                                                    </>
                                                                ) : item.technician && (
                                                                    <>
                                                                        <Avatar className="h-5 w-5">
                                                                            <AvatarFallback className="text-xs bg-green-200">{item.technician.name?.charAt(0)}</AvatarFallback>
                                                                        </Avatar>
                                                                        <span className="text-xs truncate">{item.technician.name}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                        {item.completed_at && (
                                                            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                                                <CheckCircle className="h-3 w-3 text-green-500" />
                                                                Xong: {new Date(item.completed_at).toLocaleString('vi-VN')}
                                                            </div>
                                                        )}
                                                        <Badge className="mt-2 bg-green-100 text-green-700 text-xs">
                                                            {getItemTypeLabel(item.item_type)}
                                                        </Badge>
                                                    </div>
                                                ))}
                                                {order.items?.filter(item => item.status === 'completed').length === 0 && (
                                                    <p className="text-xs text-muted-foreground text-center py-4">Không có hạng mục</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress Summary */}
                                <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium">Tiến độ tổng thể</span>
                                        <span className="text-sm text-muted-foreground">
                                            {order.items?.filter(item => item.status === 'completed').length || 0} / {order.items?.length || 0} hoàn thành
                                        </span>
                                    </div>
                                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500"
                                            style={{
                                                width: order.items?.length
                                                    ? `${((order.items.filter(item => item.status === 'completed').length) / order.items.length) * 100}%`
                                                    : '0%'
                                            }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Workflow Steps Section - for services with workflows */}
                                {order.items?.some(item => item.item_type === 'service') && (
                                    <div className="mt-6 border-t pt-6">
                                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                            <ArrowRight className="h-5 w-5 text-primary" />
                                            Chi tiết các bước quy trình
                                        </h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Các dịch vụ có quy trình sẽ hiển thị chi tiết từng bước thực hiện tại đây.
                                        </p>
                                        <div className="space-y-4">
                                            {order.items?.filter(item => item.item_type === 'service').map((item, idx) => (
                                                <div key={idx} className="border rounded-lg p-4 bg-gradient-to-r from-purple-50 to-blue-50">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                                            <Wrench className="h-5 w-5 text-purple-600" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold">{item.item_name}</h4>
                                                            <p className="text-sm text-muted-foreground">
                                                                Trạng thái:
                                                                <Badge className={`ml-2 ${getItemTypeColor(item.item_type)}`}>
                                                                    {item.status === 'completed' ? 'Hoàn thành' :
                                                                        item.status === 'in_progress' ? 'Đang thực hiện' : 'Chờ xử lý'}
                                                                </Badge>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Workflow Steps Timeline for this Item */}
                                                    <WorkflowStepsTimeline itemId={item.id} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Workflow Steps Tab - Department Kanban */}
                    <TabsContent value="workflow-steps">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Layers className="h-5 w-5 text-primary" />
                                    Các bước quy trình theo phòng ban
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Theo dõi tiến độ từng bước của quy trình, được phân nhóm theo phòng ban phụ trách
                                </p>
                            </CardHeader>
                            <CardContent>
                                {stepsLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <span className="ml-3 text-muted-foreground">Đang tải quy trình...</span>
                                    </div>
                                ) : allWorkflowSteps.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p>Chưa có bước quy trình nào được thiết lập cho đơn hàng này.</p>
                                        <p className="text-sm">Các dịch vụ cần được gắn với quy trình trong phần Cài đặt.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto pb-4">
                                        <div className="flex gap-4 min-w-max">
                                            {/* Group steps by department */}
                                            {(() => {
                                                // Create a map of department_id -> steps
                                                const stepsByDept: Record<string, any[]> = {};
                                                const unassignedSteps: any[] = [];

                                                allWorkflowSteps.forEach(step => {
                                                    const deptId = step.department?.id;
                                                    if (deptId) {
                                                        if (!stepsByDept[deptId]) {
                                                            stepsByDept[deptId] = [];
                                                        }
                                                        stepsByDept[deptId].push(step);
                                                    } else {
                                                        unassignedSteps.push(step);
                                                    }
                                                });

                                                // Get department names and order columns
                                                const deptColumns = departments
                                                    .filter(d => stepsByDept[d.id])
                                                    .map(d => ({
                                                        id: d.id,
                                                        name: d.name,
                                                        steps: stepsByDept[d.id] || []
                                                    }));

                                                // Add unassigned column if there are unassigned steps
                                                if (unassignedSteps.length > 0) {
                                                    deptColumns.push({
                                                        id: 'unassigned',
                                                        name: 'Chưa phân bổ',
                                                        steps: unassignedSteps
                                                    });
                                                }

                                                return deptColumns.map(col => (
                                                    <div
                                                        key={col.id}
                                                        className="w-72 flex-shrink-0 bg-muted/30 rounded-lg p-3"
                                                    >
                                                        {/* Column Header */}
                                                        <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                                                            <Building2 className="h-4 w-4 text-primary" />
                                                            <h3 className="font-semibold text-sm truncate flex-1">{col.name}</h3>
                                                            <Badge variant="secondary">{col.steps.length}</Badge>
                                                        </div>

                                                        {/* Steps */}
                                                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                                            {col.steps.map((step: any) => {
                                                                const isCompleted = step.status === 'completed';
                                                                const isInProgress = step.status === 'in_progress';
                                                                const isAssigned = step.status === 'assigned';

                                                                return (
                                                                    <div
                                                                        key={step.id}
                                                                        className={`bg-white rounded-lg p-3 border shadow-sm transition-all ${isInProgress ? 'ring-2 ring-blue-200 border-blue-300' :
                                                                            isCompleted ? 'border-green-200 bg-green-50/50' :
                                                                                isAssigned ? 'border-amber-200' : 'border-gray-200'
                                                                            }`}
                                                                    >
                                                                        {/* Step Name */}
                                                                        <div className="flex items-start justify-between gap-2 mb-2">
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="font-medium text-sm truncate">{step.step_name}</p>
                                                                                <p className="text-xs text-muted-foreground truncate">
                                                                                    {step.item_name}
                                                                                </p>
                                                                            </div>
                                                                            {isCompleted ? (
                                                                                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                                                            ) : isInProgress ? (
                                                                                <Clock className="h-4 w-4 text-blue-500 animate-pulse flex-shrink-0" />
                                                                            ) : null}
                                                                        </div>

                                                                        {/* Status Badge */}
                                                                        <Badge
                                                                            variant={
                                                                                isCompleted ? 'success' :
                                                                                    isInProgress ? 'info' :
                                                                                        isAssigned ? 'warning' : 'outline'
                                                                            }
                                                                            className="text-xs"
                                                                        >
                                                                            {isCompleted ? 'Hoàn thành' :
                                                                                isInProgress ? 'Đang xử lý' :
                                                                                    isAssigned ? 'Đã phân công' : 'Chờ xử lý'}
                                                                        </Badge>

                                                                        {/* Technician */}
                                                                        {step.technician && (
                                                                            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                                                                                <UserIcon className="h-3 w-3" />
                                                                                <span className="truncate">{step.technician.name}</span>
                                                                            </div>
                                                                        )}

                                                                        {/* Completed time */}
                                                                        {step.completed_at && (
                                                                            <div className="mt-1 text-xs text-green-600">
                                                                                ✓ {new Date(step.completed_at).toLocaleString('vi-VN')}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* Summary */}
                                {allWorkflowSteps.length > 0 && (
                                    <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium">Tiến độ quy trình</span>
                                            <span className="text-sm text-muted-foreground">
                                                {allWorkflowSteps.filter(s => s.status === 'completed').length} / {allWorkflowSteps.length} bước hoàn thành
                                            </span>
                                        </div>
                                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500"
                                                style={{
                                                    width: allWorkflowSteps.length
                                                        ? `${(allWorkflowSteps.filter(s => s.status === 'completed').length / allWorkflowSteps.length) * 100}%`
                                                        : '0%'
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Print QR Dialog */}
            <PrintQRDialog
                order={order}
                open={showPrintDialog}
                onClose={() => setShowPrintDialog(false)}
            />

            {/* Edit Order Dialog */}
            <EditOrderDialog
                order={showEditDialog ? order : null}
                open={showEditDialog}
                onClose={() => setShowEditDialog(false)}
                onSubmit={handleUpdateOrder}
                products={products}
                services={services}
                packages={packages}
                vouchers={vouchers}
            />

            {/* Payment Dialog */}
            <PaymentDialog
                order={showPaymentDialog ? order : null}
                open={showPaymentDialog}
                onClose={() => setShowPaymentDialog(false)}
                onSuccess={handlePaymentSuccess}
            />

            {/* Assign Technician Dialog */}
            <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-primary" />
                            Phân công kỹ thuật viên
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedItem && (
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="font-medium">{selectedItem.item_name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {getItemTypeLabel(selectedItem.item_type)} • SL: {selectedItem.quantity}
                                </p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="technician">Chọn kỹ thuật viên</Label>
                            <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn kỹ thuật viên..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {technicians.length === 0 ? (
                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                            Không có kỹ thuật viên
                                        </div>
                                    ) : (
                                        technicians.map(tech => (
                                            <SelectItem key={tech.id} value={tech.id}>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarFallback className="text-xs">{tech.name?.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    {tech.name}
                                                </div>
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                            Hủy
                        </Button>
                        <Button
                            onClick={handleAssignTechnician}
                            disabled={!selectedTechnicianId || assignLoading}
                        >
                            {assignLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Phân công
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
