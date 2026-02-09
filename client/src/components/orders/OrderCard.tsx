import { Draggable } from '@hello-pangea/dnd';
import { Calendar, User, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Order, OrderItem } from '@/hooks/useOrders';
import { columns, getRoomDeadlineDisplay } from './constants';
import { formatDate } from '@/lib/utils';

export interface ProductGroup {
    product: OrderItem | null;
    services: OrderItem[];
}

interface OrderCardProps {
    draggableId: string;
    order: Order;
    productGroup: ProductGroup;
    columnId: string;
    index: number;
    onClick: () => void;
}

export function OrderCard({ draggableId, order, productGroup, columnId, index, onClick }: OrderCardProps) {
    const { product, services } = productGroup;
    const column = columns.find((c) => c.id === columnId);
    const columnTitle = column?.title ?? columnId;

    const allItems = order?.items || [];
    const effectiveProduct = product;
    const effectiveServices = services.length > 0 ? services : allItems.filter((it) => it.item_name);

    const productImage =
        effectiveProduct?.product?.image ||
        effectiveProduct?.service?.image ||
        effectiveServices[0]?.product?.image ||
        effectiveServices[0]?.service?.image;

    const productCode =
        effectiveProduct?.item_code ||
        effectiveProduct?.product?.code ||
        effectiveProduct?.service?.code ||
        effectiveServices[0]?.item_code ||
        effectiveServices[0]?.service?.code ||
        order?.order_code ||
        'N/A';

    const technicianNames = (() => {
        const names = new Set<string>();
        for (const s of effectiveServices) {
            if (s.technicians?.length) {
                for (const t of s.technicians) {
                    if (t.technician?.name) names.add(t.technician.name);
                }
            } else if (s.technician?.name) {
                names.add(s.technician.name);
            }
        }
        return names.size > 0 ? [...names].join(', ') : 'N/A';
    })();

    const roomDeadline = getRoomDeadlineDisplay(effectiveServices);
    const showRoomDeadline =
        order.status !== 'after_sale' &&
        order.status !== 'cancelled' &&
        roomDeadline.label !== 'N/A';

    const receiveDate = order.confirmed_at || order.created_at;
    const dueDate = order.due_at;

    return (
        <Draggable draggableId={draggableId} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={onClick}
                    className={`kanban-card p-3 rounded-xl bg-white border shadow-sm cursor-pointer text-sm ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/20' : ''}`}
                >
                    {/* Header: Ảnh + Mã SP + Trạng thái */}
                    <div className="flex gap-2 mb-2">
                        <Avatar className="h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-muted">
                            {productImage ? (
                                <img
                                    src={productImage}
                                    alt=""
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <AvatarFallback className="rounded-lg text-xs bg-primary/10 text-primary">
                                    {effectiveProduct?.item_name?.charAt(0) || effectiveServices[0]?.item_name?.charAt(0) || order?.order_code?.charAt(0) || 'SP'}
                                </AvatarFallback>
                            )}
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <span className="font-mono text-xs font-medium text-foreground block truncate">
                                {productCode}
                            </span>
                            <Badge variant="secondary" className="text-[10px] mt-0.5">
                                {columnTitle}
                            </Badge>
                        </div>
                    </div>

                    {/* Dịch vụ sử dụng */}
                    <div className="flex flex-wrap gap-1 mb-2">
                        {effectiveServices.length > 0 ? (
                            effectiveServices.slice(0, 3).map((s, i) => (
                                <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-[10px] truncate max-w-[120px]"
                                >
                                    {s.item_name}
                                </Badge>
                            ))
                        ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                        {effectiveServices.length > 3 && (
                            <Badge variant="secondary" className="text-[10px]">
                                +{effectiveServices.length - 3}
                            </Badge>
                        )}
                    </div>

                    {/* Ngày nhận - Ngày hẹn trả */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>
                            {receiveDate ? formatDate(receiveDate) : 'N/A'} - {dueDate ? formatDate(dueDate) : 'N/A'}
                        </span>
                    </div>

                    {/* Hạn phòng */}
                    {showRoomDeadline && (
                        <div className={`text-xs font-medium mb-2 ${roomDeadline.color}`}>
                            Hạn phòng: {roomDeadline.label}
                        </div>
                    )}

                    {/* Footer: Kỹ thuật và Sale - mỗi dòng riêng, nhiều KTV có thể wrap */}
                    <div className="space-y-1.5 pt-2 border-t text-xs text-muted-foreground">
                        <div className="flex items-start gap-1 min-w-0">
                            <Wrench className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span className="break-words line-clamp-2">{technicianNames}</span>
                        </div>
                        <div className="flex items-center gap-1 truncate">
                            <User className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{order.sales_user?.name || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            )}
        </Draggable>
    );
}
