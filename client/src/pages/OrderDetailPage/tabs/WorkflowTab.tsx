import React, { memo, useMemo } from 'react';
import {
    Layers, Loader2, ShoppingBag, Tag, FileText, Wrench, User as UserIcon,
    Package, Truck, History
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils';
import { TECH_ROOMS } from '@/components/orders/constants';
import type { Order, OrderItem } from '@/hooks/useOrders';

interface WorkflowCardProps {
    group: { product: OrderItem | null; services: OrderItem[] };
    index: number;
    roomId: string;
    orderCode: string | undefined;
    getItemCurrentStep: (itemId: string) => any;
    getStepDeadlineDisplay: (itemId: string) => { label: string; dueAt: Date | null };
    handleOpenAccessory: (item: OrderItem) => void;
    handleOpenPartner: (item: OrderItem) => void;
    handleOpenAssignDialog: (item: OrderItem) => void;
    handleOpenSaleAssignDialog: (item: OrderItem) => void;
    onCardClick: (group: { product: OrderItem | null; services: OrderItem[] }, roomId: string) => void;
}

const WorkflowCard = memo(({
    group,
    index,
    roomId,
    orderCode,
    getItemCurrentStep,
    getStepDeadlineDisplay,
    handleOpenAccessory,
    handleOpenPartner,
    handleOpenAssignDialog,
    handleOpenSaleAssignDialog,
    onCardClick
}: WorkflowCardProps) => {
    const productName = group.product?.item_name ?? group.services[0]?.item_name ?? '—';
    const productItem = group.product as any;
    const productImages = productItem?.product_images ?? (productItem?.product?.image ? [productItem.product.image] : []);
    const hasProductDetails = group.product && (productItem?.product_type || productItem?.product_brand || productItem?.product_color || productItem?.product_size || productItem?.product_material || productItem?.product_condition_before || productItem?.product_notes);
    const cardKey = group.product?.id ?? group.services.map((s) => s.id).join('-');

    const leadItem = group.services.find((s) => getItemCurrentStep(s.id)) ?? group.services[0];
    const stepDeadline = leadItem ? getStepDeadlineDisplay(leadItem.id) : { label: 'N/A', dueAt: null };
    const itemLate = stepDeadline.dueAt ? stepDeadline.dueAt < new Date() : false;
    const currentStep = leadItem ? getItemCurrentStep(leadItem.id) : null;

    return (
        <Draggable key={cardKey} draggableId={cardKey} index={index} isDragDisabled={roomId === 'done' || roomId === 'fail'}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={cn(
                        "bg-white rounded-xl shadow-sm p-4 mb-3 border-l-4 transition-all cursor-grab active:cursor-grabbing",
                        snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20 scale-105" : "",
                        itemLate && roomId !== 'done' ? "border-red-500 bg-red-50/30" :
                            roomId === 'done' ? "border-green-500" :
                                roomId === 'fail' ? "border-red-400" : "border-blue-400"
                    )}
                    onClick={() => onCardClick(group, roomId)}
                >
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold text-gray-400">#{orderCode ?? cardKey?.slice(0, 8)}</span>
                    </div>

                    <div className="space-y-2 mb-3">
                        {productImages?.length > 0 && (
                            <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-video w-full max-h-24">
                                <img src={productImages[0]} alt={productName} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                        )}
                        <h3 className="font-bold text-gray-800 text-[13px] flex items-center gap-1.5 flex-wrap">
                            <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="truncate">{productName}</span>
                        </h3>
                        {hasProductDetails && (
                            <div className="grid grid-cols-1 gap-1 text-[11px] text-gray-600">
                                {productItem?.product_type && (
                                    <div className="flex items-center gap-1.5"><Tag className="h-3 w-3 shrink-0 text-muted-foreground" /><span>Loại: {productItem.product_type}</span></div>
                                )}
                                {productItem?.product_brand && (
                                    <div className="flex items-center gap-1.5"><Tag className="h-3 w-3 shrink-0 text-muted-foreground" /><span>Hãng: {productItem.product_brand}</span></div>
                                )}
                                {productItem?.product_notes && (
                                    <div className="flex items-center gap-1.5"><FileText className="h-3 w-3 shrink-0 text-muted-foreground" /><span className="line-clamp-1">Ghi chú: {productItem.product_notes}</span></div>
                                )}
                            </div>
                        )}
                    </div>

                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Dịch vụ</p>
                    <ul className="space-y-1">
                        {group.services.map((svc) => {
                            const isLeadService = leadItem?.id === svc.id;
                            const svcTechnicians = (svc as any).technicians;
                            const svcTechSingle = (svc as any).technician;
                            const techNames = svcTechnicians?.length > 0
                                ? svcTechnicians.map((t: any) => t.technician?.name).filter(Boolean).join(', ') || '—'
                                : svcTechSingle?.name || '—';
                            return (
                                <li key={svc.id} className={cn("rounded-md px-2 py-1", isLeadService ? "bg-primary/5 border border-primary/20" : "")}>
                                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-700">
                                        <Wrench className="h-3 w-3 shrink-0 text-primary/60" />
                                        <span className="truncate">{svc.item_name}</span>
                                    </div>
                                    <div
                                        className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-0.5 cursor-pointer hover:text-primary transition-colors"
                                        title="Nhấn để phân công/đổi kỹ thuật viên"
                                        onClick={(e) => { e.stopPropagation(); handleOpenAssignDialog(svc); }}
                                    >
                                        <UserIcon className="h-2.5 w-2.5 shrink-0" />
                                        <span className="truncate">KT: {techNames}</span>
                                    </div>
                                    <div
                                        className="flex items-center gap-1.5 text-[10px] text-amber-500 mt-0.5 cursor-pointer hover:text-amber-600 transition-colors"
                                        title="Nhấn để phân công/đổi kinh doanh"
                                        onClick={(e) => { e.stopPropagation(); handleOpenSaleAssignDialog(svc); }}
                                    >
                                        <Tag className="h-2.5 w-2.5 shrink-0" />
                                        <span className="truncate">Sale: {(svc as any).sales?.length > 0 ? (svc as any).sales.map((s: any) => s.sale?.name || (s as any).name).join(', ') : '—'}</span>
                                    </div>
                                    {isLeadService && currentStep && (
                                        <div className="mt-1.5 pt-1.5 border-t border-primary/10">
                                            <p className="text-[10px] text-primary font-semibold">Bước: {currentStep.step_name}</p>
                                            <p className="text-[10px] text-muted-foreground">{currentStep.status === 'in_progress' ? 'Đang thực hiện' : currentStep.status === 'assigned' ? 'Đã phân công' : currentStep.status}</p>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>

                    {roomId !== 'done' && roomId !== 'fail' && (
                        <>
                            <div className="mt-2 flex items-center justify-between text-[11px]">
                                <span className="text-gray-500">Hết hạn bước:</span>
                                <span className={cn("font-semibold", itemLate ? "text-red-600" : stepDeadline.dueAt ? "text-emerald-600" : "text-gray-400")}>{stepDeadline.label}</span>
                            </div>
                            <div className="mt-3 pt-2 border-t border-gray-100 flex flex-wrap gap-1.5">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); leadItem && handleOpenAccessory(leadItem); }}
                                    className={cn(
                                        'inline-flex items-center gap-1 p-1 px-2 rounded-md text-[10px] font-medium transition-all',
                                        (leadItem as any)?.accessory?.status ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 border border-blue-200'
                                    )}
                                >
                                    <Package className="h-3 w-3" />
                                    <span>{(leadItem as any)?.accessory?.status ? 'Phụ kiện OK' : 'Cần PK'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); leadItem && handleOpenPartner(leadItem); }}
                                    className={cn(
                                        'inline-flex items-center gap-1 p-1 px-2 rounded-md text-[10px] font-medium transition-all',
                                        (leadItem as any)?.partner?.status ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    )}
                                >
                                    <Truck className="h-3 w-3" />
                                    <span>{(leadItem as any)?.partner?.status ? 'Đối tác OK' : 'Gửi ĐT'}</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </Draggable>
    );
});

WorkflowCard.displayName = 'WorkflowCard';

interface WorkflowColumnProps {
    room: { id: string; title: string };
    groups: { product: OrderItem | null; services: OrderItem[] }[];
    orderCode: string | undefined;
    getItemCurrentStep: (itemId: string) => any;
    getStepDeadlineDisplay: (itemId: string) => { label: string; dueAt: Date | null };
    handleOpenAccessory: (item: OrderItem) => void;
    handleOpenPartner: (item: OrderItem) => void;
    handleOpenAssignDialog: (item: OrderItem) => void;
    handleOpenSaleAssignDialog: (item: OrderItem) => void;
    onCardClick: (group: { product: OrderItem | null; services: OrderItem[] }, roomId: string) => void;
}

const WorkflowColumn = ({
    room,
    groups,
    orderCode,
    getItemCurrentStep,
    getStepDeadlineDisplay,
    handleOpenAccessory,
    handleOpenPartner,
    handleOpenAssignDialog,
    handleOpenSaleAssignDialog,
    onCardClick
}: WorkflowColumnProps) => {
    return (
        <div className="flex flex-col min-w-[240px]">
            <div className="flex justify-between items-center mb-4 px-2">
                <h2 className={cn(
                    "font-bold uppercase text-xs tracking-widest",
                    room.id === 'done' ? "text-green-600" :
                        room.id === 'fail' ? "text-red-500" : "text-blue-700"
                )}>
                    {room.title}
                </h2>
                <span className="bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                    {groups.length}
                </span>
            </div>

            <Droppable droppableId={room.id}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                            "min-h-[300px] p-2 rounded-xl flex-1 border-2 border-dashed transition-colors",
                            snapshot.isDraggingOver ? "bg-blue-50 border-blue-300" : "bg-gray-100 border-transparent"
                        )}
                    >
                        {groups.map((group, index) => (
                            <WorkflowCard
                                key={group.product?.id ?? group.services.map((s) => s.id).join('-')}
                                group={group}
                                index={index}
                                roomId={room.id}
                                orderCode={orderCode}
                                getItemCurrentStep={getItemCurrentStep}
                                getStepDeadlineDisplay={getStepDeadlineDisplay}
                                handleOpenAccessory={handleOpenAccessory}
                                handleOpenPartner={handleOpenPartner}
                                handleOpenAssignDialog={handleOpenAssignDialog}
                                handleOpenSaleAssignDialog={handleOpenSaleAssignDialog}
                                onCardClick={onCardClick}
                            />
                        ))}
                        {provided.placeholder}
                        {groups.length === 0 && !snapshot.isDraggingOver && (
                            <div className="flex items-center justify-center h-20 text-muted-foreground text-xs italic">
                                Trống
                            </div>
                        )}
                    </div>
                )}
            </Droppable>
        </div>
    );
};

interface WorkflowTabProps {
    order: Order | null;
    stepsLoading: boolean;
    allWorkflowSteps: any[];
    workflowKanbanGroups: { product: OrderItem | null; services: OrderItem[] }[];
    workflowLogs: any[];
    onWorkflowDragEnd: (result: DropResult) => void;
    getGroupCurrentTechRoom: (group: any) => string;
    getItemCurrentStep: (itemId: string) => any;
    getStepDeadlineDisplay: (itemId: string) => { label: string; dueAt: Date | null };
    handleOpenAccessory: (item: OrderItem) => void;
    handleOpenPartner: (item: OrderItem) => void;
    handleOpenAssignDialog: (item: OrderItem) => void;
    handleOpenSaleAssignDialog: (item: OrderItem) => void;
    onProductCardClick: (group: { product: OrderItem | null; services: OrderItem[] }, roomId: string) => void;
}

export function WorkflowTab({
    order,
    stepsLoading,
    allWorkflowSteps,
    workflowKanbanGroups,
    workflowLogs,
    onWorkflowDragEnd,
    getGroupCurrentTechRoom,
    getItemCurrentStep,
    getStepDeadlineDisplay,
    handleOpenAccessory,
    handleOpenPartner,
    handleOpenAssignDialog,
    handleOpenSaleAssignDialog,
    onProductCardClick
}: WorkflowTabProps) {
    if (order?.status === 'done') return null;

    const rooms = useMemo(() => [
        { id: 'waiting', title: 'Chờ tiếp nhận' },
        ...TECH_ROOMS,
        { id: 'done', title: 'Hoàn thành' },
        { id: 'fail', title: 'Thất bại' }
    ], []);

    // Khi order ở trạng thái before_sale, chỉ hiển thị nhóm đã được "Chốt đơn" (step5)
    const filteredGroups = useMemo(() => {
        if (order?.status !== 'before_sale') return workflowKanbanGroups;
        return workflowKanbanGroups.filter(g => {
            const leadItem = g.product || g.services[0];
            return leadItem?.status === 'step5';
        });
    }, [workflowKanbanGroups, order?.status]);

    const groupsByRoom = useMemo(() => {
        const map: Record<string, typeof workflowKanbanGroups> = {};
        rooms.forEach(r => { map[r.id] = []; });
        filteredGroups.forEach(g => {
            const roomId = getGroupCurrentTechRoom(g);
            if (map[roomId]) map[roomId].push(g);
        });
        return map;
    }, [filteredGroups, getGroupCurrentTechRoom, rooms]);

    return (
        <TabsContent value="workflow">
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Layers className="h-5 w-5 text-primary" />
                            Tiến trình / Quy trình – 3 phòng
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Dịch vụ theo quy trình gồm các phòng Mạ, Dán đế, Da. Sau khi KTV xác nhận hoàn thành bước, dịch vụ sẽ được chuyển sang phòng tiếp theo.
                        </p>
                    </CardHeader>
                    <CardContent>
                        {stepsLoading && !order?.items?.length ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <span className="ml-3 text-muted-foreground">Đang tải...</span>
                            </div>
                        ) : !order?.items?.length ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>Đơn hàng chưa có hạng mục nào.</p>
                            </div>
                        ) : (
                            <div className="pb-4">
                                <DragDropContext onDragEnd={onWorkflowDragEnd}>
                                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 overflow-x-auto min-w-[1200px] pb-4">
                                        {rooms.map((room) => (
                                            <WorkflowColumn
                                                key={room.id}
                                                room={room}
                                                groups={groupsByRoom[room.id] || []}
                                                orderCode={order?.order_code}
                                                getItemCurrentStep={getItemCurrentStep}
                                                getStepDeadlineDisplay={getStepDeadlineDisplay}
                                                handleOpenAccessory={handleOpenAccessory}
                                                handleOpenPartner={handleOpenPartner}
                                                handleOpenAssignDialog={handleOpenAssignDialog}
                                                handleOpenSaleAssignDialog={handleOpenSaleAssignDialog}
                                                onCardClick={onProductCardClick}
                                            />
                                        ))}
                                    </div>
                                </DragDropContext>
                                {allWorkflowSteps.length > 0 && (
                                    <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-muted-foreground">
                                                {allWorkflowSteps.filter((s: any) => s.status === 'completed').length} / {allWorkflowSteps.length} bước hoàn thành
                                            </span>
                                        </div>
                                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500"
                                                style={{
                                                    width: allWorkflowSteps.length
                                                        ? `${(allWorkflowSteps.filter((s: any) => s.status === 'completed').length / allWorkflowSteps.length) * 100}%`
                                                        : '0%'
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="mt-6 border-t pt-6">
                                    <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                                        <History className="h-4 w-4 text-primary" /> Lịch sử chuyển bước (Quy trình)
                                    </h3>
                                    {workflowLogs.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic py-2">Chưa có lịch sử.</p>
                                    ) : (
                                        <ul className="space-y-2 max-h-48 overflow-y-auto">
                                            {workflowLogs.map((log: any) => (
                                                <li key={log.id} className="text-xs flex items-center gap-2 py-1.5 border-b border-dashed last:border-0">
                                                    <span className="text-muted-foreground shrink-0">{formatDateTime(log.created_at)}</span>
                                                    <span className="font-medium">{log.created_by_user?.name ?? 'Hệ thống'}</span>
                                                    <span className="text-muted-foreground">
                                                        {log.step_name ? `${log.step_name}: ` : ''}{log.action === 'completed' ? 'Hoàn thành' : log.action === 'started' ? 'Bắt đầu' : 'Bỏ qua'}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
    );
}
