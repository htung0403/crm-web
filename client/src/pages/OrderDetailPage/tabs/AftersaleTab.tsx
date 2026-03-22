import React, { memo } from 'react';
import {
    RefreshCcw, Camera, Upload, ThumbsUp, ThumbsDown, Bot, Copy, History, ShoppingBag,
    Tag, FileText, Wrench, User as UserIcon, Package, Truck
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils';
import { ordersApi, orderProductsApi, orderItemsApi } from '@/lib/api';
import type { Order, OrderItem } from '@/hooks/useOrders';

import type { WorkflowKanbanGroup } from '../types';

interface AftersaleTabProps {
    order: Order | null;
    groups: WorkflowKanbanGroup[];
    aftersaleLogs: any[];
    updateOrderAfterSale: (patch: Partial<Order>) => void;
    reloadOrder: () => Promise<void>;
    fetchKanbanLogs: (orderId: string) => Promise<void>;
    setActiveTab: (tab: string) => void;
    getSLADisplay: (dueAt: string | Date | null | undefined) => string;
    getAfterSaleStageLabel: (stage: string) => string;
    getGroupCurrentTechRoom: (group: any) => string;
    // Dialog control props
    onProductCardClick: (group: any, roomId: string) => void;
}

const AFTER_COLS = [
    { id: 'after1', title: 'Kiểm nợ & Ảnh hoàn thiện', color: 'text-purple-700' },
    { id: 'after2', title: 'Đóng gói & Giao hàng', color: 'text-purple-700' },
    { id: 'after3', title: 'Nhắn HD Bảo Quản & Feedback', color: 'text-purple-700' },
    { id: 'after4', title: 'Lưu Trữ', color: 'text-green-700' },
] as const;

const AftersaleCard = memo(({
    group,
    index,
    col,
    order,
    onProductCardClick,
    getSLADisplay
}: {
    group: WorkflowKanbanGroup;
    index: number;
    col: typeof AFTER_COLS[number];
    order: Order;
    onProductCardClick: (group: any, roomId: string) => void;
    getSLADisplay: (dueAt: string | Date | null | undefined) => string;
}) => {
    const product = group.product;
    const draggableId = product?.id || `group-${index}`;
    const productName = product?.item_name || 'Khách';
    const productItem = product as any;
    const productImage = product?.image || productItem?.product?.image || productItem?.service?.image;
    const isLate = order.due_at && new Date(order.due_at) < new Date();

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
                        isLate ? "border-red-500 bg-red-50/30" : "border-purple-400 hover:border-purple-600"
                    )}
                    onClick={() => onProductCardClick(group, col.id)}
                >
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold text-gray-400">#{order.order_code}</span>
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
                        {order.customer?.name && (
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                                <UserIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <span className="truncate">{order.customer.name}</span>
                            </div>
                        )}
                    </div>

                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Dịch vụ</p>
                    <ul className="space-y-1">
                        {group.services.map((svc) => (
                            <li key={svc.id} className="rounded-md px-2 py-1">
                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-700">
                                    <Wrench className="h-3 w-3 shrink-0 text-primary/60" />
                                    <span className="truncate">{svc.item_name}</span>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px]">
                        <Badge variant="secondary" className="text-[10px] font-bold text-purple-500 bg-purple-50 uppercase h-5">
                            {order.sales_user?.name || 'Sale'}
                        </Badge>
                        <span className="font-semibold text-gray-400">{getSLADisplay(order.due_at)}</span>
                    </div>

                    {col.id === 'after1' && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full h-8 text-[11px] font-bold border-purple-200 hover:bg-purple-50 text-purple-700"
                            onClick={(e) => { e.stopPropagation(); onProductCardClick(group, 'after1'); }}
                        >
                            <Camera className="h-3.5 w-3.5 mr-1.5" /> Kiểm nợ & Ảnh hoàn thiện
                        </Button>
                    )}
                    {col.id === 'after2' && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full h-8 text-[11px] font-bold border-purple-200 hover:bg-purple-50 text-purple-700"
                            onClick={(e) => { e.stopPropagation(); onProductCardClick(group, 'after2'); }}
                        >
                            <Upload className="h-3.5 w-3.5 mr-1.5" /> Đóng gói & Giao hàng
                        </Button>
                    )}
                </div>
            )}
        </Draggable>
    );
});

AftersaleCard.displayName = 'AftersaleCard';

export function AftersaleTab({
    order,
    groups,
    aftersaleLogs,
    updateOrderAfterSale,
    reloadOrder,
    fetchKanbanLogs,
    setActiveTab,
    getSLADisplay,
    getAfterSaleStageLabel,
    getGroupCurrentTechRoom,
    onProductCardClick
}: AftersaleTabProps) {
    if (!order) return null;

    const handleAfterSaleDragEnd = (result: DropResult) => {
        if (!order || !result.destination || result.destination.droppableId === result.source.droppableId) return;
        const newStage = result.destination.droppableId as string;
        const itemId = result.draggableId;

        // Find the group/product being dragged
        const draggedGroup = groups.find(g => g.product?.id === itemId);
        if (!draggedGroup || !draggedGroup.product) return;

        const isCustomerItem = !!draggedGroup.product.is_customer_item;

        toast.success(`Đã chuyển sản phẩm "${draggedGroup.product.item_name}" sang bước mới`);

        if (result.source.droppableId === 'after1' && newStage === 'after2') {
            const hasPhotos = draggedGroup.product.completion_photos && draggedGroup.product.completion_photos.length > 0;
            const hasNames = order.debt_checked_by_name && order.aftersale_receiver_name;
            const isDebtChecked = order.debt_checked;

            if (!isDebtChecked || !hasNames || !hasPhotos) {
                let errorMsg = "Vui lòng hoàn thành các yêu cầu sau để chuyển bước:";
                if (!isDebtChecked) errorMsg += "\n- Cần \"Xác nhận đã kiểm nợ\"";
                if (!hasNames) errorMsg += "\n- Phải điền tên người Kiểm nợ và người Nhận hàng";
                if (!hasPhotos) errorMsg += "\n- Cần upload ít nhất một \"Ảnh hoàn thiện/kiểm nợ\"";
                
                toast.error(errorMsg, { duration: 5000 });
                onProductCardClick(draggedGroup, 'after1');
                return;
            }
        }

        // Add validation for transition from after2 to after3
        if (result.source.droppableId === 'after2' && newStage === 'after3') {
            const arePhotosOk = draggedGroup.product.packaging_photos && draggedGroup.product.packaging_photos.length > 0;
            const areFieldsOk = order.delivery_creator_name && order.delivery_shipper_phone && 
                                order.delivery_staff_name && order.delivery_received_at;
            
            if (!areFieldsOk || !arePhotosOk) {
                let errorMsg = "Vui lòng hoàn thành các yêu cầu sau để chuyển bước:";
                if (!areFieldsOk) errorMsg += "\n- Nhập đầy đủ: NV Tạo đơn, SĐT Liên hệ, NV Giao đồ và Thời gian nhận đồ";
                if (!arePhotosOk) errorMsg += "\n- Cần ít nhất một \"Ảnh đóng gói/trả đồ\"";
                
                toast.error(errorMsg, { duration: 5000 });
                onProductCardClick(draggedGroup, 'after2');
                return;
            }
        }

        const apiPromise = isCustomerItem
            ? orderProductsApi.updateAfterSaleData(itemId, { stage: newStage })
            : orderItemsApi.updateAfterSaleData(itemId, { stage: newStage });

        apiPromise.then(() => {
            // Also ensure the order status is 'after_sale' if it's not already
            if (order.status !== 'after_sale') {
                ordersApi.updateStatus(order.id, 'after_sale').catch(console.error);
            }
            reloadOrder();
            fetchKanbanLogs(order.id);
        }).catch((e: any) => {
            reloadOrder();
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        });
    };

    return (
        <TabsContent value="aftersale">
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <RefreshCcw className="h-5 w-5 text-primary" />
                            After sale – Quy trình sau kỹ thuật
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Kiểm nợ & Ảnh → Đóng gói & Giao hàng → Nhắn HD & Feedback → Lưu trữ. Kéo thả thẻ đơn vào cột để chuyển bước.
                        </p>
                    </CardHeader>
                    <CardContent>
                        <DragDropContext onDragEnd={handleAfterSaleDragEnd}>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto pb-4">
                                {AFTER_COLS.map((col) => {
                                    const colGroups = groups.filter(g => {
                                        const itemStage = g.product?.after_sale_stage || (order as any).after_sale_stage || 'after1';
                                        return itemStage === col.id && getGroupCurrentTechRoom(g) === 'done';
                                    });
                                    return (
                                        <div key={col.id} className="flex flex-col min-w-[260px]">
                                            <div className="flex justify-between items-center mb-4 px-2">
                                                <h2 className={cn("font-bold uppercase text-xs tracking-widest", col.color)}>
                                                    {col.title}
                                                </h2>
                                                <span className="bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                                                    {colGroups.length}
                                                </span>
                                            </div>
                                            <Droppable droppableId={col.id}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        className={cn(
                                                            "min-h-[300px] p-2 rounded-xl flex-1 border-2 border-dashed transition-colors",
                                                            snapshot.isDraggingOver ? "bg-purple-50 border-purple-300" : "bg-gray-100 border-transparent"
                                                        )}
                                                    >
                                                        {colGroups.map((group, index) => (
                                                            <AftersaleCard
                                                                key={group.product?.id || `group-${index}`}
                                                                group={group}
                                                                index={index}
                                                                col={col}
                                                                order={order}
                                                                onProductCardClick={onProductCardClick}
                                                                getSLADisplay={getSLADisplay}
                                                            />
                                                        ))}
                                                        {provided.placeholder}
                                                        {colGroups.length === 0 && !snapshot.isDraggingOver && (
                                                            <div className="flex items-center justify-center h-20 text-muted-foreground text-xs italic">
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

                        {/* Nhắn HD & Feedback */}
                        {order && ((order as any).after_sale_stage ?? 'after1') === 'after3' && (
                            <div className="mt-6 p-6 bg-purple-50 rounded-2xl border border-purple-100 space-y-6">
                                <div>
                                    <h3 className="text-xs font-bold text-purple-800 uppercase mb-3 tracking-widest">Đã nhắn HD Bảo Quản & Xin feedback</h3>
                                    <div className="flex flex-wrap gap-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={!!(order as any).hd_sent}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    updateOrderAfterSale({ hd_sent: checked });
                                                    toast.success(checked ? 'Đã đánh dấu nhắn HD' : 'Đã bỏ đánh dấu');
                                                    ordersApi.patch(order.id, { hd_sent: checked }).catch((err: any) => {
                                                        reloadOrder();
                                                        toast.error(err?.response?.data?.message || 'Lỗi cập nhật');
                                                    });
                                                }}
                                                className="rounded h-4 w-4"
                                            />
                                            <span className="text-sm font-medium">Đã nhắn hướng dẫn bảo quản</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={!!(order as any).feedback_requested}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    updateOrderAfterSale({ feedback_requested: checked });
                                                    toast.success(checked ? 'Đã đánh dấu xin feedback' : 'Đã bỏ đánh dấu');
                                                    ordersApi.patch(order.id, { feedback_requested: checked }).catch((err: any) => {
                                                        reloadOrder();
                                                        toast.error(err?.response?.data?.message || 'Lỗi cập nhật');
                                                    });
                                                }}
                                                className="rounded h-4 w-4"
                                            />
                                            <span className="text-sm font-medium">Đã xin feedback khách</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold text-purple-800 uppercase mb-4 tracking-widest">Xử lý Feedback khách hàng</h3>
                                    <div className="flex flex-wrap gap-4">
                                        <Button
                                            onClick={() => {
                                                const payload = { after_sale_stage: 'after4', care_warranty_flow: 'care', care_warranty_stage: 'care6' };
                                                updateOrderAfterSale(payload);
                                                toast.success('Đã chuyển sang Lưu trữ (Khách khen)');
                                                ordersApi.patch(order.id, payload).then(() => {
                                                    fetchKanbanLogs(order.id);
                                                    setActiveTab('care');
                                                }).catch((e: any) => {
                                                    reloadOrder();
                                                    toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
                                                });
                                            }}
                                            className="flex-1 min-w-[180px] bg-green-600 hover:bg-green-700 h-12 text-white font-bold rounded-xl"
                                        >
                                            <ThumbsUp className="mr-2 h-5 w-5" /> Khách khen (→ Lưu trữ)
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                const payload = { after_sale_stage: 'after4', care_warranty_flow: 'warranty', care_warranty_stage: 'war1' };
                                                updateOrderAfterSale(payload);
                                                toast.success('Đã ghi nhận – chuyển quy trình bảo hành');
                                                ordersApi.patch(order.id, payload).then(() => {
                                                    fetchKanbanLogs(order.id);
                                                    setActiveTab('care');
                                                }).catch((e: any) => {
                                                    reloadOrder();
                                                    toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
                                                });
                                            }}
                                            variant="destructive"
                                            className="flex-1 min-w-[180px] h-12 font-bold rounded-xl"
                                        >
                                            <ThumbsDown className="mr-2 h-5 w-5" /> Khách chê (→ Bảo hành)
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tin nhắn mẫu */}
                        <div className="mt-6 p-5 bg-purple-50 border border-purple-100 rounded-xl">
                            <h3 className="text-xs font-bold text-purple-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Bot className="h-4 w-4" /> Tin nhắn mẫu cho Sale (Facebook Inbox)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {[
                                    { id: 'ship', title: '1. Xin địa chỉ Ship', getText: () => `Chào ${order.customer?.name || 'anh/chị'} ạ, giày đã xong. Anh/chị cho shop xin địa chỉ ship nhé!` },
                                    { id: 'care', title: '2. HD Bảo quản', getText: () => `Shop gửi ${order.customer?.name || 'anh/chị'} HDSD: Tránh nước, lau bằng khăn mềm định kỳ ạ.` },
                                    { id: 'feedback', title: '3. Xin Feedback', getText: () => `Dạ chào ${order.customer?.name || 'anh/chị'}, mình nhận được giày chưa ạ? Cho shop xin feedback nhé!` },
                                ].map((tmp) => (
                                    <Button
                                        key={tmp.id}
                                        variant="outline"
                                        className="h-auto py-3 px-4 justify-start text-left border-purple-200 hover:bg-white hover:shadow-md"
                                        onClick={() => {
                                            const text = tmp.getText();
                                            navigator.clipboard.writeText(text);
                                            toast.success('Đã copy tin nhắn mẫu!');
                                        }}
                                    >
                                        <Copy className="mr-2 h-4 w-4 shrink-0 text-purple-500" />
                                        <span className="text-xs font-bold text-purple-700">{tmp.title}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Lịch sử chuyển giai đoạn After sale */}
                        <div className="mt-6 border-t pt-6">
                            <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                                <History className="h-4 w-4 text-primary" /> Lịch sử chuyển bước (After sale)
                            </h3>
                            {aftersaleLogs.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic py-2">Chưa có lịch sử.</p>
                            ) : (
                                <ul className="space-y-2 max-h-48 overflow-y-auto">
                                    {aftersaleLogs.map((log: any) => (
                                        <li key={log.id} className="text-xs flex items-center gap-2 py-1.5 border-b border-dashed last:border-0">
                                            <span className="text-muted-foreground shrink-0">{formatDateTime(log.created_at)}</span>
                                            <span className="font-medium">{log.created_by_user?.name ?? 'Hệ thống'}</span>
                                            <span className="text-muted-foreground">
                                                {log.from_stage ? `${getAfterSaleStageLabel(log.from_stage)} → ` : ''}{getAfterSaleStageLabel(log.to_stage)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
    );
}
