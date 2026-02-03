import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Package, Gift, Sparkles, ShoppingBag, CreditCard, Printer,
    Wrench, Loader2, Calendar, User as UserIcon, FileText, Clock, CheckCircle, XCircle,
    ArrowRight, Building2, Users, Phone, CircleDot, UserPlus, Timer, Layers,
    RotateCw, Bot, Copy, ThumbsUp, ThumbsDown, Check, History,
    Truck, CalendarClock, RefreshCcw, Camera, Upload, X, Heart
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { uploadFile } from '@/lib/supabase';
import { ordersApi, orderItemsApi } from '@/lib/api';
import type { Order, OrderItem } from '@/hooks/useOrders';
import type { User } from '@/types';
import { useOrders } from '@/hooks/useOrders';
import { useUsers } from '@/hooks/useUsers';
import { columns, TECH_ROOMS, getTechRoomByStepOrder } from '@/components/orders/constants';
import { WorkflowStepsTimeline } from "@/components/orders/WorkflowStepsTimeline";
import { PrintQRDialog } from '@/components/orders/PrintQRDialog';
import { EditOrderDialog } from '@/components/orders/EditOrderDialog';
import { PaymentDialog } from '@/components/orders/PaymentDialog';
import { PaymentRecordDialog } from '@/components/orders/PaymentRecordDialog';
import { useProducts } from '@/hooks/useProducts';
import { usePackages } from '@/hooks/usePackages';
import { useVouchers } from '@/hooks/useVouchers';
import { useDepartments } from '@/hooks/useDepartments';
import { useAuth } from '@/contexts/AuthContext';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';

// Nhãn trạng thái cho các yêu cầu trên thẻ Kanban
const ACCESSORY_LABELS: Record<string, string> = {
    need_buy: 'Cần mua',
    bought: 'Đã mua',
    waiting_ship: 'Chờ ship',
    shipped: 'Ship tới',
    delivered_to_tech: 'Giao KT',
};
const PARTNER_LABELS: Record<string, string> = {
    ship_to_partner: 'Ship ĐT',
    partner_doing: 'ĐT làm',
    ship_back: 'Ship về',
    done: 'Done',
};
const EXTENSION_LABELS: Record<string, string> = {
    requested: 'Đã yêu cầu',
    sale_contacted: 'Sale đã liên hệ',
    manager_approved: 'QL đã duyệt',
    notified_tech: 'Đã báo KT',
    kpi_recorded: 'Đã ghi KPI',
};

const SALES_STEPS = [
    { id: 'step1', label: '1. Nhận đồ', title: 'Nhận đồ', color: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    { id: 'step2', label: '2. Gắn Tag', title: 'Gắn Tag', color: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    { id: 'step3', label: '3. Trao đổi KT', title: 'Trao đổi KT', color: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    { id: 'step4', label: '4. Phê duyệt', title: 'Phê duyệt', color: 'text-red-500', bgColor: 'bg-red-50', borderColor: 'border-red-200', isAlert: true },
    { id: 'step5', label: '5. Chốt đơn', title: 'Chốt đơn', color: 'text-green-500', bgColor: 'bg-green-50', borderColor: 'border-green-200', isSuccess: true },
];

const SALES_STATUS_LABELS: Record<string, string> = {
    pending: 'Đơn nháp',
    step1: '1. Nhận đồ',
    step2: '2. Gắn Tag',
    step3: '3. Trao đổi KT',
    step4: '4. Phê duyệt',
    step5: '5. Chốt đơn',
    assigned: 'Đã phân công',
    in_progress: 'Đang thực hiện',
    completed: 'Hoàn thành',
    cancelled: 'Đã huỷ',
};

const AFTER_SALE_STAGE_LABELS: Record<string, string> = {
    after1: 'Kiểm nợ & Ảnh hoàn thiện',
    after2: 'Đóng gói & Giao hàng',
    after3: 'Nhắn HD & Feedback',
    after4: 'Lưu Trữ',
};

function getSalesStatusLabel(value: string | null | undefined): string {
    if (value == null || value === '') return '—';
    return SALES_STATUS_LABELS[value] ?? value;
}

function getAfterSaleStageLabel(value: string | null | undefined): string {
    if (value == null || value === '') return '—';
    return AFTER_SALE_STAGE_LABELS[value] ?? value;
}

const CARE_WARRANTY_STAGE_LABELS: Record<string, string> = {
    war1: '1. Tiếp nhận',
    war2: '2. Xử lý',
    war3: '3. Hoàn tất',
    care6: 'Mốc 6 Tháng',
    care12: 'Mốc 12 Tháng',
    'care-custom': 'Lịch Riêng',
};
function getCareWarrantyStageLabel(value: string | null | undefined): string {
    if (value == null || value === '') return '—';
    return CARE_WARRANTY_STAGE_LABELS[value] ?? value;
}

export function OrderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { updateOrderStatus, updateOrder, fetchOrders } = useOrders();
    const { products, services, fetchProducts, fetchServices } = useProducts();
    const { packages, fetchPackages } = usePackages();
    const { vouchers, fetchVouchers } = useVouchers();
    const { users: technicians, fetchTechnicians } = useUsers();
    const { departments, fetchDepartments } = useDepartments();

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPrintDialog, setShowPrintDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [showPaymentRecordDialog, setShowPaymentRecordDialog] = useState(false);

    // Assign technician dialog state
    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
    const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('');
    const [assignLoading, setAssignLoading] = useState(false);

    // Workflow steps for department kanban
    const [allWorkflowSteps, setAllWorkflowSteps] = useState<any[]>([]);
    const [stepsLoading, setStepsLoading] = useState(false);

    // Mua phụ kiện dialog
    const [showAccessoryDialog, setShowAccessoryDialog] = useState(false);
    const [accessoryItem, setAccessoryItem] = useState<OrderItem | null>(null);
    const [accessoryStatus, setAccessoryStatus] = useState<string>('need_buy');
    const [accessoryNotes, setAccessoryNotes] = useState('');
    const [accessoryLoading, setAccessoryLoading] = useState(false);

    // Gửi Đối Tác dialog
    const [showPartnerDialog, setShowPartnerDialog] = useState(false);
    const [partnerItem, setPartnerItem] = useState<OrderItem | null>(null);
    const [partnerStatus, setPartnerStatus] = useState<string>('ship_to_partner');
    const [partnerNotes, setPartnerNotes] = useState('');
    const [partnerLoading, setPartnerLoading] = useState(false);

    // Xin gia hạn dialog
    const [showExtensionDialog, setShowExtensionDialog] = useState(false);
    const [extensionReason, setExtensionReason] = useState('');
    const [extensionCustomerResult, setExtensionCustomerResult] = useState('');
    const [extensionNewDueAt, setExtensionNewDueAt] = useState('');
    const [extensionValidReason, setExtensionValidReason] = useState(false);
    const [extensionLoading, setExtensionLoading] = useState(false);

    // Complete workflow step (Quy trình)
    const [stepCompleteLoading, setStepCompleteLoading] = useState<string | null>(null);

    // After sale dialogs: Kiểm nợ & Ảnh hoàn thiện (after1), Đóng gói & Giao hàng (after2)
    const [showAfter1Dialog, setShowAfter1Dialog] = useState(false);
    const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
    const [debtChecked, setDebtChecked] = useState(false);
    const [debtCheckedNotes, setDebtCheckedNotes] = useState('');
    const [after1Uploading, setAfter1Uploading] = useState(false);
    const [after1Saving, setAfter1Saving] = useState(false);

    const [showAfter2Dialog, setShowAfter2Dialog] = useState(false);
    const [packagingPhotos, setPackagingPhotos] = useState<string[]>([]);
    const [deliveryCarrier, setDeliveryCarrier] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [deliverySelfPickup, setDeliverySelfPickup] = useState(false);
    const [deliveryNotes, setDeliveryNotes] = useState('');
    const [after2Uploading, setAfter2Uploading] = useState(false);
    const [after2Saving, setAfter2Saving] = useState(false);
    const [after1JustSaved, setAfter1JustSaved] = useState(false);
    const [after2JustSaved, setAfter2JustSaved] = useState(false);

    const [activeTab, setActiveTab] = useState('detail');

    // Kanban logs (lịch sử chuyển trạng thái từng tab)
    const [salesLogs, setSalesLogs] = useState<any[]>([]);
    const [workflowLogs, setWorkflowLogs] = useState<any[]>([]);
    const [aftersaleLogs, setAftersaleLogs] = useState<any[]>([]);
    const [careLogs, setCareLogs] = useState<any[]>([]);

    const fetchKanbanLogs = useCallback(async (orderId: string) => {
        try {
            const [salesRes, workflowRes, aftersaleRes, careRes] = await Promise.all([
                ordersApi.getKanbanLogs(orderId, 'sales'),
                ordersApi.getKanbanLogs(orderId, 'workflow'),
                ordersApi.getKanbanLogs(orderId, 'aftersale'),
                ordersApi.getKanbanLogs(orderId, 'care'),
            ]);
            setSalesLogs(salesRes.data?.data?.logs ?? []);
            setWorkflowLogs(workflowRes.data?.data?.logs ?? []);
            setAftersaleLogs(aftersaleRes.data?.data?.logs ?? []);
            setCareLogs(careRes.data?.data?.logs ?? []);
        } catch {
            // ignore
        }
    }, []);

    // Tick every second so elapsed timers (Đã phân công, Đang thực hiện) update in real time
    const [, setTimerTick] = useState(0);
    useEffect(() => {
        if (!order) return;
        const id = setInterval(() => setTimerTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, [order]);

    useEffect(() => {
        if (order?.id) fetchKanbanLogs(order.id);
    }, [order?.id, fetchKanbanLogs]);

    // Reload order data
    const reloadOrder = useCallback(async () => {
        if (!id) return;
        try {
            const response = await ordersApi.getById(id);
            const orderData = response.data?.data?.order;
            if (orderData && orderData.id) {
                setOrder(orderData);
            }
        } catch {
            console.error('Error reloading order');
        }
    }, [id]);

    // Optimistic update for After-sale: cập nhật state ngay, gọi API nền; lỗi thì revert bằng reloadOrder
    const updateOrderAfterSale = useCallback((patch: Partial<Order>) => {
        setOrder((prev) => (prev ? { ...prev, ...patch } : null));
    }, []);

    // Optimistic update cho Sales Kanban: cập nhật status của 1 order item
    const updateOrderItemStatus = useCallback((itemId: string, status: string) => {
        setOrder((prev) =>
            prev
                ? { ...prev, items: (prev.items || []).map((i) => (i.id === itemId ? { ...i, status } : i)) }
                : null
        );
    }, []);

    useEffect(() => {
        if (!id) {
            navigate('/orders');
            return;
        }

        const fetchOrder = async () => {
            setLoading(true);
            try {
                const response = await ordersApi.getById(id);
                const orderData = response.data?.data?.order;
                if (orderData && orderData.id) {
                    setOrder(orderData);
                } else {
                    toast.error('Không tìm thấy đơn hàng');
                    navigate('/orders');
                }
            } catch {
                toast.error('Lỗi khi tải thông tin đơn hàng');
                navigate('/orders');
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
        fetchProducts({ status: 'active' });
        fetchServices({ status: 'active' });
        fetchPackages();
        fetchVouchers();
        fetchTechnicians();
    }, [id, navigate, fetchProducts, fetchServices, fetchPackages, fetchVouchers, fetchTechnicians]);

    // Fetch departments
    useEffect(() => {
        fetchDepartments({ status: 'active' });
    }, [fetchDepartments]);

    // Fetch all workflow steps for this order's items (service + package)
    useEffect(() => {
        const fetchAllSteps = async () => {
            if (!order?.items || order.items.length === 0) return;

            setStepsLoading(true);
            try {
                const allSteps: any[] = [];
                for (const item of order.items) {
                    if (item.item_type === 'service' || item.item_type === 'package') {
                        try {
                            const response = await orderItemsApi.getSteps(item.id);
                            if (response.data?.data) {
                                const stepsWithItem = (response.data.data as any[]).map(step => ({
                                    ...step,
                                    item_name: item.item_name,
                                    item_id: item.id
                                }));
                                allSteps.push(...stepsWithItem);
                            }
                        } catch (e) {
                            console.error('Error fetching steps for item:', item.id, e);
                        }
                    }
                }
                setAllWorkflowSteps(allSteps);
            } catch (error) {
                console.error('Error fetching workflow steps:', error);
            } finally {
                setStepsLoading(false);
            }
        };

        fetchAllSteps();
    }, [order?.items]);

    // Auto-refresh when window regains focus (e.g., after completing task in another tab)
    useEffect(() => {
        const handleFocus = () => {
            reloadOrder();
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [reloadOrder]);

    const getItemTypeLabel = (type: string) => {
        switch (type) {
            case 'product': return 'Sản phẩm';
            case 'service': return 'Dịch vụ';
            case 'package': return 'Gói dịch vụ';
            case 'voucher': return 'Voucher';
            default: return type;
        }
    };

    const getItemTypeColor = (type: string) => {
        switch (type) {
            case 'product': return 'bg-blue-100 text-blue-700';
            case 'service': return 'bg-purple-100 text-purple-700';
            case 'package': return 'bg-emerald-100 text-emerald-700';
            case 'voucher': return 'bg-amber-100 text-amber-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    // Loại sản phẩm của khách (Giày, Túi xách, Ví...) - khớp với CreateOrderPage PRODUCT_TYPES
    const getCustomerProductTypeLabel = (value: string | null | undefined) => {
        if (!value) return 'Sản phẩm của khách';
        const labels: Record<string, string> = {
            giày: 'Giày', túi: 'Túi xách', ví: 'Ví', 'thắt lưng': 'Thắt lưng',
            dép: 'Dép', mũ: 'Mũ/Nón', khác: 'Khác'
        };
        return labels[value] || value;
    };

    const getStatusVariant = (status: string) => {
        if (status === 'step4') return 'danger';
        if (status === 'step5') return 'success';
        if (status.startsWith('step')) return 'info';

        switch (status) {
            case 'completed': return 'success';
            case 'cancelled': return 'danger';
            case 'processing': return 'warning';
            case 'confirmed': return 'purple';
            default: return 'info';
        }
    };

    // SLA display for Kanban Kỹ thuật: còn X ngày / trễ X ngày (from order.due_at)
    const getSLADisplay = (dueAt: string | undefined) => {
        if (!dueAt) return 'N/A';
        const diff = Math.ceil((new Date(dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return diff < 0 ? `Trễ ${Math.abs(diff)} ngày` : `Còn ${diff} ngày`;
    };

    // Compute current tech room per order item from workflow steps (step_order 1→Phòng Mạ, 2→Dán đế, 3→Phòng Da)
    const getItemCurrentTechRoom = useCallback((itemId: string): 'phong_ma' | 'phong_dan_de' | 'phong_da' => {
        const steps = allWorkflowSteps.filter((s: any) => s.item_id === itemId || s.order_item_id === itemId || s.order_product_service_id === itemId);
        const inProgress = steps.find((s: any) => s.status === 'in_progress');
        const firstPending = steps.find((s: any) => s.status === 'pending' || s.status === 'assigned');
        const step = inProgress || firstPending;
        const order = step?.step_order ?? 1;
        return getTechRoomByStepOrder(order);
    }, [allWorkflowSteps]);

    // Current step for an item (in_progress or first pending/assigned) for "Xác nhận hoàn thành bước"
    const getItemCurrentStep = useCallback((itemId: string): { id: string; step_name: string; status: string } | null => {
        const steps = allWorkflowSteps.filter((s: any) => s.item_id === itemId || s.order_item_id === itemId || s.order_product_service_id === itemId);
        const inProgress = steps.find((s: any) => s.status === 'in_progress');
        const firstPending = steps.find((s: any) => s.status === 'pending' || s.status === 'assigned');
        const step = inProgress || firstPending;
        return step ? { id: step.id, step_name: step.step_name, status: step.status } : null;
    }, [allWorkflowSteps]);

    // Format elapsed time for timer display
    const formatElapsedTime = (startTime: string | undefined) => {
        if (!startTime) return '--:--:--';
        const start = new Date(startTime).getTime();
        const now = Date.now();
        const elapsed = Math.max(0, now - start);
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // Open assign dialog
    const handleOpenAssignDialog = (item: OrderItem) => {
        setSelectedItem(item);
        setSelectedTechnicianId('');
        setShowAssignDialog(true);
    };

    const handleOpenAccessory = (item: OrderItem) => {
        setAccessoryItem(item);
        setAccessoryStatus((item as any).accessory?.status || 'need_buy');
        setAccessoryNotes((item as any).accessory?.notes || '');
        setShowAccessoryDialog(true);
    };

    const handleSubmitAccessory = async () => {
        if (!accessoryItem) return;
        setAccessoryLoading(true);
        try {
            await orderItemsApi.updateAccessory(accessoryItem.id, { status: accessoryStatus, notes: accessoryNotes || undefined });
            toast.success('Đã cập nhật trạng thái mua phụ kiện');
            await reloadOrder();
            setShowAccessoryDialog(false);
            setAccessoryItem(null);
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
        } finally {
            setAccessoryLoading(false);
        }
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
            setPartnerItem(null);
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

    const handleCompleteStep = async (stepId: string) => {
        setStepCompleteLoading(stepId);
        try {
            await orderItemsApi.completeStep(stepId);
            toast.success('Đã xác nhận hoàn thành bước. Dịch vụ chuyển sang phòng tiếp theo.');
            await reloadOrder();
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Lỗi xác nhận hoàn thành bước');
        } finally {
            setStepCompleteLoading(null);
        }
    };

    const handleSubmitExtension = async () => {
        if (!order?.id) return;
        setExtensionLoading(true);
        try {
            if (order.extension_request?.id) {
                const payload: { customer_result?: string; new_due_at?: string; valid_reason?: boolean; status?: string } = {};
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
                toast.success('Đã gửi yêu cầu gia hạn. Telegram báo Sale + Quản lý (dùng nút Gửi thông báo nếu cần).');
            }
            await reloadOrder();
            setShowExtensionDialog(false);
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Lỗi gửi yêu cầu gia hạn');
        } finally {
            setExtensionLoading(false);
        }
    };

    const handleNotifyTelegram = () => {
        toast.info('Gửi thông báo Telegram: cấu hình Bot Token và Chat ID để tích hợp thật.');
    };

    // Assign technician to item
    const handleAssignTechnician = async () => {
        if (!selectedItem || !selectedTechnicianId) return;

        setAssignLoading(true);
        try {
            await orderItemsApi.assignTechnician(selectedItem.id, selectedTechnicianId);
            toast.success('Đã phân công kỹ thuật viên thành công!');
            await reloadOrder();
            setShowAssignDialog(false);
        } catch {
            toast.error('Lỗi khi phân công kỹ thuật viên');
        } finally {
            setAssignLoading(false);
        }
    };

    const handleUpdateOrder = async (orderId: string, data: {
        items: Array<{ type: string; item_id: string; name: string; quantity: number; unit_price: number }>;
        notes?: string;
        discount?: number;
    }) => {
        try {
            await updateOrder(orderId, data);
            toast.success('Đã cập nhật đơn hàng!');
            // Refetch order data
            const response = await ordersApi.getById(orderId);
            if (response.data?.data?.order) {
                setOrder(response.data.data.order);
            }
            setShowEditDialog(false);
        } catch {
            toast.error('Lỗi khi cập nhật đơn hàng');
        }
    };

    const handlePaymentSuccess = async () => {
        try {
            if (order) {
                await updateOrderStatus(order.id, 'completed');
                toast.success('Thanh toán thành công! Đơn hàng đã hoàn thành.');
                // Refetch order data
                const response = await ordersApi.getById(order.id);
                if (response.data?.data?.order) {
                    setOrder(response.data.data.order);
                }
                await fetchOrders();
            }
        } catch {
            toast.error('Lỗi khi cập nhật trạng thái đơn hàng');
        } finally {
            setShowPaymentDialog(false);
        }
    };

    const handleApproveOrder = async () => {
        if (!order?.items) return;

        const itemsToApprove = order.items.filter(item => {
            const hasV2Products = order.items?.some(i => (i as any).is_v2_product);
            if (hasV2Products && !(item as any).is_v2_product) return false;
            return item.status === 'step4' || (item.status === 'pending' && false); // Safe check
        });

        if (itemsToApprove.length === 0) {
            toast.error('Không có hạng mục nào đang chờ phê duyệt');
            return;
        }

        setLoading(true);
        try {
            await Promise.all(itemsToApprove.map(item => orderItemsApi.updateStatus(item.id, 'step5')));

            // Also update the overall order status to 'confirmed'
            await updateOrderStatus(order.id, 'confirmed');

            toast.success('Đã phê duyệt tất cả các hạng mục và xác nhận đơn hàng!');
            await reloadOrder();
        } catch (error) {
            console.error('Error approving items:', error);
            toast.error('Lỗi khi phê duyệt đơn hàng');
        } finally {
            setLoading(false);
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
                    <p className="text-muted-foreground mb-4">Đơn hàng này không tồn tại hoặc đã bị xóa.</p>
                    <Button onClick={() => navigate('/orders')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Quay lại
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <>
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
                                <Badge variant={getStatusVariant(order.status) as 'success' | 'danger' | 'warning' | 'info' | 'purple'}>
                                    {columns.find(c => c.id === order.status)?.title || SALES_STEPS.find(s => s.id === order.status)?.title}
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
                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                            <Button variant="outline" onClick={() => setShowEditDialog(true)} className="flex-1 sm:flex-none">
                                <Sparkles className="h-4 w-4 mr-2" />
                                Sửa đơn
                            </Button>
                        )}
                        {/* Payment button - always show when order is not completed/cancelled */}
                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                            <Button
                                className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none whitespace-nowrap"
                                onClick={() => setShowPaymentRecordDialog(true)}
                            >
                                <CreditCard className="h-4 w-4 mr-2" />
                                Thanh toán
                            </Button>
                        )}
                        {/* Approval button for managers/admins */}
                        {(user?.role === 'manager' || user?.role === 'admin') &&
                            order.items?.some(item => {
                                const hasV2Products = order.items?.some(i => (i as any).is_v2_product);
                                if (hasV2Products && !(item as any).is_v2_product) return false;
                                return item.status === 'step4';
                            }) && (
                                <Button
                                    className="bg-red-600 hover:bg-red-700 flex-1 sm:flex-none whitespace-nowrap"
                                    onClick={handleApproveOrder}
                                >
                                    <ThumbsUp className="h-4 w-4 mr-2" />
                                    Phê duyệt đơn
                                </Button>
                            )}
                    </div>
                </div>

                {/* Tabs for Detail and Workflow */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="mb-4 w-full justify-start overflow-x-auto no-scrollbar md:w-auto md:overflow-visible">
                        <TabsTrigger value="detail" className="gap-2 flex-shrink-0">
                            <FileText className="h-4 w-4" />
                            Chi tiết
                        </TabsTrigger>
                        {order?.status === 'pending' && (
                            <TabsTrigger value="sales" className="gap-2 flex-shrink-0">
                                <ShoppingBag className="h-4 w-4" />
                                Lên đơn (Sales)
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="workflow" className="gap-2 flex-shrink-0">
                            <Layers className="h-4 w-4" />
                            Tiến trình / Quy trình
                        </TabsTrigger>
                        <TabsTrigger value="aftersale" className="gap-2 flex-shrink-0">
                            <RefreshCcw className="h-4 w-4" />
                            After sale
                        </TabsTrigger>
                        <TabsTrigger value="care" className="gap-2 flex-shrink-0">
                            <Heart className="h-4 w-4" />
                            Chăm sóc / Bảo hành
                        </TabsTrigger>
                    </TabsList>

                    {/* Detail Tab */}
                    <TabsContent value="detail">
                        {/* Main Content - 2 Column Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Column - Order Items (2/3) */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Customer Info */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <UserIcon className="h-4 w-4 text-primary" />
                                            Thông tin khách hàng
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-14 w-14">
                                                <AvatarFallback className="bg-primary text-white text-lg">
                                                    {order.customer?.name?.charAt(0) || 'C'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <p className="font-semibold text-lg">{order.customer?.name || 'N/A'}</p>
                                                <p className="text-muted-foreground">{order.customer?.phone || 'Không có SĐT'}</p>
                                            </div>
                                            {order.customer && (
                                                <Button variant="outline" size="sm" onClick={() => navigate(`/customers?id=${order.customer?.id}`)}>
                                                    Xem hồ sơ
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Items Table: V2 = product row + services listed below; V1 = single row */}
                                {order.items && order.items.length > 0 && (() => {
                                    type ItemGroup = { product: OrderItem | null; services: OrderItem[] };
                                    const groups: ItemGroup[] = [];
                                    let i = 0;
                                    while (i < order.items!.length) {
                                        const item = order.items![i] as OrderItem & { is_v2_product?: boolean };
                                        if (item.is_v2_product && item.item_type === 'product') {
                                            const services: OrderItem[] = [];
                                            let j = i + 1;
                                            while (j < order.items!.length) {
                                                const next = order.items![j] as OrderItem & { is_v2_product?: boolean };
                                                if (next.is_v2_product && next.item_type === 'product') break;
                                                services.push(order.items![j]);
                                                j++;
                                            }
                                            groups.push({ product: item, services });
                                            i = j;
                                        } else {
                                            groups.push({ product: null, services: [item] });
                                            i++;
                                        }
                                    }
                                    if (groups.length === 0) return null;
                                    return (
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Package className="h-4 w-4 text-primary" />
                                                Chi tiết sản phẩm/dịch vụ
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-muted/50">
                                                        <tr>
                                                            <th className="text-left p-4 font-medium w-16">Ảnh</th>
                                                            <th className="text-left p-4 font-medium">Loại</th>
                                                            <th className="text-left p-4 font-medium">Tên</th>
                                                            <th className="text-center p-4 font-medium">SL</th>
                                                            <th className="text-right p-4 font-medium">Đơn giá</th>
                                                            <th className="text-right p-4 font-medium">Thành tiền</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {groups.map((group, gi) => {
                                                            if (group.product) {
                                                                const product = group.product;
                                                                const servicesTotal = group.services.reduce((sum, s) => sum + (s.total_price || 0), 0);
                                                                return (
                                                                    <React.Fragment key={gi}>
                                                                        <tr className="bg-muted/20 hover:bg-muted/30 border-l-2 border-l-primary">
                                                                            <td className="p-4 align-top">
                                                                                {(product.product?.image || (product as any).product?.image) ? (
                                                                                    <img src={(product.product?.image || (product as any).product?.image) as string} alt={product.item_name} className="w-12 h-12 rounded-lg object-cover border" />
                                                                                ) : (
                                                                                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                                                                        <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                            <td className="p-4 align-top">
                                                                                <Badge className={getItemTypeColor('product')}>
                                                                                    {getCustomerProductTypeLabel((product as any).product_type)}
                                                                                </Badge>
                                                                            </td>
                                                                            <td className="p-4 font-medium align-top">{product.item_name}</td>
                                                                            <td className="p-4 text-center align-top">{product.quantity}</td>
                                                                            <td className="p-4 text-right text-muted-foreground align-top">—</td>
                                                                            <td className="p-4 text-right font-semibold align-top">
                                                                                {group.services.length > 0 ? formatCurrency(servicesTotal) : '—'}
                                                                            </td>
                                                                        </tr>
                                                                        {group.services.map((svc, si) => (
                                                                            <tr key={`${gi}-s-${si}`} className="hover:bg-muted/30">
                                                                                <td className="p-4 pl-8 w-16">
                                                                                    {(svc.service?.image || svc.product?.image || (svc as any).product?.image) ? (
                                                                                        <img src={(svc.service?.image || svc.product?.image || (svc as any).product?.image) as string} alt={svc.item_name} className="w-10 h-10 rounded-lg object-cover border" />
                                                                                    ) : (
                                                                                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                                                                            <Wrench className="h-4 w-4 text-muted-foreground" />
                                                                                        </div>
                                                                                    )}
                                                                                </td>
                                                                                <td className="p-4 pl-8">
                                                                                    <Badge className={getItemTypeColor(svc.item_type)}>
                                                                                        {getItemTypeLabel(svc.item_type)}
                                                                                    </Badge>
                                                                                </td>
                                                                                <td className="p-4 pl-8 text-muted-foreground">{svc.item_name}</td>
                                                                                <td className="p-4 text-center">{svc.quantity}</td>
                                                                                <td className="p-4 text-right text-muted-foreground">{formatCurrency(svc.unit_price)}</td>
                                                                                <td className="p-4 text-right font-semibold">{formatCurrency(svc.total_price)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </React.Fragment>
                                                                );
                                                            }
                                                            const item = group.services[0];
                                                            return (
                                                                <tr key={gi} className="hover:bg-muted/30">
                                                                    <td className="p-4">
                                                                        {(item.product?.image || item.service?.image) ? (
                                                                            <img src={item.product?.image || item.service?.image as string} alt={item.item_name} className="w-12 h-12 rounded-lg object-cover border" />
                                                                        ) : (
                                                                            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                                                                {item.item_type === 'product' ? <ShoppingBag className="h-5 w-5 text-muted-foreground" /> :
                                                                                    item.item_type === 'service' ? <Wrench className="h-5 w-5 text-muted-foreground" /> :
                                                                                        item.item_type === 'package' ? <Gift className="h-5 w-5 text-muted-foreground" /> :
                                                                                            <CreditCard className="h-5 w-5 text-muted-foreground" />}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-4">
                                                                        <Badge className={getItemTypeColor(item.item_type)}>
                                                                            {getItemTypeLabel(item.item_type)}
                                                                        </Badge>
                                                                    </td>
                                                                    <td className="p-4 font-medium">{item.item_name}</td>
                                                                    <td className="p-4 text-center">{item.quantity}</td>
                                                                    <td className="p-4 text-right text-muted-foreground">{formatCurrency(item.unit_price)}</td>
                                                                    <td className="p-4 text-right font-semibold">{formatCurrency(item.total_price)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    );
                                })()}

                                {/* Notes */}
                                {order.notes && (
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-primary" />
                                                Ghi chú
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm bg-muted/50 p-4 rounded-lg">{order.notes}</p>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            {/* Right Column - Summary (1/3) */}
                            <div className="lg:col-span-1 space-y-4">
                                {/* Order Summary */}
                                <Card className="border-primary/20">
                                    <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-primary/10">
                                        <CardTitle className="text-base">Tổng đơn hàng</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 pt-4">
                                        <div className="flex justify-between text-sm">
                                            <span>Tạm tính:</span>
                                            <span className="font-medium">{formatCurrency(order.subtotal)}</span>
                                        </div>
                                        {order.discount > 0 && (
                                            <div className="flex justify-between text-sm text-red-600">
                                                <span className="flex items-center gap-1">
                                                    <Gift className="h-3.5 w-3.5" />
                                                    Giảm giá{order.discount_type === 'percent' && order.discount_value ? ` (${order.discount_value}%)` : ''}:
                                                </span>
                                                <span className="font-medium">-{formatCurrency(order.discount)}</span>
                                            </div>
                                        )}
                                        {/* Surcharges */}
                                        {order.surcharges && Array.isArray(order.surcharges) && order.surcharges.length > 0 && (
                                            <>
                                                {order.surcharges.map((surcharge: any, i: number) => (
                                                    <div key={i} className="flex justify-between text-sm text-orange-600">
                                                        <span className="flex items-center gap-1">
                                                            {surcharge.label}{surcharge.is_percent ? ` (${surcharge.value}%)` : ''}:
                                                        </span>
                                                        <span className="font-medium">+{formatCurrency(surcharge.amount || 0)}</span>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                        {(order.surcharges_amount ?? 0) > 0 && (
                                            <div className="flex justify-between text-sm text-orange-600 pt-1 border-t border-dashed">
                                                <span>Tổng phụ phí:</span>
                                                <span className="font-medium">+{formatCurrency(order.surcharges_amount ?? 0)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-xl font-bold pt-3 border-t">
                                            <span>Tổng:</span>
                                            <span className="text-primary">{formatCurrency(order.total_amount)}</span>
                                        </div>

                                        {/* Payment Info */}
                                        <div className="pt-3 border-t space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span>Đã thanh toán:</span>
                                                <span className={`font-medium ${(order.paid_amount || 0) >= order.total_amount ? 'text-green-600' : 'text-blue-600'}`}>
                                                    {formatCurrency(order.paid_amount || 0)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span>Còn nợ:</span>
                                                <span className={`font-medium ${(order.remaining_debt || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    {formatCurrency(order.remaining_debt || (order.total_amount - (order.paid_amount || 0)))}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span>Trạng thái TT:</span>
                                                <Badge
                                                    className={
                                                        order.payment_status === 'paid' ? 'bg-green-500' :
                                                            order.payment_status === 'partial' ? 'bg-yellow-500' :
                                                                'bg-red-500'
                                                    }
                                                >
                                                    {order.payment_status === 'paid' ? 'Đã thanh toán' :
                                                        order.payment_status === 'partial' ? 'Thanh toán một phần' :
                                                            'Chưa thanh toán'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Order Status */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-primary" />
                                            Trạng thái
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex items-center justify-center py-4">
                                            <Badge
                                                variant={getStatusVariant(order.status) as 'success' | 'danger' | 'warning' | 'info' | 'purple'}
                                                className="text-base px-4 py-2"
                                            >
                                                {columns.find(c => c.id === order.status)?.title}
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Order Details */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-primary" />
                                            Thông tin đơn hàng
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Ngày tạo</p>
                                            <p className="font-medium flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                {formatDateTime(order.created_at)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Hoàn thành</p>
                                            <p className="font-medium">
                                                {order.completed_at ? formatDateTime(order.completed_at) : 'Chưa hoàn thành'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Nhân viên phụ trách</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback className="text-xs">{order.sales_user?.name?.charAt(0) || 'N'}</AvatarFallback>
                                                </Avatar>
                                                <span className="font-medium">{order.sales_user?.name || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Quick Actions */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">Thao tác nhanh</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start"
                                            onClick={() => setShowPrintDialog(true)}
                                        >
                                            <Printer className="h-4 w-4 mr-2" />
                                            In phiếu QR
                                        </Button>
                                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                                            <Button
                                                variant="outline"
                                                className="w-full justify-start"
                                                onClick={() => setShowEditDialog(true)}
                                            >
                                                <Sparkles className="h-4 w-4 mr-2" />
                                                Chỉnh sửa đơn hàng
                                            </Button>
                                        )}
                                        {order.status === 'processing' && (
                                            <Button
                                                className="w-full justify-start bg-green-600 hover:bg-green-700"
                                                onClick={() => setShowPaymentDialog(true)}
                                            >
                                                <CreditCard className="h-4 w-4 mr-2" />
                                                Thanh toán ngay
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Sales Tab - Item Kanban Board (chỉ hiện khi đơn nháp) */}
                    {order?.status === 'pending' && (
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

                            {/* Kanban Board Layout – kéo thả + font lớn hơn */}
                            <div className="overflow-x-auto pb-4 -mx-1 px-1">
                                <DragDropContext
                                    onDragEnd={(result: DropResult) => {
                                        if (!result.destination || result.destination.droppableId === result.source.droppableId) return;
                                        const itemId = result.draggableId;
                                        const newStatus = result.destination.droppableId;
                                        const stepLabel = SALES_STEPS.find((s) => s.id === newStatus)?.label || newStatus;
                                        updateOrderItemStatus(itemId, newStatus);
                                        toast.success(`Đã chuyển sang: ${stepLabel}`);
                                        orderItemsApi.updateStatus(itemId, newStatus).then(() => { if (order?.id) fetchKanbanLogs(order.id); }).catch(() => {
                                            reloadOrder();
                                            toast.error('Lỗi khi cập nhật trạng thái');
                                        });
                                    }}
                                >
                                <div className="flex gap-4 min-w-[1200px]">
                                    {SALES_STEPS.map((column, colIdx) => {
                                        const columnItems = order.items?.filter(item => {
                                            const hasV2Products = order.items?.some(i => (i as any).is_v2_product);
                                            if (hasV2Products && !(item as any).is_v2_product) return false;
                                            const status = item.status || 'step1';
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
                                                            {columnItems.length}
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
                                                        {columnItems.map((item, itemIdx) => (
                                                            <Draggable key={item.id} draggableId={item.id} index={itemIdx}>
                                                                {(provided) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                className="bg-white p-3 rounded-lg border shadow-sm group hover:border-primary hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
                                                            >
                                                                <div className="flex items-start gap-2 mb-2">
                                                                    <div className="w-9 h-9 rounded bg-muted flex items-center justify-center shrink-0">
                                                                        {item.item_type === 'product' ? <ShoppingBag className="h-5 w-5 text-muted-foreground" /> :
                                                                            item.item_type === 'service' ? <Wrench className="h-5 w-5 text-muted-foreground" /> :
                                                                                <Gift className="h-5 w-5 text-muted-foreground" />}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="font-bold text-sm truncate leading-tight">{item.item_name}</p>
                                                                        <Badge className={cn("text-xs px-1.5 h-5 mt-1", getItemTypeColor(item.item_type))}>
                                                                            {getItemTypeLabel(item.item_type)}
                                                                        </Badge>
                                                                    </div>
                                                                </div>

                                                                {/* Task Controls – nút lùi/tiến + mã item */}
                                                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 rounded-full"
                                                                        disabled={colIdx === 0}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const prevStep = SALES_STEPS[colIdx - 1].id;
                                                                            updateOrderItemStatus(item.id, prevStep);
                                                                            toast.success(`Đã lùi về: ${SALES_STEPS[colIdx - 1].label}`);
                                                                            orderItemsApi.updateStatus(item.id, prevStep).then(() => { if (order?.id) fetchKanbanLogs(order.id); }).catch(() => {
                                                                                reloadOrder();
                                                                                toast.error('Lỗi khi cập nhật trạng thái');
                                                                            });
                                                                        }}
                                                                    >
                                                                        <ArrowLeft className="h-4 w-4" />
                                                                    </Button>
                                                                    <span className="text-xs font-bold text-muted-foreground">
                                                                        #{item.item_code?.slice(-4) || 'Item'}
                                                                    </span>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 rounded-full text-primary hover:bg-primary hover:text-white"
                                                                        disabled={colIdx === SALES_STEPS.length - 1}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const nextStep = SALES_STEPS[colIdx + 1].id;
                                                                            updateOrderItemStatus(item.id, nextStep);
                                                                            toast.success(`Đã chuyển sang: ${SALES_STEPS[colIdx + 1].label}`);
                                                                            orderItemsApi.updateStatus(item.id, nextStep).then(() => { if (order?.id) fetchKanbanLogs(order.id); }).catch(() => {
                                                                                reloadOrder();
                                                                                toast.error('Lỗi khi cập nhật trạng thái');
                                                                            });
                                                                        }}
                                                                    >
                                                                        <ArrowRight className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                                )}
                                                            </Draggable>
                                                        ))}
                                                        {columnItems.length === 0 && (
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
                                                    { id: 'ship', title: '1. Xin địa chỉ Ship', sub: '“Chào anh, đồ đã xong...”', content: `Chào ${order.customer?.name} ạ, giày ${order.items?.[0]?.item_name || 'của mình'} đã xong. Anh/chị cho shop xin địa chỉ ship nhé!` },
                                                    { id: 'care', title: '2. HD Bảo quản', sub: '“Shop gửi HDSD...”', content: `Shop gửi ${order.customer?.name} HDSD: Tránh nước, lau bằng khăn mềm định kỳ ạ.` },
                                                    { id: 'feedback', title: '3. Xin Feedback', sub: '“Bạn đã nhận được đồ chưa...”', content: `Dạ chào ${order.customer?.name}, mình nhận được đồ chưa ạ? Cho shop xin feedback nhé!` }
                                                ].map(tmp => (
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
                                            <Button variant="outline" className="w-full justify-start h-12 text-xs font-bold border-gray-200 hover:bg-purple-50 hover:text-purple-700">
                                                <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
                                                Đề xuất gói VIP (Upsell)
                                            </Button>
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
                                                        <span className="text-xs font-bold">{order.items?.filter(i => (i.status || 'step1') === 'step5').length || 0}/{order.items?.length || 0} hạng mục</span>
                                                        <span className="text-xs font-bold text-primary">
                                                            {Math.round(((order.items?.filter(i => (i.status || 'step1') === 'step5').length || 0) / (order.items?.length || 1)) * 100)}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                        <div
                                                            className="bg-primary h-1.5 rounded-full transition-all duration-500"
                                                            style={{ width: `${((order.items?.filter(i => (i.status || 'step1') === 'step5').length || 0) / (order.items?.length || 1)) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                                                    <p className="text-[10px] font-bold text-green-700 uppercase mb-1">Doanh thu dự kiến</p>
                                                    <p className="text-xl font-black text-green-700">{formatCurrency(order.total_amount)}</p>
                                                </div>

                                                {/* Chốt đơn button */}
                                                {(order.status === 'pending' || (order.status as string).startsWith('step')) && (
                                                    <Button
                                                        className="w-full h-12 font-bold shadow-lg shadow-green-200 bg-green-600 hover:bg-green-700"
                                                        disabled={!order.items?.every(i => (i.status || 'step1') === 'step5')}
                                                        onClick={async () => {
                                                            try {
                                                                await updateOrderStatus(order.id, 'confirmed');
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
                    )}

                    {/* Tiến trình / Quy trình - Kanban 3 phòng + Chi tiết bước */}
                    <TabsContent value="workflow">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Layers className="h-5 w-5 text-primary" />
                                    Tiến trình / Quy trình – 3 phòng
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Dịch vụ đi qua Phòng Mạ → Phòng Dán đế → Phòng Da. Xác nhận hoàn thành bước để chuyển sang phòng tiếp theo.
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
                                        {/* 3 cột cố định: Phòng Mạ, Phòng Dán đế, Phòng Da */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-x-auto">
                                            {TECH_ROOMS.map((room) => {
                                                const itemsInRoom = (order?.items || []).filter((item: OrderItem) => {
                                                    // Chỉ hiển thị dịch vụ (service / package), không hiển thị sản phẩm
                                                    if (item.item_type !== 'service' && item.item_type !== 'package') return false;
                                                    const roomId = getItemCurrentTechRoom(item.id);
                                                    return roomId === room.id;
                                                });
                                                return (
                                                    <div key={room.id} className="flex flex-col min-w-[280px]">
                                                        <div className="flex justify-between items-center mb-4 px-2">
                                                            <h2 className="font-bold uppercase text-xs tracking-widest text-blue-700">
                                                                {room.title}
                                                            </h2>
                                                            <span className="bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                                                                {itemsInRoom.length}
                                                            </span>
                                                        </div>
                                                        <div className="min-h-[200px] bg-gray-100 p-2 rounded-xl flex-1 border-2 border-dashed border-transparent transition-colors">
                                                            {itemsInRoom.map((item: OrderItem) => {
                                                                const slaLabel = getSLADisplay(order?.due_at);
                                                                const saleName = order?.sales_user?.name || 'N/A';
                                                                const techName = (item.technician as { name?: string })?.name || (item as any).technician?.name || 'N/A';
                                                                const itemLate = order?.due_at ? new Date(order.due_at) < new Date() : false;
                                                                const currentStep = getItemCurrentStep(item.id);
                                                                const canCompleteStep = currentStep && (currentStep.status === 'in_progress' || currentStep.status === 'assigned');
                                                                return (
                                                                    <div
                                                                        key={item.id}
                                                                        className={cn(
                                                                            "bg-white rounded-xl shadow-sm p-4 mb-3 border-l-4 transition-all",
                                                                            itemLate ? "border-red-500 bg-red-50/30" : "border-blue-400"
                                                                        )}
                                                                    >
                                                                        <div className="flex justify-between items-start mb-2">
                                                                            <span className="text-xs font-semibold text-gray-400">#{order?.order_code || item.id?.slice(0, 8)}</span>
                                                                        </div>
                                                                        <h3 className="font-bold text-gray-800 text-sm truncate">{item.item_name}</h3>
                                                                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                                                            <span>SLA: {slaLabel}</span>
                                                                        </div>
                                                                        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                                                                            <UserIcon className="h-4 w-4 shrink-0" />
                                                                            <span className="truncate">Sale: {saleName}</span>
                                                                        </div>
                                                                        <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                                                                            <Wrench className="h-4 w-4 shrink-0" />
                                                                            <span className="truncate">KT: {techName}</span>
                                                                        </div>
                                                                        {/* Bước hiện tại + Xác nhận hoàn thành bước */}
                                                                        {currentStep && (
                                                                            <div className="mt-2 pt-2 border-t border-gray-100">
                                                                                <p className="text-xs text-muted-foreground">Bước: {currentStep.step_name}</p>
                                                                                <p className="text-xs text-muted-foreground">{currentStep.status === 'in_progress' ? 'Đang thực hiện' : currentStep.status === 'assigned' ? 'Đã phân công' : currentStep.status}</p>
                                                                                {canCompleteStep && (
                                                                                    <Button
                                                                                        size="sm"
                                                                                        className="mt-1.5 h-8 text-xs bg-green-600 hover:bg-green-700"
                                                                                        disabled={stepCompleteLoading === currentStep.id}
                                                                                        onClick={() => handleCompleteStep(currentStep.id)}
                                                                                    >
                                                                                        {stepCompleteLoading === currentStep.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                                                                                        Xác nhận hoàn thành bước
                                                                                    </Button>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        {/* Yêu cầu: Mua phụ kiện, Gửi Đối Tác, Xin gia hạn — rõ ràng, dễ chú ý */}
                                                                        <div className="mt-3 pt-2 border-t border-gray-200">
                                                                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Yêu cầu</p>
                                                                            <div className="flex flex-wrap gap-2">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleOpenAccessory(item)}
                                                                                    className={cn(
                                                                                        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all shadow-sm',
                                                                                        (item as any).accessory?.status
                                                                                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                                                            : 'bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100'
                                                                                    )}
                                                                                >
                                                                                    <Package className="h-4 w-4 shrink-0" />
                                                                                    <span>{(item as any).accessory?.status ? ACCESSORY_LABELS[(item as any).accessory.status] ?? (item as any).accessory.status : 'Mua phụ kiện'}</span>
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleOpenPartner(item)}
                                                                                    className={cn(
                                                                                        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all shadow-sm',
                                                                                        (item as any).partner?.status
                                                                                            ? 'bg-amber-600 text-white hover:bg-amber-700'
                                                                                            : 'bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100'
                                                                                    )}
                                                                                >
                                                                                    <Truck className="h-4 w-4 shrink-0" />
                                                                                    <span>{(item as any).partner?.status ? PARTNER_LABELS[(item as any).partner.status] ?? (item as any).partner.status : 'Gửi Đối Tác'}</span>
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={handleOpenExtension}
                                                                                    className={cn(
                                                                                        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all shadow-sm',
                                                                                        order?.extension_request
                                                                                            ? 'bg-violet-600 text-white hover:bg-violet-700'
                                                                                            : 'bg-violet-50 text-violet-700 border border-violet-300 hover:bg-violet-100'
                                                                                    )}
                                                                                >
                                                                                    <CalendarClock className="h-4 w-4 shrink-0" />
                                                                                    <span>{order?.extension_request ? EXTENSION_LABELS[order.extension_request.status] ?? order.extension_request.status : 'Xin gia hạn'}</span>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {itemsInRoom.length === 0 && (
                                                                <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
                                                                    Không có dịch vụ
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {/* Summary progress */}
                                        {allWorkflowSteps.length > 0 && (
                                            <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium">Tiến độ quy trình</span>
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

                                        {/* Chi tiết các bước quy trình - dịch vụ & gói */}
                                        {(order.items?.some(item => item.item_type === 'service' || item.item_type === 'package') && allWorkflowSteps.length > 0) && (
                                            <div className="mt-6 border-t pt-6">
                                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                                    <ArrowRight className="h-5 w-5 text-primary" />
                                                    Chi tiết các bước quy trình
                                                </h3>
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    Các dịch vụ có quy trình hiển thị từng bước thực hiện. Có thể xác nhận hoàn thành bước tại đây.
                                                </p>
                                                <div className="space-y-4">
                                                    {order.items?.filter(item => item.item_type === 'service' || item.item_type === 'package').map((item, idx) => (
                                                        <div key={idx} className="border rounded-lg p-4 bg-gradient-to-r from-purple-50 to-blue-50">
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                                                    <Wrench className="h-5 w-5 text-purple-600" />
                                                                </div>
                                                                <div>
                                                                    <h4 className="font-semibold">{item.item_name}</h4>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        Trạng thái:
                                                                        <Badge className={`ml-2 ${getItemTypeColor(item.item_type)}`}>
                                                                            {item.status === 'completed' ? 'Hoàn thành' :
                                                                                item.status === 'in_progress' ? 'Đang thực hiện' : 'Chờ xử lý'}
                                                                        </Badge>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <WorkflowStepsTimeline itemId={item.id} onStepCompleted={() => { reloadOrder(); if (order?.id) fetchKanbanLogs(order.id); }} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Lịch sử chuyển bước Workflow (Quy trình) */}
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
                    </TabsContent>

                    {/* After sale – dựa theo WorkflowKanbanBoardPage (C. After-sale) */}
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
                                {(() => {
                                    const AFTER_COLS = [
                                        { id: 'after1', title: 'Kiểm nợ & Ảnh hoàn thiện', color: 'text-purple-700' },
                                        { id: 'after2', title: 'Đóng gói & Giao hàng', color: 'text-purple-700' },
                                        { id: 'after3', title: 'Nhắn HD & Feedback', color: 'text-purple-700' },
                                        { id: 'after4', title: 'Lưu Trữ', color: 'text-green-700' },
                                    ] as const;
                                    const currentStage = (order as Order & { after_sale_stage?: string | null })?.after_sale_stage ?? 'after1';

                                    const handleAfterSaleDragEnd = (result: DropResult) => {
                                        if (!order || !result.destination || result.destination.droppableId === result.source.droppableId) return;
                                        const newStage = result.destination.droppableId as string;
                                        updateOrderAfterSale({ after_sale_stage: newStage });
                                        toast.success('Đã chuyển bước After sale');
                                        ordersApi.updateAfterSaleStage(order.id, newStage).then(() => fetchKanbanLogs(order.id)).catch((e: any) => {
                                            reloadOrder();
                                            toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
                                        });
                                    };

                                    return (
                                <DragDropContext onDragEnd={handleAfterSaleDragEnd}>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto pb-4">
                                    {AFTER_COLS.map((col) => {
                                        const hasOrder = order && col.id === currentStage;
                                        return (
                                        <div key={col.id} className="flex flex-col min-w-[280px]">
                                            <div className="flex justify-between items-center mb-4 px-2">
                                                <h2 className={cn('font-bold uppercase text-xs sm:text-sm tracking-widest', col.color)}>{col.title}</h2>
                                                <span className="bg-gray-200 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                                                    {hasOrder ? 1 : 0}
                                                </span>
                                            </div>
                                            <Droppable droppableId={col.id}>
                                                {(provided) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.droppableProps}
                                                className="min-h-[200px] bg-gray-100 p-2 rounded-xl border-2 border-dashed border-transparent"
                                            >
                                                {hasOrder && order && (
                                                    <Draggable draggableId={order.id} index={0}>
                                                        {(provided) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={cn(
                                                            'bg-white rounded-xl shadow-sm p-4 mb-3 border-l-4 transition-all cursor-grab active:cursor-grabbing',
                                                            order.due_at && new Date(order.due_at) < new Date() ? 'border-red-500 bg-red-50/30' : 'border-purple-400'
                                                        )}
                                                    >
                                                        <div className="flex justify-between items-start mb-2">
                                                            <span className="text-xs font-black text-gray-300">#{order.order_code}</span>
                                                        </div>
                                                        <h3 className="font-bold text-gray-800 text-sm truncate">{order.customer?.name || 'Khách'}</h3>
                                                        <p className="text-xs text-gray-400 mt-1">
                                                            {order.items?.length ? (order.items[0] as OrderItem).item_name : 'Đơn hàng'}
                                                            {(order.items?.length ?? 0) > 1 && ` +${(order.items?.length ?? 0) - 1}`}
                                                        </p>
                                                        <div className="mt-4 flex justify-between items-center">
                                                            <Badge variant="secondary" className="text-xs font-bold text-purple-500 bg-purple-50 uppercase">
                                                                {order.sales_user?.name || 'Sale'}
                                                            </Badge>
                                                            <span className="text-xs font-bold text-gray-400">{getSLADisplay(order.due_at)}</span>
                                                        </div>
                                                        {col.id === 'after1' && (
                                                            <Button size="sm" variant="outline" className="mt-2 w-full h-9 text-sm" onClick={(e) => { e.stopPropagation(); setCompletionPhotos((order as any).completion_photos ?? []); setDebtChecked(!!(order as any).debt_checked); setDebtCheckedNotes((order as any).debt_checked_notes ?? ''); setAfter1JustSaved(false); setShowAfter1Dialog(true); }}>
                                                                <Camera className="h-4 w-4 mr-1.5" /> Kiểm nợ & Ảnh hoàn thiện
                                                            </Button>
                                                        )}
                                                        {col.id === 'after2' && (
                                                            <Button size="sm" variant="outline" className="mt-2 w-full h-9 text-sm" onClick={(e) => { e.stopPropagation(); setPackagingPhotos((order as any).packaging_photos ?? []); setDeliveryCarrier((order as any).delivery_carrier ?? ''); setDeliveryAddress((order as any).delivery_address ?? ''); setDeliverySelfPickup(!!(order as any).delivery_self_pickup); setDeliveryNotes((order as any).delivery_notes ?? ''); setAfter2JustSaved(false); setShowAfter2Dialog(true); }}>
                                                                <Upload className="h-4 w-4 mr-1.5" /> Đóng gói & Giao hàng
                                                            </Button>
                                                        )}
                                                    </div>
                                                        )}
                                                    </Draggable>
                                                )}
                                                {!hasOrder && (
                                                    <div className="flex items-center justify-center h-20 text-muted-foreground text-base">
                                                        —
                                                    </div>
                                                )}
                                                {provided.placeholder}
                                            </div>
                                                )}
                                            </Droppable>
                                        </div>
                                        );
                                    })}
                                </div>
                                </DragDropContext>
                                    );
                                })()}
                                {/* Nhắn HD & Feedback – checkboxes khi đơn ở after3 */}
                                {order && ((order as Order & { after_sale_stage?: string | null; hd_sent?: boolean; feedback_requested?: boolean }).after_sale_stage ?? 'after1') === 'after3' && (
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
                                                    const payload = { after_sale_stage: 'after4' as const, care_warranty_flow: 'care' as const, care_warranty_stage: 'care6' as const };
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
                                                    const payload = { after_sale_stage: 'after4' as const, care_warranty_flow: 'warranty' as const, care_warranty_stage: 'war1' as const };
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
                                {/* Tin nhắn mẫu – dựa theo WorkflowKanbanBoardPage modal */}
                                {order && (
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
                                )}
                                {/* Lịch sử chuyển giai đoạn After sale */}
                                {order && (
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
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Chăm sóc / Bảo hành – đơn hiện tại, kéo thả chuyển bước */}
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
                                {(() => {
                                    const CARE_WAR_COLS = [
                                        { id: 'war1' as const, title: '1. Tiếp nhận', color: 'border-red-200 bg-red-50/30', flow: 'warranty' as const },
                                        { id: 'war2' as const, title: '2. Xử lý', color: 'border-red-200 bg-red-50/30', flow: 'warranty' as const },
                                        { id: 'war3' as const, title: '3. Hoàn tất', color: 'border-green-200 bg-green-50/30', flow: 'warranty' as const },
                                        { id: 'care6' as const, title: 'Mốc 6 Tháng', color: 'border-teal-200 bg-teal-50/30', flow: 'care' as const },
                                        { id: 'care12' as const, title: 'Mốc 12 Tháng', color: 'border-teal-200 bg-teal-50/30', flow: 'care' as const },
                                        { id: 'care-custom' as const, title: 'Lịch Riêng', color: 'border-teal-200 bg-teal-50/30', flow: 'care' as const },
                                    ];
                                    const currentFlow = (order as Order & { care_warranty_flow?: string | null })?.care_warranty_flow ?? null;
                                    const currentStage = (order as Order & { care_warranty_stage?: string | null })?.care_warranty_stage ?? null;
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
                                        <>
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
                                        </>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Print QR Dialog */}
            <PrintQRDialog
                order={order}
                open={showPrintDialog}
                onClose={() => setShowPrintDialog(false)}
            />

            {/* Edit Order Dialog */}
            <EditOrderDialog
                order={showEditDialog ? order : null}
                open={showEditDialog}
                onClose={() => setShowEditDialog(false)}
                onSubmit={handleUpdateOrder}
                products={products}
                services={services}
                packages={packages}
                vouchers={vouchers}
            />

            {/* Payment Dialog */}
            <PaymentDialog
                order={showPaymentDialog ? order : null}
                open={showPaymentDialog}
                onClose={() => setShowPaymentDialog(false)}
                onSuccess={handlePaymentSuccess}
            />

            {/* Assign Technician Dialog */}
            <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-primary" />
                            Phân công kỹ thuật viên
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedItem && (
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="font-medium">{selectedItem.item_name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {getItemTypeLabel(selectedItem.item_type)} • SL: {selectedItem.quantity}
                                </p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="technician">Chọn kỹ thuật viên</Label>
                            <Select value={selectedTechnicianId} onValueChange={setSelectedTechnicianId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn kỹ thuật viên..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {technicians.length === 0 ? (
                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                            Không có kỹ thuật viên
                                        </div>
                                    ) : (
                                        technicians.map(tech => (
                                            <SelectItem key={tech.id} value={tech.id}>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarFallback className="text-xs">{tech.name?.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    {tech.name}
                                                </div>
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                            Hủy
                        </Button>
                        <Button
                            onClick={handleAssignTechnician}
                            disabled={!selectedTechnicianId || assignLoading}
                        >
                            {assignLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Phân công
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Mua phụ kiện Dialog */}
            <Dialog open={showAccessoryDialog} onOpenChange={setShowAccessoryDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Mua phụ kiện</DialogTitle>
                    </DialogHeader>
                    {accessoryItem && (
                        <div className="space-y-4">
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="font-medium text-sm">{accessoryItem.item_name}</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Trạng thái</Label>
                                <Select value={accessoryStatus} onValueChange={setAccessoryStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
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
                                <Label>Ghi chú (tùy chọn)</Label>
                                <Textarea value={accessoryNotes} onChange={(e) => setAccessoryNotes(e.target.value)} placeholder="Ghi chú..." className="min-h-[80px]" />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowAccessoryDialog(false)}>Hủy</Button>
                                <Button onClick={handleSubmitAccessory} disabled={accessoryLoading}>
                                    {accessoryLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Cập nhật
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Gửi Đối Tác Dialog */}
            <Dialog open={showPartnerDialog} onOpenChange={setShowPartnerDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Gửi Đối Tác</DialogTitle>
                    </DialogHeader>
                    {partnerItem && (
                        <div className="space-y-4">
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="font-medium text-sm">{partnerItem.item_name}</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Trạng thái</Label>
                                <Select value={partnerStatus} onValueChange={setPartnerStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ship_to_partner">Ship đối tác</SelectItem>
                                        <SelectItem value="partner_doing">Đối tác làm</SelectItem>
                                        <SelectItem value="ship_back">Ship về Shop</SelectItem>
                                        <SelectItem value="done">Done</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Ghi chú (tùy chọn)</Label>
                                <Textarea value={partnerNotes} onChange={(e) => setPartnerNotes(e.target.value)} placeholder="Ghi chú..." className="min-h-[80px]" />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowPartnerDialog(false)}>Hủy</Button>
                                <Button onClick={handleSubmitPartner} disabled={partnerLoading}>
                                    {partnerLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Cập nhật
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Xin gia hạn Dialog */}
            <Dialog open={showExtensionDialog} onOpenChange={setShowExtensionDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Xin gia hạn</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {order?.extension_request && (
                            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                                <p className="font-medium">Trạng thái: {order.extension_request.status}</p>
                                {order.extension_request.reason && <p className="text-muted-foreground">Lý do: {order.extension_request.reason}</p>}
                                {order.extension_request.customer_result && <p className="text-muted-foreground">Kết quả liên hệ: {order.extension_request.customer_result}</p>}
                            </div>
                        )}
                        {!order?.extension_request ? (
                            <div className="space-y-2">
                                <Label>Lý do gia hạn (Kỹ thuật yêu cầu)</Label>
                                <Textarea value={extensionReason} onChange={(e) => setExtensionReason(e.target.value)} placeholder="Nhập lý do..." className="min-h-[100px]" />
                            </div>
                        ) : (
                            <>
                                {(user?.role === 'sale' || user?.role === 'manager' || user?.role === 'admin') && (
                                    <div className="space-y-2">
                                        <Label>Kết quả liên hệ khách (Sale gọi/nhắn)</Label>
                                        <Textarea value={extensionCustomerResult} onChange={(e) => setExtensionCustomerResult(e.target.value)} placeholder="Cập nhật kết quả sau khi gọi/nhắn khách..." className="min-h-[80px]" />
                                    </div>
                                )}
                                {(user?.role === 'manager' || user?.role === 'admin') && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Ngày gia hạn mới (Quản lý chốt)</Label>
                                            <input type="datetime-local" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={extensionNewDueAt} onChange={(e) => setExtensionNewDueAt(e.target.value)} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" id="valid_reason" checked={extensionValidReason} onChange={(e) => setExtensionValidReason(e.target.checked)} />
                                            <Label htmlFor="valid_reason">Lý do hợp lệ (không ghi trễ KPI)</Label>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                        {order?.extension_request && (
                            <Button variant="outline" className="w-full" onClick={handleNotifyTelegram}>
                                Gửi thông báo Telegram (Sale + Quản lý / Sale + Kỹ thuật)
                            </Button>
                        )}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowExtensionDialog(false)}>Hủy</Button>
                            <Button onClick={handleSubmitExtension} disabled={extensionLoading || (!order?.extension_request && !extensionReason.trim())}>
                                {extensionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {order?.extension_request ? 'Cập nhật' : 'Gửi yêu cầu'}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* After sale – Kiểm nợ & Ảnh hoàn thiện (after1) */}
            <Dialog open={showAfter1Dialog} onOpenChange={(open) => { setShowAfter1Dialog(open); if (!open) setAfter1JustSaved(false); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Camera className="h-5 w-5 text-primary" />
                            Kiểm nợ & Ảnh hoàn thiện
                        </DialogTitle>
                    </DialogHeader>
                    {order && (
                        <div className="space-y-4">
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Công nợ đơn hàng</p>
                                <p className="font-medium">Tổng đơn: {formatCurrency(order.total_amount)}</p>
                                <p className="text-sm">Đã thu: {formatCurrency(order.paid_amount ?? 0)}</p>
                                <p className={cn('text-sm font-semibold', (order.remaining_debt ?? 0) > 0 ? 'text-amber-600' : 'text-green-600')}>
                                    Còn nợ: {formatCurrency(order.remaining_debt ?? Math.max(0, order.total_amount - (order.paid_amount ?? 0)))}
                                </p>
                            </div>
                            <div>
                                <Label>Ảnh hoàn thiện</Label>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    {completionPhotos.map((url, i) => (
                                        <div key={i} className="relative">
                                            <img src={url} alt="" className="h-20 w-20 rounded border object-cover" />
                                            <button type="button" className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center" onClick={() => setCompletionPhotos(prev => prev.filter((_, j) => j !== i))}>
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                    <label className={cn('h-20 w-20 rounded border-2 border-dashed flex items-center justify-center cursor-pointer', after1Uploading ? 'opacity-50' : 'hover:bg-muted')}>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            multiple
                                            disabled={after1Uploading}
                                            onChange={async (e) => {
                                                const files = e.target.files;
                                                if (!files?.length || !order) return;
                                                setAfter1Uploading(true);
                                                for (let i = 0; i < files.length; i++) {
                                                    const { url: u, error } = await uploadFile('payment-proofs', `orders/${order.id}/completion`, files[i]);
                                                    if (u) setCompletionPhotos(prev => [...prev, u]);
                                                    if (error) toast.error('Lỗi tải ảnh: ' + (error as Error).message);
                                                }
                                                setAfter1Uploading(false);
                                                e.target.value = '';
                                            }}
                                        />
                                        {after1Uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6 text-muted-foreground" />}
                                    </label>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="debt_checked" checked={debtChecked} onChange={(e) => setDebtChecked(e.target.checked)} className="rounded h-4 w-4" />
                                <Label htmlFor="debt_checked">Đã kiểm tra công nợ (đơn hết nợ / còn nợ)</Label>
                            </div>
                            <div>
                                <Label>Ghi chú kiểm nợ (tùy chọn)</Label>
                                <Textarea value={debtCheckedNotes} onChange={(e) => setDebtCheckedNotes(e.target.value)} placeholder="Ghi chú..." className="mt-1 min-h-[60px]" />
                            </div>
                            {after1JustSaved && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex flex-col gap-2">
                                    <p className="text-sm font-medium text-green-800">Đã lưu thành công. Chuyển sang bước tiếp theo?</p>
                                    <Button
                                        className="w-full bg-green-600 hover:bg-green-700"
                                        onClick={() => {
                                            updateOrderAfterSale({ after_sale_stage: 'after2' });
                                            setShowAfter1Dialog(false);
                                            setAfter1JustSaved(false);
                                            toast.success('Đã chuyển sang Đóng gói & Giao hàng');
                                            ordersApi.updateAfterSaleStage(order.id, 'after2').then(() => fetchKanbanLogs(order.id)).catch((e: any) => {
                                                reloadOrder();
                                                toast.error(e?.response?.data?.message || 'Lỗi chuyển bước');
                                            });
                                        }}
                                    >
                                        <ArrowRight className="h-4 w-4 mr-2" /> Chuyển sang Đóng gói & Giao hàng
                                    </Button>
                                </div>
                            )}
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowAfter1Dialog(false)}>{after1JustSaved ? 'Đóng' : 'Hủy'}</Button>
                                {!after1JustSaved && (
                                    <Button
                                        disabled={after1Saving || completionPhotos.length === 0 || !debtChecked}
                                        onClick={() => {
                                            setAfter1Saving(true);
                                            const payload = { completion_photos: completionPhotos, debt_checked: debtChecked, debt_checked_notes: debtCheckedNotes || undefined };
                                            updateOrderAfterSale(payload);
                                            setAfter1JustSaved(true);
                                            toast.success('Đã lưu Kiểm nợ & Ảnh hoàn thiện');
                                            ordersApi.patch(order.id, payload).catch((e: any) => {
                                                reloadOrder();
                                                toast.error(e?.response?.data?.message || 'Lỗi lưu');
                                            }).finally(() => setAfter1Saving(false));
                                        }}
                                    >
                                        {after1Saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        Lưu
                                    </Button>
                                )}
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* After sale – Đóng gói & Giao hàng (after2) */}
            <Dialog open={showAfter2Dialog} onOpenChange={(open) => { setShowAfter2Dialog(open); if (!open) setAfter2JustSaved(false); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5 text-primary" />
                            Đóng gói & Giao hàng
                        </DialogTitle>
                    </DialogHeader>
                    {order && (
                        <div className="space-y-4">
                            <div>
                                <Label>Ảnh đóng gói</Label>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    {packagingPhotos.map((url, i) => (
                                        <div key={i} className="relative">
                                            <img src={url} alt="" className="h-20 w-20 rounded border object-cover" />
                                            <button type="button" className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center" onClick={() => setPackagingPhotos(prev => prev.filter((_, j) => j !== i))}>
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                    <label className={cn('h-20 w-20 rounded border-2 border-dashed flex items-center justify-center cursor-pointer', after2Uploading ? 'opacity-50' : 'hover:bg-muted')}>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            multiple
                                            disabled={after2Uploading}
                                            onChange={async (e) => {
                                                const files = e.target.files;
                                                if (!files?.length || !order) return;
                                                setAfter2Uploading(true);
                                                for (let i = 0; i < files.length; i++) {
                                                    const { url: u, error } = await uploadFile('payment-proofs', `orders/${order.id}/packaging`, files[i]);
                                                    if (u) setPackagingPhotos(prev => [...prev, u]);
                                                    if (error) toast.error('Lỗi tải ảnh: ' + (error as Error).message);
                                                }
                                                setAfter2Uploading(false);
                                                e.target.value = '';
                                            }}
                                        />
                                        {after2Uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                                    </label>
                                </div>
                            </div>
                            <div>
                                <Label>Đơn vị giao hàng</Label>
                                <Input value={deliveryCarrier} onChange={(e) => setDeliveryCarrier(e.target.value)} placeholder="VD: GHTK, Viettel Post, Grab..." className="mt-1" />
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="delivery_self_pickup" checked={deliverySelfPickup} onChange={(e) => setDeliverySelfPickup(e.target.checked)} className="rounded h-4 w-4" />
                                <Label htmlFor="delivery_self_pickup">Khách tự đến lấy</Label>
                            </div>
                            {!deliverySelfPickup && (
                                <div>
                                    <Label>Địa chỉ giao hàng (khách nhận)</Label>
                                    <Textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Địa chỉ đầy đủ..." className="mt-1 min-h-[80px]" />
                                </div>
                            )}
                            <div>
                                <Label>Ghi chú giao hàng (tùy chọn)</Label>
                                <Textarea value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="Ghi chú..." className="mt-1 min-h-[60px]" />
                            </div>
                            {after2JustSaved && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex flex-col gap-2">
                                    <p className="text-sm font-medium text-green-800">Đã lưu thành công. Chuyển sang bước tiếp theo?</p>
                                    <Button
                                        className="w-full bg-green-600 hover:bg-green-700"
                                        onClick={() => {
                                            updateOrderAfterSale({ after_sale_stage: 'after3' });
                                            setShowAfter2Dialog(false);
                                            setAfter2JustSaved(false);
                                            toast.success('Đã chuyển sang Nhắn HD & Feedback');
                                            ordersApi.updateAfterSaleStage(order.id, 'after3').then(() => fetchKanbanLogs(order.id)).catch((e: any) => {
                                                reloadOrder();
                                                toast.error(e?.response?.data?.message || 'Lỗi chuyển bước');
                                            });
                                        }}
                                    >
                                        <ArrowRight className="h-4 w-4 mr-2" /> Chuyển sang Nhắn HD & Feedback
                                    </Button>
                                </div>
                            )}
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowAfter2Dialog(false)}>{after2JustSaved ? 'Đóng' : 'Hủy'}</Button>
                                {!after2JustSaved && (
                                    <Button
                                        disabled={after2Saving || packagingPhotos.length === 0 || (!deliverySelfPickup && !deliveryCarrier.trim())}
                                        onClick={() => {
                                            setAfter2Saving(true);
                                            const payload = {
                                                packaging_photos: packagingPhotos,
                                                delivery_carrier: deliveryCarrier || undefined,
                                                delivery_address: deliverySelfPickup ? undefined : (deliveryAddress || undefined),
                                                delivery_self_pickup: deliverySelfPickup,
                                                delivery_notes: deliveryNotes || undefined,
                                            };
                                            updateOrderAfterSale(payload);
                                            setAfter2JustSaved(true);
                                            toast.success('Đã lưu Đóng gói & Giao hàng');
                                            ordersApi.patch(order.id, payload).catch((e: any) => {
                                                reloadOrder();
                                                toast.error(e?.response?.data?.message || 'Lỗi lưu');
                                            }).finally(() => setAfter2Saving(false));
                                        }}
                                    >
                                        {after2Saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        Lưu
                                    </Button>
                                )}
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Payment Record Dialog */}
            {order && (
                <PaymentRecordDialog
                    open={showPaymentRecordDialog}
                    onOpenChange={setShowPaymentRecordDialog}
                    orderId={order.id}
                    orderCode={order.order_code}
                    remainingDebt={order.remaining_debt ?? (order.total_amount - (order.paid_amount || 0))}
                    onSuccess={reloadOrder}
                />
            )}
        </>
    );
}
