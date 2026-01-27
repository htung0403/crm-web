import { Draggable } from '@hello-pangea/dnd';
import { Clock, User, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatCurrency } from '@/lib/utils';
import type { Order } from '@/hooks/useOrders';
import { calculateSLAProgress } from './constants';

interface OrderCardProps {
    order: Order;
    index: number;
    onClick: () => void;
}

export function OrderCard({ order, index, onClick }: OrderCardProps) {
    const sla = calculateSLAProgress(order.completed_at, order.created_at);

    return (
        <Draggable draggableId={order.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={onClick}
                    className={`kanban-card p-4 rounded-xl bg-white border shadow-sm cursor-pointer ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/20' : ''
                        }`}
                >
                    {/* Order Code */}
                    <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-sm text-foreground">{order.order_code}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Customer */}
                    <div className="flex items-center gap-2 mb-3">
                        <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {order.customer?.name?.charAt(0) || 'C'}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">{order.customer?.name || 'N/A'}</span>
                    </div>

                    {/* Amount */}
                    <div className="mb-3">
                        <span className="text-lg font-bold text-primary">{formatCurrency(order.total_amount)}</span>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-3">
                        {order.items?.slice(0, 3).map((item, i) => (
                            <Badge key={i} variant={item.item_type === 'service' ? 'secondary' : 'outline'} className="text-xs truncate max-w-25">
                                {item.item_name}
                            </Badge>
                        ))}
                        {(order.items?.length || 0) > 3 && (
                            <Badge variant="secondary" className="text-xs">
                                +{(order.items?.length || 0) - 3}
                            </Badge>
                        )}
                    </div>

                    {/* SLA Progress */}
                    {order.status !== 'completed' && order.status !== 'cancelled' && (
                        <div className="mb-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    SLA
                                </span>
                                <span className={`font-medium ${sla.color === 'bg-red-500' ? 'text-red-600' : sla.color === 'bg-amber-500' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {sla.label}
                                </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${sla.color} transition-all duration-300`}
                                    style={{ width: `${sla.percentage}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Assigned Employee */}
                    <div className="flex items-center gap-2 pt-2 border-t text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{order.sales_user?.name || 'N/A'}</span>
                    </div>
                </div>
            )}
        </Draggable>
    );
}
