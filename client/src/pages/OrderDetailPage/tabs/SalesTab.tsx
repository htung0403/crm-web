import React from 'react';
import {
    ArrowLeft, ArrowRight, Gift, ShoppingBag, CreditCard,
    Wrench, Clock, CheckCircle, Sparkles, Copy, Bot, History, RotateCw
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { orderItemsApi } from '@/lib/api';
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
import { UpsellDialog } from '@/components/orders/UpsellDialog';

interface SalesTabProps {
    order: Order;
    salesLogs: any[];
    updateOrderItemStatus: (itemId: string, status: string) => void;
    updateOrderStatus: (orderId: string, status: string) => Promise<void>;
    reloadOrder: () => Promise<void>;
    fetchKanbanLogs: (orderId: string) => Promise<void>;
    onProductCardClick?: (group: { product: OrderItem | null; services: OrderItem[] }, roomId: string) => void;
    workflowKanbanGroups?: { product: OrderItem | null; services: OrderItem[] }[];
}

export function SalesTab({
    order,
    salesLogs,
    updateOrderItemStatus,
    updateOrderStatus,
    reloadOrder,
    fetchKanbanLogs,
    onProductCardClick,
    workflowKanbanGroups,
}: SalesTabProps) {
    const [showUpsellDialog, setShowUpsellDialog] = React.useState(false);

    if (order?.status !== 'before_sale') return null;

    return (
        <TabsContent value="sales">
            <div className="space-y-6">
                {/* Kanban Board Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <RotateCw className="h-5 w-5 text-primary" />
                            Quy trình Lên đơn (Sales Kanban)
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Kéo thả thẻ hạng mục vào cột hoặc nhấn nút mũi tên để chuyển bước
                        </p>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                        <span className="text-sm font-bold px-2.5 py-1 rounded bg-blue-100 text-blue-700">1-3: Chuẩn bị</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-bold px-2.5 py-1 rounded bg-red-100 text-red-700">4: Phê duyệt</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-bold px-2.5 py-1 rounded bg-green-100 text-green-700">5: Chốt đơn</span>
                    </div>
                </div>

                {/* Kanban Board Layout */}
                <div className="overflow-x-auto pb-4 -mx-1 px-1">
                    <DragDropContext
                        onDragEnd={async (result: DropResult) => {
                            if (!result.destination || result.destination.droppableId === result.source.droppableId) return;
                            const draggableId = result.draggableId;
                            const newStatus = result.destination.droppableId;
                            const stepLabel = SALES_STEPS.find((s: any) => s.id === newStatus)?.label || newStatus;

                            // Find the group to update all its items
                            const group = workflowKanbanGroups?.find(g =>
                                (g.product?.id ?? g.services.map((s: OrderItem) => s.id).join('-')) === draggableId
                            );

                            if (group) {
                                // Update all items in the group
                                const itemsToUpdate = [];
                                if (group.product) itemsToUpdate.push(group.product);
                                if (group.services) itemsToUpdate.push(...group.services);

                                try {
                                    for (const item of itemsToUpdate) {
                                        updateOrderItemStatus(item.id, newStatus);
                                        await orderItemsApi.updateStatus(item.id, newStatus);
                                    }
                                    toast.success(`Đã chuyển nhóm sang: ${stepLabel}`);
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
                                // Filter groups where the "main" item matches the column status
                                const columnGroups = workflowKanbanGroups?.filter(group => {
                                    // Identify the "lead" item to determine status
                                    // Usually product, or first service
                                    const leadItem = group.product || group.services[0];
                                    if (!leadItem) return false;

                                    const status = leadItem.status || 'step1';
                                    if (status === 'pending' && column.id === 'step1') return true;
                                    return status === column.id;
                                }) || [];

                                return (
                                    <div key={column.id} className="flex-1 min-w-[220px]">
                                        <div className={cn(
                                            "rounded-xl border-t-4 p-3 h-full mb-4 shadow-sm",
                                            column.id === 'step4' ? "bg-red-50/30 border-t-red-500" :
                                                column.id === 'step5' ? "bg-green-50/30 border-t-green-500" :
                                                    "bg-blue-50/30 border-t-blue-500"
                                        )}>
                                            {/* Column Header */}
                                            <div className="flex items-center justify-between mb-4 pb-2 border-b">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white",
                                                        column.id === 'step4' ? "bg-red-500" :
                                                            column.id === 'step5' ? "bg-green-500" :
                                                                "bg-blue-500"
                                                    )}>
                                                        {colIdx + 1}
                                                    </div>
                                                    <h3 className="font-bold text-sm uppercase tracking-tight">{column.title}</h3>
                                                </div>
                                                <Badge variant="outline" className="text-xs bg-white">
                                                    {columnGroups.length}
                                                </Badge>
                                            </div>

                                            {/* Column Items – Droppable */}
                                            <Droppable droppableId={column.id}>
                                                {(provided) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        className="space-y-3 min-h-[150px]"
                                                    >
                                                        {columnGroups.map((group, groupIdx) => {
                                                            const draggableId = group.product?.id ?? group.services.map((s: OrderItem) => s.id).join('-');
                                                            const leadItem = group.product || group.services[0];

                                                            return (
                                                                <Draggable key={draggableId} draggableId={draggableId} index={groupIdx}>
                                                                    {(provided) => (
                                                                        <div
                                                                            ref={provided.innerRef}
                                                                            {...provided.draggableProps}
                                                                            {...provided.dragHandleProps}
                                                                            onClick={() => {
                                                                                if (onProductCardClick) {
                                                                                    onProductCardClick(group, column.id);
                                                                                }
                                                                            }}
                                                                            className="bg-white p-3 rounded-lg border shadow-sm group hover:border-primary hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                                                                        >
                                                                            <div className="flex items-start gap-2 mb-2">
                                                                                <div className="w-9 h-9 rounded bg-muted flex items-center justify-center shrink-0">
                                                                                    {group.product ? <ShoppingBag className="h-5 w-5 text-muted-foreground" /> :
                                                                                        <Wrench className="h-5 w-5 text-muted-foreground" />}
                                                                                </div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <p className="font-bold text-sm truncate leading-tight">
                                                                                        {group.product?.item_name || group.services[0]?.item_name}
                                                                                    </p>
                                                                                    {group.product && (
                                                                                        <Badge className={cn("text-[10px] px-1 h-4 mt-1", getItemTypeColor('product'))}>
                                                                                            {getItemTypeLabel('product')}
                                                                                        </Badge>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            {/* List of services inside product card */}
                                                                            {group.services.length > 0 && (
                                                                                <div className="mt-2 space-y-1 pl-1 border-l-2 border-primary/20">
                                                                                    {group.services.map((svc: OrderItem) => (
                                                                                        <div key={svc.id} className="flex items-center justify-between gap-2">
                                                                                            <span className="text-[11px] text-gray-600 truncate flex-1">
                                                                                                • {svc.item_name}
                                                                                            </span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}

                                                                            {/* Task Controls */}
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
                                                                                                updateOrderItemStatus(item.id, prevStep);
                                                                                                await orderItemsApi.updateStatus(item.id, prevStep);
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
                                                                                <span className="text-xs font-bold text-muted-foreground text-[10px]">
                                                                                    #{leadItem?.item_code?.slice(-4) || 'Item'}
                                                                                </span>
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
                                                                                                updateOrderItemStatus(item.id, nextStep);
                                                                                                await orderItemsApi.updateStatus(item.id, nextStep);
                                                                                            }
                                                                                            toast.success(`Đã chuyển nhóm sang: ${SALES_STEPS[colIdx + 1].label}`);
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
                                                        })}
                                                        {columnGroups.length === 0 && (
                                                            <div className="py-8 text-center border-2 border-dashed rounded-lg bg-black/5">
                                                                <p className="text-xs text-muted-foreground uppercase font-medium">Trống</p>
                                                            </div>
                                                        )}
                                                        {provided.placeholder}
                                                    </div>
                                                )}
                                            </Droppable>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </DragDropContext>
                </div>

                {/* Additional Tools Overlay */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">

                        {/* AI Message Templates */}
                        <Card className="border-blue-100 bg-blue-50/30">
                            <CardHeader className="pb-3 border-b border-blue-100">
                                <CardTitle className="text-sm font-bold text-blue-800 flex items-center gap-2">
                                    <Bot className="h-4 w-4" /> AI AGENT: MẪU TIN NHẮN CHĂM SÓC
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
                                            <p className="text-xs font-black text-blue-600 uppercase mb-1">{tmp.title}</p>
                                            <p className="text-sm text-gray-500 line-clamp-2 italic">{tmp.sub}</p>
                                            <Copy className="absolute bottom-4 right-4 h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Lịch sử chuyển bước Sales Kanban */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <History className="h-4 w-4 text-primary" /> LỊCH SỬ CHUYỂN BƯỚC (LÊN ĐƠN)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {salesLogs.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic py-2">Chưa có lịch sử chuyển bước.</p>
                                ) : (
                                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                                        {salesLogs.map((log: any) => (
                                            <li key={log.id} className="text-xs flex items-center gap-2 py-1.5 border-b border-dashed last:border-0">
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
                                <CardTitle className="text-sm font-bold text-purple-800">CÔNG CỤ SALES</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                <Button
                                    variant="outline"
                                    className="w-full justify-start h-12 text-xs font-bold border-gray-200 hover:bg-purple-50 hover:text-purple-700"
                                    onClick={() => setShowUpsellDialog(true)}
                                >
                                    <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
                                    Đề xuất gói VIP (Upsell)
                                </Button>
                                <UpsellDialog
                                    open={showUpsellDialog}
                                    onOpenChange={setShowUpsellDialog}
                                    orderId={order.id}
                                    onSuccess={async () => {
                                        await reloadOrder();
                                    }}
                                />
                                <Button variant="outline" className="w-full justify-start h-12 text-xs font-bold border-gray-200 hover:bg-orange-50 hover:text-orange-700">
                                    <Clock className="h-4 w-4 mr-2 text-orange-500" />
                                    Nhắc việc (Flow-up)
                                </Button>
                                <div className="mt-4 pt-4 border-t border-dashed">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">Thông tin sale phụ trách</p>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarFallback className="bg-orange-100 text-orange-600 font-bold">
                                                {order.sales_user?.name?.charAt(0) || 'S'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-bold">{order.sales_user?.name || 'Chưa gán'}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase">Saler Phụ Trách</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="space-y-4">
                                    {/* Global Progress Summary */}
                                    <div className="pb-4 border-b border-dashed">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Tiến độ tổng thể</p>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold">{order.items?.filter((i: OrderItem) => (i.status || 'step1') === 'step5').length || 0}/{order.items?.length || 0} hạng mục</span>
                                            <span className="text-xs font-bold text-primary">
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
                                        <p className="text-xl font-black text-green-700">{formatCurrency(order.total_amount)}</p>
                                    </div>

                                    {/* Chốt đơn button */}
                                    {(order.status === 'before_sale' || (order.status as string).startsWith('step')) && (
                                        <Button
                                            className="w-full h-12 font-bold shadow-lg shadow-green-200 bg-green-600 hover:bg-green-700"
                                            disabled={!order.items?.every(i => (i.status || 'step1') === 'step5')}
                                            onClick={async () => {
                                                try {
                                                    await updateOrderStatus(order.id, 'in_progress');
                                                    toast.success('Đã xác nhận đơn hàng thành công!');
                                                    await reloadOrder();
                                                } catch {
                                                    toast.error('Lỗi khi chốt đơn hàng');
                                                }
                                            }}
                                        >
                                            <CheckCircle className="h-5 w-5 mr-2" />
                                            CHỐT ĐƠN HÀNG
                                        </Button>
                                    )}

                                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                                        <p className="text-[10px] font-bold text-blue-700 uppercase mb-1">Hoa hồng ước tính</p>
                                        <p className="text-xl font-black text-blue-700">{formatCurrency(order.total_amount * 0.05)}</p>
                                        <p className="text-[9px] text-blue-500 mt-1 italic">* Tính dựa trên 5% doanh thu</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </TabsContent>
    );
}
