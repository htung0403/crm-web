import React from 'react';
import {
    RefreshCcw, Camera, Upload, ThumbsUp, ThumbsDown, Bot, Copy, History, ShoppingBag
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils';
import { ordersApi } from '@/lib/api';
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
    { id: 'after3', title: 'Nhắn HD & Feedback', color: 'text-purple-700' },
    { id: 'after4', title: 'Lưu Trữ', color: 'text-green-700' },
] as const;

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

    const currentStage = (order as any).after_sale_stage ?? 'after1';

    const handleAfterSaleDragEnd = (result: DropResult) => {
        if (!order || !result.destination || result.destination.droppableId === result.source.droppableId) return;
        const newStage = result.destination.droppableId as string;

        const patch: Partial<Order> = { after_sale_stage: newStage };
        // If status not after_sale, update it
        if (order.status !== 'after_sale') {
            patch.status = 'after_sale';
        }

        updateOrderAfterSale(patch);
        toast.success('Đã chuyển bước After sale');

        ordersApi.updateAfterSaleStage(order.id, newStage).then(() => {
            // Also update status in backend if needed
            if (order.status !== 'after_sale') {
                ordersApi.updateStatus(order.id, 'after_sale').catch(console.error);
            }
            fetchKanbanLogs(order.id);
        }).catch((e: any) => {
            reloadOrder();
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        });
    };

    return (
        <TabsContent value="aftersale">
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
                                return (
                                    <div key={col.id} className="flex flex-col min-w-[280px]">
                                        <div className="flex justify-between items-center mb-4 px-2">
                                            <h2 className={cn('font-bold uppercase text-xs sm:text-sm tracking-widest', col.color)}>{col.title}</h2>
                                            <span className="bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                                                {groups.filter(g => currentStage === col.id && getGroupCurrentTechRoom(g) === 'done').length}
                                            </span>
                                        </div>
                                        <Droppable droppableId={col.id}>
                                            {(provided, snapshot) => {
                                                const colGroups = groups.filter(g => currentStage === col.id && getGroupCurrentTechRoom(g) === 'done');
                                                return (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        className={cn(
                                                            "min-h-[300px] p-2 rounded-xl flex-1 border-2 border-dashed transition-colors",
                                                            snapshot.isDraggingOver ? "bg-purple-50 border-purple-300" : "bg-gray-50 border-transparent"
                                                        )}
                                                    >
                                                        {colGroups.map((group, index) => {
                                                            const product = group.product;
                                                            const draggableId = product?.id || `group-${index}`;

                                                            return (
                                                                <Draggable key={draggableId} draggableId={draggableId} index={index}>
                                                                    {(provided) => (
                                                                        <div
                                                                            ref={provided.innerRef}
                                                                            {...provided.draggableProps}
                                                                            {...provided.dragHandleProps}
                                                                            className={cn(
                                                                                'bg-white rounded-xl shadow-sm mb-3 border-l-4 transition-all overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md hover:border-purple-600',
                                                                                order.due_at && new Date(order.due_at) < new Date() ? 'border-red-500 bg-red-50/30' : 'border-purple-400'
                                                                            )}
                                                                            onClick={() => onProductCardClick(group, col.id)}
                                                                        >
                                                                            {/* Full width image at the top */}
                                                                            {(product?.image || product?.product?.image || (product as any)?.service?.image) ? (
                                                                                <div className="aspect-video w-full bg-gray-100 overflow-hidden border-b">
                                                                                    <img
                                                                                        src={product?.image || product?.product?.image || (product as any)?.service?.image}
                                                                                        alt={product?.item_name || 'Product Image'}
                                                                                        className="w-full h-full object-cover"
                                                                                    />
                                                                                </div>
                                                                            ) : (
                                                                                <div className="aspect-video w-full bg-gray-100 flex items-center justify-center border-b">
                                                                                    <ShoppingBag className="h-10 w-10 text-muted-foreground" />
                                                                                </div>
                                                                            )}

                                                                            <div className="p-4">
                                                                                <div className="flex justify-between items-start mb-2">
                                                                                    <span className="text-xs font-black text-gray-300">#{order.order_code}</span>
                                                                                </div>

                                                                                <div className="min-w-0 mb-3">
                                                                                    <h3 className="font-bold text-gray-800 text-sm truncate">
                                                                                        {product?.item_name || 'Khách'}
                                                                                    </h3>
                                                                                    <p className="text-xs text-muted-foreground truncate">
                                                                                        {order.customer?.name}
                                                                                    </p>
                                                                                </div>

                                                                                <p className="text-xs text-gray-400 mt-1">
                                                                                    {group.services.map(s => s.item_name).join(', ')}
                                                                                </p>

                                                                                <div className="mt-4 flex justify-between items-center">
                                                                                    <Badge variant="secondary" className="text-xs font-bold text-purple-500 bg-purple-50 uppercase">
                                                                                        {order.sales_user?.name || 'Sale'}
                                                                                    </Badge>
                                                                                    <span className="text-xs font-bold text-gray-400">{getSLADisplay(order.due_at)}</span>
                                                                                </div>
                                                                                {col.id === 'after1' && (
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        size="sm"
                                                                                        className="mt-2 w-full h-9 font-bold border-purple-200 hover:bg-purple-50 text-purple-700"
                                                                                        onClick={(e) => { e.stopPropagation(); onProductCardClick(group, 'after1'); }}
                                                                                    >
                                                                                        <Camera className="h-4 w-4 mr-1.5" /> Kiểm nợ & Ảnh hoàn thiện
                                                                                    </Button>
                                                                                )}
                                                                                {col.id === 'after2' && (
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        size="sm"
                                                                                        className="mt-2 w-full h-9 font-bold border-purple-200 hover:bg-purple-50 text-purple-700"
                                                                                        onClick={(e) => { e.stopPropagation(); onProductCardClick(group, 'after2'); }}
                                                                                    >
                                                                                        <Upload className="h-4 w-4 mr-1.5" /> Đóng gói & Giao hàng
                                                                                    </Button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </Draggable>
                                                            );
                                                        })}
                                                        {colGroups.length === 0 && (
                                                            <div className="flex items-center justify-center h-20 text-muted-foreground text-base">
                                                                —
                                                            </div>
                                                        )}
                                                        {provided.placeholder}
                                                    </div>
                                                );
                                            }}
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
                                <h3 className="text-xs font-bold text-purple-800 uppercase mb-3 tracking-widest">Đã nhắn HD & Xin feedback</h3>
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
        </TabsContent>
    );
}
