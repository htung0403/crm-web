import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Package,
    Truck,
    Clock,
    Loader2,
    ExternalLink,
    FileText,
    RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { requestsApi, orderItemsApi, ordersApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

const ACCESSORY_LABELS: Record<string, string> = {
    need_buy: 'Cần mua',
    bought: 'Đã mua',
    waiting_ship: 'Chờ ship',
    shipped: 'Ship tới',
    delivered_to_tech: 'Giao KT',
};

const PARTNER_LABELS: Record<string, string> = {
    ship_to_partner: 'Ship Đối tác',
    partner_doing: 'Đối tác làm',
    ship_back: 'Ship về Shop',
    done: 'Done',
};

const EXTENSION_LABELS: Record<string, string> = {
    requested: 'Đã yêu cầu',
    sale_contacted: 'Sale đã liên hệ',
    manager_approved: 'QL đã duyệt',
    notified_tech: 'Đã báo KT',
    kpi_recorded: 'Đã ghi KPI',
};

// Chờ duyệt = cần Admin/QL xử lý
function isPendingAccessory(row: any) {
    return row?.status === 'need_buy';
}
function isPendingPartner(row: any) {
    return row?.status === 'ship_to_partner';
}
function isPendingExtension(row: any) {
    return row?.status === 'requested' || row?.status === 'sale_contacted';
}

export function RequestsPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [accessories, setAccessories] = useState<any[]>([]);
    const [partners, setPartners] = useState<any[]>([]);
    const [extensions, setExtensions] = useState<any[]>([]);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'pending'>('all');

    // Dialog Mua phụ kiện / Gửi Đối Tác
    const [showAccessoryDialog, setShowAccessoryDialog] = useState(false);
    const [accessoryRow, setAccessoryRow] = useState<any>(null);
    const [accessoryStatus, setAccessoryStatus] = useState('');
    const [accessoryNotes, setAccessoryNotes] = useState('');
    const [accessoryItemId, setAccessoryItemId] = useState<string | null>(null);

    const [showPartnerDialog, setShowPartnerDialog] = useState(false);
    const [partnerRow, setPartnerRow] = useState<any>(null);
    const [partnerStatus, setPartnerStatus] = useState('');
    const [partnerNotes, setPartnerNotes] = useState('');
    const [partnerItemId, setPartnerItemId] = useState<string | null>(null);

    // Dialog Xin gia hạn
    const [showExtensionDialog, setShowExtensionDialog] = useState(false);
    const [extensionRow, setExtensionRow] = useState<any>(null);
    const [extensionStatus, setExtensionStatus] = useState('');
    const [extensionCustomerResult, setExtensionCustomerResult] = useState('');
    const [extensionNewDueAt, setExtensionNewDueAt] = useState('');
    const [extensionValidReason, setExtensionValidReason] = useState(false);

    const pendingAccessories = accessories.filter(isPendingAccessory);
    const pendingPartners = partners.filter(isPendingPartner);
    const pendingExtensions = extensions.filter(isPendingExtension);

    const filteredAccessories = filter === 'pending' ? pendingAccessories : accessories;
    const filteredPartners = filter === 'pending' ? pendingPartners : partners;
    const filteredExtensions = filter === 'pending' ? pendingExtensions : extensions;

    const loadAll = async () => {
        setLoading(true);
        try {
            const [accRes, partRes, extRes] = await Promise.all([
                requestsApi.getAccessories(),
                requestsApi.getPartners(),
                requestsApi.getExtensions(),
            ]);
            setAccessories((accRes.data?.data as any[]) || []);
            setPartners((partRes.data?.data as any[]) || []);
            setExtensions((extRes.data?.data as any[]) || []);
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Không tải được danh sách yêu cầu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, []);

    const handleUpdateAccessory = async (orderItemId: string, status: string) => {
        setUpdatingId(orderItemId);
        try {
            await orderItemsApi.updateAccessory(orderItemId, { status });
            toast.success('Đã cập nhật trạng thái mua phụ kiện');
            loadAll();
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleUpdatePartner = async (orderItemId: string, status: string) => {
        setUpdatingId(orderItemId);
        try {
            await orderItemsApi.updatePartner(orderItemId, { status });
            toast.success('Đã cập nhật trạng thái gửi đối tác');
            loadAll();
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleUpdateExtension = async (orderId: string, status: string, newDueAt?: string, validReason?: boolean, customerResult?: string) => {
        setUpdatingId(orderId);
        try {
            await ordersApi.updateExtensionRequest(orderId, {
                status,
                ...(newDueAt && { new_due_at: newDueAt }),
                ...(typeof validReason === 'boolean' && { valid_reason: validReason }),
                ...(customerResult !== undefined && { customer_result: customerResult }),
            });
            toast.success('Đã cập nhật yêu cầu gia hạn');
            loadAll();
            setShowExtensionDialog(false);
            setExtensionRow(null);
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        } finally {
            setUpdatingId(null);
        }
    };

    const openAccessoryDialog = (row: any) => {
        const itemId = row.order_item_id ?? row.order_product_service_id;
        setAccessoryRow(row);
        setAccessoryStatus(row.status);
        setAccessoryNotes(row.notes ?? '');
        setAccessoryItemId(itemId);
        setShowAccessoryDialog(true);
    };

    const handleSubmitAccessory = async () => {
        if (!accessoryItemId) return;
        setUpdatingId(accessoryItemId);
        try {
            await orderItemsApi.updateAccessory(accessoryItemId, { status: accessoryStatus, notes: accessoryNotes || undefined });
            toast.success('Đã cập nhật trạng thái mua phụ kiện');
            loadAll();
            setShowAccessoryDialog(false);
            setAccessoryRow(null);
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        } finally {
            setUpdatingId(null);
        }
    };

    const openPartnerDialog = (row: any) => {
        const itemId = row.order_item_id ?? row.order_product_service_id;
        setPartnerRow(row);
        setPartnerStatus(row.status);
        setPartnerNotes(row.notes ?? '');
        setPartnerItemId(itemId);
        setShowPartnerDialog(true);
    };

    const handleSubmitPartner = async () => {
        if (!partnerItemId) return;
        setUpdatingId(partnerItemId);
        try {
            await orderItemsApi.updatePartner(partnerItemId, { status: partnerStatus, notes: partnerNotes || undefined });
            toast.success('Đã cập nhật trạng thái gửi đối tác');
            loadAll();
            setShowPartnerDialog(false);
            setPartnerRow(null);
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        } finally {
            setUpdatingId(null);
        }
    };

    const openExtensionDialog = (row: any) => {
        setExtensionRow(row);
        setExtensionStatus(row.status);
        setExtensionCustomerResult(row.customer_result ?? '');
        setExtensionNewDueAt(row.new_due_at ? row.new_due_at.slice(0, 16) : '');
        setExtensionValidReason(!!row.valid_reason);
        setShowExtensionDialog(true);
    };

    const handleSubmitExtension = async () => {
        if (!extensionRow?.order_id) return;
        await handleUpdateExtension(
            extensionRow.order_id,
            extensionStatus,
            extensionNewDueAt || undefined,
            extensionValidReason,
            extensionCustomerResult
        );
    };

    if (loading && accessories.length === 0 && partners.length === 0 && extensions.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[40vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="h-7 w-7 text-primary" />
                        Quản lý yêu cầu
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Trang dành cho Admin / Quản lý duyệt và xử lý các phiếu Mua phụ kiện, Gửi Đối Tác và Xin gia hạn do kỹ thuật tạo.
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                        Dùng bộ lọc &quot;Chờ duyệt&quot; để chỉ xem yêu cầu cần xử lý; dòng có nền nhạt là chờ duyệt.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
                    <RefreshCw className={loading ? 'animate-spin h-4 w-4 mr-2' : 'h-4 w-4 mr-2'} />
                    Tải lại
                </Button>
            </div>

            <Tabs defaultValue="accessories" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-2xl">
                    <TabsTrigger value="accessories" className="gap-2">
                        <Package className="h-4 w-4" />
                        Mua phụ kiện ({accessories.length})
                        {pendingAccessories.length > 0 && (
                            <span className="text-amber-600 font-medium"> · {pendingAccessories.length} chờ duyệt</span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="partners" className="gap-2">
                        <Truck className="h-4 w-4" />
                        Gửi Đối Tác ({partners.length})
                        {pendingPartners.length > 0 && (
                            <span className="text-amber-600 font-medium"> · {pendingPartners.length} chờ duyệt</span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="extensions" className="gap-2">
                        <Clock className="h-4 w-4" />
                        Xin gia hạn ({extensions.length})
                        {pendingExtensions.length > 0 && (
                            <span className="text-amber-600 font-medium"> · {pendingExtensions.length} chờ duyệt</span>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="accessories" className="mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <CardTitle className="text-base">Yêu cầu Mua phụ kiện</CardTitle>
                                    <p className="text-sm text-muted-foreground">Cập nhật trạng thái và xem đơn hàng liên quan.</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>Tất cả</Button>
                                    <Button variant={filter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('pending')}>Chờ duyệt</Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {accessories.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">Chưa có yêu cầu nào.</p>
                            ) : filteredAccessories.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">Không có yêu cầu chờ duyệt.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="text-left p-3 font-medium">Đơn hàng</th>
                                                <th className="text-left p-3 font-medium">Hạng mục</th>
                                                <th className="text-left p-3 font-medium">Trạng thái</th>
                                                <th className="text-left p-3 font-medium">Ghi chú</th>
                                                <th className="text-left p-3 font-medium">Cập nhật</th>
                                                <th className="text-right p-3 font-medium">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {filteredAccessories.map((row: any) => {
                                                const order = row.order_item?.order ?? row.order_product_service?.order_product?.order;
                                                const orderId = order?.id;
                                                const orderCode = order?.order_code || '—';
                                                const itemName = row.order_item?.item_name ?? row.order_product_service?.order_product?.name ?? '—';
                                                const itemId = row.order_item_id ?? row.order_product_service_id;
                                                const pending = isPendingAccessory(row);
                                                return (
                                                    <tr
                                                        key={row.id}
                                                        className={`hover:bg-muted/30 ${filter === 'all' && pending ? 'bg-amber-50' : ''}`}
                                                    >
                                                        <td className="p-3 align-middle">
                                                            {orderId ? (
                                                                <Button variant="link" className="p-0 h-auto font-mono text-primary" onClick={() => navigate(`/orders/${orderId}`)}>
                                                                    #{orderCode}
                                                                    <ExternalLink className="ml-1 h-3 w-3 inline" />
                                                                </Button>
                                                            ) : orderCode}
                                                        </td>
                                                        <td className="p-3 align-middle">{itemName}</td>
                                                        <td className="p-3 align-middle">
                                                            {filter === 'all' && pending && (
                                                                <Badge variant="outline" className="mr-1 text-amber-700 border-amber-300">Chờ duyệt</Badge>
                                                            )}
                                                            <Badge variant="secondary">{ACCESSORY_LABELS[row.status] || row.status}</Badge>
                                                        </td>
                                                        <td className="p-3 align-middle max-w-[160px] truncate text-muted-foreground" title={row.notes ?? ''}>{row.notes ?? '—'}</td>
                                                        <td className="p-3 align-middle text-muted-foreground">{formatDateTime(row.updated_at)}</td>
                                                        <td className="p-3 align-middle">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Select
                                                                    value={row.status}
                                                                    onValueChange={(v) => handleUpdateAccessory(itemId, v)}
                                                                    disabled={!!updatingId}
                                                                >
                                                                    <SelectTrigger className="w-[160px] h-8">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {Object.entries(ACCESSORY_LABELS).map(([value, label]) => (
                                                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => openAccessoryDialog(row)}>Duyệt</Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="partners" className="mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <CardTitle className="text-base">Yêu cầu Gửi Đối Tác</CardTitle>
                                    <p className="text-sm text-muted-foreground">Cập nhật trạng thái và xem đơn hàng liên quan.</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>Tất cả</Button>
                                    <Button variant={filter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('pending')}>Chờ duyệt</Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {partners.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">Chưa có yêu cầu nào.</p>
                            ) : filteredPartners.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">Không có yêu cầu chờ duyệt.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="text-left p-3 font-medium">Đơn hàng</th>
                                                <th className="text-left p-3 font-medium">Hạng mục</th>
                                                <th className="text-left p-3 font-medium">Trạng thái</th>
                                                <th className="text-left p-3 font-medium">Ghi chú</th>
                                                <th className="text-left p-3 font-medium">Cập nhật</th>
                                                <th className="text-right p-3 font-medium">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {filteredPartners.map((row: any) => {
                                                const order = row.order_item?.order ?? row.order_product_service?.order_product?.order;
                                                const orderId = order?.id;
                                                const orderCode = order?.order_code || '—';
                                                const itemName = row.order_item?.item_name ?? row.order_product_service?.order_product?.name ?? '—';
                                                const itemId = row.order_item_id ?? row.order_product_service_id;
                                                const pending = isPendingPartner(row);
                                                return (
                                                    <tr
                                                        key={row.id}
                                                        className={`hover:bg-muted/30 ${filter === 'all' && pending ? 'bg-amber-50' : ''}`}
                                                    >
                                                        <td className="p-3">
                                                            {orderId ? (
                                                                <Button variant="link" className="p-0 h-auto font-mono text-primary" onClick={() => navigate(`/orders/${orderId}`)}>
                                                                    #{orderCode}
                                                                    <ExternalLink className="ml-1 h-3 w-3 inline" />
                                                                </Button>
                                                            ) : orderCode}
                                                        </td>
                                                        <td className="p-3">{itemName}</td>
                                                        <td className="p-3">
                                                            {filter === 'all' && pending && (
                                                                <Badge variant="outline" className="mr-1 text-amber-700 border-amber-300">Chờ duyệt</Badge>
                                                            )}
                                                            <Badge variant="secondary">{PARTNER_LABELS[row.status] || row.status}</Badge>
                                                        </td>
                                                        <td className="p-3 max-w-[160px] truncate text-muted-foreground" title={row.notes ?? ''}>{row.notes ?? '—'}</td>
                                                        <td className="p-3 text-muted-foreground">{formatDateTime(row.updated_at)}</td>
                                                        <td className="p-3 align-middle">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Select
                                                                    value={row.status}
                                                                    onValueChange={(v) => handleUpdatePartner(itemId, v)}
                                                                    disabled={!!updatingId}
                                                                >
                                                                    <SelectTrigger className="w-[160px] h-8">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {Object.entries(PARTNER_LABELS).map(([value, label]) => (
                                                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => openPartnerDialog(row)}>Duyệt</Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="extensions" className="mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <CardTitle className="text-base">Yêu cầu Xin gia hạn</CardTitle>
                                    <p className="text-sm text-muted-foreground">Xem lý do, kết quả liên hệ khách và duyệt gia hạn (chốt ngày mới).</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>Tất cả</Button>
                                    <Button variant={filter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('pending')}>Chờ duyệt</Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {extensions.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">Chưa có yêu cầu nào.</p>
                            ) : filteredExtensions.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">Không có yêu cầu chờ duyệt.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="text-left p-3 font-medium">Đơn hàng</th>
                                                <th className="text-left p-3 font-medium">Lý do / Kết quả</th>
                                                <th className="text-left p-3 font-medium">Trạng thái</th>
                                                <th className="text-left p-3 font-medium">Ngày tạo</th>
                                                <th className="text-right p-3 font-medium">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {filteredExtensions.map((row: any) => {
                                                const orderId = row.order_id || (row.order as any)?.id;
                                                const orderCode = (row.order as any)?.order_code || '—';
                                                const pending = isPendingExtension(row);
                                                return (
                                                    <tr
                                                        key={row.id}
                                                        className={`hover:bg-muted/30 ${filter === 'all' && pending ? 'bg-amber-50' : ''}`}
                                                    >
                                                        <td className="p-3">
                                                            {orderId ? (
                                                                <Button variant="link" className="p-0 h-auto font-mono text-primary" onClick={() => navigate(`/orders/${orderId}`)}>
                                                                    #{orderCode}
                                                                    <ExternalLink className="ml-1 h-3 w-3 inline" />
                                                                </Button>
                                                            ) : orderCode}
                                                        </td>
                                                        <td className="p-3 max-w-[280px]">
                                                            <span className="text-muted-foreground block truncate" title={row.reason}>{row.reason}</span>
                                                            {row.customer_result && (
                                                                <span className="text-xs text-muted-foreground block mt-1">Kết quả: {row.customer_result}</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3">
                                                            {filter === 'all' && pending && (
                                                                <Badge variant="outline" className="mr-1 text-amber-700 border-amber-300">Chờ duyệt</Badge>
                                                            )}
                                                            <Badge variant="secondary">{EXTENSION_LABELS[row.status] || row.status}</Badge>
                                                        </td>
                                                        <td className="p-3 text-muted-foreground">{formatDateTime(row.created_at)}</td>
                                                        <td className="p-3 align-middle">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Select
                                                                    value={row.status}
                                                                    onValueChange={(v) => handleUpdateExtension(row.order_id, v)}
                                                                    disabled={!!updatingId}
                                                                >
                                                                    <SelectTrigger className="w-[180px] h-8">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {Object.entries(EXTENSION_LABELS).map(([value, label]) => (
                                                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => openExtensionDialog(row)}>Duyệt gia hạn</Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialog Cập nhật / Duyệt Mua phụ kiện */}
            <Dialog open={showAccessoryDialog} onOpenChange={setShowAccessoryDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Duyệt / Cập nhật Mua phụ kiện</DialogTitle>
                    </DialogHeader>
                    {accessoryRow && (
                        <>
                            <div className="space-y-4 py-2">
                                <div>
                                    <Label>Trạng thái</Label>
                                    <Select value={accessoryStatus} onValueChange={setAccessoryStatus}>
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(ACCESSORY_LABELS).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Ghi chú (tùy chọn)</Label>
                                    <Textarea value={accessoryNotes} onChange={(e) => setAccessoryNotes(e.target.value)} placeholder="Ghi chú khi duyệt..." className="mt-1 min-h-[80px]" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowAccessoryDialog(false)}>Hủy</Button>
                                <Button onClick={handleSubmitAccessory} disabled={!!updatingId}>
                                    {updatingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Cập nhật
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Dialog Cập nhật / Duyệt Gửi Đối Tác */}
            <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Duyệt / Cập nhật Gửi Đối Tác</DialogTitle>
                    </DialogHeader>
                    {partnerRow && (
                        <>
                            <div className="space-y-4 py-2">
                                <div>
                                    <Label>Trạng thái</Label>
                                    <Select value={partnerStatus} onValueChange={setPartnerStatus}>
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(PARTNER_LABELS).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Ghi chú (tùy chọn)</Label>
                                    <Textarea value={partnerNotes} onChange={(e) => setPartnerNotes(e.target.value)} placeholder="Ghi chú khi duyệt..." className="mt-1 min-h-[80px]" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowPartnerDialog(false)}>Hủy</Button>
                                <Button onClick={handleSubmitPartner} disabled={!!updatingId}>
                                    {updatingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Cập nhật
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Dialog Duyệt gia hạn */}
            <Dialog open={showExtensionDialog} onOpenChange={setShowExtensionDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Duyệt gia hạn</DialogTitle>
                    </DialogHeader>
                    {extensionRow && (
                        <>
                            <div className="space-y-4 py-2">
                                <div>
                                    <Label>Lý do (từ KT)</Label>
                                    <p className="mt-1 text-sm text-muted-foreground bg-muted/50 rounded p-3">{extensionRow.reason || '—'}</p>
                                </div>
                                <div>
                                    <Label>Kết quả liên hệ khách (Sale)</Label>
                                    <Textarea value={extensionCustomerResult} onChange={(e) => setExtensionCustomerResult(e.target.value)} placeholder="Cập nhật sau khi gọi/nhắn khách..." className="mt-1 min-h-[80px]" />
                                </div>
                                <div>
                                    <Label>Ngày hạn mới (chốt khi QL duyệt)</Label>
                                    <input type="datetime-local" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1" value={extensionNewDueAt} onChange={(e) => setExtensionNewDueAt(e.target.value)} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" id="ext_valid_reason" checked={extensionValidReason} onChange={(e) => setExtensionValidReason(e.target.checked)} className="rounded" />
                                    <Label htmlFor="ext_valid_reason">Lý do hợp lệ</Label>
                                </div>
                                <div>
                                    <Label>Trạng thái</Label>
                                    <Select value={extensionStatus} onValueChange={setExtensionStatus}>
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(EXTENSION_LABELS).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowExtensionDialog(false)}>Hủy</Button>
                                <Button onClick={handleSubmitExtension} disabled={!!updatingId}>
                                    {updatingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Cập nhật / Duyệt
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
