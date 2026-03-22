import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
    Calendar,
    Pencil,
    Clock,
    Hash,
    Search,
    Image as ImageIcon,
    DollarSign,
    CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import type { DropResult } from '@hello-pangea/dnd';

import { ordersApi, orderItemsApi, requestsApi } from '@/lib/api';
import { uploadFile } from '@/lib/supabase';
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
import { TECH_ROOMS } from '@/components/orders/constants';
import { columns, getAfterSaleStageLabel, getCareWarrantyStageLabel } from './OrderDetailPage/constants';
import { getStatusVariant, getItemTypeLabel, getSLADisplay } from './OrderDetailPage/utils';
import { formatDate } from '@/lib/utils';

// Specific Dialogs
import { PrintQRDialog } from '@/components/orders/PrintQRDialog';
import { PaymentDialog } from '@/components/orders/PaymentDialog';
import { PaymentRecordDialog } from '@/components/orders/PaymentRecordDialog';
import { AssignTechnicianDialog } from './OrderDetailPage/dialogs/AssignTechnicianDialog';
import { AssignSalesPersonDialog } from './OrderDetailPage/dialogs/AssignSalesPersonDialog';
import { MoveStepDialog } from '@/components/orders/workflow/MoveStepDialog';
import { FailDialog } from '@/components/orders/workflow/FailDialog';
import { ConfirmDoneDialog } from '@/components/orders/workflow/ConfirmDoneDialog';
import { ProductDetailDialog } from './OrderDetailPage/dialogs/ProductDetailDialog';
import { UpsellDialog } from '@/components/orders/UpsellDialog';

export function PhotoUpload({ label, value, onChange, disabled }: { label: string; value: string[]; onChange: (urls: string[]) => void; disabled?: boolean }) {
    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        try {
            const uploadedUrls: string[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const { url, error } = await uploadFile('orders', 'accessories', file);
                if (error) throw error;
                if (url) uploadedUrls.push(url);
            }
            onChange([...value, ...uploadedUrls]);
            toast.success('Đã tải ảnh lên thành công');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Lỗi upload ảnh');
        } finally {
            setUploading(false);
        }
    };

    const removePhoto = (index: number) => {
        const newValue = [...value];
        newValue.splice(index, 1);
        onChange(newValue);
    };

    return (
        <div className="space-y-2">
            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">{label}</Label>
            <div className="grid grid-cols-4 gap-2">
                {value?.map((url, i) => (
                    <div key={i} className="group relative aspect-square rounded-lg overflow-hidden border bg-white shadow-sm">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        {!disabled && (
                            <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Plus className="w-3 h-3 rotate-45" />
                            </button>
                        )}
                    </div>
                ))}
                {!disabled && (
                    <label className={`aspect-square rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        {uploading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <ImageIcon className="w-6 h-6 text-slate-300" />}
                        <span className="text-[10px] font-medium text-slate-400 mt-1">Tải ảnh</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                )}
            </div>
        </div>
    );
}

export function OrderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
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
        updateItemAfterSaleData,
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
    const [showSaleAssignDialog, setShowSaleAssignDialog] = useState(false);
    const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);

    const [showAccessoryDialog, setShowAccessoryDialog] = useState(false);
    const [accessoryItem, setAccessoryItem] = useState<OrderItem | null>(null);
    const [newItemName, setNewItemName] = useState('');
    const [newItemQuantity, setNewItemQuantity] = useState('1');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [newItemOrderCode, setNewItemOrderCode] = useState('');
    const [newItemNotes, setNewItemNotes] = useState('');
    const [newItemPhotos, setNewItemPhotos] = useState<string[]>([]);
    const [accessoryLoading, setAccessoryLoading] = useState(false);

    const [showPartnerDialog, setShowPartnerDialog] = useState(false);
    const [partnerItem, setPartnerItem] = useState<OrderItem | null>(null);
    const [partnerStatus, setPartnerStatus] = useState('');
    const [partnerNotes, setPartnerNotes] = useState('');
    const [partnerLoading, setPartnerLoading] = useState(false);

    const [showExtensionDialog, setShowExtensionDialog] = useState(false);
    const [extensionItem, setExtensionItem] = useState<OrderItem | null>(null);
    const [extensionReason, setExtensionReason] = useState('');
    const [extensionCustomerResult, setExtensionCustomerResult] = useState('');
    const [extensionNewDueAt, setExtensionNewDueAt] = useState('');
    const [extensionValidReason, setExtensionValidReason] = useState(false);
    const [extensionLoading, setExtensionLoading] = useState(false);

    // Step confirm states
    const [showMoveStepDialog, setShowMoveStepDialog] = useState(false);
    const [moveStepItemId, setMoveStepItemId] = useState<string>('');
    const [moveStepTargetRoom, setMoveStepTargetRoom] = useState<any>({});
    const [moveStepInitialTechId, setMoveStepInitialTechId] = useState<string>('');
    const [showFailDialog, setShowFailDialog] = useState(false);
    const [failItemId, setFailItemId] = useState<string>('');
    const [showConfirmDoneDialog, setShowConfirmDoneDialog] = useState(false);
    const [confirmDoneItemIds, setConfirmDoneItemIds] = useState<string[]>([]);
    const [isV2ServiceForDone, setIsV2ServiceForDone] = useState(false);

    const [showProductDialog, setShowProductDialog] = useState(false);
    const [showUpsellDialog, setShowUpsellDialog] = useState(false);
    const [selectedProductGroup, setSelectedProductGroup] = useState<any>(null);
    const [currentRoomId, setCurrentRoomId] = useState('');
    const [highlightMessageId, setHighlightMessageId] = useState<string | undefined>(undefined);

    // Departments and Technicians/Sales
    const { departments, fetchDepartments } = useDepartments();
    const { technicians, salesPersons, fetchTechnicians, fetchSales } = useUsers();

    useEffect(() => {
        if (!id) {
            navigate('/orders');
            return;
        }
        fetchTechnicians();
        fetchSales();
        fetchDepartments();

        // Set active tab from navigation state if present
        const stateTab = (location.state as any)?.activeTab;
        if (stateTab) {
            setActiveTab(stateTab);
        }
    }, [id, navigate, fetchTechnicians, fetchSales, fetchDepartments, location.state]);

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

    // Auto-open product dialog from mention notification navigation state
    useEffect(() => {
        const chatState = (location.state as any)?.openChat;
        if (!chatState || !order || !workflowKanbanGroups.length) return;

        const { entityId, roomId, messageId } = chatState;
        // Find the matching group by entity id
        const group = workflowKanbanGroups.find((g: any) =>
            g.product?.id === entityId ||
            g.services?.some((s: any) => s.id === entityId)
        );
        if (group) {
            setSelectedProductGroup(group);
            setCurrentRoomId(roomId || '');
            setHighlightMessageId(messageId);
            setShowProductDialog(true);
            // Clear the navigation state so dialog doesn't re-open on refresh
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, order, workflowKanbanGroups]);

    useEffect(() => {
        if (showProductDialog && selectedProductGroup && workflowKanbanGroups.length > 0) {
            const groupId = selectedProductGroup.product?.id || selectedProductGroup.services?.[0]?.id;
            const currentGroup = workflowKanbanGroups.find(g =>
                (g.product?.id === groupId) ||
                (g.services && g.services.length > 0 && g.services[0].id === groupId)
            );
            if (currentGroup) {
                setSelectedProductGroup(currentGroup);
            }
        }
    }, [workflowKanbanGroups, showProductDialog]);

    // Handlers
    const handleOpenAssignDialog = (item: OrderItem) => {
        setSelectedItem(item);
        setShowAssignDialog(true);
    };

    const handleOpenSaleAssignDialog = (item: OrderItem) => {
        setSelectedItem(item);
        setShowSaleAssignDialog(true);
    };

    const handleSubmitAccessory = async () => {
        if (!accessoryItem || !order) return;
        if (!newItemName.trim()) {
            toast.error('Vui lòng nhập tên linh kiện / sản phẩm');
            return;
        }

        setAccessoryLoading(true);
        try {
            let order_item_id = undefined;
            let order_product_id = undefined;
            let order_product_service_id = undefined;

            if ((accessoryItem as any).is_customer_item) {
                if ((accessoryItem as any).item_type === 'product') {
                    order_product_id = accessoryItem.id;
                } else {
                    order_product_service_id = accessoryItem.id;
                }
            } else {
                order_item_id = accessoryItem.id;
            }

            const payload = {
                notes: newItemNotes,
                metadata: {
                    item_name: newItemName,
                    quantity: newItemQuantity,
                    price_estimate: newItemPrice,
                    photos: newItemPhotos,
                    order_code: newItemOrderCode || order.order_code,
                },
                order_item_id,
                order_product_id,
                order_product_service_id
            };

            await requestsApi.createAccessory(payload);
            toast.success('Đã tạo yêu cầu mua phụ kiện');
            await reloadOrder();
            setShowAccessoryDialog(false);
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Lỗi tạo yêu cầu');
        } finally {
            setAccessoryLoading(false);
        }
    };

    const handleOpenAccessory = (item: OrderItem) => {
        setAccessoryItem(item);
        setNewItemName('');
        setNewItemQuantity('1');
        setNewItemPrice('');
        setNewItemNotes('');
        setNewItemPhotos([]);

        let relatedCode = order?.order_code || '';
        if ((item as any).product?.product_code) {
            relatedCode = (item as any).product.product_code;
        } else if (item.item_code) {
            relatedCode = item.item_code;
        } else if ((item as any).order_product?.product_code) {
            relatedCode = (item as any).order_product.product_code;
        }

        setNewItemOrderCode(relatedCode);
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
            await orderItemsApi.updatePartner(partnerItem.id, { status: 'ship_to_partner', notes: partnerNotes || undefined });
            toast.success('Đã cập nhật trạng thái gửi đối tác');
            await reloadOrder();
            setShowPartnerDialog(false);
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        } finally {
            setPartnerLoading(false);
        }
    };

    const handleOpenExtension = (item?: OrderItem | any) => {
        if (item && item.id) {
            setExtensionItem(item);
            setExtensionReason((item as any).extension_request?.reason || '');
            setExtensionNewDueAt((item as any).extension_request?.new_due_at ? (item as any).extension_request.new_due_at.slice(0, 16) : '');
        } else {
            setExtensionItem(null);
            setExtensionReason(order?.extension_request?.reason || '');
            setExtensionCustomerResult(order?.extension_request?.customer_result || '');
            setExtensionNewDueAt(order?.extension_request?.new_due_at ? order.extension_request.new_due_at.slice(0, 16) : '');
            setExtensionValidReason(!!order?.extension_request?.valid_reason);
        }
        setShowExtensionDialog(true);
    };

    const handleSubmitExtension = async () => {
        if (!order?.id) return;
        setExtensionLoading(true);
        try {
            const isItemExtension = !!extensionItem;
            const currentRequest = isItemExtension ? (extensionItem as any).extension_request : order.extension_request;

            if (currentRequest?.id) {
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
                    toast.error('Vui lòng chọn hoặc nhập lý do gia hạn');
                    setExtensionLoading(false);
                    return;
                }
                if (!extensionNewDueAt) {
                    toast.error('Vui lòng chọn thời gian đề xuất gia hạn');
                    setExtensionLoading(false);
                    return;
                }

                const extensionData = {
                    reason: extensionReason.trim(),
                    new_due_at: new Date(extensionNewDueAt).toISOString()
                };

                if (isItemExtension && extensionItem) {
                    await orderItemsApi.createExtensionRequest(extensionItem.id, extensionData);
                } else {
                    await ordersApi.createExtensionRequest(order.id, extensionData);
                }

                toast.success('Đã gửi yêu cầu gia hạn.');
                // Chuyển sang bên yêu cầu
                navigate('/requests', { state: { defaultTab: 'extensions' } });
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
                const currentStep = getItemCurrentStep(leadItem.id);
                setMoveStepInitialTechId(currentStep?.technician_id || '');
                setShowMoveStepDialog(true);
            }
        }
    };

    const handleOpenProductDialog = (group: any, roomId: string) => {
        setSelectedProductGroup(group);
        setCurrentRoomId(roomId);
        setShowProductDialog(true);
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
                        <div className="text-muted-foreground text-sm flex items-center gap-2">
                            <span>Chi tiết đơn hàng</span>
                            <span className="text-muted-foreground/30 px-1">•</span>
                            <div
                                className="flex items-center gap-1.5 cursor-pointer hover:bg-orange-50 px-1.5 py-0.5 rounded transition-colors group"
                                onClick={handleOpenExtension}
                            >
                                {order.due_at ? (
                                    <>
                                        <Calendar className="h-3.5 w-3.5 text-orange-500" />
                                        <span className="font-medium">Hạn trả: {formatDate(order.due_at)}</span>
                                        <span className={`font-semibold ${getSLADisplay(order.due_at).includes('Trễ') ? 'text-red-600' : 'text-green-600'}`}>
                                            ({getSLADisplay(order.due_at)})
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="italic">Chưa có hạn</span>
                                    </>
                                )}
                                <Pencil className="h-3 w-3 text-muted-foreground opacity-20 group-hover:opacity-100 transition-opacity ml-1" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button variant="outline" onClick={() => setShowUpsellDialog(true)} className="flex-1 sm:flex-none">
                        <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
                        Upsell
                    </Button>
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
                    <TabsTrigger value="sales" className="gap-2 shrink-0">
                        <ShoppingBag className="h-4 w-4" />
                        Lên đơn (Sales)
                    </TabsTrigger>
                    <TabsTrigger value="workflow" className="gap-2 shrink-0">
                        <Layers className="h-4 w-4" />
                        Tiến trình / Quy trình
                    </TabsTrigger>
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

                <SalesTab
                    order={order}
                    salesLogs={salesLogs}
                    updateOrderItemStatus={updateOrderItemStatus}
                    updateOrderStatus={updateOrderStatus}
                    reloadOrder={reloadOrder}
                    fetchKanbanLogs={fetchKanbanLogs}
                    onProductCardClick={handleOpenProductDialog}
                    workflowKanbanGroups={workflowKanbanGroups}
                    onTabChange={setActiveTab}
                />

                <WorkflowTab
                    order={order}
                    stepsLoading={stepsLoading}
                    allWorkflowSteps={allWorkflowSteps}
                    workflowKanbanGroups={workflowKanbanGroups}
                    workflowLogs={workflowLogs}
                    salesLogs={salesLogs}
                    onWorkflowDragEnd={onWorkflowDragEnd}
                    getGroupCurrentTechRoom={getGroupCurrentTechRoom}
                    getItemCurrentStep={getItemCurrentStep}
                    getStepDeadlineDisplay={(itemId: string) => getStepDeadlineDisplay(itemId)}
                    handleOpenAccessory={handleOpenAccessory}
                    handleOpenPartner={handleOpenPartner}
                    handleOpenExtension={handleOpenExtension}
                    handleOpenAssignDialog={handleOpenAssignDialog}
                    handleOpenSaleAssignDialog={handleOpenSaleAssignDialog}
                    onProductCardClick={handleOpenProductDialog}
                    updateOrderItemStatus={updateOrderItemStatus}
                    fetchKanbanLogs={fetchKanbanLogs}
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
                    onProductCardClick={handleOpenProductDialog}
                />

                <CareTab
                    order={order}
                    groups={workflowKanbanGroups}
                    careLogs={careLogs}
                    updateOrderAfterSale={updateOrderAfterSale}
                    reloadOrder={reloadOrder}
                    fetchKanbanLogs={fetchKanbanLogs}
                    getCareWarrantyStageLabel={getCareWarrantyStageLabel}
                    onProductCardClick={handleOpenProductDialog}
                    onUpdateItemAfterSaleData={updateItemAfterSaleData}
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

            {/* Sales Assignment Dialog */}
            {selectedItem && (
                <AssignSalesPersonDialog
                    open={showSaleAssignDialog}
                    onOpenChange={setShowSaleAssignDialog}
                    selectedItem={selectedItem}
                    salesPersons={salesPersons}
                    onSuccess={reloadOrder}
                />
            )}

            {/* Accessory Dialog */}
            <Dialog open={showAccessoryDialog} onOpenChange={setShowAccessoryDialog}>
                <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="p-6 pb-4 bg-slate-50/50 border-b">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Plus className="w-6 h-6 text-primary" />
                            Tạo yêu cầu mua phụ kiện
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500">Tên phụ kiện *</Label>
                            <Input
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                placeholder=""
                                className="h-11 rounded-xl"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500">Số lượng</Label>
                                <div className="relative">
                                    <Input
                                        value={newItemQuantity}
                                        onChange={(e) => setNewItemQuantity(e.target.value)}
                                        placeholder="1"
                                        className="h-11 rounded-xl pl-10"
                                    />
                                    <Hash className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500">Giá dự kiến</Label>
                                <div className="relative">
                                    <Input
                                        value={newItemPrice}
                                        onChange={(e) => {
                                            const digits = e.target.value.replace(/\D/g, '');
                                            if (!digits) setNewItemPrice('');
                                            else setNewItemPrice(new Intl.NumberFormat('en-US').format(Number(digits)));
                                        }}
                                        placeholder="1,500,000"
                                        className="h-11 rounded-xl pl-10"
                                    />
                                    <DollarSign className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500">Mã sản phẩm / đơn hàng</Label>
                            <div className="relative">
                                <Input
                                    value={newItemOrderCode}
                                    readOnly disabled
                                    className="h-11 rounded-xl pl-10 bg-slate-50"
                                />
                                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500">Ghi chú chi tiết</Label>
                            <Textarea
                                value={newItemNotes}
                                onChange={(e) => setNewItemNotes(e.target.value)}
                                placeholder="Mô tả tình trạng, yêu cầu đặc biệt..."
                                className="min-h-[80px] rounded-xl resize-none"
                            />
                        </div>

                        <PhotoUpload
                            label="Ảnh phụ kiện mẫu / Link sản phẩm"
                            value={newItemPhotos}
                            onChange={setNewItemPhotos}
                        />
                    </div>
                    <DialogFooter className="p-6 bg-slate-50/50 border-t flex items-center justify-between gap-3">
                        <Button variant="ghost" onClick={() => setShowAccessoryDialog(false)} className="rounded-xl px-6">Hủy</Button>
                        <Button
                            onClick={handleSubmitAccessory}
                            disabled={accessoryLoading || !newItemName}
                            className="rounded-xl px-10 font-bold shadow-lg shadow-primary/20"
                        >
                            {accessoryLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Gửi yêu cầu
                        </Button>
                    </DialogFooter>
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
                                <div className="p-2.5 border rounded-lg bg-amber-50 text-amber-800 font-medium text-sm">
                                    Xác nhận gửi đối tác
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Ghi chú</Label>
                                <Textarea value={partnerNotes} onChange={e => setPartnerNotes(e.target.value)} />
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSubmitPartner} disabled={partnerLoading}>
                                    {partnerLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Xác nhận
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Extension Dialog */}
            <Dialog open={showExtensionDialog} onOpenChange={setShowExtensionDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {order.extension_request ? 'Cập nhật yêu cầu gia hạn' : 'Cập nhật hạn trả / Gia hạn'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {!order.extension_request && !(extensionItem as any)?.extension_request ? (
                            <>
                                {extensionItem && (
                                    <div className="p-3 bg-muted rounded-lg mb-4">
                                        <p className="text-sm font-bold text-primary flex items-center gap-2">
                                            <Layers className="h-4 w-4" />
                                            {extensionItem.item_name}
                                        </p>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label>Lý do xin gia hạn</Label>
                                    <Select value={['MẤT ĐIỆN', 'HẾT NVL', 'QUÊN CHƯA LÀM'].includes(extensionReason) ? extensionReason : extensionReason ? 'other' : ''} onValueChange={(val) => {
                                        if (val === 'other') setExtensionReason('');
                                        else setExtensionReason(val);
                                    }}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Chọn lý do..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MẤT ĐIỆN">1. Mất điện</SelectItem>
                                            <SelectItem value="HẾT NVL">2. Hết nguyên vật liệu</SelectItem>
                                            <SelectItem value="QUÊN CHƯA LÀM">3. Quên chưa làm</SelectItem>
                                            <SelectItem value="other">Ghi chú khác...</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {(extensionReason === '' || !['MẤT ĐIỆN', 'HẾT NVL', 'QUÊN CHƯA LÀM'].includes(extensionReason)) && (
                                        <Textarea
                                            placeholder="Nhập lý do chi tiết..."
                                            value={extensionReason}
                                            onChange={e => setExtensionReason(e.target.value)}
                                            className="mt-2"
                                        />
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-red-500" />
                                        THỜI GIAN ĐỀ XUẤT XIN GIA HẠN <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="datetime-local"
                                        required
                                        value={extensionNewDueAt}
                                        onChange={e => setExtensionNewDueAt(e.target.value)}
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">Phải có ngày giờ rõ ràng để tiếp tục quy trình.</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="p-3 bg-muted rounded-lg text-sm">
                                    <p>Lý do: {order.extension_request?.reason || (extensionItem as any)?.extension_request?.reason}</p>
                                    <p>Trạng thái: {order.extension_request?.status || (extensionItem as any)?.extension_request?.status}</p>
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
                technicians={technicians}
                initialTechnicianId={moveStepInitialTechId}
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
                    setActiveTab('aftersale');
                }}
            />

            <ProductDetailDialog
                open={showProductDialog}
                onOpenChange={(open) => {
                    setShowProductDialog(open);
                    if (!open) setHighlightMessageId(undefined);
                }}
                group={selectedProductGroup}
                roomId={currentRoomId}
                currentUserId={user?.id}
                order={order}
                onUpdateOrder={updateOrderAfterSale}
                onUpdateItemAfterSaleData={updateItemAfterSaleData}
                onReloadOrder={reloadOrder}
                setActiveTab={setActiveTab}
                highlightMessageId={highlightMessageId}
                salesLogs={salesLogs}
                workflowLogs={workflowLogs}
                aftersaleLogs={aftersaleLogs}
                careLogs={careLogs}
            />

            <UpsellDialog
                open={showUpsellDialog}
                onOpenChange={setShowUpsellDialog}
                orderId={order.id}
                order={order}
                onSuccess={async () => {
                    await reloadOrder();
                }}
            />
        </div>
    );
}
