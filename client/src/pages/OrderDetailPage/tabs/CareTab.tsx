import React from 'react';
import { Heart, Wrench, History, ShoppingBag, User } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    onProductCardClick: (group: any, roomId: string) => void;
}

const CARE_WAR_COLS = [
    { id: 'war1' as const, title: '1. Tiếp nhận', color: 'border-red-400 bg-red-50/20', flow: 'warranty' as const },
    { id: 'war2' as const, title: '2. Xử lý', color: 'border-red-400 bg-red-50/20', flow: 'warranty' as const },
    { id: 'war3' as const, title: '3. Hoàn tất', color: 'border-green-400 bg-green-50/20', flow: 'warranty' as const },
    { id: 'care6' as const, title: 'Mốc 6 Tháng', color: 'border-teal-400 bg-teal-50/20', flow: 'care' as const },
    { id: 'care12' as const, title: 'Mốc 12 Tháng', color: 'border-teal-400 bg-teal-50/20', flow: 'care' as const },
    { id: 'care-custom' as const, title: 'Lịch Riêng', color: 'border-teal-400 bg-teal-50/20', flow: 'care' as const },
];

export function CareTab({
    order,
    careLogs,
    updateOrderAfterSale,
    reloadOrder,
    fetchKanbanLogs,
    getCareWarrantyStageLabel,
    onProductCardClick
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

    // Construct a "group" for the dialog (using first product if available)
    const productItem = order.sale_items?.find(i => i.item_type === 'product');
    const serviceItems = order.sale_items?.filter(i => i.item_type === 'service') || [];
    const group = {
        product: productItem || null,
        services: serviceItems
    };

    const productImage = (productItem as any)?.product?.image || (serviceItems[0] as any)?.service?.image;

    return (
        <TabsContent value="care">
            <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                                <Heart className="h-6 w-6 text-red-500 fill-red-500" />
                                Chăm sóc & Bảo hành
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Quản lý quy trình hậu mãi và chăm sóc khách hàng định kỳ
                            </p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="px-0">
                    {!orderInCareFlow && (
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl mb-6 flex items-start gap-3">
                            <ShoppingBag className="h-5 w-5 text-amber-500 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-amber-900">Đơn hàng chưa vào quy trình</p>
                                <p className="text-xs text-amber-700">Tại tab After sale, hãy bấm &quot;Khách khen&quot; hoặc &quot;Khách chê&quot; để kích hoạt quy trình này.</p>
                            </div>
                        </div>
                    )}
                    <DragDropContext onDragEnd={handleCareDragEnd}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Warranty Section */}
                            <div className="flex flex-col min-w-0">
                                <h3 className="font-black text-red-700 mb-4 flex items-center tracking-widest uppercase text-xs">
                                    <Wrench className="mr-2 h-4 w-4" /> BẢO HÀNH (Feedback Chê)
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    {CARE_WAR_COLS.filter((c) => c.flow === 'warranty').map((col) => {
                                        const isActive = orderInCareFlow && col.id === currentStage;
                                        return (
                                            <div key={col.id} className="flex flex-col min-w-[140px]">
                                                <Droppable droppableId={col.id}>
                                                    {(provided) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.droppableProps}
                                                            className={cn(
                                                                'rounded-2xl border-t-4 p-3 min-h-[180px] transition-colors',
                                                                isActive ? 'bg-red-50/50' : 'bg-gray-50/50',
                                                                col.color
                                                            )}
                                                        >
                                                            <h4 className="font-bold text-[10px] uppercase tracking-widest text-gray-500 mb-3 px-1">{col.title}</h4>
                                                            {isActive && (
                                                                <Draggable draggableId={order.id} index={0}>
                                                                    {(provided) => (
                                                                        <div
                                                                            ref={provided.innerRef}
                                                                            {...provided.draggableProps}
                                                                            {...provided.dragHandleProps}
                                                                            onClick={() => onProductCardClick(group, col.id)}
                                                                            className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md transition-all group"
                                                                        >
                                                                            {productImage && (
                                                                                <div className="h-20 w-full overflow-hidden border-b grayscale-[0.5] group-hover:grayscale-0 transition-all">
                                                                                    <img src={productImage} alt="" className="w-full h-full object-cover" />
                                                                                </div>
                                                                            )}
                                                                            <div className="p-2.5 space-y-1.5">
                                                                                <div className="flex justify-between items-center">
                                                                                    <span className="text-[10px] font-black text-red-200">#{order.order_code}</span>
                                                                                </div>
                                                                                <p className="text-xs font-bold text-gray-800 truncate">{order.customer?.name || 'Khách'}</p>
                                                                                <p className="text-[10px] text-gray-500 truncate leading-tight">
                                                                                    {order.items?.length ? (order.items[0] as OrderItem).item_name : 'Sản phẩm'}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </Draggable>
                                                            )}
                                                            {provided.placeholder}
                                                        </div>
                                                    )}
                                                </Droppable>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Care Section */}
                            <div className="flex flex-col min-w-0">
                                <h3 className="font-black text-teal-700 mb-4 flex items-center tracking-widest uppercase text-xs">
                                    <Heart className="mr-2 h-4 w-4" /> CHĂM SÓC (Feedback Khen)
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    {CARE_WAR_COLS.filter((c) => c.flow === 'care').map((col) => {
                                        const isActive = orderInCareFlow && col.id === currentStage;
                                        return (
                                            <div key={col.id} className="flex flex-col min-w-[140px]">
                                                <Droppable droppableId={col.id}>
                                                    {(provided) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.droppableProps}
                                                            className={cn(
                                                                'rounded-2xl border-t-4 p-3 min-h-[180px] transition-colors',
                                                                isActive ? 'bg-teal-50/50' : 'bg-gray-50/50',
                                                                col.color
                                                            )}
                                                        >
                                                            <h4 className="font-bold text-[10px] uppercase tracking-widest text-gray-500 mb-3 px-1">{col.title}</h4>
                                                            {isActive && (
                                                                <Draggable draggableId={order.id} index={0}>
                                                                    {(provided) => (
                                                                        <div
                                                                            ref={provided.innerRef}
                                                                            {...provided.draggableProps}
                                                                            {...provided.dragHandleProps}
                                                                            onClick={() => onProductCardClick(group, col.id)}
                                                                            className="bg-white rounded-xl shadow-sm border border-teal-100 overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md transition-all group"
                                                                        >
                                                                            {productImage && (
                                                                                <div className="h-20 w-full overflow-hidden border-b grayscale-[0.5] group-hover:grayscale-0 transition-all">
                                                                                    <img src={productImage} alt="" className="w-full h-full object-cover" />
                                                                                </div>
                                                                            )}
                                                                            <div className="p-2.5 space-y-1.5">
                                                                                <div className="flex justify-between items-center">
                                                                                    <span className="text-[10px] font-black text-teal-200">#{order.order_code}</span>
                                                                                </div>
                                                                                <p className="text-xs font-bold text-gray-800 truncate">{order.customer?.name || 'Khách'}</p>
                                                                                <p className="text-[10px] text-gray-500 truncate leading-tight">
                                                                                    {order.items?.length ? (order.items[0] as OrderItem).item_name : 'Sản phẩm'}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </Draggable>
                                                            )}
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

                    {/* History Section - Styled */}
                    {order && (
                        <div className="mt-12 bg-gray-50/50 p-6 rounded-3xl border border-gray-100">
                            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 mb-6">
                                <History className="h-4 w-4" /> Lịch sử quy trình
                            </h3>
                            {careLogs.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic py-4 text-center bg-white rounded-2xl border border-dashed">Chưa có lịch sử cập nhật.</p>
                            ) : (
                                <div className="relative space-y-4">
                                    <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-100" />
                                    {careLogs.map((log: any, idx: number) => (
                                        <div key={log.id} className="relative pl-10">
                                            <div className={cn(
                                                "absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ring-4 ring-white",
                                                idx === 0 ? "bg-primary scale-125" : "bg-gray-300"
                                            )} />
                                            <div className="bg-white p-3.5 rounded-2xl border border-gray-50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="space-y-1">
                                                    <p className="text-xs font-bold text-gray-800">
                                                        {log.from_stage ? `${getCareWarrantyStageLabel(log.from_stage)} → ` : ''}
                                                        <span className="text-primary">{getCareWarrantyStageLabel(log.to_stage)}</span>
                                                    </p>
                                                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium">
                                                        <User className="h-3 w-3" />
                                                        {log.created_by_user?.name ?? 'Hệ thống'}
                                                        <span className="mx-1">•</span>
                                                        {log.flow_type === 'warranty' ? 'Bảo hành' : 'Chăm sóc'}
                                                    </div>
                                                </div>
                                                <Badge variant="secondary" className="text-[10px] font-black h-6 bg-gray-50 text-gray-400 border-none shrink-0 w-fit">
                                                    {formatDateTime(log.created_at)}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
    );
}


