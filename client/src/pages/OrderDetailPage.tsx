import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ShoppingBag,
    FileText,
    Layers,
    RefreshCcw,
    Heart,
    Printer,
    Sparkles,
    CreditCard,
    ThumbsUp,
    Loader2,
    XCircle,
    UserPlus,
    Trash2,
    Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import type { DropResult } from '@hello-pangea/dnd';

import { ordersApi, orderItemsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/hooks/useOrders';
import type { OrderItem } from '@/hooks/useOrders';
import { useDepartments } from '@/hooks/useDepartments';
import { useUsers } from '@/hooks/useUsers';

// Direct imports from files to avoid circularity via index.ts
import { useOrderDetail } from './OrderDetailPage/hooks/useOrderDetail';
import { useOrderActions } from './OrderDetailPage/hooks/useOrderActions';
import { useWorkflowKanban } from './OrderDetailPage/hooks/useWorkflowKanban';
import { DetailTab } from './OrderDetailPage/tabs/DetailTab';
import { SalesTab } from './OrderDetailPage/tabs/SalesTab';
import { WorkflowTab } from './OrderDetailPage/tabs/WorkflowTab';
import { AftersaleTab } from './OrderDetailPage/tabs/AftersaleTab';
import { CareTab } from './OrderDetailPage/tabs/CareTab';
import { TECH_ROOMS, columns, getAfterSaleStageLabel, getCareWarrantyStageLabel } from './OrderDetailPage/constants';
import { getStatusVariant, getItemTypeLabel, getSLADisplay } from './OrderDetailPage/utils';

// Specific Dialogs
import { PrintQRDialog } from '@/components/orders/PrintQRDialog';
import { PaymentDialog } from '@/components/orders/PaymentDialog';
import { PaymentRecordDialog } from '@/components/orders/PaymentRecordDialog';
import { AssignTechnicianDialog } from './OrderDetailPage/dialogs/AssignTechnicianDialog';
import { MoveStepDialog } from '@/components/orders/workflow/MoveStepDialog';
import { FailDialog } from '@/components/orders/workflow/FailDialog';
import { ConfirmDoneDialog } from '@/components/orders/workflow/ConfirmDoneDialog';

export function OrderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { fetchOrders } = useOrders();

    // Custom Hooks
    const {
        order,
        setOrder,
        loading,
        allWorkflowSteps,
        stepsLoading,
        productStatusSummary,
        setProductStatusSummary,
        salesLogs,
        workflowLogs,
        aftersaleLogs,
        careLogs,
        reloadOrder,
        fetchKanbanLogs,
    } = useOrderDetail(id);

    const {
        updateOrderItemStatus,
        updateOrderStatus,
        updateOrderAfterSale,
        handleApproveOrder,
        handlePaymentSuccess,
    } = useOrderActions(id, fetchOrders, reloadOrder);

    const {
        getItemCurrentStep,
        getItemCurrentTechRoom,
        getGroupCurrentTechRoom,
        workflowKanbanGroups,
        getStepDeadlineDisplay,
    } = useWorkflowKanban(order, allWorkflowSteps);

    // Dialog & UI States
    const [activeTab, setActiveTab] = useState('detail');
    const [showPrintDialog, setShowPrintDialog] = useState(false);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [showPaymentRecordDialog, setShowPaymentRecordDialog] = useState(false);

    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);

    const [showAccessoryDialog, setShowAccessoryDialog] = useState(false);
    const [accessoryItem, setAccessoryItem] = useState<OrderItem | null>(null);
    const [accessoryStatus, setAccessoryStatus] = useState('');
    const [accessoryNotes, setAccessoryNotes] = useState('');
    const [accessoryLoading, setAccessoryLoading] = useState(false);

    const [showPartnerDialog, setShowPartnerDialog] = useState(false);
    const [partnerItem, setPartnerItem] = useState<OrderItem | null>(null);
    const [partnerStatus, setPartnerStatus] = useState('');
    const [partnerNotes, setPartnerNotes] = useState('');
    const [partnerLoading, setPartnerLoading] = useState(false);

    const [showExtensionDialog, setShowExtensionDialog] = useState(false);
    const [extensionReason, setExtensionReason] = useState('');
    const [extensionCustomerResult, setExtensionCustomerResult] = useState('');
    const [extensionNewDueAt, setExtensionNewDueAt] = useState('');
    const [extensionValidReason, setExtensionValidReason] = useState(false);
    const [extensionLoading, setExtensionLoading] = useState(false);

    // Step confirm states
    const [showMoveStepDialog, setShowMoveStepDialog] = useState(false);
    const [moveStepItemId, setMoveStepItemId] = useState<string>('');
    const [moveStepTargetRoom, setMoveStepTargetRoom] = useState<any>({});
    const [showFailDialog, setShowFailDialog] = useState(false);
    const [failItemId, setFailItemId] = useState<string>('');
    const [showConfirmDoneDialog, setShowConfirmDoneDialog] = useState(false);
    const [confirmDoneItemIds, setConfirmDoneItemIds] = useState<string[]>([]);
    const [isV2ServiceForDone, setIsV2ServiceForDone] = useState(false);

    // Departments and Technicians
    const { departments, fetchDepartments } = useDepartments();
    const { users: technicians, fetchUsers: fetchTechnicians } = useUsers();

    useEffect(() => {
        if (!id) {
            navigate('/orders');
            return;
        }
        fetchTechnicians();
        fetchDepartments();
    }, [id, navigate, fetchTechnicians, fetchDepartments]);

    // Tab switching logic for completed orders
    useEffect(() => {
        if (order?.status === 'done' && activeTab === 'workflow') {
            setActiveTab('detail');
        }
    }, [order?.status, activeTab]);

    // Fetch product status summary for V2 products
    useEffect(() => {
        const fetchProductStatusSummary = async () => {
            if (!order?.items) return;
            const v2Product = order.items.find((item: any) =>
                item.is_customer_item && item.item_type === 'product'
            );
            if (!v2Product || !v2Product.id) return;

            try {
                // Assuming orderProductsApi exists
                // const response = await orderProductsApi.getStatusSummary(v2Product.id);
                // if (response.data?.data) {
                //     setProductStatusSummary(response.data.data);
                // }
            } catch (error) {
                console.error('Error fetching status summary:', error);
            }
        };
        fetchProductStatusSummary();
    }, [order?.items, setProductStatusSummary]);

    // Handlers
    const handleOpenAssignDialog = (item: OrderItem) => {
        setSelectedItem(item);
        setShowAssignDialog(true);
    };

    const handleSubmitAccessory = async () => {
        if (!accessoryItem) return;
        setAccessoryLoading(true);
        try {
            await orderItemsApi.updateAccessory(accessoryItem.id, { status: accessoryStatus, notes: accessoryNotes || undefined });
            toast.success('Đã cập nhật trạng thái mua phụ kiện');
            await reloadOrder();
            setShowAccessoryDialog(false);
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        } finally {
            setAccessoryLoading(false);
        }
    };

    const handleOpenAccessory = (item: OrderItem) => {
        setAccessoryItem(item);
        setAccessoryStatus((item as any).accessory?.status || 'need_buy');
        setAccessoryNotes((item as any).accessory?.notes || '');
        setShowAccessoryDialog(true);
    };

    const handleOpenPartner = (item: OrderItem) => {
        setPartnerItem(item);
        setPartnerStatus((item as any).partner?.status || 'ship_to_partner');
        setPartnerNotes((item as any).partner?.notes || '');
        setShowPartnerDialog(true);
    };

    const handleSubmitPartner = async () => {
        if (!partnerItem) return;
        setPartnerLoading(true);
        try {
            await orderItemsApi.updatePartner(partnerItem.id, { status: partnerStatus, notes: partnerNotes || undefined });
            toast.success('Đã cập nhật trạng thái gửi đối tác');
            await reloadOrder();
            setShowPartnerDialog(false);
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        } finally {
            setPartnerLoading(false);
        }
    };

    const handleOpenExtension = () => {
        setExtensionReason(order?.extension_request?.reason || '');
        setExtensionCustomerResult(order?.extension_request?.customer_result || '');
        setExtensionNewDueAt(order?.extension_request?.new_due_at ? order.extension_request.new_due_at.slice(0, 16) : '');
        setExtensionValidReason(!!order?.extension_request?.valid_reason);
        setShowExtensionDialog(true);
    };

    const handleSubmitExtension = async () => {
        if (!order?.id) return;
        setExtensionLoading(true);
        try {
            if (order.extension_request?.id) {
                const payload: any = {};
                if (user?.role === 'sale' || user?.role === 'manager' || user?.role === 'admin') {
                    payload.customer_result = extensionCustomerResult;
                    if (extensionCustomerResult) payload.status = 'sale_contacted';
                }
                if (user?.role === 'manager' || user?.role === 'admin') {
                    if (extensionNewDueAt) payload.new_due_at = new Date(extensionNewDueAt).toISOString();
                    payload.valid_reason = extensionValidReason;
                    if (extensionNewDueAt) payload.status = 'manager_approved';
                }
                await ordersApi.updateExtensionRequest(order.id, payload);
                toast.success('Đã cập nhật yêu cầu gia hạn');
            } else {
                if (!extensionReason.trim()) {
                    toast.error('Vui lòng nhập lý do gia hạn');
                    setExtensionLoading(false);
                    return;
                }
                await ordersApi.createExtensionRequest(order.id, { reason: extensionReason.trim() });
                toast.success('Đã gửi yêu cầu gia hạn.');
            }
            await reloadOrder();
            setShowExtensionDialog(false);
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Lỗi gửi yêu cầu gia hạn');
        } finally {
            setExtensionLoading(false);
        }
    };

    const onWorkflowDragEnd = (result: DropResult) => {
        if (!result.destination || result.destination.droppableId === result.source.droppableId) return;

        const draggableId = result.draggableId;
        const targetRoomId = result.destination.droppableId;

        const group = workflowKanbanGroups.find(g => (g.product?.id ?? g.services.map(s => s.id).join('-')) === draggableId);
        if (!group) return;

        const leadItem = group.services.find((s) => getItemCurrentStep(s.id)) ?? group.services[0];
        if (!leadItem) return;

        if (targetRoomId === 'done') {
            const serviceIds = group.services.map(s => s.id);
            setConfirmDoneItemIds(serviceIds);
            setIsV2ServiceForDone(group.services.some(s => s.item_type === 'service' || s.item_type === 'package'));
            setShowConfirmDoneDialog(true);
        } else if (targetRoomId === 'fail') {
            setFailItemId(leadItem.id);
            setShowFailDialog(true);
        } else {
            const room = [...TECH_ROOMS].find(r => r.id === targetRoomId);
            if (room) {
                setMoveStepItemId(leadItem.id);
                setMoveStepTargetRoom(room);
                setShowMoveStepDialog(true);
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                    <p className="mt-4 text-muted-foreground">Đang tải thông tin đơn hàng...</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Không tìm thấy đơn hàng</h2>
                    <Button onClick={() => navigate('/orders')}>Quay lại</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2 shrink-0">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold flex flex-wrap items-center gap-2 sm:gap-3">
                            <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                            <span className="truncate max-w-[200px] sm:max-w-none">{order.order_code}</span>
                            <Badge variant={getStatusVariant(order.status) as any}>
                                {columns.find(c => c.id === order.status)?.title || order.status}
                            </Badge>
                        </h1>
                        <p className="text-muted-foreground text-sm">Chi tiết đơn hàng</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button variant="outline" onClick={() => setShowPrintDialog(true)} className="flex-1 sm:flex-none">
                        <Printer className="h-4 w-4 mr-2" />
                        In phiếu
                    </Button>
                    {order.status !== 'after_sale' && order.status !== 'cancelled' && (
                        <Button variant="outline" onClick={() => navigate(`/orders/${order.id}/edit`)} className="flex-1 sm:flex-none">
                            <Sparkles className="h-4 w-4 mr-2" />
                            Sửa đơn
                        </Button>
                    )}
                    {order.status !== 'after_sale' && order.status !== 'cancelled' && (
                        <Button
                            className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
                            onClick={() => setShowPaymentRecordDialog(true)}
                        >
                            <CreditCard className="h-4 w-4 mr-2" />
                            Thanh toán
                        </Button>
                    )}
                    {(user?.role === 'manager' || user?.role === 'admin') &&
                        order.items?.some(item => (item as any).status === 'step4') && (
                            <Button
                                className="bg-red-600 hover:bg-red-700 flex-1 sm:flex-none"
                                onClick={() => handleApproveOrder(order)}
                            >
                                <ThumbsUp className="h-4 w-4 mr-2" />
                                Phê duyệt đơn
                            </Button>
                        )}
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4 w-full justify-start overflow-x-auto no-scrollbar md:w-auto md:overflow-visible">
                    <TabsTrigger value="detail" className="gap-2 shrink-0">
                        <FileText className="h-4 w-4" />
                        Chi tiết
                    </TabsTrigger>
                    {order.status === 'before_sale' && (
                        <TabsTrigger value="sales" className="gap-2 shrink-0">
                            <ShoppingBag className="h-4 w-4" />
                            Lên đơn (Sales)
                        </TabsTrigger>
                    )}
                    {order.status !== 'done' && (
                        <TabsTrigger value="workflow" className="gap-2 shrink-0">
                            <Layers className="h-4 w-4" />
                            Tiến trình / Quy trình
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="aftersale" className="gap-2 shrink-0">
                        <RefreshCcw className="h-4 w-4" />
                        After sale
                    </TabsTrigger>
                    <TabsTrigger value="care" className="gap-2 shrink-0">
                        <Heart className="h-4 w-4" />
                        Chăm sóc / Bảo hành
                    </TabsTrigger>
                </TabsList>

                <DetailTab
                    order={order}
                    productStatusSummary={productStatusSummary}
                    onShowPrintDialog={() => setShowPrintDialog(true)}
                    onShowPaymentDialog={() => setShowPaymentDialog(true)}
                />

                {order.status === 'before_sale' && (
                    <SalesTab
                        order={order}
                        salesLogs={salesLogs}
                        updateOrderItemStatus={updateOrderItemStatus}
                        updateOrderStatus={updateOrderStatus}
                        reloadOrder={reloadOrder}
                        fetchKanbanLogs={fetchKanbanLogs}
                    />
                )}

                <WorkflowTab
                    order={order}
                    stepsLoading={stepsLoading}
                    allWorkflowSteps={allWorkflowSteps}
                    workflowKanbanGroups={workflowKanbanGroups}
                    workflowLogs={workflowLogs}
                    onWorkflowDragEnd={onWorkflowDragEnd}
                    getGroupCurrentTechRoom={getGroupCurrentTechRoom}
                    getItemCurrentStep={getItemCurrentStep}
                    getStepDeadlineDisplay={(itemId: string) => getStepDeadlineDisplay(itemId)}
                    handleOpenAccessory={handleOpenAccessory}
                    handleOpenPartner={handleOpenPartner}
                    handleOpenAssignDialog={handleOpenAssignDialog}
                />

                <AftersaleTab
                    order={order}
                    groups={workflowKanbanGroups}
                    aftersaleLogs={aftersaleLogs}
                    updateOrderAfterSale={updateOrderAfterSale}
                    reloadOrder={reloadOrder}
                    fetchKanbanLogs={fetchKanbanLogs}
                    setActiveTab={setActiveTab}
                    getSLADisplay={getSLADisplay}
                    getAfterSaleStageLabel={getAfterSaleStageLabel}
                    getGroupCurrentTechRoom={getGroupCurrentTechRoom}
                    openAfter1Dialog={() => { /* Implement if needed */ }}
                    openAfter2Dialog={() => { /* Implement if needed */ }}
                />

                <CareTab
                    order={order}
                    careLogs={careLogs}
                    updateOrderAfterSale={updateOrderAfterSale}
                    reloadOrder={reloadOrder}
                    fetchKanbanLogs={fetchKanbanLogs}
                    getCareWarrantyStageLabel={getCareWarrantyStageLabel}
                />
            </Tabs>

            {/* Dialogs */}
            <PrintQRDialog
                order={order}
                open={showPrintDialog}
                onClose={() => setShowPrintDialog(false)}
            />

            <PaymentDialog
                order={showPaymentDialog ? order : null}
                open={showPaymentDialog}
                onClose={() => setShowPaymentDialog(false)}
                onSuccess={handlePaymentSuccess}
            />

            <PaymentRecordDialog
                open={showPaymentRecordDialog}
                onOpenChange={setShowPaymentRecordDialog}
                orderId={order.id}
                orderCode={order.order_code}
                remainingDebt={order.remaining_debt ?? (order.total_amount - (order.paid_amount || 0))}
                onSuccess={reloadOrder}
            />

            {/* Technician Assignment Dialog */}
            {selectedItem && (
                <AssignTechnicianDialog
                    open={showAssignDialog}
                    onOpenChange={setShowAssignDialog}
                    selectedItem={selectedItem}
                    technicians={technicians}
                    onSuccess={reloadOrder}
                />
            )}

            {/* Accessory Dialog */}
            <Dialog open={showAccessoryDialog} onOpenChange={setShowAccessoryDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Mua phụ kiện</DialogTitle></DialogHeader>
                    {accessoryItem && (
                        <div className="space-y-4">
                            <div className="p-3 bg-muted rounded-lg"><p className="font-medium">{accessoryItem.item_name}</p></div>
                            <div className="space-y-2">
                                <Label>Trạng thái</Label>
                                <Select value={accessoryStatus} onValueChange={setAccessoryStatus}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="need_buy">Cần mua</SelectItem>
                                        <SelectItem value="bought">Đã mua</SelectItem>
                                        <SelectItem value="waiting_ship">Chờ ship</SelectItem>
                                        <SelectItem value="shipped">Ship tới</SelectItem>
                                        <SelectItem value="delivered_to_tech">Giao kỹ thuật</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Ghi chú</Label>
                                <Textarea value={accessoryNotes} onChange={e => setAccessoryNotes(e.target.value)} />
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSubmitAccessory} disabled={accessoryLoading}>
                                    {accessoryLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Cập nhật
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Partner Dialog */}
            <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Gửi đối tác</DialogTitle></DialogHeader>
                    {partnerItem && (
                        <div className="space-y-4">
                            <div className="p-3 bg-muted rounded-lg"><p className="font-medium">{partnerItem.item_name}</p></div>
                            <div className="space-y-2">
                                <Label>Trạng thái</Label>
                                <Select value={partnerStatus} onValueChange={setPartnerStatus}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ship_to_partner">Ship đối tác</SelectItem>
                                        <SelectItem value="partner_doing">Đối tác làm</SelectItem>
                                        <SelectItem value="ship_back">Ship về Shop</SelectItem>
                                        <SelectItem value="done">Done</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Ghi chú</Label>
                                <Textarea value={partnerNotes} onChange={e => setPartnerNotes(e.target.value)} />
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSubmitPartner} disabled={partnerLoading}>
                                    {partnerLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Cập nhật
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Extension Dialog */}
            <Dialog open={showExtensionDialog} onOpenChange={setShowExtensionDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Yêu cầu gia hạn</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        {!order.extension_request ? (
                            <div className="space-y-2">
                                <Label>Lý do gia hạn</Label>
                                <Textarea value={extensionReason} onChange={e => setExtensionReason(e.target.value)} />
                            </div>
                        ) : (
                            <>
                                <div className="p-3 bg-muted rounded-lg text-sm">
                                    <p>Lý do: {order.extension_request.reason}</p>
                                    <p>Trạng thái: {order.extension_request.status}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Kết quả liên hệ khách</Label>
                                    <Textarea value={extensionCustomerResult} onChange={e => setExtensionCustomerResult(e.target.value)} />
                                </div>
                                {(user?.role === 'manager' || user?.role === 'admin') && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Checkbox checked={extensionValidReason} onCheckedChange={(val) => setExtensionValidReason(!!val)} />
                                            <Label>Lý do hợp lệ</Label>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Hạn mới</Label>
                                            <Input type="datetime-local" value={extensionNewDueAt} onChange={e => setExtensionNewDueAt(e.target.value)} />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSubmitExtension} disabled={extensionLoading}>
                            {extensionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {order.extension_request ? 'Cập nhật' : 'Gửi yêu cầu'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Workflow Kanban Dialogs */}
            <MoveStepDialog
                open={showMoveStepDialog}
                onOpenChange={setShowMoveStepDialog}
                itemId={moveStepItemId}
                targetRoomId={moveStepTargetRoom?.id}
                targetRoomName={moveStepTargetRoom?.title}
                onSuccess={() => {
                    reloadOrder();
                    if (order?.id) fetchKanbanLogs(order.id);
                }}
            />

            <FailDialog
                open={showFailDialog}
                onOpenChange={setShowFailDialog}
                itemId={failItemId}
                onSuccess={() => {
                    reloadOrder();
                    if (order?.id) fetchKanbanLogs(order.id);
                }}
            />

            <ConfirmDoneDialog
                open={showConfirmDoneDialog}
                onOpenChange={setShowConfirmDoneDialog}
                itemIds={confirmDoneItemIds}
                isV2Service={isV2ServiceForDone}
                onSuccess={() => {
                    reloadOrder();
                    if (order?.id) fetchKanbanLogs(order.id);
                }}
            />
        </div>
    );
}
