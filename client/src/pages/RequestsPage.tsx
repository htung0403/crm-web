import { useState, useEffect, useMemo } from 'react';
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
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
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

const ACCESSORY_COLUMNS = Object.entries(ACCESSORY_LABELS).map(([id, label]) => ({ id, label }));

const PARTNER_LABELS: Record<string, string> = {
    ship_to_partner: 'Ship Đối tác',
    partner_doing: 'Đối tác làm',
    ship_back: 'Ship về Shop',
    done: 'Done',
};

const PARTNER_COLUMNS = Object.entries(PARTNER_LABELS).map(([id, label]) => ({ id, label }));

const EXTENSION_LABELS: Record<string, string> = {
    requested: 'Đã yêu cầu',
    sale_contacted: 'Sale đã liên hệ',
    manager_approved: 'QL đã duyệt',
    notified_tech: 'Đã báo KT',
    kpi_recorded: 'Đã ghi KPI',
};

const EXTENSION_COLUMNS = Object.entries(EXTENSION_LABELS).map(([id, label]) => ({ id, label }));

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

function groupByStatus<T extends { status: string }>(items: T[], columnIds: string[]): Record<string, T[]> {
    const map: Record<string, T[]> = {};
    columnIds.forEach((id) => (map[id] = []));
    items.forEach((item) => {
        if (map[item.status]) map[item.status].push(item);
    });
    return map;
}

type KanbanCardProps = {
    row: any;
    isPending: boolean;
    onOpenDialog: (row: any) => void;
    onNavigateOrder: (id: string) => void;
    getOrder: (row: any) => { id?: string; order_code?: string };
    getProductCode?: (row: any) => string;
    getItemName: (row: any) => string;
    getProductImage?: (row: any) => string | null;
    extra?: React.ReactNode;
};

function AccessoryKanbanCard({ row, isPending, onOpenDialog, onNavigateOrder, getOrder, getProductCode, getItemName, getProductImage, extra }: KanbanCardProps) {
    const order = getOrder(row);
    const productCode = getProductCode?.(row) ?? '—';
    const productImage = getProductImage?.(row) ?? null;
    return (
        <div
            className={`rounded-lg border bg-card text-sm shadow-sm transition-shadow hover:shadow-md overflow-hidden ${isPending ? 'border-amber-300 bg-amber-50/50' : ''}`}
        >
            <div className="w-full aspect-square bg-muted flex items-center justify-center">
                {productImage ? (
                    <img src={productImage} alt="" className="w-full h-full object-cover" />
                ) : (
                    <Package className="h-12 w-12 text-muted-foreground" />
                )}
            </div>
            <div className="p-3 min-w-0">
                <div className="font-medium font-mono text-primary truncate" title={productCode}>
                    Mã SP: {productCode || '—'}
                </div>
                <p className="mt-0.5 truncate text-muted-foreground" title={getItemName(row)}>{getItemName(row)}</p>
                {row.notes && <p className="mt-1 truncate text-xs text-muted-foreground" title={row.notes}>{row.notes}</p>}
                {extra}
                <Button variant="outline" size="sm" className="mt-2 w-full h-7 text-xs" onClick={() => onOpenDialog(row)}>Duyệt</Button>
            </div>
        </div>
    );
}

function PartnerKanbanCard(props: KanbanCardProps) {
    return <AccessoryKanbanCard {...props} />;
}

function ExtensionKanbanCard({ row, isPending, onOpenDialog, onNavigateOrder, getOrder, extra }: Omit<KanbanCardProps, 'getItemName'> & { getItemName?: (row: any) => string }) {
    const order = getOrder(row);
    return (
        <div
            className={`rounded-lg border bg-card text-sm shadow-sm transition-shadow hover:shadow-md overflow-hidden ${isPending ? 'border-amber-300 bg-amber-50/50' : ''}`}
        >
            <div className="w-full aspect-square bg-muted flex items-center justify-center">
                <Clock className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="p-3 min-w-0">
                <div className="font-medium font-mono text-primary truncate">
                    {order.id ? (
                        <Button variant="link" className="p-0 h-auto font-mono text-primary text-xs truncate max-w-full" onClick={() => onNavigateOrder(order.id!)}>
                            Đơn #{order.order_code}
                            <ExternalLink className="ml-0.5 h-3 w-3 inline shrink-0" />
                        </Button>
                    ) : (
                        <span className="text-muted-foreground">Đơn #{order.order_code || '—'}</span>
                    )}
                </div>
                {row.reason && <p className="mt-0.5 truncate text-xs text-muted-foreground" title={row.reason}>{row.reason}</p>}
                {row.customer_result && <p className="mt-1 truncate text-xs text-muted-foreground" title={row.customer_result}>Kết quả: {row.customer_result}</p>}
                {extra}
                <Button variant="outline" size="sm" className="mt-2 w-full h-7 text-xs" onClick={() => onOpenDialog(row)}>Duyệt gia hạn</Button>
            </div>
        </div>
    );
}

function AccessoryKanban({
    items,
    updatingId,
    onDragEnd,
    onOpenDialog,
    onNavigateOrder,
}: {
    items: any[];
    updatingId: string | null;
    onDragEnd: (result: DropResult) => void;
    onOpenDialog: (row: any) => void;
    onNavigateOrder: (id: string) => void;
}) {
    const columns = ACCESSORY_COLUMNS;
    const byStatus = useMemo(() => groupByStatus(items, columns.map((c) => c.id)), [items, columns]);
    const isUpdating = !!updatingId;
    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-2 min-h-[320px]">
                {columns.map((col) => (
                    <Droppable key={col.id} droppableId={col.id}>
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`shrink-0 w-[280px] rounded-lg border bg-muted/30 p-3 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/10 border-primary/30' : ''}`}
                            >
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="font-medium text-sm">{col.label}</span>
                                    <Badge variant="secondary" className="text-xs">{byStatus[col.id]?.length ?? 0}</Badge>
                                </div>
                                <div className="space-y-2 min-h-[200px]">
                                    {(byStatus[col.id] || []).map((row: any, index: number) => {
                                        const order = row.order_item?.order ?? row.order_product_service?.order_product?.order;
                                        return (
                                            <Draggable key={row.id} draggableId={row.id} index={index} isDragDisabled={isUpdating}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={snapshot.isDragging ? 'opacity-90' : ''}
                                                    >
                                                        <AccessoryKanbanCard
                                                            row={row}
                                                            isPending={isPendingAccessory(row)}
                                                            onOpenDialog={onOpenDialog}
                                                            onNavigateOrder={onNavigateOrder}
                                                            getOrder={() => order || {}}
                                                            getProductCode={(r) => r.order_item?.item_code ?? r.order_product_service?.order_product?.product_code ?? '—'}
                                                            getItemName={(r) => r.order_item?.item_name ?? r.order_product_service?.order_product?.name ?? '—'}
                                                            getProductImage={(r) => {
                                                                const v1 = r.order_item?.product?.image;
                                                                if (v1) return v1;
                                                                const op = r.order_product_service?.order_product;
                                                                const imgs = op?.images;
                                                                if (Array.isArray(imgs) && imgs[0]) return imgs[0];
                                                                if (typeof imgs === 'string') {
                                                                    try { const arr = JSON.parse(imgs); return Array.isArray(arr) && arr[0] ? arr[0] : null; } catch { return null; }
                                                                }
                                                                return null;
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </Draggable>
                                        );
                                    })}
                                </div>
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                ))}
            </div>
        </DragDropContext>
    );
}

function PartnerKanban({
    items,
    updatingId,
    onDragEnd,
    onOpenDialog,
    onNavigateOrder,
}: {
    items: any[];
    updatingId: string | null;
    onDragEnd: (result: DropResult) => void;
    onOpenDialog: (row: any) => void;
    onNavigateOrder: (id: string) => void;
}) {
    const columns = PARTNER_COLUMNS;
    const byStatus = useMemo(() => groupByStatus(items, columns.map((c) => c.id)), [items, columns]);
    const isUpdating = !!updatingId;
    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-2 min-h-[320px]">
                {columns.map((col) => (
                    <Droppable key={col.id} droppableId={col.id}>
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`shrink-0 w-[280px] rounded-lg border bg-muted/30 p-3 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/10 border-primary/30' : ''}`}
                            >
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="font-medium text-sm">{col.label}</span>
                                    <Badge variant="secondary" className="text-xs">{byStatus[col.id]?.length ?? 0}</Badge>
                                </div>
                                <div className="space-y-2 min-h-[200px]">
                                    {(byStatus[col.id] || []).map((row: any, index: number) => {
                                        const order = row.order_item?.order ?? row.order_product_service?.order_product?.order;
                                        return (
                                            <Draggable key={row.id} draggableId={row.id} index={index} isDragDisabled={isUpdating}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={snapshot.isDragging ? 'opacity-90' : ''}
                                                    >
                                                        <PartnerKanbanCard
                                                            row={row}
                                                            isPending={isPendingPartner(row)}
                                                            onOpenDialog={onOpenDialog}
                                                            onNavigateOrder={onNavigateOrder}
                                                            getOrder={() => order || {}}
                                                            getProductCode={(r) => r.order_item?.item_code ?? r.order_product_service?.order_product?.product_code ?? '—'}
                                                            getItemName={(r) => r.order_item?.item_name ?? r.order_product_service?.order_product?.name ?? '—'}
                                                            getProductImage={(r) => {
                                                                const v1 = r.order_item?.product?.image;
                                                                if (v1) return v1;
                                                                const op = r.order_product_service?.order_product;
                                                                const imgs = op?.images;
                                                                if (Array.isArray(imgs) && imgs[0]) return imgs[0];
                                                                if (typeof imgs === 'string') {
                                                                    try { const arr = JSON.parse(imgs); return Array.isArray(arr) && arr[0] ? arr[0] : null; } catch { return null; }
                                                                }
                                                                return null;
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </Draggable>
                                        );
                                    })}
                                </div>
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                ))}
            </div>
        </DragDropContext>
    );
}

function ExtensionKanban({
    items,
    updatingId,
    onDragEnd,
    onOpenDialog,
    onNavigateOrder,
}: {
    items: any[];
    updatingId: string | null;
    onDragEnd: (result: DropResult) => void;
    onOpenDialog: (row: any) => void;
    onNavigateOrder: (id: string) => void;
}) {
    const columns = EXTENSION_COLUMNS;
    const byStatus = useMemo(() => groupByStatus(items, columns.map((c) => c.id)), [items, columns]);
    const isUpdating = !!updatingId;
    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-2 min-h-[320px]">
                {columns.map((col) => (
                    <Droppable key={col.id} droppableId={col.id}>
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`shrink-0 w-[280px] rounded-lg border bg-muted/30 p-3 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/10 border-primary/30' : ''}`}
                            >
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="font-medium text-sm">{col.label}</span>
                                    <Badge variant="secondary" className="text-xs">{byStatus[col.id]?.length ?? 0}</Badge>
                                </div>
                                <div className="space-y-2 min-h-[200px]">
                                    {(byStatus[col.id] || []).map((row: any, index: number) => {
                                        const order = row.order as any;
                                        return (
                                            <Draggable key={row.id} draggableId={row.id} index={index} isDragDisabled={isUpdating}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={snapshot.isDragging ? 'opacity-90' : ''}
                                                    >
                                                        <ExtensionKanbanCard
                                                            row={row}
                                                            isPending={isPendingExtension(row)}
                                                            onOpenDialog={onOpenDialog}
                                                            onNavigateOrder={onNavigateOrder}
                                                            getOrder={() => ({ id: order?.id ?? row.order_id, order_code: order?.order_code || '—' })}
                                                        />
                                                    </div>
                                                )}
                                            </Draggable>
                                        );
                                    })}
                                </div>
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                ))}
            </div>
        </DragDropContext>
    );
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

    const handleAccessoryDragEnd = (result: DropResult) => {
        if (!result.destination || result.source.droppableId === result.destination.droppableId) return;
        const row = accessories.find((r: any) => r.id === result.draggableId);
        if (!row) return;
        const newStatus = result.destination.droppableId;
        const itemId = row.order_item_id ?? row.order_product_service_id;
        const prevStatus = row.status;
        setAccessories((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: newStatus } : r)));
        orderItemsApi.updateAccessory(itemId, { status: newStatus }).then(() => {
            toast.success('Đã cập nhật trạng thái mua phụ kiện');
        }).catch((e: any) => {
            setAccessories((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: prevStatus } : r)));
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        });
    };

    const handlePartnerDragEnd = (result: DropResult) => {
        if (!result.destination || result.source.droppableId === result.destination.droppableId) return;
        const row = partners.find((r: any) => r.id === result.draggableId);
        if (!row) return;
        const newStatus = result.destination.droppableId;
        const itemId = row.order_item_id ?? row.order_product_service_id;
        const prevStatus = row.status;
        setPartners((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: newStatus } : r)));
        orderItemsApi.updatePartner(itemId, { status: newStatus }).then(() => {
            toast.success('Đã cập nhật trạng thái gửi đối tác');
        }).catch((e: any) => {
            setPartners((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: prevStatus } : r)));
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        });
    };

    const handleExtensionDragEnd = (result: DropResult) => {
        if (!result.destination || result.source.droppableId === result.destination.droppableId) return;
        const row = extensions.find((r: any) => r.id === result.draggableId);
        if (!row?.order_id) return;
        const newStatus = result.destination.droppableId;
        const prevStatus = row.status;
        setExtensions((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: newStatus } : r)));
        ordersApi.updateExtensionRequest(row.order_id, { status: newStatus }).then(() => {
            toast.success('Đã cập nhật yêu cầu gia hạn');
        }).catch((e: any) => {
            setExtensions((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: prevStatus } : r)));
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        });
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
                                    <p className="text-sm text-muted-foreground">Kéo thả thẻ giữa các cột để chuyển trạng thái.</p>
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
                                <AccessoryKanban
                                    items={filteredAccessories}
                                    updatingId={updatingId}
                                    onDragEnd={handleAccessoryDragEnd}
                                    onOpenDialog={openAccessoryDialog}
                                    onNavigateOrder={(id) => navigate(`/orders/${id}`)}
                                />
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
                                    <p className="text-sm text-muted-foreground">Kéo thả thẻ giữa các cột để chuyển trạng thái.</p>
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
                                <PartnerKanban
                                    items={filteredPartners}
                                    updatingId={updatingId}
                                    onDragEnd={handlePartnerDragEnd}
                                    onOpenDialog={openPartnerDialog}
                                    onNavigateOrder={(id) => navigate(`/orders/${id}`)}
                                />
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
                                    <p className="text-sm text-muted-foreground">Kéo thả thẻ giữa các cột để chuyển trạng thái.</p>
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
                                <ExtensionKanban
                                    items={filteredExtensions}
                                    updatingId={updatingId}
                                    onDragEnd={handleExtensionDragEnd}
                                    onOpenDialog={openExtensionDialog}
                                    onNavigateOrder={(id) => navigate(`/orders/${id}`)}
                                />
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
