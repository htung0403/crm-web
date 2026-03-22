import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Package,
    Truck,
    Clock,
    Loader2,
    ExternalLink,
    FileText,
    RefreshCw,
    Plus,
    AlertCircle,
    CheckCircle2,
    Calendar,
    MapPin,
    User,
    Image as ImageIcon,
    Search,
    Building2,
    Hash,
    DollarSign,
    Layers,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { requestsApi, orderItemsApi, ordersApi } from '@/lib/api';
import { uploadFile } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils';
import { ACCESSORY_LABELS, PARTNER_LABELS, EXTENSION_LABELS, REQUEST_SLA } from '@/components/orders/constants';

const ACCESSORY_COLUMNS = Object.entries(ACCESSORY_LABELS).map(([id, label]) => ({ id, label }));
const PARTNER_COLUMNS = Object.entries(PARTNER_LABELS).map(([id, label]) => ({ id, label }));

// Extension: Show only requested, manager_approved, sale_contacted, notified_tech in Kanban board
const EXTENSION_COLUMNS = Object.entries(EXTENSION_LABELS)
    .filter(([id]) => ['requested', 'manager_approved', 'sale_contacted', 'notified_tech'].includes(id))
    .map(([id, label]) => ({ id, label }));

// Reorder extension columns: QL duyệt (manager_approved) before "Đã báo KT" (notified_tech)
// Since notified_tech was 4th and manager_approved was 3rd, the order requested is requested -> contacted -> approved -> tech
// Current labels: requested, sale_contacted, manager_approved, notified_tech, kpi_recorded.
// Order in EXTENSION_COLUMNS filter:
// 1. requested
// 2. sale_contacted
// 3. manager_approved
// 4. notified_tech
// This is already the correct order from the Labels object. Let's just make sure.

function calculateSLADisplay(updatedAt: string | undefined, slaHours: number): { label: string; isOverdue: boolean; color: string; badge: string } {
    if (!updatedAt || slaHours === 0) return { label: '', isOverdue: false, color: '', badge: '' };

    // SLA start from updatedAt of the status change
    const start = new Date(updatedAt);
    const deadline = new Date(start.getTime() + Math.abs(slaHours) * 60 * 60 * 1000);
    const now = new Date();

    const diffMs = deadline.getTime() - now.getTime();
    const isOverdue = diffMs < 0;

    if (isOverdue) {
        const h = Math.abs(Math.floor(diffMs / (3600 * 1000)));
        const m = Math.abs(Math.floor((diffMs % (3600 * 1000)) / 60000));
        return {
            label: h > 0 ? `Trễ ${h}h ${m}p` : `Trễ ${m}p`,
            isOverdue: true,
            color: 'text-red-600 border-red-200 bg-red-50',
            badge: 'bg-red-500'
        };
    }

    const h = Math.floor(diffMs / (3600 * 1000));
    const m = Math.floor((diffMs % (3600 * 1000)) / 60000);

    let label = h > 0 ? `${h}h ${m}p` : `${m}p`;
    let color = h <= 2 ? 'text-amber-600 border-amber-200 bg-amber-50' : 'text-emerald-600 border-emerald-200 bg-emerald-50';
    let badge = h <= 2 ? 'bg-amber-500' : 'bg-emerald-500';

    return { label: `Còn ${label}`, isOverdue: false, color, badge };
}

const COLUMN_SLA_LABELS: Record<string, string> = {
    need_buy: 'Xử lý trong 1 ngày',
    bought: 'Mua trong 1 ngày',
    waiting_ship: 'Chờ trong 6 ngày',
    shipped: 'Xử lý trong 12h',

    ship_to_partner: 'Xử lý trong 1 ngày',
    partner_doing: 'Theo deadline',
    ship_back: 'Xử lý trong 1 ngày',

    requested: 'Cảnh báo 3h',
    manager_approved: 'Xử lý trong 1h',
    sale_contacted: 'Xong trong 1h',
    notified_tech: 'Xong trong 1h',
};



function groupByStatus<T extends { status: string }>(items: T[], columnIds: string[]): Record<string, T[]> {
    const map: Record<string, T[]> = {};
    columnIds.forEach((id) => (map[id] = []));
    items.forEach((item) => {
        if (map[item.status]) map[item.status].push(item);
    });
    return map;
}

function PhotoUpload({ label, value, onChange, disabled }: { label: string; value: string[]; onChange: (urls: string[]) => void; disabled?: boolean }) {
    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        try {
            const uploadedUrls: string[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const { url, error } = await uploadFile('orders', 'accessories', file);
                if (error) throw error;
                if (url) uploadedUrls.push(url);
            }
            onChange([...value, ...uploadedUrls]);
            toast.success('Đã tải ảnh lên thành công');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Lỗi upload ảnh');
        } finally {
            setUploading(false);
        }
    };

    const removePhoto = (index: number) => {
        const newValue = [...value];
        newValue.splice(index, 1);
        onChange(newValue);
    };

    return (
        <div className="space-y-2">
            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">{label}</Label>
            <div className="grid grid-cols-4 gap-2">
                {value?.map((url, i) => (
                    <div key={i} className="group relative aspect-square rounded-lg overflow-hidden border bg-white shadow-sm">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        {!disabled && (
                            <button
                                onClick={() => removePhoto(i)}
                                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Plus className="w-3 h-3 rotate-45" />
                            </button>
                        )}
                    </div>
                ))}
                {!disabled && (
                    <label className={`aspect-square rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        {uploading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <ImageIcon className="w-6 h-6 text-slate-300" />}
                        <span className="text-[10px] font-medium text-slate-400 mt-1">Tải ảnh</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                )}
            </div>
        </div>
    );
}

const ACCESSORY_TRANSITIONS: Record<string, { next: string; label: string; fields: { name: string; label: string; type: 'photo' | 'text' | 'number'; required: boolean; placeholder?: string }[] }> = {
    need_buy: { 
        next: 'bought', 
        label: 'Đã mua (Cập nhật ảnh)', 
        fields: [
            { name: 'photos_purchase', label: '1. Ảnh mua', type: 'photo', required: true },
            { name: 'photos_transfer', label: '2. Ảnh ck', type: 'photo', required: true }
        ] 
    },
    bought: { 
        next: 'waiting_ship', 
        label: 'Chờ ship (Cập nhật vận đơn)', 
        fields: [
            { name: 'tracking_number', label: '1. Mã vận đơn', type: 'text', required: true, placeholder: 'VN12345678...' },
            { name: 'notes_shipping', label: '2. Note', type: 'text', required: false, placeholder: 'Ghi chú vận chuyển...' }
        ] 
    },
    waiting_ship: { 
        next: 'shipped', 
        label: 'Ship tới (Cập nhật nhận hàng)', 
        fields: [
            { name: 'shipping_cost', label: '1. Phí ship (0đ hoặc 100k...)', type: 'text', required: true, placeholder: '0đ hoặc 100k...' },
            { name: 'photos_arrival', label: '2. Ảnh chụp lúc nhận hàng', type: 'photo', required: true }
        ] 
    },
    shipped: { 
        next: 'delivered_to_tech', 
        label: 'Giao KT (Hoàn tất bàn giao)', 
        fields: [
            { name: 'photos_item', label: '1. Chụp ảnh hàng', type: 'photo', required: true },
            { name: 'photos_storage', label: '2. Chụp chỗ để', type: 'photo', required: true }
        ] 
    },
    delivered_to_tech: {
        next: 'done',
        label: 'Hoàn tất',
        fields: []
    }
};

const PARTNER_TRANSITIONS: Record<string, { next: string; label: string; fields: { name: string; label: string; type: 'photo' | 'text' | 'number' | 'datetime-local'; required: boolean; placeholder?: string }[] }> = {
    ship_to_partner: { 
        next: 'partner_doing', 
        label: 'Đối tác đã nhận', 
        fields: [
            { name: 'photos_package', label: 'Ảnh gói đồ', type: 'photo', required: true }
        ] 
    },
    partner_doing: { 
        next: 'ship_back', 
        label: 'Gửi về Shop', 
        fields: [
            { name: 'partner_name', label: 'Tên đối tác', type: 'text', required: true, placeholder: 'Xưởng ABC...' },
            { name: 'partner_address', label: 'Địa chỉ', type: 'text', required: true, placeholder: 'Số 1 Trần Phú...' },
            { name: 'appointment_time', label: 'Hẹn ngày xong', type: 'datetime-local', required: true }
        ] 
    },
    ship_back: { 
        next: 'done', 
        label: 'Hoàn thành bàn giao', 
        fields: [
            { name: 'shipping_cost', label: 'Phí ship (Free hoặc 20k...)', type: 'text', required: true, placeholder: 'Free hoặc 20k...' },
            { name: 'photos_package_back', label: 'Ảnh gói hàng (về)', type: 'photo', required: true },
            { name: 'photos_storage', label: 'Ảnh chỗ để gói hàng', type: 'photo', required: true }
        ] 
    },
};


type KanbanCardProps = {
    row: any;
    onOpenDialog: (row: any) => void;
    onNavigateOrder: (id: string) => void;
    getOrder: (row: any) => { id?: string; order_code?: string };
    getProductCode?: (row: any) => string;
    getItemName: (row: any) => string;
    getProductImage?: (row: any) => string | null;
    extra?: React.ReactNode;
};

function AccessoryKanbanCard({ row, onOpenDialog, onNavigateOrder, getOrder, getProductCode, getItemName, getProductImage, extra }: KanbanCardProps) {
    const order = getOrder(row);
    const productCode = getProductCode?.(row) ?? '—';
    const productImage = getProductImage?.(row) ?? null;

    const slaConfig = REQUEST_SLA[row.status] || 0;
    const { label: slaLabel, isOverdue, color: slaColor, badge: slaBadge } = calculateSLADisplay(row.updated_at, slaConfig);

    return (
        <div
            className={`group relative rounded-xl border bg-card text-sm shadow-sm transition-all hover:shadow-md overflow-hidden ${isOverdue ? 'border-red-500 ring-1 ring-red-500' : ''}`}
        >
            <div className="relative w-full aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                {productImage ? (
                    <img src={productImage} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                    <Package className="h-10 w-10 text-muted-foreground/40" />
                )}
                {slaLabel && (
                    <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1 border ${slaColor}`}>
                        <Clock className="w-3 h-3" />
                        {slaLabel}
                    </div>
                )}
            </div>
            <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">{productCode.includes('.') ? 'Mã SP' : 'Mã ĐH'}:</span>
                            <span className="font-mono font-bold text-primary truncate" title={productCode}>{productCode}</span>
                        </div>
                        <p className="mt-1 font-medium text-slate-900 truncate" title={getItemName(row)}>
                            {row.metadata?.item_name || getItemName(row)}
                            {row.metadata?.quantity && <span className="text-muted-foreground ml-1">x{row.metadata.quantity}</span>}
                        </p>
                    </div>
                    {order.order_code && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/5"
                            onClick={() => order.id && onNavigateOrder(order.id)}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>

                {row.notes && (
                    <div className="mt-2 text-xs text-muted-foreground bg-muted/40 p-1.5 rounded-md line-clamp-2 italic" title={row.notes}>
                        &ldquo;{row.notes}&rdquo;
                    </div>
                )}

                {extra}

                <Button
                    variant={isOverdue ? "destructive" : "outline"}
                    size="sm"
                    className="mt-3 w-full h-8 text-xs font-semibold rounded-lg"
                    onClick={() => onOpenDialog(row)}
                >
                    {isOverdue ? "Xử lý quá hạn" : "Cập nhật"}
                </Button>
            </div>
        </div>
    );
}

function PartnerKanbanCard({ row, onOpenDialog, onNavigateOrder, getOrder, getProductCode, getItemName, getProductImage, extra }: KanbanCardProps) {
    const order = getOrder(row);
    const productCode = getProductCode?.(row) ?? '—';
    const productImage = getProductImage?.(row) ?? null;

    const slaConfig = REQUEST_SLA[row.status] || 0;
    const { label: slaLabel, isOverdue, color: slaColor } = calculateSLADisplay(row.updated_at, slaConfig);

    const metadata = row.metadata || {};
    const isAppointmentOverdue = row.status === 'partner_doing' && 
                                metadata.appointment_time && 
                                new Date(metadata.appointment_time).getTime() < Date.now();
    
    const finalOverdue = isOverdue || isAppointmentOverdue;

    return (
        <div
            className={`group relative rounded-xl border bg-card text-sm shadow-sm transition-all hover:shadow-md overflow-hidden ${finalOverdue ? 'border-red-500 ring-1 ring-red-500' : ''}`}
        >
            <div className="relative w-full aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                {productImage ? (
                    <img src={productImage} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                    <Package className="h-10 w-10 text-muted-foreground/40" />
                )}
                {slaLabel && (
                    <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1 border ${slaColor}`}>
                        <Clock className="w-3 h-3" />
                        {slaLabel}
                    </div>
                )}
            </div>
            <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">{productCode.includes('.') ? 'Mã SP' : 'Mã ĐH'}:</span>
                            <span className="font-mono font-bold text-primary truncate" title={productCode}>{productCode}</span>
                        </div>
                        <p className="mt-1 font-medium text-slate-900 truncate" title={getItemName(row)}>
                            {row.metadata?.item_name || getItemName(row)}
                        </p>
                    </div>
                    {order.order_code && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/5"
                            onClick={() => order.id && onNavigateOrder(order.id)}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>

                {metadata.partner_name && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 border border-slate-100 p-1.5 rounded-md">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span className="font-semibold">{metadata.partner_name}</span>
                    </div>
                )}

                {metadata.appointment_time && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 border border-slate-100 p-1.5 rounded-md">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Hẹn: </span>
                        <span className={isAppointmentOverdue ? 'text-red-600 font-bold' : 'font-semibold'}>
                            {formatDateTime(metadata.appointment_time)}
                        </span>
                    </div>
                )}

                {row.notes && (
                    <div className="mt-2 text-xs text-muted-foreground bg-muted/40 p-1.5 rounded-md line-clamp-2 italic">
                        &ldquo;{row.notes}&rdquo;
                    </div>
                )}

                {extra}

                <Button
                    variant={finalOverdue ? "destructive" : "outline"}
                    size="sm"
                    className="mt-3 w-full h-8 text-xs font-semibold rounded-lg"
                    onClick={() => onOpenDialog(row)}
                >
                    {finalOverdue ? "Xử lý quá hạn" : "Cập nhật"}
                </Button>
            </div>
        </div>
    );
}

function ExtensionKanbanCard({ row, onOpenDialog, onNavigateOrder, getOrder, getProductImage, extra }: Omit<KanbanCardProps, 'getItemName' | 'getProductCode'> & { getItemName?: (row: any) => string }) {
    const order = getOrder(row);
    const productImage = getProductImage?.(row) ?? null;

    // SLA for Extension: Warning if requested more than 3h ago (handled by requested: -3 SLA)
    const slaConfig = REQUEST_SLA[row.status] || 0;
    const { label: slaLabel, isOverdue, color: slaColor } = calculateSLADisplay(row.updated_at, slaConfig);

    return (
        <div
            className={`group relative rounded-xl border bg-card text-sm shadow-sm transition-all hover:shadow-md overflow-hidden ${isOverdue ? 'border-red-500 ring-1 ring-red-500' : ''}`}
        >
            <div className="relative w-full aspect-[16/9] bg-muted flex items-center justify-center overflow-hidden">
                {productImage ? (
                    <img src={productImage} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                    <Clock className="h-8 w-8 text-muted-foreground/30" />
                )}
                {slaLabel && (
                    <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1 border ${slaColor}`}>
                        <Clock className="w-3 h-3" />
                        {slaLabel}
                    </div>
                )}
            </div>

            <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <span className="font-mono font-bold text-primary truncate" title={order.order_code}>
                            #{order.order_code || '—'}
                        </span>
                    </div>
                    {order.id && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/5"
                            onClick={() => onNavigateOrder(order.id!)}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>

                <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-100 p-1.5 rounded-md">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Hạn mới: <span className="font-bold text-slate-900">{row.new_due_at ? formatDateTime(row.new_due_at) : '—'}</span></span>
                    </div>
                    {row.reason && (
                        <div className="text-[11px] text-muted-foreground line-clamp-2 italic italic px-1">
                            &ldquo;{row.reason}&rdquo;
                        </div>
                    )}
                </div>

                {extra}

                <Button
                    variant={isOverdue ? "destructive" : "outline"}
                    size="sm"
                    className="mt-3 w-full h-8 text-xs font-semibold rounded-lg"
                    onClick={() => onOpenDialog(row)}
                >
                    Cập nhật
                </Button>
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
                                <div className="mb-3 flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-slate-700">{col.label}</span>
                                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{byStatus[col.id]?.length ?? 0}</Badge>
                                    </div>
                                    {COLUMN_SLA_LABELS[col.id] && (
                                        <span className="text-[10px] text-muted-foreground font-medium italic">
                                            {COLUMN_SLA_LABELS[col.id]}
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-2 min-h-[200px]">
                                    {(byStatus[col.id] || []).map((row: any, index: number) => {
                                        const order = row.order_item?.order ?? row.order_product_service?.order_product?.order ?? row.order_product?.order;
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
                                                            onOpenDialog={onOpenDialog}
                                                            onNavigateOrder={onNavigateOrder}
                                                            getOrder={() => order || {}}
                                                            getProductCode={(r) => r.order_item?.item_code ?? 
                                                                 r.order_product_service?.order_product?.product_code ?? 
                                                                 r.order_product?.product_code ?? 
                                                                 (r.metadata?.order_code ?? '—').toUpperCase().replace('HD', 'HĐ')}
                                                            getItemName={(r) => r.order_item?.item_name ?? 
                                                                 r.order_product_service?.order_product?.name ?? 
                                                                 r.order_product?.name ?? '—'}
                                                            getProductImage={(r) => {
                                                                const v1 = r.order_item?.product?.image || r.metadata?.photos?.[0];
                                                                if (v1) return v1;
                                                                const op = r.order_product_service?.order_product ?? r.order_product;
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
                                <div className="mb-3 flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-slate-700">{col.label}</span>
                                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{byStatus[col.id]?.length ?? 0}</Badge>
                                    </div>
                                    {COLUMN_SLA_LABELS[col.id] && (
                                        <span className="text-[10px] text-muted-foreground font-medium italic">
                                            {COLUMN_SLA_LABELS[col.id]}
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-2 min-h-[200px]">
                                    {(byStatus[col.id] || []).map((row: any, index: number) => {
                                        const order = row.order_item?.order ?? row.order_product_service?.order_product?.order ?? row.order_product?.order;
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
                                                            onOpenDialog={onOpenDialog}
                                                            onNavigateOrder={onNavigateOrder}
                                                            getOrder={() => order || {}}
                                                            getProductCode={(r) => r.order_item?.item_code ?? 
                                                                 r.order_product_service?.order_product?.product_code ?? 
                                                                 r.order_product?.product_code ?? 
                                                                 (r.metadata?.order_code ?? '—').toUpperCase().replace('HD', 'HĐ')}
                                                            getItemName={(r) => r.order_item?.item_name ?? 
                                                                 r.order_product_service?.order_product?.name ?? 
                                                                 r.order_product?.name ?? '—'}
                                                            getProductImage={(r) => {
                                                                const v1 = r.order_item?.product?.image || r.metadata?.photos?.[0];
                                                                if (v1) return v1;
                                                                const op = r.order_product_service?.order_product ?? r.order_product;
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
                                                            onOpenDialog={onOpenDialog}
                                                            onNavigateOrder={onNavigateOrder}
                                                            getOrder={() => ({ id: order?.id ?? row.order_id, order_code: order?.order_code || '—' })}
                                                            getProductImage={(r) => {
                                                                const op = r.order?.order_products?.[0]; // Estimate first product
                                                                if (!op) return null;
                                                                const imgs = op.images;
                                                                if (Array.isArray(imgs) && imgs[0]) return imgs[0];
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

export function RequestsPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(true);
    const [accessories, setAccessories] = useState<any[]>([]);
    const [partners, setPartners] = useState<any[]>([]);
    const [extensions, setExtensions] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState((location.state as any)?.defaultTab || 'accessories');
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Dialog Mua phụ kiện / Gửi Đối Tác
    const [showAccessoryDialog, setShowAccessoryDialog] = useState(false);
    const [accessoryRow, setAccessoryRow] = useState<any>(null);
    const [accessoryStatus, setAccessoryStatus] = useState('');
    const [accessoryNotes, setAccessoryNotes] = useState('');

    const [showPartnerDialog, setShowPartnerDialog] = useState(false);
    const [partnerRow, setPartnerRow] = useState<any>(null);
    const [partnerStatus, setPartnerStatus] = useState('');
    const [partnerNotes, setPartnerNotes] = useState('');

    // Dialog Xin gia hạn
    const [showExtensionDialog, setShowExtensionDialog] = useState(false);
    const [extensionRow, setExtensionRow] = useState<any>(null);
    const [extensionStatus, setExtensionStatus] = useState('');
    const [extensionCustomerResult, setExtensionCustomerResult] = useState('');
    const [extensionNewDueAt, setExtensionNewDueAt] = useState('');
    const [extensionValidReason, setExtensionValidReason] = useState(false);
    const [extensionCancelReason, setExtensionCancelReason] = useState('1'); // '1', '2', '3'

    const [accessoryMeta, setAccessoryMeta] = useState<Record<string, any>>({});
    const [partnerMeta, setPartnerMeta] = useState<Record<string, any>>({});

    // Create Accessory Dialog State
    const [showCreateAccessory, setShowCreateAccessory] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemQuantity, setNewItemQuantity] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [newItemOrderCode, setNewItemOrderCode] = useState('');
    const [newItemNotes, setNewItemNotes] = useState('');
    const [newItemPhotos, setNewItemPhotos] = useState<string[]>([]);
    const [searchingOrder, setSearchingOrder] = useState(false);
    const [foundOrder, setFoundOrder] = useState<any>(null);
    const [foundItem, setFoundItem] = useState<any>(null);

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

    const handleUpdateAccessory = async (requestId: string, status: string) => {
        setUpdatingId(requestId);
        try {
            await requestsApi.updateAccessory(requestId, { status });
            toast.success('Đã cập nhật trạng thái mua phụ kiện');
            loadAll();
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleUpdatePartner = async (requestId: string, status: string) => {
        setUpdatingId(requestId);
        try {
            await requestsApi.updatePartner(requestId, { status });
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
        const trans = ACCESSORY_TRANSITIONS[row.status];
        
        // Prevent drag-to-next if required fields are missing
        if (trans && trans.next === newStatus) {
            for (const field of trans.fields) {
                if (field.required) {
                    const val = row.metadata?.[field.name];
                    if (!val || (Array.isArray(val) && val.length === 0)) {
                        toast.error(`Bạn cần điền/tải ${field.label}. Đã tự động mở Dialog xử lý.`);
                        openAccessoryDialog(row);
                        return;
                    }
                }
            }
        }

        const prevStatus = row.status;
        setAccessories((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: newStatus } : r)));
        requestsApi.updateAccessory(row.id, { status: newStatus }).then(() => {
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
        const trans = PARTNER_TRANSITIONS[row.status];
        
        // Validation for drag & drop
        if (trans && trans.next === newStatus) {
            for (const field of trans.fields) {
                if (field.required) {
                    const val = row.metadata?.[field.name];
                    if (!val || (Array.isArray(val) && val.length === 0)) {
                        toast.error(`Bạn cần điền/tải ${field.label}. Đã tự động mở Dialog xử lý.`);
                        openPartnerDialog(row);
                        return;
                    }
                }
            }
        }

        const prevStatus = row.status;
        setPartners((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: newStatus } : r)));
        requestsApi.updatePartner(row.id, { status: newStatus }).then(() => {
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
        setAccessoryRow(row);
        const trans = ACCESSORY_TRANSITIONS[row.status];
        setAccessoryStatus(trans?.next || row.status);
        setAccessoryNotes(row.notes ?? '');
        setAccessoryMeta(row.metadata || {});
        setShowAccessoryDialog(true);
    };

    const handleSubmitAccessory = async () => {
        if (!accessoryRow?.id) return;
        
        // Validation for mandatory fields
        const trans = ACCESSORY_TRANSITIONS[accessoryRow.status];
        if (trans) {
            for (const field of trans.fields) {
                if (field.required) {
                    const val = accessoryMeta[field.name];
                    if (!val || (Array.isArray(val) && val.length === 0)) {
                        toast.error(`Vui lòng điền/tải: ${field.label}`);
                        return;
                    }
                }
            }
        }

        setUpdatingId(accessoryRow.id);
        try {
            await requestsApi.updateAccessory(accessoryRow.id, {
                status: accessoryStatus,
                notes: accessoryNotes || undefined,
                metadata: accessoryMeta
            });
            toast.success('Đã cập nhật trạng thái mua phụ kiện');
            loadAll();
            setShowAccessoryDialog(false);
            setAccessoryRow(null);
            setAccessoryMeta({});
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        } finally {
            setUpdatingId(null);
        }
    };

    const openPartnerDialog = (row: any) => {
        setPartnerRow(row);
        const trans = PARTNER_TRANSITIONS[row.status];
        setPartnerStatus(trans?.next || row.status);
        setPartnerNotes(row.notes ?? '');
        setPartnerMeta(row.metadata || {});
        setShowPartnerDialog(true);
    };

    const handleSubmitPartner = async () => {
        if (!partnerRow?.id) return;
        
        const trans = PARTNER_TRANSITIONS[partnerRow.status];
        if (trans) {
            for (const field of trans.fields) {
                if (field.required) {
                    const val = partnerMeta[field.name];
                    if (!val || (Array.isArray(val) && val.length === 0)) {
                        toast.error(`Vui lòng điền/tải: ${field.label}`);
                        return;
                    }
                }
            }
        }

        setUpdatingId(partnerRow.id);
        try {
            await requestsApi.updatePartner(partnerRow.id, {
                status: partnerStatus,
                notes: partnerNotes || undefined,
                metadata: partnerMeta
            });
            toast.success('Đã cập nhật trạng thái gửi đối tác');
            loadAll();
            setShowPartnerDialog(false);
            setPartnerRow(null);
            setPartnerMeta({});
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

        // If rejected, valid_reason depends on the selected reason (1 and 2 are valid, 3 is not)
        const isRejected = extensionStatus === 'rejected';
        const finalValidReason = isRejected ? extensionValidReason : true;

        await handleUpdateExtension(
            extensionRow.order_id,
            extensionStatus,
            extensionNewDueAt || undefined,
            finalValidReason,
            extensionCustomerResult
        );
    };

    // Create Accessory Logic
    const handleSearchOrder = async () => {
        if (!newItemOrderCode.trim()) return;
        setSearchingOrder(true);
        try {
            // Normalize: HD -> HĐ, uppercase
            const query = newItemOrderCode.trim().toUpperCase().replace('HD', 'HĐ');
            
            // If query is HĐ1.1, base code is HĐ1
            const baseOrderCode = query.includes('.') ? query.split('.')[0] : query;

            const res = await ordersApi.getAll({ search: baseOrderCode });
            const orders = (res.data as any).data.orders || [];
            
            // 1. Try to find direct match by order_code
            let order = orders.find((o: any) => o.order_code === baseOrderCode);
            
            // 2. If not found or searching for specific item, try to find by product code in sub-items
            let targetItem = null;
            // Search in flattened items (works for both V1 order_items and V2 order_product_services)
            if (order && query.includes('.')) {
                targetItem = (order.items || []).find((it: any) => 
                    it.item_code === query || 
                    (it.product?.code === query) ||
                    (it.id === query) // Fallback for direct ID match
                );
            }

            if (order) {
                setFoundOrder(order);
                // If we specifically found an item, we can store it or toast it
                if (targetItem) {
                    setFoundItem(targetItem);
                    toast.success(`Đã tìm thấy đơn hàng: ${order.order_code} - Sản phẩm: ${targetItem.item_name}`);
                } else {
                    setFoundItem(null);
                    toast.success(`Đã tìm thấy đơn hàng: ${order.order_code}`);
                }
            } else {
                setFoundOrder(null);
                setFoundItem(null);
                toast.error('Không tìm thấy đơn hàng');
            }
        } catch (e) {
            toast.error('Lỗi tìm kiếm đơn hàng');
        } finally {
            setSearchingOrder(false);
        }
    };

    const handleCreateAccessory = async () => {
        if (!newItemName.trim()) {
            toast.error('Vui lòng nhập tên linh kiện / sản phẩm');
            return;
        }
        setUpdatingId('creating');
        try {
            const normalizedCustomCode = newItemOrderCode.trim().toUpperCase().replace('HD', 'HĐ');
            
            // Resolve correct ID based on the item found or the first item in the order
            let order_item_id = undefined;
            let order_product_id = undefined;
            let order_product_service_id = undefined;

            const itemToLink = foundItem || foundOrder?.items?.[0];
            if (itemToLink) {
                if (itemToLink.is_customer_item) {
                     if (itemToLink.item_type === 'product') {
                         order_product_id = itemToLink.id;
                     } else {
                         order_product_service_id = itemToLink.id;
                     }
                } else {
                     order_item_id = itemToLink.id;
                }
            }

            const payload = {
                notes: newItemNotes,
                metadata: {
                    item_name: newItemName,
                    quantity: newItemQuantity,
                    price_estimate: newItemPrice,
                    photos: newItemPhotos,
                    order_code: foundOrder?.order_code || (normalizedCustomCode || undefined)
                },
                order_item_id,
                order_product_id,
                order_product_service_id
            };
            console.log('📤 Sending Create Accessory Request:', payload);
            await requestsApi.createAccessory(payload);
            toast.success('Đã tạo yêu cầu mua phụ kiện');
            loadAll();
            setShowCreateAccessory(false);
            setNewItemName('');
            setNewItemQuantity('');
            setNewItemPrice('');
            setNewItemOrderCode('');
            setNewItemNotes('');
            setNewItemPhotos([]);
            setFoundOrder(null);
            setFoundItem(null);
        } catch (e: any) {
            console.error('❌ Create Accessory Error:', e);
            if (e.response) {
                console.error('❌ Server Response:', e.response.data);
            }
            toast.error(e?.response?.data?.message || 'Lỗi tạo yêu cầu');
        } finally {
            setUpdatingId(null);
        }
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
                        Trang dành cho Admin / Quản lý xử lý các phiếu Mua phụ kiện, Gửi Đối Tác và Xin gia hạn do kỹ thuật tạo.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
                    <RefreshCw className={loading ? 'animate-spin h-4 w-4 mr-2' : 'h-4 w-4 mr-2'} />
                    Tải lại
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-2xl">
                    <TabsTrigger value="accessories" className="gap-2">
                        <Package className="h-4 w-4" />
                        Mua phụ kiện ({accessories.length})
                    </TabsTrigger>
                    <TabsTrigger value="partners" className="gap-2">
                        <Truck className="h-4 w-4" />
                        Gửi Đối Tác ({partners.length})
                    </TabsTrigger>
                    <TabsTrigger value="extensions" className="gap-2">
                        <Clock className="h-4 w-4" />
                        Xin gia hạn ({extensions.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="accessories" className="mt-4">
                    <Card>
                        <CardHeader className="pb-4">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-lg font-bold">Yêu cầu Mua phụ kiện / VPP</CardTitle>
                                    <CardDescription>Kéo thả thẻ giữa các cột để chuyển trạng thái.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button size="sm" className="h-10 px-4 rounded-xl gap-2 font-bold shadow-lg shadow-primary/20" onClick={() => {
                                        setShowCreateAccessory(true);
                                    }}>
                                        <Plus className="w-4 h-4" />
                                        Tạo yêu cầu
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {accessories.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">Chưa có yêu cầu nào.</p>
                            ) : (
                                <AccessoryKanban
                                    items={accessories}
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
                            </div>
                        </CardHeader>
                        <CardContent>
                            {partners.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">Chưa có yêu cầu nào.</p>
                            ) : (
                                <PartnerKanban
                                    items={partners}
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
                            </div>
                        </CardHeader>
                        <CardContent>
                            {extensions.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">Chưa có yêu cầu nào.</p>
                            ) : (
                                <ExtensionKanban
                                    items={extensions}
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

            {/* Dialog Cập nhật Mua phụ kiện */}
            <Dialog open={showAccessoryDialog} onOpenChange={setShowAccessoryDialog}>
                <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="p-6 pb-4 bg-slate-50/50 border-b">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Package className="w-6 h-6 text-primary" />
                            Xử lý yêu cầu
                        </DialogTitle>
                    </DialogHeader>
                    {accessoryRow && (
                        <div className="p-6 space-y-5">
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                                <div className="h-10 w-10 shrink-0 bg-white rounded-lg border shadow-sm flex items-center justify-center">
                                    <RefreshCw className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Trạng thái tiếp theo</p>
                                    <p className="text-sm font-bold text-amber-900 mt-0.5">
                                        {ACCESSORY_LABELS[accessoryStatus] || accessoryStatus}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-slate-50 border rounded-xl p-4 space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Tên phụ kiện</p>
                                            <p className="text-sm font-bold text-slate-700">{accessoryRow.metadata?.item_name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Mã SP/ĐH</p>
                                            <p className="text-sm font-bold text-slate-700">{accessoryRow.metadata?.order_code || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Số lượng</p>
                                            <p className="text-sm font-bold text-slate-700">{accessoryRow.metadata?.quantity || '1'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Giá dự kiến</p>
                                            <p className="text-sm font-bold text-emerald-600">{(Number(accessoryRow.metadata?.price_estimate || 0)).toLocaleString()}đ</p>
                                        </div>
                                    </div>
                                    {accessoryRow.notes && (
                                        <div className="pt-2 border-t text-left">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Ghi chú KT</p>
                                            <p className="text-xs text-slate-600 italic">"{accessoryRow.notes}"</p>
                                        </div>
                                    )}
                                </div>

                                {ACCESSORY_TRANSITIONS[accessoryRow.status]?.fields.map((field) => (
                                    <div key={field.name} className="space-y-1.5 text-left">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                                                {field.label} {field.required && <span className="text-red-500">*</span>}
                                            </Label>
                                        </div>
                                        
                                        {field.type === 'photo' ? (
                                            <PhotoUpload
                                                label=""
                                                value={accessoryMeta[field.name] || []}
                                                onChange={(urls) => setAccessoryMeta(m => ({ ...m, [field.name]: urls }))}
                                            />
                                        ) : (
                                            <Input
                                                type={field.type === 'number' ? 'number' : 'text'}
                                                value={accessoryMeta[field.name] || ''}
                                                onChange={(e) => setAccessoryMeta(m => ({ ...m, [field.name]: e.target.value }))}
                                                placeholder={field.placeholder || '...'}
                                                className="h-10 rounded-lg text-left"
                                            />
                                        )}
                                    </div>
                                ))}
                                
                                <div className="space-y-1.5 pt-2 border-t border-dashed text-left">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Ghi chú xử lý</Label>
                                    <Textarea
                                        value={accessoryNotes}
                                        onChange={(e) => setAccessoryNotes(e.target.value)}
                                        placeholder="Nhập ghi chú (nếu có)..."
                                        className="min-h-[100px] rounded-xl resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="p-6 bg-slate-50/50 border-t flex items-center justify-between gap-3">
                        <Button variant="ghost" onClick={() => setShowAccessoryDialog(false)} className="rounded-xl px-6">Hủy</Button>
                        <Button
                            onClick={handleSubmitAccessory}
                            disabled={!!updatingId}
                            className="rounded-xl px-10 font-bold shadow-lg shadow-primary/20"
                        >
                            {updatingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Xác nhận
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog Cập nhật Gửi Đối Tác */}
            <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
                <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="p-6 pb-4 bg-slate-50/50 border-b">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Truck className="w-6 h-6 text-primary" />
                            Xử lý gửi đối tác
                        </DialogTitle>
                    </DialogHeader>
                    {partnerRow && (
                        <div className="p-6 space-y-5">
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                                <div className="h-10 w-10 shrink-0 bg-white rounded-lg border shadow-sm flex items-center justify-center">
                                    <RefreshCw className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Trạng thái tiếp theo</p>
                                    <p className="text-sm font-bold text-amber-900 mt-0.5">
                                        {PARTNER_LABELS[partnerStatus] || partnerStatus}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-slate-50 border rounded-xl p-4 space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Hạng mục</p>
                                            <p className="text-sm font-bold text-slate-700">
                                                {partnerRow.order_item?.item_name ?? 
                                                 partnerRow.order_product_service?.order_product?.name ?? 
                                                 partnerRow.order_product?.name ?? '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Mã SP/ĐH</p>
                                            <p className="text-sm font-bold text-slate-700">
                                                {partnerRow.order_item?.item_code ?? 
                                                 partnerRow.order_product_service?.order_product?.product_code ?? 
                                                 partnerRow.order_product?.product_code ?? 
                                                 (partnerRow.metadata?.order_code ?? '—').toUpperCase()}
                                            </p>
                                        </div>
                                    </div>
                                    {partnerRow.notes && (
                                        <div className="pt-2 border-t text-left">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Ghi chú KT</p>
                                            <p className="text-xs text-slate-600 italic">"{partnerRow.notes}"</p>
                                        </div>
                                    )}
                                </div>

                                {PARTNER_TRANSITIONS[partnerRow.status]?.fields.map((field) => (
                                    <div key={field.name} className="space-y-1.5 text-left">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                                                {field.label} {field.required && <span className="text-red-500">*</span>}
                                            </Label>
                                        </div>
                                        
                                        {field.type === 'photo' ? (
                                            <PhotoUpload
                                                label=""
                                                value={partnerMeta[field.name] || []}
                                                onChange={(urls) => setPartnerMeta(m => ({ ...m, [field.name]: urls }))}
                                            />
                                        ) : (
                                            <Input
                                                type={field.type === 'datetime-local' ? 'datetime-local' : (field.type === 'number' ? 'number' : 'text')}
                                                value={partnerMeta[field.name] || ''}
                                                onChange={(e) => setPartnerMeta(m => ({ ...m, [field.name]: e.target.value }))}
                                                placeholder={field.placeholder || '...'}
                                                className="h-10 rounded-lg text-left"
                                            />
                                        )}
                                    </div>
                                ))}

                                <div className="space-y-1.5 pt-2 border-t border-dashed text-left">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Ghi chú xử lý</Label>
                                    <Textarea
                                        value={partnerNotes}
                                        onChange={(e) => setPartnerNotes(e.target.value)}
                                        placeholder="Nhập ghi chú (nếu có)..."
                                        className="min-h-[100px] rounded-xl resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="p-6 bg-slate-50/50 border-t flex items-center justify-between gap-3">
                        <Button variant="ghost" onClick={() => setShowPartnerDialog(false)} className="rounded-xl px-6">Hủy</Button>
                        <Button
                            onClick={handleSubmitPartner}
                            disabled={!!updatingId}
                            className="rounded-xl px-10 font-bold shadow-lg shadow-primary/20"
                        >
                            {updatingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Xác nhận
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            {/* Dialog Xin gia hạn */}
            <Dialog open={showExtensionDialog} onOpenChange={setShowExtensionDialog}>
                <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="p-6 pb-4 bg-slate-50/50 border-b">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Clock className="w-6 h-6 text-primary" />
                            Xử lý gia hạn đơn hàng
                        </DialogTitle>
                    </DialogHeader>
                    {extensionRow && (
                        <div className="p-6 space-y-6">
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                                <div className="h-10 w-10 shrink-0 bg-white rounded-lg border shadow-sm flex items-center justify-center">
                                    <AlertCircle className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Hành động tiếp theo</p>
                                    <p className="text-sm font-bold text-blue-900 mt-0.5">
                                        {extensionStatus === 'rejected' ? 'Từ chối yêu cầu' :
                                            extensionStatus === 'manager_approved' ? 'QL đã duyệt' :
                                                EXTENSION_LABELS[extensionStatus] || extensionStatus}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-slate-500">Trạng thái mới</Label>
                                    <Select value={extensionStatus} onValueChange={setExtensionStatus}>
                                        <SelectTrigger className="h-11 rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="sale_contacted">Sale đã liên hệ</SelectItem>
                                            <SelectItem value="manager_approved">QL đã duyệt</SelectItem>
                                            <SelectItem value="notified_tech">Đã báo KT</SelectItem>
                                            <SelectItem value="rejected">Từ chối</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {extensionStatus === 'rejected' ? (
                                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                                        <Label className="text-xs font-bold text-slate-500">Lý do từ chối (KPI impact)</Label>
                                        <Select value={extensionCancelReason} onValueChange={(val) => {
                                            setExtensionCancelReason(val);
                                            setExtensionValidReason(val === '1' || val === '2');
                                        }}>
                                            <SelectTrigger className="h-11 rounded-xl">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">Máy hỏng / Mất điện (Không dính KPI)</SelectItem>
                                                <SelectItem value="2">Thiếu linh kiện / Hết vật tư (Không dính KPI)</SelectItem>
                                                <SelectItem value="3">Quên chưa làm (Bị tính KPI)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[10px] text-muted-foreground px-1 py-1">
                                            {extensionCancelReason === '3' ?
                                                '⚠️ Lưu ý: Lý do này sẽ gây trễ KPI cho nhân viên.' :
                                                '✅ Lý do hợp lệ: Không gây trễ KPI.'}
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-slate-500">Gia hạn đến ngày</Label>
                                            <div className="relative">
                                                <Input
                                                    type="datetime-local"
                                                    value={extensionNewDueAt}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExtensionNewDueAt(e.target.value)}
                                                    className="h-11 rounded-xl pl-10"
                                                />
                                                <Calendar className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-slate-500">Kết quả báo khách</Label>
                                            <Textarea
                                                value={extensionCustomerResult}
                                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setExtensionCustomerResult(e.target.value)}
                                                placeholder="Khách đồng ý / hẹn lại sau..."
                                                className="min-h-[100px] rounded-xl resize-none"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    <DialogFooter className="p-6 bg-slate-50/50 border-t flex items-center justify-between gap-3">
                        <Button variant="ghost" onClick={() => setShowExtensionDialog(false)} className="rounded-xl px-6">Hủy</Button>
                        <Button
                            onClick={handleSubmitExtension}
                            disabled={!!updatingId}
                            className={`rounded-xl px-10 font-bold shadow-lg ${extensionStatus === 'rejected' ? 'bg-red-600 hover:bg-red-700 shadow-red-200 text-white' : 'shadow-primary/20 bg-primary text-primary-foreground'}`}
                        >
                            {updatingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Xác nhận xử lý
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog Tạo yêu cầu mới */}
            <Dialog open={showCreateAccessory} onOpenChange={setShowCreateAccessory}>
                <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="p-6 pb-4 bg-slate-50/50 border-b">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Plus className="w-6 h-6 text-primary" />
                            Tạo yêu cầu mua phụ kiện
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500">Tên phụ kiện *</Label>
                            <Input
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                placeholder=""
                                className="h-11 rounded-xl"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500">Số lượng</Label>
                                <div className="relative">
                                    <Input
                                        value={newItemQuantity}
                                        onChange={(e) => setNewItemQuantity(e.target.value)}
                                        placeholder="1"
                                        className="h-11 rounded-xl pl-10"
                                    />
                                    <Hash className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500">Giá dự kiến</Label>
                                <div className="relative">
                                    <Input
                                        value={newItemPrice}
                                        onChange={(e) => {
                                            const digits = e.target.value.replace(/\D/g, '');
                                            if (!digits) setNewItemPrice('');
                                            else setNewItemPrice(new Intl.NumberFormat('en-US').format(Number(digits)));
                                        }}
                                        placeholder="1,500,000"
                                        className="h-11 rounded-xl pl-10"
                                    />
                                    <DollarSign className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500">Mã đơn hàng liên quan (không bắt buộc)</Label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        value={newItemOrderCode}
                                        onChange={(e) => setNewItemOrderCode(e.target.value)}
                                        placeholder="HĐ.123..."
                                        className="h-11 rounded-xl pl-10"
                                    />
                                    <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                                </div>
                                <Button
                                    variant="outline"
                                    className="h-11 rounded-xl px-4"
                                    onClick={handleSearchOrder}
                                    disabled={searchingOrder}
                                >
                                    {searchingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tìm'}
                                </Button>
                            </div>
                            {foundOrder && (
                                <div className="mt-1 flex items-center gap-2 p-2 bg-green-50 border border-green-100 rounded-lg animate-in fade-in slide-in-from-top-1">
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    <span className="text-xs font-medium text-green-800">
                                        Khớp: {foundOrder.order_code}{foundItem ? ` - ${foundItem.item_name}` : ''}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500">Ghi chú chi tiết</Label>
                            <Textarea
                                value={newItemNotes}
                                onChange={(e) => setNewItemNotes(e.target.value)}
                                placeholder="Mô tả tình trạng, yêu cầu đặc biệt..."
                                className="min-h-[80px] rounded-xl resize-none"
                            />
                        </div>

                        <PhotoUpload
                            label="Ảnh phụ kiện mẫu / Link sản phẩm"
                            value={newItemPhotos}
                            onChange={setNewItemPhotos}
                        />
                    </div>
                    <DialogFooter className="p-6 bg-slate-50/50 border-t flex items-center justify-between gap-3">
                        <Button variant="ghost" onClick={() => setShowCreateAccessory(false)} className="rounded-xl px-6">Hủy</Button>
                        <Button
                            onClick={handleCreateAccessory}
                            disabled={!!updatingId || !newItemName}
                            className="rounded-xl px-10 font-bold shadow-lg shadow-primary/20"
                        >
                            {updatingId === 'creating' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Gửi yêu cầu
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
