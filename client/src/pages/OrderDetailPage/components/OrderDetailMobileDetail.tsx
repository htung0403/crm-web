import { useNavigate } from 'react-router-dom';
import {
    Calendar,
    ClipboardList,
    FileText,
    List,
    Pencil,
    Phone,
    Printer,
    Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, cn } from '@/lib/utils';
import type { Order, OrderItem } from '@/hooks/useOrders';
import { columns } from '@/components/orders/constants';
import { MobileProductPhotos } from './MobileProductPhotos';

interface OrderDetailMobileDetailProps {
    order: Order;
    canEdit: boolean;
    hasPendingEditApproval?: boolean;
    onShowPrintDialog: () => void;
    onShowInvoicePrintDialog: () => void;
    onShowPaymentDialog: () => void;
    onReload: () => void;
    onEditOrder?: () => void;
}

function MobileCard({
    icon: Icon,
    title,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <Card className="w-full min-w-0 overflow-hidden border-0 shadow-sm">
            <CardHeader className="space-y-0 px-3 pb-2 pt-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-white shadow-sm">
                        <Icon className="h-3.5 w-3.5 text-slate-600" />
                    </span>
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">{children}</CardContent>
        </Card>
    );
}

function FinanceCell({
    label,
    value,
    valueClassName,
    className,
}: {
    label: string;
    value: React.ReactNode;
    valueClassName?: string;
    className?: string;
}) {
    return (
        <div className={cn('min-w-0', className)}>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className={cn('mt-0.5 truncate text-xs font-bold tabular-nums leading-tight', valueClassName)}>
                {value}
            </div>
        </div>
    );
}

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="mt-1 text-sm font-medium leading-snug">{children}</div>
        </div>
    );
}

function formatShortDateTime(date: string) {
    const d = new Date(date);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const day = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    return `${time} · ${day}`;
}

function shortenName(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 3) {
        return `${parts[0]} ${parts[1].charAt(0)}. ${parts[parts.length - 1]}`;
    }
    if (parts.length === 2) {
        return `${parts[0]} ${parts[1].charAt(0)}.`;
    }
    return name;
}

function buildItemGroups(items: OrderItem[]) {
    type ItemGroup = { product: OrderItem | null; services: OrderItem[] };
    const groups: ItemGroup[] = [];
    let i = 0;
    while (i < items.length) {
        const item = items[i] as OrderItem & { is_customer_item?: boolean };
        if (item.is_customer_item && item.item_type === 'product') {
            const services: OrderItem[] = [];
            let j = i + 1;
            while (j < items.length) {
                const next = items[j] as OrderItem & { is_customer_item?: boolean };
                if (next.is_customer_item && next.item_type === 'product') break;
                services.push(items[j]);
                j++;
            }
            groups.push({ product: item, services });
            i = j;
        } else {
            groups.push({ product: null, services: [item] });
            i++;
        }
    }
    return groups;
}

function ProductLine({
    name,
    quantity,
    dotColor,
    dueAt,
    conditionBefore,
    showProductMeta = false,
    indent = false,
}: {
    name: string;
    quantity: number;
    dotColor: 'blue' | 'purple';
    dueAt?: string;
    conditionBefore?: string;
    showProductMeta?: boolean;
    indent?: boolean;
}) {
    return (
        <div
            className={cn(
                'flex items-center gap-2 border-t border-slate-100 py-2.5 first:border-t-0',
                indent && 'pl-3',
            )}
        >
            <span
                className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    dotColor === 'blue' ? 'bg-blue-600' : 'bg-purple-600',
                )}
            />
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                {showProductMeta && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-700">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>Hạn trả đồ: {dueAt ? new Date(dueAt).toLocaleDateString('vi-VN') : '—'}</span>
                    </div>
                )}
                {showProductMeta && (
                    <div className="mt-0.5 flex items-start gap-1 text-[11px] text-muted-foreground">
                        <FileText className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="line-clamp-2 leading-tight">Tình trạng ban đầu: {conditionBefore || '—'}</span>
                    </div>
                )}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">SL: {quantity}</span>
        </div>
    );
}

export function OrderDetailMobileDetail({
    order,
    canEdit,
    hasPendingEditApproval = false,
    onShowPrintDialog,
    onShowInvoicePrintDialog,
    onShowPaymentDialog,
    onReload,
    onEditOrder,
}: OrderDetailMobileDetailProps) {
    const navigate = useNavigate();
    const remaining =
        order.remaining_debt ?? Math.max(0, (order.total_amount || 0) - (order.paid_amount || 0));
    const statusTitle = columns.find((c) => c.id === order.status)?.title || order.status;
    const statusColumn = columns.find((c) => c.id === order.status);
    const groups = order.items?.length ? buildItemGroups(order.items) : [];

    const paymentBadgeLabel =
        order.payment_status === 'paid'
            ? 'Đã TT'
            : order.payment_status === 'partial'
              ? 'TT một phần'
              : 'Chưa TT';

    const canEditOrder =
        canEdit && order.status !== 'after_sale' && order.status !== 'cancelled' && !hasPendingEditApproval;
    const canEditPhotos = canEdit && order.status !== 'cancelled';

    return (
        <div className="w-full min-w-0 max-w-full space-y-3">
            <MobileCard icon={Receipt} title="Tổng đơn hàng">
                <div className="grid min-w-0 grid-cols-2 gap-x-2 gap-y-3">
                    <FinanceCell label="Tạm tính" value={formatCurrency(order.subtotal || 0)} />
                    <FinanceCell
                        label="Tổng"
                        value={formatCurrency(order.total_amount || 0)}
                        valueClassName="text-blue-600"
                    />
                    <FinanceCell
                        label="Đã thanh toán"
                        value={formatCurrency(order.paid_amount || 0)}
                        valueClassName="text-emerald-600"
                    />
                    <FinanceCell
                        label="Còn nợ"
                        value={formatCurrency(remaining)}
                        valueClassName={remaining > 0 ? 'text-orange-600' : undefined}
                    />
                    <div className="col-span-2 min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Trạng thái TT
                        </p>
                        <Badge
                            className={cn(
                                'mt-1 border-0 text-[11px] font-semibold',
                                order.payment_status === 'paid'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : order.payment_status === 'partial'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-red-100 text-red-700',
                            )}
                        >
                            {paymentBadgeLabel}
                        </Badge>
                    </div>
                </div>

                <div className="mt-3 grid min-w-0 grid-cols-3 gap-1.5">
                    <button
                        type="button"
                        onClick={onShowPrintDialog}
                        className="flex flex-col items-center gap-1.5 rounded-xl bg-blue-50 px-1 py-2.5 active:scale-[0.98]"
                    >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                            <Printer className="h-4 w-4" />
                        </span>
                        <span className="text-center text-[10px] font-medium leading-tight text-blue-900">
                            In phiếu QR
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={onShowInvoicePrintDialog}
                        className="flex flex-col items-center gap-1.5 rounded-xl bg-amber-50 px-1 py-2.5 active:scale-[0.98]"
                    >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                            <FileText className="h-4 w-4" />
                        </span>
                        <span className="text-center text-[10px] font-medium leading-tight text-amber-900">
                            In hóa đơn
                        </span>
                    </button>
                    <button
                        type="button"
                        disabled={!canEditOrder}
                        onClick={() => {
                            if (!canEditOrder) return;
                            if (onEditOrder) {
                                onEditOrder();
                                return;
                            }
                            navigate(`/orders/${order.id}/edit`);
                        }}
                        className={cn(
                            'flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 active:scale-[0.98]',
                            canEditOrder ? 'bg-violet-50' : 'bg-muted/50 opacity-50',
                        )}
                    >
                        <span
                            className={cn(
                                'flex h-9 w-9 items-center justify-center rounded-lg',
                                canEditOrder ? 'bg-violet-100 text-violet-700' : 'bg-muted text-muted-foreground',
                            )}
                        >
                            <Pencil className="h-4 w-4" />
                        </span>
                        <span
                            className={cn(
                                'text-center text-[10px] font-medium leading-tight',
                                canEditOrder ? 'text-violet-900' : 'text-muted-foreground',
                            )}
                        >
                            {hasPendingEditApproval ? 'Chờ duyệt sửa' : 'Chỉnh sửa đơn'}
                        </span>
                    </button>
                </div>
            </MobileCard>

            {hasPendingEditApproval && (
                <MobileCard icon={Receipt} title="Trạng thái duyệt sửa">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                        Đơn hàng đang chờ admin/quản lý duyệt yêu cầu sửa.
                    </div>
                </MobileCard>
            )}

            <MobileCard icon={List} title="Chi tiết đơn hàng">
                <div className="grid min-w-0 grid-cols-2 gap-x-2 gap-y-3">
                    <MetaCell label="Trạng thái">
                        <Badge
                            variant="outline"
                            className={cn(
                                'border-0 text-[11px] font-medium',
                                statusColumn?.bgColor,
                                statusColumn?.color,
                            )}
                        >
                            {statusTitle}
                        </Badge>
                    </MetaCell>
                    <MetaCell label="Ngày tạo">
                        {order.created_at ? formatShortDateTime(order.created_at) : '—'}
                    </MetaCell>
                    <MetaCell label="Hoàn thành">
                        {order.completed_at ? formatShortDateTime(order.completed_at) : 'Chưa xong'}
                    </MetaCell>
                    <MetaCell label="Phụ trách">
                        {shortenName(order.sales_user?.name || 'N/A')}
                    </MetaCell>
                </div>

                <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                    <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-blue-600 text-sm font-semibold text-white">
                            {order.customer?.name?.charAt(0)?.toUpperCase() || 'C'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{order.customer?.name || 'N/A'}</p>
                        <p className="truncate text-xs text-muted-foreground">
                            {order.customer?.phone || 'Không có SĐT'}
                        </p>
                    </div>
                    {order.customer?.phone && (
                        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 bg-white" asChild>
                            <a href={`tel:${order.customer.phone}`}>
                                <Phone className="h-4 w-4" />
                            </a>
                        </Button>
                    )}
                </div>

                {groups.length > 0 && (
                    <div className="mt-2">
                        {groups.map((group, gi) => {
                            if (group.product) {
                                const product = group.product;
                                const isCustomerProduct = !!(product as OrderItem & { is_customer_item?: boolean })
                                    .is_customer_item;
                                return (
                                    <div key={gi}>
                                        <ProductLine
                                            name={product.item_name}
                                            quantity={product.quantity}
                                            dotColor="blue"
                                            dueAt={(product as any).due_at}
                                            conditionBefore={(product as any).condition_before || (product as any).product_condition_before}
                                            showProductMeta
                                        />
                                        {isCustomerProduct && (
                                            <MobileProductPhotos
                                                item={product}
                                                canEdit={canEditPhotos}
                                                onUpdated={onReload}
                                            />
                                        )}
                                        {group.services.map((svc, si) => (
                                            <ProductLine
                                                key={si}
                                                name={svc.item_name}
                                                quantity={svc.quantity}
                                                dotColor="purple"
                                                indent
                                            />
                                        ))}
                                    </div>
                                );
                            }
                            const item = group.services[0];
                            return (
                                <ProductLine
                                    key={gi}
                                    name={item.item_name}
                                    quantity={item.quantity}
                                    dotColor={item.item_type === 'product' ? 'blue' : 'purple'}
                                    dueAt={(item as any).due_at}
                                    conditionBefore={(item as any).condition_before || (item as any).product_condition_before}
                                    showProductMeta={item.item_type === 'product'}
                                />
                            );
                        })}
                    </div>
                )}
            </MobileCard>

            {order.notes && (
                <MobileCard icon={ClipboardList} title="Ghi chú">
                    <p className="text-sm leading-relaxed text-muted-foreground">{order.notes}</p>
                </MobileCard>
            )}
        </div>
    );
}
