import React from 'react';
import { Heart, Wrench, History } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils';
import { ordersApi } from '@/lib/api';
import type { Order, OrderItem } from '@/hooks/useOrders';

interface CareTabProps {
    order: Order | null;
    careLogs: any[];
    updateOrderAfterSale: (patch: Partial<Order>) => void;
    reloadOrder: () => Promise<void>;
    fetchKanbanLogs: (orderId: string) => Promise<void>;
    getCareWarrantyStageLabel: (stage: string) => string;
}

const CARE_WAR_COLS = [
    { id: 'war1' as const, title: '1. Tiếp nhận', color: 'border-red-200 bg-red-50/30', flow: 'warranty' as const },
    { id: 'war2' as const, title: '2. Xử lý', color: 'border-red-200 bg-red-50/30', flow: 'warranty' as const },
    { id: 'war3' as const, title: '3. Hoàn tất', color: 'border-green-200 bg-green-50/30', flow: 'warranty' as const },
    { id: 'care6' as const, title: 'Mốc 6 Tháng', color: 'border-teal-200 bg-teal-50/30', flow: 'care' as const },
    { id: 'care12' as const, title: 'Mốc 12 Tháng', color: 'border-teal-200 bg-teal-50/30', flow: 'care' as const },
    { id: 'care-custom' as const, title: 'Lịch Riêng', color: 'border-teal-200 bg-teal-50/30', flow: 'care' as const },
];

export function CareTab({
    order,
    careLogs,
    updateOrderAfterSale,
    reloadOrder,
    fetchKanbanLogs,
    getCareWarrantyStageLabel
}: CareTabProps) {
    if (!order) return null;

    const currentFlow = (order as any).care_warranty_flow ?? null;
    const currentStage = (order as any).care_warranty_stage ?? null;
    const orderInCareFlow = currentFlow && currentStage;

    const handleCareDragEnd = (result: DropResult) => {
        if (!order || !result.destination || result.destination.droppableId === result.source.droppableId) return;
        const toStage = result.destination.droppableId as string;
        const toFlow = ['war1', 'war2', 'war3'].includes(toStage) ? 'warranty' : 'care';
        updateOrderAfterSale({ care_warranty_flow: toFlow, care_warranty_stage: toStage });
        toast.success('Đã chuyển bước Chăm sóc/Bảo hành');
        ordersApi.patch(order.id, { care_warranty_flow: toFlow, care_warranty_stage: toStage }).then(() => fetchKanbanLogs(order.id)).catch((e: any) => {
            reloadOrder();
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        });
    };

    return (
        <TabsContent value="care">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Heart className="h-5 w-5 text-primary" />
                        Chăm sóc / Bảo hành
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Đơn có thể chuyển sang Bảo hành (từ Khách chê tại tab After sale) hoặc Chăm sóc (từ Khách khen). Kéo thẻ đơn giữa các cột để chuyển bước.
                    </p>
                </CardHeader>
                <CardContent>
                    {!orderInCareFlow && (
                        <p className="text-sm text-muted-foreground mb-4">
                            Đơn chưa vào quy trình Chăm sóc/Bảo hành. Tại tab After sale, bấm &quot;Khách khen&quot; hoặc &quot;Khách chê&quot; để chuyển đơn vào đây.
                        </p>
                    )}
                    <DragDropContext onDragEnd={handleCareDragEnd}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="flex flex-col min-w-0">
                                <h3 className="font-bold text-red-600 mb-4 flex items-center tracking-tight uppercase text-sm">
                                    <Wrench className="mr-2 h-4 w-4" /> Quy trình Bảo hành (Feedback Chê)
                                </h3>
                                <div className="grid grid-cols-3 gap-3">
                                    {CARE_WAR_COLS.filter((c) => c.flow === 'warranty').map((col) => {
                                        const hasOrder = order && orderInCareFlow && col.id === currentStage;
                                        return (
                                            <div key={col.id} className="flex flex-col min-w-[120px]">
                                                <Droppable droppableId={col.id}>
                                                    {(provided) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.droppableProps}
                                                            className={cn('rounded-xl border-t-4 p-3 min-h-[140px]', col.color)}
                                                        >
                                                            <h4 className="font-bold text-xs uppercase tracking-tight text-gray-700">{col.title}</h4>
                                                            {hasOrder && order && (
                                                                <Draggable draggableId={order.id} index={0}>
                                                                    {(provided) => (
                                                                        <div
                                                                            ref={provided.innerRef}
                                                                            {...provided.draggableProps}
                                                                            {...provided.dragHandleProps}
                                                                            className="mt-2 p-2 bg-white rounded-lg shadow border border-red-100 cursor-grab active:cursor-grabbing"
                                                                        >
                                                                            <span className="text-[10px] font-bold text-gray-500">#{order.order_code}</span>
                                                                            <p className="text-xs font-medium truncate">{order.customer?.name || 'Khách'}</p>
                                                                            <p className="text-[10px] text-muted-foreground truncate">
                                                                                {order.items?.length ? (order.items[0] as OrderItem).item_name : 'Đơn hàng'}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </Draggable>
                                                            )}
                                                            {!hasOrder && <p className="text-[10px] text-muted-foreground mt-2">—</p>}
                                                            {provided.placeholder}
                                                        </div>
                                                    )}
                                                </Droppable>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <h3 className="font-bold text-teal-600 mb-4 flex items-center tracking-tight uppercase text-sm">
                                    <Heart className="mr-2 h-4 w-4" /> Quy trình Chăm sóc (Feedback Khen)
                                </h3>
                                <div className="grid grid-cols-3 gap-3">
                                    {CARE_WAR_COLS.filter((c) => c.flow === 'care').map((col) => {
                                        const hasOrder = order && orderInCareFlow && col.id === currentStage;
                                        return (
                                            <div key={col.id} className="flex flex-col min-w-[120px]">
                                                <Droppable droppableId={col.id}>
                                                    {(provided) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.droppableProps}
                                                            className={cn('rounded-xl border-t-4 p-3 min-h-[140px]', col.color)}
                                                        >
                                                            <h4 className="font-bold text-xs uppercase tracking-tight text-gray-700">{col.title}</h4>
                                                            {hasOrder && order && (
                                                                <Draggable draggableId={order.id} index={0}>
                                                                    {(provided) => (
                                                                        <div
                                                                            ref={provided.innerRef}
                                                                            {...provided.draggableProps}
                                                                            {...provided.dragHandleProps}
                                                                            className="mt-2 p-2 bg-white rounded-lg shadow border border-teal-100 cursor-grab active:cursor-grabbing"
                                                                        >
                                                                            <span className="text-[10px] font-bold text-gray-500">#{order.order_code}</span>
                                                                            <p className="text-xs font-medium truncate">{order.customer?.name || 'Khách'}</p>
                                                                            <p className="text-[10px] text-muted-foreground truncate">
                                                                                {order.items?.length ? (order.items[0] as OrderItem).item_name : 'Đơn hàng'}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </Draggable>
                                                            )}
                                                            {!hasOrder && <p className="text-[10px] text-muted-foreground mt-2">—</p>}
                                                            {provided.placeholder}
                                                        </div>
                                                    )}
                                                </Droppable>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </DragDropContext>
                    {order && (
                        <div className="mt-6 border-t pt-6">
                            <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                                <History className="h-4 w-4 text-primary" /> Lịch sử chuyển bước (Chăm sóc / Bảo hành)
                            </h3>
                            {careLogs.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic py-2">Chưa có lịch sử.</p>
                            ) : (
                                <ul className="space-y-2 max-h-48 overflow-y-auto">
                                    {careLogs.map((log: any) => (
                                        <li key={log.id} className="text-xs flex items-center gap-2 py-1.5 border-b border-dashed last:border-0">
                                            <span className="text-muted-foreground shrink-0">{formatDateTime(log.created_at)}</span>
                                            <span className="font-medium">{log.created_by_user?.name ?? 'Hệ thống'}</span>
                                            <span className="text-muted-foreground">
                                                {log.from_stage ? `${getCareWarrantyStageLabel(log.from_stage)} → ` : ''}{getCareWarrantyStageLabel(log.to_stage)}
                                                {log.flow_type && <span className="ml-1 text-muted-foreground">({log.flow_type === 'warranty' ? 'Bảo hành' : 'Chăm sóc'})</span>}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
    );
}
