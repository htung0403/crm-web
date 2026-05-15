import React from 'react';
import { Calendar, ChevronRight, Circle, MoreVertical, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/utils';
import type { KanbanColumn } from './constants';
import type { Order, OrderItem } from '@/hooks/useOrders';

interface ProductGroup {
    product: OrderItem | null;
    services: OrderItem[];
}

interface MobileOrdersKanbanProps {
    columns: KanbanColumn[];
    getCardsByStatus: (status: string) => Array<{ order: Order; group: ProductGroup; groupIndex: number }>;
    onCardClick: (order: Order, group: ProductGroup) => void;
    onViewOrder: (order: Order, group: ProductGroup) => void;
    onEditOrder: (order: Order) => void;
    onDeleteOrder: (order: Order) => void;
}

function getTechnicianNames(services: OrderItem[]) {
    const names = new Set<string>();

    for (const service of services) {
        if (service.technicians?.length) {
            for (const tech of service.technicians) {
                if (tech.technician?.name) names.add(tech.technician.name);
            }
        } else if (service.technician?.name) {
            names.add(service.technician.name);
        }
    }

    return [...names].join(', ');
}

function getDeadlineStatus(dueAt?: string) {
    if (!dueAt) return null;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueAt);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return {
            dateClassName: 'text-red-600 font-semibold',
            badgeClassName: 'bg-red-100 text-red-600',
            label: `Quá ${Math.abs(diffDays)} ngày`,
        };
    }

    if (diffDays === 0) {
        return {
            dateClassName: 'text-red-600 font-semibold',
            badgeClassName: 'bg-red-100 text-red-600',
            label: 'Hôm nay',
        };
    }

    if (diffDays <= 2) {
        return {
            dateClassName: 'text-amber-600 font-semibold',
            badgeClassName: 'bg-amber-100 text-amber-700',
            label: `Còn ${diffDays} ngày`,
        };
    }

    return {
        dateClassName: 'text-emerald-600 font-semibold',
        badgeClassName: 'bg-emerald-100 text-emerald-700',
        label: `Còn ${diffDays} ngày`,
    };
}

function MobileOrderCard({
    order,
    group,
    onClick,
    onView,
    onEdit,
    onDelete,
}: {
    order: Order;
    group: ProductGroup;
    onClick: () => void;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const product = group.product;
    const services = group.services || [];
    const primaryService = services.find((service) => service.item_name !== product?.item_name) || services[0];
    const displayName = product?.item_name || services[0]?.item_name || 'N/A';
    const serviceName = primaryService?.item_name || primaryService?.service?.name;
    const productCode =
        product?.item_code ||
        product?.product?.code ||
        product?.service?.code ||
        services[0]?.item_code ||
        services[0]?.service?.code ||
        order.order_code;
    const receiveDate = order.confirmed_at || order.created_at;
    const dueAt = product?.due_at || services[0]?.due_at;
    const deadline = getDeadlineStatus(dueAt);
    const responsibleName = getTechnicianNames(services) || order.sales_user?.name || 'N/A';
    const salesName = order.sales_user?.name || 'N/A';
    const avatarLabel = displayName.trim().charAt(0).toUpperCase() || 'SP';

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
            className="block w-full overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition active:scale-[0.99]"
        >
            <div className="flex gap-3 p-3">
                <Avatar className="h-12 w-12 shrink-0 rounded-xl bg-blue-50">
                    <AvatarFallback className="rounded-xl bg-blue-50 text-sm font-semibold text-blue-600">
                        {avatarLabel}
                    </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center gap-2 text-xs text-slate-500">
                        <span className="shrink-0 font-medium">{productCode}</span>
                        <span className="h-4 w-px bg-slate-200" />
                        <span className="truncate font-semibold text-blue-600">{order.customer?.name || 'N/A'}</span>
                    </div>

                    <div className="flex min-w-0 items-center gap-1.5">
                        <h3 className="min-w-0 truncate text-base font-bold text-slate-950">{displayName}</h3>
                        {serviceName && serviceName !== displayName && (
                            <Badge className="shrink-0 rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-slate-900 hover:bg-blue-50">
                                {serviceName}
                            </Badge>
                        )}
                    </div>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mt-0.5 h-6 w-6 shrink-0 text-slate-500"
                        >
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>Xem</DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>Sửa</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                            Xóa
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="flex items-center gap-2.5 border-t border-slate-100 px-3 py-2.5 text-sm">
                <Calendar className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="text-slate-500">{receiveDate ? formatDate(receiveDate) : 'N/A'}</span>
                <span className="text-slate-400">-</span>
                <span className={deadline?.dateClassName || 'text-slate-500'}>{dueAt ? formatDate(dueAt) : 'N/A'}</span>
                {deadline && (
                    <Badge className={`ml-auto shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${deadline.badgeClassName}`}>
                        {deadline.label}
                    </Badge>
                )}
            </div>

            <div className="flex items-center gap-2.5 border-t border-slate-100 px-3 py-2.5 text-sm">
                <UserRound className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="shrink-0 text-slate-500">Người phụ trách:</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-950">{responsibleName}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
            </div>

            <div className="flex items-center gap-2.5 border-t border-slate-100 px-3 py-2.5 text-sm">
                <span className="shrink-0 text-slate-500">Sale:</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-950">{salesName}</span>
            </div>
        </div>
    );
}

export function MobileOrdersKanban({
    columns: columnsList,
    getCardsByStatus,
    onCardClick,
    onViewOrder,
    onEditOrder,
    onDeleteOrder,
}: MobileOrdersKanbanProps) {
    const [activeColumnIndex, setActiveColumnIndex] = React.useState(0);

    React.useEffect(() => {
        const container = document.getElementById('mobile-orders-kanban-scroll');
        if (!container) return;

        const handleScroll = () => {
            const scrollLeft = container.scrollLeft;
            const columnWidth = container.offsetWidth;
            const index = Math.round(scrollLeft / columnWidth);
            setActiveColumnIndex(Math.min(index, columnsList.length - 1));
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [columnsList.length]);

    const scrollToColumn = (index: number) => {
        const container = document.getElementById('mobile-orders-kanban-scroll');
        if (container) {
            container.scrollTo({
                left: container.offsetWidth * index,
                behavior: 'smooth',
            });
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex gap-1 overflow-x-auto pb-2">
                {columnsList.map((column, index) => {
                    const count = getCardsByStatus(column.id).length;
                    const isActive = index === activeColumnIndex;
                    const ColumnIcon = column.icon ?? Circle;

                    return (
                        <button
                            key={column.id}
                            onClick={() => scrollToColumn(index)}
                            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                                isActive ? `${column.bgColor} border-2 border-primary` : 'border border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                        >
                            <div className={`rounded p-1.5 ${column.color}`}>
                                <ColumnIcon className="h-3 w-3" />
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-semibold text-foreground">{column.title}</p>
                                <p className="text-xs text-muted-foreground">{count}</p>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div id="mobile-orders-kanban-scroll" className="-mx-2 snap-x snap-mandatory overflow-x-auto px-2 pb-4 scroll-smooth">
                <div className="flex w-fit gap-4">
                    {columnsList.map((column) => {
                        const cards = getCardsByStatus(column.id);

                        return (
                            <div key={column.id} className="w-[100vw] shrink-0 snap-center sm:w-96">
                                <Card className={`${column.bgColor} ${column.borderColor} h-full border`}>
                                    <CardHeader className="p-3 pb-2">
                                        <CardTitle className={`flex items-center justify-between text-sm font-semibold ${column.color}`}>
                                            <span>{column.title}</span>
                                            <Badge variant="secondary" className="bg-white/80 text-xs">
                                                {cards.length}
                                            </Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto p-2">
                                        {cards.length === 0 ? (
                                            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">Không có đơn hàng</div>
                                        ) : (
                                            cards.map((item, idx) => (
                                                <MobileOrderCard
                                                    key={`${item.order.id}-${idx}`}
                                                    order={item.order}
                                                    group={item.group}
                                                    onClick={() => onCardClick(item.order, item.group)}
                                                    onView={() => onViewOrder(item.order, item.group)}
                                                    onEdit={() => onEditOrder(item.order)}
                                                    onDelete={() => onDeleteOrder(item.order)}
                                                />
                                            ))
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
