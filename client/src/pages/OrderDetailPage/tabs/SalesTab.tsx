import React, { memo } from 'react';
import {
    ArrowLeft, ArrowRight, ShoppingBag, CreditCard,
    Wrench, Clock, CheckCircle, Sparkles, Copy, Bot, History, RotateCw,
    User as UserIcon, Tag, FileText, Package, Truck
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import type { Order, OrderItem } from '@/hooks/useOrders';
import {
    SALES_STEPS,
    getSalesStatusLabel,
} from '../constants';
import {
    getItemTypeLabel,
    getItemTypeColor,
} from '../utils';

interface SalesTabProps {
    order: Order;
    salesLogs: any[];
    updateOrderItemStatus: (itemId: string, status: string) => Promise<void>;
    updateOrderStatus: (orderId: string, status: string) => Promise<void>;
    reloadOrder: () => Promise<void>;
    fetchKanbanLogs: (orderId: string) => Promise<void>;
    onProductCardClick?: (group: { product: OrderItem | null; services: OrderItem[] }, roomId: string) => void;
    workflowKanbanGroups?: { product: OrderItem | null; services: OrderItem[] }[];
    onTabChange?: (tab: string) => void;
}

const SalesCard = memo(({
    group,
    index,
    column,
    order,
    onProductCardClick,
    colIdx,
    updateOrderItemStatus,
    fetchKanbanLogs,
    reloadOrder,
    onTabChange
}: {
    group: { product: OrderItem | null; services: OrderItem[] };
    index: number;
    column: typeof SALES_STEPS[number];
    order: Order;
    onProductCardClick?: (group: any, roomId: string) => void;
    colIdx: number;
    updateOrderItemStatus: (itemId: string, status: string) => Promise<void>;
    fetchKanbanLogs: (orderId: string) => Promise<void>;
    reloadOrder: () => Promise<void>;
    onTabChange?: (tab: string) => void;
}) => {
    const leadItem = group.product || group.services[0];
    const draggableId = group.product?.id ?? group.services.map((s: OrderItem) => s.id).join('-');

    const productImage =
        group.product?.image ||
        group.product?.product?.image ||
        group.product?.service?.image ||
        group.services[0]?.image ||
        group.services[0]?.product?.image ||
        group.services[0]?.service?.image;

    const productName = group.product?.item_name || group.services[0]?.item_name || 'Hạng mục';

    return (
        <Draggable key={draggableId} draggableId={draggableId} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={cn(
                        "bg-white rounded-xl shadow-sm p-4 mb-3 border-l-4 transition-all cursor-grab active:cursor-grabbing",
                        snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20 scale-105" : "",
                        column.id === 'step4' ? "border-red-400 hover:border-red-600" :
                            column.id === 'step5' ? "border-green-400 hover:border-green-600" :
                                "border-blue-400 hover:border-blue-600"
                    )}
                    onClick={() => onProductCardClick?.(group, column.id)}
                >
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold text-gray-400">#{order.order_code}</span>
                        <span className="text-xs font-bold text-muted-foreground text-[10px]">
                            #{leadItem?.item_code?.slice(-4) || 'Item'}
                        </span>
                    </div>

                    <div className="space-y-2 mb-3">
                        {productImage && (
                            <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-video w-full max-h-24">
                                <img
                                    src={productImage}
                                    alt={productName}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            </div>
                        )}
                        <h3 className="font-bold text-gray-800 text-[13px] flex items-center gap-1.5 flex-wrap">
                            <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="truncate">{productName}</span>
                        </h3>
                        {group.product && (
                            <Badge className={cn("text-[10px] px-1 h-4", getItemTypeColor('product'))}>
                                {getItemTypeLabel('product')}
                            </Badge>
                        )}
                    </div>

                    {group.services.length > 0 && (
                        <div className="mt-2 space-y-1 pl-1 border-l-2 border-primary/20">
                            {group.services.map((svc: OrderItem) => (
                                <div key={svc.id} className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600">
                                    <Wrench className="h-3 w-3 shrink-0 text-primary/60" />
                                    <span className="truncate">{svc.item_name}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            disabled={colIdx === 0}
                            onClick={async (e) => {
                                e.stopPropagation();
                                const prevStep = SALES_STEPS[colIdx - 1].id;
                                const itemsToUpdate = [];
                                if (group.product) itemsToUpdate.push(group.product);
                                if (group.services) itemsToUpdate.push(...group.services);

                                try {
                                    for (const item of itemsToUpdate) {
                                        await updateOrderItemStatus(item.id, prevStep);
                                    }
                                    toast.success(`Đã lùi nhóm về: ${SALES_STEPS[colIdx - 1].label}`);
                                    if (order?.id) fetchKanbanLogs(order.id);
                                } catch {
                                    reloadOrder();
                                    toast.error('Lỗi khi cập nhật trạng thái');
                                }
                            }}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-primary hover:bg-primary hover:text-white"
                            disabled={colIdx === SALES_STEPS.length - 1}
                            onClick={async (e) => {
                                e.stopPropagation();
                                const nextStep = SALES_STEPS[colIdx + 1].id;
                                const itemsToUpdate = [];
                                if (group.product) itemsToUpdate.push(group.product);
                                if (group.services) itemsToUpdate.push(...group.services);

                                try {
                                    for (const item of itemsToUpdate) {
                                        await updateOrderItemStatus(item.id, nextStep);
                                    }
                                    toast.success(`Đã chuyển nhóm sang: ${SALES_STEPS[colIdx + 1].label}`);
                                    if (nextStep === 'step5') {
                                        onTabChange?.('workflow');
                                    }
                                    if (order?.id) fetchKanbanLogs(order.id);
                                } catch {
                                    reloadOrder();
                                    toast.error('Lỗi khi cập nhật trạng thái');
                                }
                            }}
                        >
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </Draggable>
    );
});

SalesCard.displayName = 'SalesCard';

export function SalesTab({
    order,
    salesLogs,
    updateOrderItemStatus,
    updateOrderStatus,
    reloadOrder,
    fetchKanbanLogs,
    onProductCardClick,
    workflowKanbanGroups,
    onTabChange,
}: SalesTabProps) {
    if (order?.status !== 'before_sale' && !['step1', 'step2', 'step3', 'step4', 'step5'].includes(order.status)) return null;

    return (
        <TabsContent value="sales">
            <div className="space-y-6">
                {/* Kanban Board Header */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <RotateCw className="h-5 w-5 text-primary" />
                                    Quy trình Lên đơn (Sales Kanban)
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Kiểm tra thông tin → Tư vấn thêm → Chốt gói. Kéo thả thẻ hạng mục vào cột để chuyển bước.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                                <span className="text-[11px] font-bold px-2 py-1 rounded bg-blue-100 text-blue-700">1-3: Chuẩn bị</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[11px] font-bold px-2 py-1 rounded bg-red-100 text-red-700">4: Phê duyệt</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[11px] font-bold px-2 py-1 rounded bg-green-100 text-green-700">5: Chốt đơn</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Kanban Board Layout */}
                        <div className="overflow-x-auto pb-4">
                            <DragDropContext
                                onDragEnd={async (result: DropResult) => {
                                    if (!result.destination || result.destination.droppableId === result.source.droppableId) return;
                                    const draggableId = result.draggableId;
                                    const newStatus = result.destination.droppableId;
                                    const stepLabel = SALES_STEPS.find((s: any) => s.id === newStatus)?.label || newStatus;

                                    const group = workflowKanbanGroups?.find(g =>
                                        (g.product?.id ?? g.services.map((s: OrderItem) => s.id).join('-')) === draggableId
                                    );

                                    if (group) {
                                        const itemsToUpdate = [];
                                        if (group.product) itemsToUpdate.push(group.product);
                                        if (group.services) itemsToUpdate.push(...group.services);

                                        try {
                                            for (const item of itemsToUpdate) {
                                                await updateOrderItemStatus(item.id, newStatus);
                                            }
                                            toast.success(`Đã chuyển nhóm sang: ${stepLabel}`);
                                            if (newStatus === 'step5') {
                                                onTabChange?.('workflow');
                                            }
                                            if (order?.id) fetchKanbanLogs(order.id);
                                        } catch (error) {
                                            reloadOrder();
                                            toast.error('Lỗi khi cập nhật trạng thái');
                                        }
                                    }
                                }}
                            >
                                <div className="flex gap-4 min-w-[1200px]">
                                    {SALES_STEPS.map((column, colIdx) => {
                                        const columnGroups = workflowKanbanGroups?.filter(group => {
                                            const leadItem = group.product || group.services[0];
                                            if (!leadItem) return false;
                                            const status = leadItem.status || 'step1';
                                            if (status === 'pending' && column.id === 'step1') return true;
                                            // Hide items that are in step5 (Chốt đơn) from the Kanban board view
                                            if (status === 'step5') return false;
                                            return status === column.id;
                                        }) || [];

                                        return (
                                            <div key={column.id} className="flex-1 min-w-[220px] flex flex-col">
                                                <div className="flex justify-between items-center mb-4 px-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white",
                                                            column.id === 'step4' ? "bg-red-500" :
                                                                column.id === 'step5' ? "bg-green-500" :
                                                                    "bg-blue-500"
                                                        )}>
                                                            {colIdx + 1}
                                                        </div>
                                                        <h3 className="font-bold text-xs uppercase tracking-widest text-gray-700">{column.title}</h3>
                                                    </div>
                                                    <span className="bg-gray-200 text-gray-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                                        {columnGroups.length}
                                                    </span>
                                                </div>

                                                <Droppable droppableId={column.id}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.droppableProps}
                                                            className={cn(
                                                                "min-h-[300px] p-2 rounded-xl flex-1 border-2 border-dashed transition-colors",
                                                                snapshot.isDraggingOver ?
                                                                    (column.id === 'step4' ? "bg-red-50 border-red-300" :
                                                                        column.id === 'step5' ? "bg-green-50 border-green-300" :
                                                                            "bg-blue-50 border-blue-300") :
                                                                    "bg-gray-100 border-transparent"
                                                            )}
                                                        >
                                                            {columnGroups.map((group, groupIdx) => (
                                                                <SalesCard
                                                                    key={group.product?.id ?? group.services.map((s: OrderItem) => s.id).join('-')}
                                                                    group={group}
                                                                    index={groupIdx}
                                                                    column={column}
                                                                    order={order}
                                                                    onProductCardClick={onProductCardClick}
                                                                    colIdx={colIdx}
                                                                    updateOrderItemStatus={updateOrderItemStatus}
                                                                    fetchKanbanLogs={fetchKanbanLogs}
                                                                    reloadOrder={reloadOrder}
                                                                    onTabChange={onTabChange}
                                                                />
                                                            ))}
                                                            {provided.placeholder}
                                                            {columnGroups.length === 0 && !snapshot.isDraggingOver && (
                                                                <div className="flex items-center justify-center h-20 text-muted-foreground text-[10px] italic">
                                                                    Trống
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </Droppable>
                                            </div>
                                        );
                                    })}
                                </div>
                            </DragDropContext>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {/* AI Message Templates */}
                        <Card className="border-blue-100 bg-blue-50/30">
                            <CardHeader className="pb-3 border-b border-blue-100">
                                <CardTitle className="text-xs font-bold text-blue-800 flex items-center gap-2 tracking-widest uppercase">
                                    <Bot className="h-4 w-4" /> AI Agent: Mẫu tin nhắn chăm sóc
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {[
                                        { id: 'ship', title: '1. Xin địa chỉ Ship', sub: '"Chào anh, đồ đã xong..."', content: `Chào ${order.customer?.name} ạ, giày ${order.items?.[0]?.item_name || 'của mình'} đã xong. Anh/chị cho shop xin địa chỉ ship nhé!` },
                                        { id: 'care', title: '2. HD Bảo quản', sub: '"Shop gửi HDSD..."', content: `Shop gửi ${order.customer?.name} HDSD: Tránh nước, lau bằng khăn mềm định kỳ ạ.` },
                                        { id: 'feedback', title: '3. Xin Feedback', sub: '"Bạn đã nhận được đồ chưa..."', content: `Dạ chào ${order.customer?.name}, mình nhận được đồ chưa ạ? Cho shop xin feedback nhé!` }
                                    ].map((tmp: any) => (
                                        <div
                                            key={tmp.id}
                                            className="bg-white p-4 rounded-xl border border-blue-200 hover:shadow-md transition-all group relative cursor-pointer"
                                            onClick={() => {
                                                navigator.clipboard.writeText(tmp.content);
                                                toast.success(`Đã copy mẫu: ${tmp.title}`);
                                            }}
                                        >
                                            <p className="text-[10px] font-black text-blue-600 uppercase mb-1">{tmp.title}</p>
                                            <p className="text-xs text-gray-500 line-clamp-2 italic">{tmp.sub}</p>
                                            <Copy className="absolute bottom-4 right-4 h-3 w-3 text-gray-300 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Lịch sử chuyển bước */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-xs font-bold flex items-center gap-2 tracking-widest uppercase text-gray-500">
                                    <History className="h-4 w-4 text-primary" /> Lịch sử chuyển bước (Lên đơn)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {salesLogs.length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground italic py-2">Chưa có lịch sử chuyển bước.</p>
                                ) : (
                                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                                        {salesLogs.map((log: any) => (
                                            <li key={log.id} className="text-[11px] flex items-center gap-2 py-1.5 border-b border-dashed last:border-0">
                                                <span className="text-muted-foreground shrink-0">{formatDateTime(log.created_at)}</span>
                                                <span className="font-medium">{log.created_by_user?.name ?? 'Hệ thống'}</span>
                                                <span className="text-muted-foreground">
                                                    {log.from_status ? `${getSalesStatusLabel(log.from_status)} → ` : ''}{getSalesStatusLabel(log.to_status)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right: Quick Tools */}
                    <div className="lg:col-span-1 space-y-4">
                        <Card className="border-purple-100">
                            <CardHeader className="pb-3 bg-purple-50/50">
                                <CardTitle className="text-[11px] font-bold text-purple-800 tracking-widest uppercase">Công cụ Sales</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                <Button variant="outline" className="w-full justify-start h-12 text-xs font-bold border-gray-200 hover:bg-orange-50 hover:text-orange-700">
                                    <Clock className="h-4 w-4 mr-2 text-orange-500" />
                                    Nhắc việc (Flow-up)
                                </Button>
                                <div className="mt-4 pt-4 border-t border-dashed">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">Thông tin sale phụ trách</p>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9">
                                            <AvatarFallback className="bg-orange-100 text-orange-600 font-bold text-xs">
                                                {order.sales_user?.name?.charAt(0) || 'S'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-xs font-bold">{order.sales_user?.name || 'Chưa gán'}</p>
                                            <p className="text-[9px] text-muted-foreground uppercase">Saler Phụ Trách</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="space-y-4">
                                    <div className="pb-4 border-b border-dashed">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Tiến độ tổng thể hạng mục</p>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[11px] font-bold">{order.items?.filter((i: OrderItem) => (i.status || 'step1') === 'step5').length || 0}/{order.items?.length || 0}</span>
                                            <span className="text-[11px] font-bold text-primary">
                                                {Math.round(((order.items?.filter((i: OrderItem) => (i.status || 'step1') === 'step5').length || 0) / (order.items?.length || 1)) * 100)}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                                            <div
                                                className="bg-primary h-1.5 rounded-full transition-all duration-500"
                                                style={{ width: `${((order.items?.filter((i: OrderItem) => (i.status || 'step1') === 'step5').length || 0) / (order.items?.length || 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                                        <p className="text-[10px] font-bold text-green-700 uppercase mb-1">Doanh thu dự kiến</p>
                                        <p className="text-lg font-black text-green-700">{formatCurrency(order.total_amount)}</p>
                                    </div>

                                    {(order.status === 'before_sale' || (order.status as string).startsWith('step')) && (
                                        <Button
                                            className="w-full h-12 font-bold shadow-lg shadow-green-200 bg-green-600 hover:bg-green-700"
                                            disabled={!order.items?.every(i => (i.status || 'step1') === 'step5')}
                                            onClick={async () => {
                                                try {
                                                    await updateOrderStatus(order.id, 'in_progress');
                                                    toast.success('Đã xác nhận đơn hàng sang Kỹ thuật!');
                                                    await reloadOrder();
                                                } catch {
                                                    toast.error('Lỗi khi chốt đơn hàng');
                                                }
                                            }}
                                        >
                                            <CheckCircle className="h-5 w-5 mr-2" />
                                            XÁC NHẬN CHỐT ĐƠN
                                        </Button>
                                    )}

                                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                                        <p className="text-[10px] font-bold text-blue-700 uppercase mb-1">Hoa hồng ước tính</p>
                                        <p className="text-lg font-black text-blue-700">{formatCurrency(order.total_amount * 0.05)}</p>
                                        <p className="text-[9px] text-blue-600 mt-1 italic leading-tight">* Tính dựa trên 5% doanh thu tạm tính</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </TabsContent >
    );
}
