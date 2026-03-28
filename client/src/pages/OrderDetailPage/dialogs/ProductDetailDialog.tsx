import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    ShoppingBag, Tag, FileText, Package, Truck, Wrench, Camera,
    User as UserIcon, CheckCircle2, MessageSquare, BookOpen,
    History, Save, Loader2, Heart, ShieldCheck, ClipboardList, Sparkles,
    ThumbsUp, ThumbsDown, Calendar, XCircle, Maximize2
} from 'lucide-react';
import { WorkflowLogDetailDialog } from '@/components/orders/workflow/WorkflowLogDetailDialog';
import { UpsellDialog } from '@/components/orders/UpsellDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductChat } from '@/components/orders/workflow/ProductChat';
import type { Order, OrderItem } from '@/hooks/useOrders';
import { cn, formatCurrency, formatDateTime, formatDate } from '@/lib/utils';
import { SALES_STATUS_LABELS, getCareWarrantyStageLabel } from '../constants';
import { orderItemsApi } from '@/lib/api';
import { toast } from 'sonner';
import { ImageUpload } from '@/components/products/ImageUpload';
import { useUsers } from '@/hooks/useUsers';
import { uploadFile } from '@/lib/supabase';


interface ProductDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    group: { product: OrderItem | null; services: OrderItem[] } | null;
    roomId: string;
    currentUserId?: string;
    order?: Order | null;
    onUpdateOrder?: (patch: Partial<Order>) => Promise<void>;
    onUpdateItemAfterSaleData?: (itemId: string, isCustomerItem: boolean, data: any) => Promise<void>;
    onReloadOrder?: () => void;
    setActiveTab?: (tab: string) => void;
    highlightMessageId?: string;
    salesLogs?: any[];
    workflowLogs?: any[];
    aftersaleLogs?: any[];
    careLogs?: any[];
}

export function MultiMediaUpload({ value, onChange, disabled, bucket = 'orders', folder = 'step1' }: { value: string[]; onChange: (urls: string[]) => void; disabled?: boolean; bucket?: string; folder?: string }) {
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        try {
            const uploadedUrls: string[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const { url, error } = await uploadFile(bucket, folder, file);
                if (error) throw error;
                if (url) uploadedUrls.push(url);
            }
            onChange([...value, ...uploadedUrls]);
            toast.success('Đã tải lên thành công');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Lỗi upload file');
        } finally {
            setUploading(false);
        }
    };

    const removeFile = (index: number) => {
        const newValue = [...value];
        newValue.splice(index, 1);
        onChange(newValue);
    };

    return (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mt-2">
            {value?.map((url, i) => {
                const isVideo = url.match(/\.(mp4|webm|ogg|mov|m4v)$|^data:video/i) || url.includes('/video/');
                return (
                    <div 
                        key={i} 
                        className="group relative aspect-square rounded-xl overflow-hidden border bg-white shadow-sm ring-1 ring-gray-100 cursor-zoom-in group"
                        onClick={() => setPreviewUrl(url)}
                    >
                        {isVideo ? (
                            <video src={url} className="w-full h-full object-cover" />
                        ) : (
                            <img src={url} alt="" className="w-full h-full object-cover" />
                        )}
                        
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                        </div>

                        {!disabled && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); removeFile(i); }} 
                                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                                <XCircle className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {isVideo && (
                            <div className="absolute bottom-1 left-1 bg-black/40 px-1 rounded text-[8px] text-white font-bold uppercase">Video</div>
                        )}
                    </div>
                );
            })}
            {!disabled && (
                <label className={cn(
                    "aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm",
                    uploading ? "opacity-50 pointer-events-none" : ""
                )}>
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <Camera className="w-6 h-6 text-slate-300" />}
                    <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Tải lên</span>
                    <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
                </label>
            )}

            <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
                    <DialogTitle className="sr-only">Xem phương tiện</DialogTitle>
                    {previewUrl && (
                        previewUrl.match(/\.(mp4|webm|ogg|mov|m4v)$|^data:video/i) || previewUrl.includes('/video/') ? (
                            <video src={previewUrl} controls autoPlay className="max-w-full max-h-[90vh] rounded-lg shadow-2xl bg-black" />
                        ) : (
                            <img src={previewUrl} alt="" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl bg-white" />
                        )
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export function ProductDetailDialog({
    open,
    onOpenChange,
    group,
    roomId,
    currentUserId,
    order,
    onUpdateOrder,
    onUpdateItemAfterSaleData,
    onReloadOrder,
    setActiveTab,
    highlightMessageId,
    salesLogs = [],
    workflowLogs = [],
    aftersaleLogs = [],
    careLogs = [],
}: ProductDetailDialogProps) {
    const [activeImageIdx, setActiveImageIdx] = useState(0);
    const [saving, setSaving] = useState(false);
    const [showUpsellDialog, setShowUpsellDialog] = useState(false);
    const { users, fetchUsers } = useUsers();

    useEffect(() => {
        if (open) {
            fetchUsers();
            // Reset scroll position to top when dialog opens or room changes
            const viewport = document.querySelector('.product-detail-scroll-area [data-radix-scroll-area-viewport]');
            if (viewport) viewport.scrollTop = 0;
        }
    }, [open, fetchUsers, roomId]);

    // Local form state
    const [formData, setFormData] = useState<Partial<Order>>({});
    const [dueAt, setDueAt] = useState<string>('');
    const [selectedLogDetail, setSelectedLogDetail] = useState<any>(null);
    const [showLogDetailDialog, setShowLogDetailDialog] = useState(false);
    const [mainPreviewUrl, setMainPreviewUrl] = useState<string | null>(null);

    // Initialize form data when the dialog is opened or order ID changes
    useEffect(() => {
        if (open && order) {
            const parsePhotos = (photos: any) => {
                if (Array.isArray(photos)) return photos;
                if (typeof photos === 'string' && photos.startsWith('[')) {
                    try { return JSON.parse(photos); } catch { return []; }
                }
                return [];
            };

            const item = group?.product || group?.services?.[0];
            const itemCompPhotos = parsePhotos((item as any)?.completion_photos);
            const itemPackPhotos = parsePhotos((item as any)?.packaging_photos);

            setFormData({
                debt_checked: order.debt_checked || false,
                debt_checked_notes: order.debt_checked_notes || '',
                debt_checked_by_name: order.debt_checked_by_name || '',
                aftersale_receiver_name: order.aftersale_receiver_name || '',
                delivery_type: (item as any)?.delivery_type || order.delivery_type || 'ship',
                delivery_carrier: (item as any)?.delivery_carrier || order.delivery_carrier || '',
                delivery_code: (item as any)?.delivery_code || order.delivery_code || '',
                delivery_fee: order.delivery_fee || 0,
                aftersale_return_user_name: order.aftersale_return_user_name || '',
                delivery_address: order.delivery_address || '',
                delivery_notes: order.delivery_notes || '',
                delivery_creator_name: order.delivery_creator_name || '',
                delivery_shipper_phone: order.delivery_shipper_phone || '',
                delivery_staff_name: order.delivery_staff_name || '',
                delivery_received_at: order.delivery_received_at ? new Date(order.delivery_received_at).toISOString().slice(0, 16) : '',
                hd_sent: order.hd_sent || false,
                feedback_requested: order.feedback_requested || false,
                notes: order.notes || '',
                // Strict separation: Only use item-specific photos
                completion_photos: itemCompPhotos,
                packaging_photos: itemPackPhotos,
                sales_step_data: (item as any)?.sales_step_data || {},
                delivery_payment_method: (item as any)?.delivery_payment_method || order.delivery_payment_method || 'cash',
            });
            
            setActiveImageIdx(0);
        }
    }, [open, order?.id, group?.product?.id, group?.services?.[0]?.id]); // Only re-init when dialog opens or identity changes

    useEffect(() => {
        if (open) {
            const item = (group?.product || group?.services?.[0]) as any;
            const existingPickupAt = item?.sales_step_data?.pickup_appointment_at;
            const existingDueAt = item?.due_at;
            
            const initialDate = existingDueAt || existingPickupAt;
            setDueAt(initialDate ? new Date(initialDate).toISOString().slice(0, 16) : '');
        }
    }, [open, group?.product?.id, group?.services?.[0]?.id]);

    const product = group?.product;
    const services = group?.services || [];
    const productName = product?.item_name ?? services[0]?.item_name ?? '—';
    const productItem = product as any;

    const entityId = product?.id ?? services[0]?.id;
    const entityType = product ? 'order_product' : 'order_item';
    const isAftersale = roomId.startsWith('after');
    const isCareFlow = roomId.startsWith('care') || roomId.startsWith('war');
    const isSalesStep = roomId.startsWith('step');

    // Build image lists
    const originalImages = [...(productItem?.product_images ?? (productItem?.product?.image ? [productItem.product.image] : []))];
    let completionImages: string[] = [];
    let packagingImages: string[] = [];

    if (isAftersale || isCareFlow) {
        const item = product || services[0];
        const parsePhotos = (photos: any) => {
            if (Array.isArray(photos)) return photos;
            if (typeof photos === 'string' && photos.startsWith('[')) {
                try { return JSON.parse(photos); } catch { return []; }
            }
            return [];
        };

        const itemCompPhotos = parsePhotos((item as any)?.completion_photos);
        const itemPackPhotos = parsePhotos((item as any)?.packaging_photos);

        completionImages = (formData.completion_photos?.length ? formData.completion_photos : itemCompPhotos) as string[];
        packagingImages = (formData.packaging_photos?.length ? formData.packaging_photos : itemPackPhotos) as string[];
    }

    // Total ordered list for big preview navigation
    const allImages = [...originalImages];
    [...completionImages, ...packagingImages].forEach(img => {
        if (img && typeof img === 'string' && !allImages.includes(img)) {
            allImages.push(img);
        }
    });

    // Sales step data state
    const [stepData, setStepData] = useState<Record<string, any>>({});
    const [savingStepData, setSavingStepData] = useState(false);

    // Load sales_step_data from item when opening or when data updates
    useEffect(() => {
        if (open && isSalesStep) {
            // Try to get existing sales_step_data from the item
            const item = product || services[0];
            const existing = (item as any)?.sales_step_data || {};
            setStepData(existing);
        }
    }, [open, roomId, isSalesStep, product?.id, services?.[0]?.id]); // Only re-init when dialog opens or identity changes

    const handleSaveStepData = async () => {
        const itemId = product?.id || services[0]?.id;
        if (!itemId) return;

        // Validation for step1
        if (roomId === 'step1') {
            if (!stepData.step1_receiver_name) {
                toast.error('Vui lòng chọn nhân viên Sale nhận');
                return;
            }
            if (!stepData.step1_evidence_photos || stepData.step1_evidence_photos.length === 0) {
                toast.error('Vui lòng tải ảnh/video làm bằng chứng trước khi kỹ thuật làm');
                return;
            }
        }

        // Validation for step2
        if (roomId === 'step2') {
            if (!stepData.step2_tags_photos || stepData.step2_tags_photos.length === 0) {
                toast.error('Vui lòng tải ảnh chứng minh đã gắn tags');
                return;
            }
            if (!stepData.step2_form_photos || stepData.step2_form_photos.length === 0) {
                toast.error('Vui lòng tải ảnh đã gắn Form túi hoặc shoestree');
                return;
            }
        }

        setSavingStepData(true);
        try {
            await orderItemsApi.updateSalesStepData(itemId, stepData);
            toast.success('Đã lưu thông tin thành công');
            if (onReloadOrder) onReloadOrder();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Lỗi khi lưu thông tin');
        } finally {
            setSavingStepData(false);
        }
    };

    // Removed handleSavePickupDate - Logic unified in the Due Date block onClick handler

    const handleSave = async () => {
        // Validation: If debt_checked is true, require names and at least one image in completion_photos (in Aftersale steps)
        if (isAftersale && roomId.startsWith('after1')) {
            if (formData.debt_checked) {
                if (!formData.debt_checked_by_name || !formData.aftersale_receiver_name) {
                    toast.error("Vui lòng chọn Người thu tiền và Người chụp After");
                    return;
                }
                const hasPhotos = formData.completion_photos && formData.completion_photos.length > 0;
                if (!hasPhotos) {
                    toast.error("Vui lòng upload ảnh hoàn thiện/kiểm nợ làm bằng chứng");
                    return;
                }
            }
        }

        setSaving(true);
        try {
            if ((isAftersale || isCareFlow) && onUpdateItemAfterSaleData) {
                const itemId = product?.id || services[0]?.id;
                if (itemId) {
                    await onUpdateItemAfterSaleData(itemId, !!product, {
                        completion_photos: formData.completion_photos,
                        packaging_photos: formData.packaging_photos,
                        shipping_photos: formData.packaging_photos, // mapping alias if needed
                        delivery_carrier: formData.delivery_carrier,
                        delivery_code: formData.delivery_code,
                        delivery_type: formData.delivery_type,
                        delivery_creator_name: formData.delivery_creator_name,
                        delivery_shipper_phone: formData.delivery_shipper_phone,
                        delivery_staff_name: formData.delivery_staff_name,
                        delivery_received_at: formData.delivery_received_at,
                    });
                }
            }

            // Also update the general order data (debt, receiver, etc)
            // But exclude photos from order-level update to keep them strictly at item-level
            if (onUpdateOrder) {
                const { completion_photos, packaging_photos, ...orderData } = formData;
                await onUpdateOrder(orderData);
            }

            toast.success('Đã cập nhật thông tin thành công');
            if (onReloadOrder) onReloadOrder();
            
            // Nếu có phí ship và đang ở các bước liên quan đến giao hàng thì tạo phiếu thu
            if (formData.delivery_fee && formData.delivery_fee > 0 && order && (roomId.startsWith('after2') || roomId.startsWith('after4'))) {
                const { transactionsApi } = await import('@/lib/api');
                try {
                    await transactionsApi.create({
                        type: 'income',
                        category: 'Phí giao hàng',
                        amount: formData.delivery_fee,
                        notes: `Phí ship giao đồ cho đơn ${order.order_code || order.id}`,
                        order_id: order.id,
                        order_code: order.order_code,
                        date: new Date().toISOString().split('T')[0],
                        payment_method: (formData as any).delivery_payment_method || 'cash'
                    });
                    toast.success('Đã tạo phiếu thu cho phí ship');
                } catch (error) {
                    console.error('Lỗi tạo phiếu thu ship:', error);
                }
            }
        } catch (error: any) {
            toast.error(error?.message || 'Lỗi khi cập nhật thông tin');
        } finally {
            setSaving(false);
        }
    };

    const handleFeedbackAction = async (isPositive: boolean) => {
        if (!entityId || !onUpdateItemAfterSaleData) return;

        try {
            setSaving(true);

            // 1. Both move the item to 'after4' (Lưu trữ) stage AND set item-level care/warranty flow
            await onUpdateItemAfterSaleData(entityId, !!product, {
                stage: 'after4',
                care_warranty_flow: isPositive ? 'care' : 'warranty',
                care_warranty_stage: isPositive ? 'care6' : 'war1'
            });

            if (isPositive) {
                toast.success('Đã ghi nhận Feedback và chuyển sản phẩm sang mục Chăm sóc & Lưu trữ');
            } else {
                toast.success('Đã chuyển sản phẩm sang mục Bảo hành và Lưu trữ');
            }

            onOpenChange(false);
            if (setActiveTab) setActiveTab('care');

        } catch (error) {
            console.error('Feedback action error:', error);
            toast.error('Lỗi khi thực hiện thao tác');
        } finally {
            setSaving(false);
        }
    };

    const getStageTitle = () => {
        if (!roomId) return 'Chi tiết sản phẩm';
        if (roomId.startsWith('after')) {
            switch (roomId) {
                case 'after1': return 'Ảnh hoàn thiện';
                case 'after1_debt': return 'Kiểm nợ';
                case 'after2': return 'Đóng gói & Giao hàng';
                case 'after3': return 'Nhắn HD & Feedback';
                case 'after4': return 'Lưu Trữ';
                default: return 'Sau bán hàng';
            }
        }
        if (roomId.startsWith('war')) return 'Quy trình Bảo hành';
        if (roomId.startsWith('care')) return 'Chăm sóc khách hàng';
        if (isSalesStep) return SALES_STATUS_LABELS[roomId] || 'Lên đơn';
        return 'Chi tiết sản phẩm';
    };

    const getRoomLogs = () => {
        const filteredWorkflowLogs = workflowLogs.filter(log => log.action === 'assigned' || log.action === 'failed');
        const allLogs = [...salesLogs, ...filteredWorkflowLogs, ...aftersaleLogs, ...careLogs];
        return allLogs
            .filter(log => log.entity_id === entityId || log.order_item_step_id) // simplified filter
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    };

    const roomLogs = getRoomLogs();

    const [timeLeft, setTimeLeft] = useState<string>('');

    useEffect(() => {
        if (!open || !dueAt) return;

        const updateCountdown = () => {
            const now = new Date().getTime();
            const target = new Date(dueAt).getTime();
            const diff = target - now;

            if (diff <= 0) {
                setTimeLeft('ĐÃ QUÁ HẠN');
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        };

        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);
        return () => clearInterval(timer);
    }, [open, dueAt]);

    const getStageInstructions = () => {
        if (roomId === 'step1') return "Kiểm tra kỹ tình trạng đồ của khách, chụp ảnh các vết trầy xước hoặc hư hỏng trước khi nhận.";
        if (roomId === 'step2') return "Gắn Tag định danh cho từng sản phẩm. Đảm bảo Tag không làm hỏng chất liệu sản phẩm.";
        if (roomId === 'step3') return "Trao đổi kỹ với bộ phận Kỹ thuật về phương án xử lý. Ghi chú lại các yêu cầu đặc biệt của khách.";
        if (roomId === 'after1') return "Chụp ảnh sản phẩm sau khi đã hoàn thiện để gửi khách.";
        if (roomId === 'after1_debt') return "Kiểm tra lại nợ cũ của khách và xác nhận đã kiểm nợ.";
        if (roomId.startsWith('after2')) return "Đóng gói cẩn thận, dán mã vận đơn rõ ràng. Chụp ảnh gói hàng trước khi giao shipper.";
        return "Hoàn thành các nhiệm vụ trong giai đoạn này và cập nhật trạng thái.";
    };

    if (!group) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-none w-screen h-screen p-0 overflow-hidden flex flex-col rounded-none border-none">
                <DialogHeader className="p-4 border-b">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                                <ShoppingBag className="h-5 w-5 text-primary" />
                            </div>
                            <div className="space-y-0.5">
                                <DialogTitle className="text-xl font-bold tracking-tight">
                                    {productName}
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                    {isAftersale || isCareFlow || isSalesStep ? getStageTitle() : 'Thông tin chi tiết sản phẩm và trao đổi nội bộ'}
                                </DialogDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            {dueAt && (
                                <div className="text-right hidden sm:block">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Hạn trả sản phẩm</div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="font-mono text-sm border-orange-200 text-orange-700 bg-orange-50 px-2 py-0.5">
                                            {formatDate(dueAt)}
                                        </Badge>
                                        <Badge className={cn(
                                            "font-mono text-sm px-2 py-0.5",
                                            timeLeft === 'ĐÃ QUÁ HẠN' ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700"
                                        )}>
                                            {timeLeft}
                                        </Badge>
                                    </div>
                                </div>
                            )}
                            {product?.status && (
                                <Badge variant="secondary" className="capitalize text-[10px] font-bold px-2 py-1">
                                    {product.status}
                                </Badge>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* Product Info - Left Side */}
                    <ScrollArea className="flex-1 p-4 md:max-w-[50%] border-r">
                        <div className="space-y-4">
                            {allImages?.length > 0 && (
                                <div className="flex flex-col xl:flex-row gap-4">
                                    {/* Main Large Image */}
                                    <div 
                                        className="flex-[3] rounded-2xl overflow-hidden border-4 border-white shadow-xl bg-gray-50 max-h-[400px] xl:max-h-[500px] aspect-video relative group shrink-0 cursor-zoom-in"
                                        onClick={() => setMainPreviewUrl(allImages[activeImageIdx])}
                                    >
                                        <img
                                            src={allImages[activeImageIdx]}
                                            alt={`${productName}-${activeImageIdx}`}
                                            className="w-full h-full object-contain transition-transform group-hover:scale-105 duration-700"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                            <Maximize2 className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-2xl" />
                                        </div>
                                    </div>

                                    {/* Scrollable Thumbnails Right Side */}
                                    <div className="flex-1 space-y-4 max-h-[400px] xl:max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                        {/* Row 1: Original Product Photos */}
                                        {originalImages.length > 0 && (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                                                    <ShoppingBag className="h-3 w-3" /> Ảnh sản phẩm lúc nhận
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {originalImages.map((img: string, idx: number) => {
                                                        const globalIdx = allImages.indexOf(img);
                                                        return (
                                                            <button
                                                                key={`orig-${idx}`}
                                                                onClick={() => setActiveImageIdx(globalIdx)}
                                                                className={cn(
                                                                    "w-16 h-16 rounded-xl overflow-hidden border-2 transition-all",
                                                                    activeImageIdx === globalIdx ? "border-primary ring-2 ring-primary/20 scale-95" : "border-gray-100 opacity-60 hover:opacity-100"
                                                                )}
                                                            >
                                                                <img src={img} alt="" className="w-full h-full object-cover" />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Row 2: Completion Photos */}
                                        {completionImages.length > 0 && (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-1.5 text-[10px] font-black text-purple-400 uppercase tracking-widest pl-1">
                                                    <Camera className="h-3 w-3" /> Ảnh hoàn thiện
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {completionImages.map((img: string, idx: number) => {
                                                        const globalIdx = allImages.indexOf(img);
                                                        return (
                                                            <button
                                                                key={`comp-${idx}`}
                                                                onClick={() => setActiveImageIdx(globalIdx)}
                                                                className={cn(
                                                                    "w-16 h-16 rounded-xl overflow-hidden border-2 transition-all",
                                                                    activeImageIdx === globalIdx ? "border-purple-500 ring-2 ring-purple-500/20 scale-95" : "border-purple-50 opacity-60 hover:opacity-100"
                                                                )}
                                                            >
                                                                <img src={img} alt="" className="w-full h-full object-cover" />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Row 3: Packaging Photos */}
                                        {packagingImages.length > 0 && (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-400 uppercase tracking-widest pl-1">
                                                    <Package className="h-3 w-3" /> Ảnh đóng gói
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {packagingImages.map((img: string, idx: number) => {
                                                        const globalIdx = allImages.indexOf(img);
                                                        return (
                                                            <button
                                                                key={`pack-${idx}`}
                                                                onClick={() => setActiveImageIdx(globalIdx)}
                                                                className={cn(
                                                                    "w-16 h-16 rounded-xl overflow-hidden border-2 transition-all",
                                                                    activeImageIdx === globalIdx ? "border-blue-500 ring-2 ring-blue-500/20 scale-95" : "border-blue-50 opacity-60 hover:opacity-100"
                                                                )}
                                                            >
                                                                <img src={img} alt="" className="w-full h-full object-cover" />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <h3 className="font-semibold text-xs uppercase tracking-[0.2em] text-gray-400">Thông tin chi tiết</h3>
                                <div className="grid grid-cols-1 gap-3 text-sm bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                                    {productItem?.product_type && (
                                        <div className="flex items-center gap-3">
                                            <Tag className="h-4 w-4 text-primary/60 shrink-0" />
                                            <span className="text-gray-500 min-w-[70px]">Loại:</span>
                                            <span className="font-bold text-gray-800 tracking-tight capitalize">{productItem.product_type}</span>
                                        </div>
                                    )}
                                    {productItem?.product_brand && (
                                        <div className="flex items-center gap-3">
                                            <Tag className="h-4 w-4 text-primary/60 shrink-0" />
                                            <span className="text-gray-500 min-w-[70px]">Hãng:</span>
                                            <span className="font-bold text-gray-800 tracking-tight capitalize">{productItem.product_brand}</span>
                                        </div>
                                    )}
                                    {productItem?.product_color && (
                                        <div className="flex items-center gap-3">
                                            <div className="h-4 w-4 rounded-full border-2 border-white shadow-sm shrink-0" style={{ backgroundColor: productItem.product_color }} />
                                            <span className="text-gray-500 min-w-[70px]">Màu sắc:</span>
                                            <span className="font-bold text-gray-800 tracking-tight capitalize">{productItem.product_color}</span>
                                        </div>
                                    )}
                                    {productItem?.product_notes && (
                                        <div className="flex items-start gap-3">
                                            <FileText className="h-4 w-4 text-primary/60 shrink-0 mt-0.5" />
                                            <span className="text-gray-500 min-w-[70px]">Ghi chú:</span>
                                            <span className="font-medium text-gray-700 leading-relaxed italic pr-2">{productItem.product_notes}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Staff Info Card */}
                            <div className="space-y-3">
                                <h3 className="font-semibold text-xs uppercase tracking-[0.2em] text-gray-400">Nhân sự phụ trách</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                                            <UserIcon className="h-4 w-4 text-orange-500" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">HĐ TẠO BỞI</span>
                                            <span className="text-xs font-bold text-gray-800 truncate">{(order as any).created_by_user?.name || 'Hệ thống'}</span>
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                            <ShieldCheck className="h-4 w-4 text-blue-500" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">SALE CHỐT</span>
                                            <span className="text-xs font-bold text-gray-800 truncate">{order?.sales_user?.name || 'N/A'}</span>
                                        </div>
                                    </div>
                                    {services.some(s => (s as any).technician) && (
                                        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 sm:col-span-2">
                                            <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                                                <Wrench className="h-4 w-4 text-purple-500" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">KỸ THUẬT VIÊN</span>
                                                <span className="text-xs font-bold text-gray-800 truncate">
                                                    {Array.from(new Set(services.filter(s => (s as any).technician).map(s => (s as any).technician.name))).join(', ')}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stage Instructions Card */}
                            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    <h3 className="font-bold text-xs uppercase tracking-tight text-primary">Hướng dẫn Giai đoạn này</h3>
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed font-medium">
                                    {getStageInstructions()}
                                </p>
                            </div>

                            <div className="space-y-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px] font-bold border-purple-200 hover:bg-purple-50 hover:text-purple-700 bg-purple-50/30 gap-1.5"
                                        onClick={() => setShowUpsellDialog(true)}
                                    >
                                        <Sparkles className="h-3 w-3 text-purple-500" />
                                        UPSALE
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {services.map((svc) => (
                                        <div key={svc.id} className="p-3.5 rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow group">
                                            <div className="flex items-center gap-2.5 font-bold text-sm text-gray-800">
                                                <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                                    <Wrench className="h-4 w-4 text-primary" />
                                                </div>
                                                {svc.item_name}
                                            </div>
                                            {(svc as any).technician && (
                                                <div className="flex items-center gap-2 mt-2.5 ml-10.5 text-[11px] text-gray-500">
                                                    <UserIcon className="h-3 w-3" />
                                                    <span className="font-medium">Kỹ thuật viên: <span className="text-gray-800">{(svc as any).technician.name}</span></span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Contextual Right Sidebar */}
                    <ScrollArea className="flex-1 bg-gray-50/40 product-detail-scroll-area">
                        <div className="p-4 flex flex-col gap-4 min-h-full">
                            {/* Consolidated Due Date / Pickup Block */}
                            <div className={cn(
                                "p-4 rounded-2xl border shadow-sm space-y-3",
                                isAftersale ? "bg-blue-50/50 border-blue-100" : "bg-white border-gray-100"
                            )}>
                                <div className={cn(
                                    "flex items-center gap-2 text-[11px] font-black uppercase tracking-tight",
                                    isAftersale ? "text-blue-900" : "text-gray-400 font-bold tracking-widest text-xs"
                                )}>
                                    <div className={cn(
                                        "h-6 w-6 rounded-lg flex items-center justify-center",
                                        isAftersale ? "bg-blue-100" : "bg-gray-100"
                                    )}>
                                        <Calendar className={cn("h-3.5 w-3.5", isAftersale ? "text-blue-600" : "text-gray-400")} />
                                    </div>
                                    {isAftersale ? "LỊCH HẸN TRẢ ĐỒ (PICKUP)" : "Hẹn trả sản phẩm này"}
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        type="datetime-local"
                                        className={cn(
                                            "h-9 text-xs rounded-xl",
                                            isAftersale ? "bg-white border-blue-200" : "bg-white border-gray-200"
                                        )}
                                        value={dueAt}
                                        onChange={(e) => setDueAt(e.target.value)}
                                    />
                                    <Button
                                        size="sm"
                                        className={cn(
                                            "h-9 px-3 rounded-xl gap-2 font-bold",
                                            isAftersale ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-slate-200"
                                        )}
                                        onClick={async () => {
                                            const itemId = product?.id || services[0]?.id;
                                            if (!itemId || !onUpdateItemAfterSaleData) return;
                                            setSaving(true);
                                            try {
                                                const payload: any = {
                                                    due_at: dueAt ? new Date(dueAt).toISOString() : null
                                                };
                                                
                                                if (isAftersale) {
                                                    payload.sales_step_data = {
                                                        ...(formData.sales_step_data || {}),
                                                        pickup_appointment_at: dueAt ? new Date(dueAt).toISOString() : null
                                                    };
                                                }
                                                
                                                await onUpdateItemAfterSaleData(itemId, !!product, payload);
                                                
                                                if (isAftersale) {
                                                    setFormData(prev => ({ ...prev, sales_step_data: payload.sales_step_data }));
                                                }
                                                
                                                toast.success('Đã cập nhật lịch hẹn');
                                            } catch (error) {
                                                toast.error('Lỗi cập nhật lịch hẹn');
                                            } finally {
                                                setSaving(false);
                                            }
                                        }}
                                        disabled={saving}
                                    >
                                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : (isAftersale ? 'LƯU' : <Save className="h-4 w-4" />)}
                                    </Button>
                                </div>
                                {isAftersale ? (
                                    <p className="text-[10px] text-blue-500 italic leading-tight">
                                        * Hệ thống sẽ gửi tin nhắn nhắc nhở tự động 1 lần/ngày nếu khách quá hẹn chưa qua lấy đồ.
                                    </p>
                                ) : (
                                    <p className="text-[10px] text-muted-foreground italic pl-1">
                                        * Mặc định sẽ lấy hạn trả của toàn đơn nếu để trống.
                                    </p>
                                )}
                            </div>

                            {isAftersale && order ? (
                                <div className="flex-1 flex flex-col gap-4">
                                    {(roomId.startsWith('after1') || roomId.startsWith('after4')) && (
                                        <div className="space-y-3">
                                            {/* Proof Photos */}
                                            <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100 shadow-sm space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center">
                                                            <Camera className="h-4 w-4 text-purple-600" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-black text-purple-900 uppercase tracking-tight">ẢNH HOÀN THIỆN</span>
                                                            <span className="text-[9px] text-purple-500 font-medium italic">Chụp ảnh sản phẩm đã hoàn thiện</span>
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="text-[9px] bg-white text-purple-600 border-purple-200">
                                                        {(formData.completion_photos?.length || 0)} ảnh
                                                    </Badge>
                                                </div>

                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    {(Array.isArray(formData.completion_photos) ? formData.completion_photos : []).map((photo, idx) => (
                                                        <ImageUpload
                                                            key={`comp-${idx}`}
                                                            value={photo}
                                                            onChange={(url) => {
                                                                setFormData(prev => {
                                                                    const newPhotos = [...(prev.completion_photos || [])];
                                                                    if (url) { newPhotos[idx] = url; } else { newPhotos.splice(idx, 1); }
                                                                    return { ...prev, completion_photos: newPhotos };
                                                                });
                                                            }}
                                                            className="w-16 h-16 rounded-xl border-2"
                                                            bucket="orders" folder="completion" hideInfo
                                                        />
                                                    ))}
                                                    <ImageUpload
                                                        key="comp-new" value={null}
                                                        onChange={(url) => {
                                                            if (url) {
                                                                setFormData(prev => ({ ...prev, completion_photos: [...(prev.completion_photos || []), url] }));
                                                            }
                                                        }}
                                                        className="w-16 h-16 rounded-xl border-2 border-dashed"
                                                        bucket="orders" folder="completion" placeholderIcon={<Camera className="h-6 w-6 text-purple-300" />} hideInfo
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                                                    Người chụp After
                                                    {(roomId === 'after1' || roomId === 'after4') && <span className="text-rose-500">*</span>}
                                                </Label>
                                                <Select
                                                    value={formData.aftersale_receiver_name || ''}
                                                    onValueChange={(val) => setFormData(prev => ({ ...prev, aftersale_receiver_name: val }))}
                                                >
                                                    <SelectTrigger className="bg-white h-9">
                                                        <SelectValue placeholder="Chọn nhân viên..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {users.map(u => (
                                                            <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}

                                    {(roomId.startsWith('after1_debt') || roomId.startsWith('after4')) && (
                                        <div className="space-y-3">
                                            <h3 className="font-semibold text-xs uppercase tracking-[0.2em] text-purple-800">Thông tin thanh toán (Kiểm nợ)</h3>
                                            <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-sm space-y-4">
                                                <div className="flex justify-between items-center bg-purple-50/50 p-2.5 rounded-xl border border-purple-50">
                                                    <span className="text-xs font-semibold text-purple-700">NGƯỜI TRẢ ĐỒ:</span>
                                                    <Badge className="bg-purple-600 font-bold hover:bg-purple-700 transition-colors text-white">
                                                        {order.sales_user?.name || 'Sale'}
                                                    </Badge>
                                                </div>

                                                <div className="space-y-3.5 px-1">
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-gray-500">Tổng đơn:</span>
                                                        <span className="font-bold text-gray-900">{formatCurrency(order.total_amount)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-gray-500 font-medium">Đã thanh toán:</span>
                                                        <span className="font-bold text-green-600">{formatCurrency(order.paid_amount || 0)}</span>
                                                    </div>
                                                    <div className="pt-3 mt-1 border-t-2 border-dashed border-purple-100">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm font-black text-purple-900 uppercase tracking-tight">Cần thu:</span>
                                                            <span className="font-black text-xl text-red-600">
                                                                {formatCurrency(order.remaining_debt ?? (order.total_amount - (order.paid_amount || 0)))}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3 pt-1">
                                                <div className="flex items-center space-x-2 bg-white p-3 rounded-xl border shadow-sm">
                                                    <Checkbox
                                                        id="debt_checked"
                                                        checked={formData.debt_checked}
                                                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, debt_checked: !!checked }))}
                                                    />
                                                    <Label htmlFor="debt_checked" className="text-sm font-semibold cursor-pointer">Xác nhận đã kiểm nợ</Label>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold text-gray-500 uppercase">Ghi chú kiểm nợ</Label>
                                                    <Textarea
                                                        placeholder="Nhập ghi chú kiểm nợ nếu có..."
                                                        className="bg-white min-h-[80px]"
                                                        value={formData.debt_checked_notes || ''}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, debt_checked_notes: e.target.value }))}
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                                                        Người thu tiền
                                                        {(roomId.startsWith('after1_debt') || roomId === 'after4') && <span className="text-rose-500">*</span>}
                                                    </Label>
                                                    <Select
                                                        value={formData.debt_checked_by_name || ''}
                                                        onValueChange={(val) => setFormData(prev => ({ ...prev, debt_checked_by_name: val }))}
                                                    >
                                                        <SelectTrigger className="bg-white h-9">
                                                            <SelectValue placeholder="Chọn nhân viên..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {users.map(u => (
                                                                <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Delivery Info */}
                                    {(roomId.startsWith('after2') || roomId.startsWith('after4')) && (
                                        <div className="space-y-3">
                                            <h3 className="font-semibold text-xs uppercase tracking-[0.2em] text-blue-800">Giao hàng</h3>
                                            <div className="bg-white p-4 rounded-2xl border border-blue-50 shadow-sm space-y-4">
                                                {roomId.startsWith('after2') ? (
                                                    <div className="space-y-4">
                                                        <div className="flex p-1 bg-gray-100 rounded-xl">
                                                            <button
                                                                type="button"
                                                                onClick={() => setFormData(p => ({ ...p, delivery_type: 'ship' }))}
                                                                className={cn(
                                                                    "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-bold transition-all",
                                                                    formData.delivery_type !== 'pickup' ? "bg-white shadow text-blue-600 scale-100" : "text-gray-500 hover:text-gray-700"
                                                                )}
                                                            >
                                                                <Truck className="h-4 w-4" />
                                                                Ship tận nơi
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setFormData(p => ({ ...p, delivery_type: 'pickup' }))}
                                                                className={cn(
                                                                    "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-bold transition-all",
                                                                    formData.delivery_type === 'pickup' ? "bg-white shadow text-blue-600 scale-100" : "text-gray-500 hover:text-gray-700"
                                                                )}
                                                            >
                                                                <UserIcon className="h-4 w-4" />
                                                                Khách đến lấy
                                                            </button>
                                                        </div>

                                                        {formData.delivery_type === 'pickup' ? (
                                                            <div className="space-y-4">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-black text-blue-600 uppercase tracking-tight flex items-center gap-1">
                                                                            NV TẠO ĐƠN <span className="text-red-500">*</span>
                                                                        </Label>
                                                                        <Select
                                                                            value={formData.delivery_creator_name || ''}
                                                                            onValueChange={(val) => setFormData(prev => ({ ...prev, delivery_creator_name: val }))}
                                                                        >
                                                                            <SelectTrigger className="h-9 bg-white">
                                                                                <SelectValue placeholder="Chọn..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {users.map(u => (
                                                                                    <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-black text-blue-600 uppercase tracking-tight flex items-center gap-1">
                                                                            SĐT LIÊN HỆ <span className="text-red-500">*</span>
                                                                        </Label>
                                                                        <Input
                                                                            placeholder="Nhập SĐT..."
                                                                            className="h-9"
                                                                            value={formData.delivery_shipper_phone || ''}
                                                                            onChange={(e) => setFormData(prev => ({ ...prev, delivery_shipper_phone: e.target.value }))}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-black text-blue-600 uppercase tracking-tight flex items-center gap-1">
                                                                            NV GIAO ĐỒ <span className="text-red-500">*</span>
                                                                        </Label>
                                                                        <Select
                                                                            value={formData.delivery_staff_name || ''}
                                                                            onValueChange={(val) => setFormData(prev => ({ ...prev, delivery_staff_name: val }))}
                                                                        >
                                                                            <SelectTrigger className="h-9 bg-white">
                                                                                <SelectValue placeholder="Chọn..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {users.map(u => (
                                                                                    <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-black text-blue-600 uppercase tracking-tight flex items-center gap-1">
                                                                            THỜI GIAN NHẬN <span className="text-red-500">*</span>
                                                                        </Label>
                                                                        <Input
                                                                            type="datetime-local"
                                                                            className="h-9"
                                                                            value={formData.delivery_received_at || ''}
                                                                            onChange={(e) => setFormData(prev => ({ ...prev, delivery_received_at: e.target.value }))}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-black text-blue-600 uppercase tracking-tight flex items-center gap-1">
                                                                            NV TẠO ĐƠN <span className="text-red-500">*</span>
                                                                        </Label>
                                                                        <Select
                                                                            value={formData.delivery_creator_name || ''}
                                                                            onValueChange={(val) => setFormData(prev => ({ ...prev, delivery_creator_name: val }))}
                                                                        >
                                                                            <SelectTrigger className="h-9 bg-white">
                                                                                <SelectValue placeholder="Chọn..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {users.map(u => (
                                                                                    <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-black text-blue-600 uppercase tracking-tight flex items-center gap-1">
                                                                            SDT SHIP LẤY HÀNG <span className="text-red-500">*</span>
                                                                        </Label>
                                                                        <Input
                                                                            placeholder="09xx..."
                                                                            className="h-9"
                                                                            value={formData.delivery_shipper_phone || ''}
                                                                            onChange={(e) => setFormData(prev => ({ ...prev, delivery_shipper_phone: e.target.value }))}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-black text-blue-600 uppercase tracking-tight flex items-center gap-1">
                                                                            NHÂN VIÊN GIAO SHIP <span className="text-red-500">*</span>
                                                                        </Label>
                                                                        <Select
                                                                            value={formData.delivery_staff_name || ''}
                                                                            onValueChange={(val) => setFormData(prev => ({ ...prev, delivery_staff_name: val }))}
                                                                        >
                                                                            <SelectTrigger className="h-9 bg-white">
                                                                                <SelectValue placeholder="Chọn..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {users.map(u => (
                                                                                    <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-black text-blue-600 uppercase tracking-tight flex items-center gap-1">
                                                                            THỜI GIAN KHÁCH NHẬN <span className="text-red-500">*</span>
                                                                        </Label>
                                                                        <Input
                                                                            type="datetime-local"
                                                                            className="h-9"
                                                                            value={formData.delivery_received_at || ''}
                                                                            onChange={(e) => setFormData(prev => ({ ...prev, delivery_received_at: e.target.value }))}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-4 border-t border-blue-50 pt-4">
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div className="space-y-2">
                                                                            <Label className="text-xs font-bold text-gray-500 uppercase">ĐƠN VỊ VẬN CHUYỂN</Label>
                                                                            <Input
                                                                                placeholder="VD: GHTK, Viettel Post..."
                                                                                value={formData.delivery_carrier || ''}
                                                                                onChange={(e) => setFormData(prev => ({ ...prev, delivery_carrier: e.target.value }))}
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label className="text-xs font-bold text-gray-500 uppercase">Mã vận đơn</Label>
                                                                            <Input
                                                                                placeholder="Nhập mã..."
                                                                                value={formData.delivery_code || ''}
                                                                                onChange={(e) => setFormData(prev => ({ ...prev, delivery_code: e.target.value }))}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div className="space-y-2">
                                                                            <Label className="text-xs font-bold text-gray-500 uppercase">Phí Ship</Label>
                                                                            <Input
                                                                                type="text"
                                                                                placeholder="0"
                                                                                value={formData.delivery_fee ? formData.delivery_fee.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ""}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value.replace(/\./g, "");
                                                                                    if (/^\d*$/.test(val)) {
                                                                                        setFormData(prev => ({ ...prev, delivery_fee: val ? parseInt(val, 10) : 0 }));
                                                                                    }
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label className="text-xs font-bold text-gray-500 uppercase">PT Thanh toán Ship</Label>
                                                                            <Select 
                                                                                value={(formData as any).delivery_payment_method || 'cash'}
                                                                                onValueChange={(val) => setFormData(prev => ({ ...prev, delivery_payment_method: val }))}
                                                                            >
                                                                                <SelectTrigger className="bg-white">
                                                                                    <SelectValue />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="cash">Tiền mặt</SelectItem>
                                                                                    <SelectItem value="transfer">Chuyển khoản</SelectItem>
                                                                                    <SelectItem value="zalopay">Zalo Pay</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <div className="space-y-2">
                                                                        <Label className="text-xs font-bold text-gray-500 uppercase">ĐỊA CHỈ GIAO HÀNG</Label>
                                                                        <Input
                                                                            placeholder="Địa chỉ nhận đồ của khách..."
                                                                            value={formData.delivery_address || ''}
                                                                            onChange={(e) => setFormData(prev => ({ ...prev, delivery_address: e.target.value }))}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-bold text-gray-500 uppercase">GHI CHÚ GIAO HÀNG</Label>
                                                            <Textarea
                                                                placeholder="Lưu ý cho shipper hoặc khâu đóng gói..."
                                                                value={formData.delivery_notes || ''}
                                                                onChange={(e) => setFormData(prev => ({ ...prev, delivery_notes: e.target.value }))}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start gap-4">
                                                        <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                                            <Truck className="h-5 w-5 text-blue-600" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="font-bold text-gray-800">{order.delivery_carrier || 'N/A'}</p>
                                                            <p className="text-xs text-gray-500">{order.delivery_address || 'Không có địa chỉ'}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 shadow-sm space-y-3 pt-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center">
                                                                <Package className="h-4 w-4 text-blue-600" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] font-black text-blue-900 uppercase tracking-tight">Ảnh đóng gói</span>
                                                                <span className="text-[9px] text-blue-500 font-medium">Kiện hàng kèm mã vận đơn</span>
                                                            </div>
                                                        </div>
                                                        <Badge variant="outline" className="text-[9px] bg-white text-blue-600 border-blue-200">
                                                            {(formData.packaging_photos?.length || 0)} ảnh
                                                        </Badge>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                        {(Array.isArray(formData.packaging_photos) ? formData.packaging_photos : []).map((photo, idx) => (
                                                            <ImageUpload
                                                                key={`pack-${idx}`}
                                                                value={photo}
                                                                onChange={(url) => {
                                                                    setFormData(prev => {
                                                                        const newPhotos = [...(prev.packaging_photos || [])];
                                                                        if (url) { newPhotos[idx] = url; } else { newPhotos.splice(idx, 1); }
                                                                        return { ...prev, packaging_photos: newPhotos };
                                                                    });
                                                                }}
                                                                className="w-16 h-16 rounded-xl border-2"
                                                                bucket="orders" folder="packaging" hideInfo
                                                            />
                                                        ))}
                                                        <ImageUpload
                                                            key="pack-new" value={null}
                                                            onChange={(url) => {
                                                                if (url) {
                                                                    setFormData(prev => ({ ...prev, packaging_photos: [...(prev.packaging_photos || []), url] }));
                                                                }
                                                            }}
                                                            className="w-16 h-16 rounded-xl border-2 border-dashed"
                                                            bucket="orders" folder="packaging" placeholderIcon={<Package className="h-6 w-6 text-blue-300" />} hideInfo
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Feedback & Invoice */}
                                    {(roomId.startsWith('after3') || roomId.startsWith('after4')) && (
                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-xs uppercase tracking-[0.2em] text-green-800">HD BẢO QUẢN & PHẢN HỒI</h3>
                                            <div className="space-y-3">
                                                {roomId.startsWith('after3') ? (
                                                    <label htmlFor="hd_sent" className="bg-white p-4 rounded-xl border border-green-50 shadow-sm flex items-center justify-between cursor-pointer hover:bg-green-50/30 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <BookOpen className={cn("h-5 w-5", formData.hd_sent ? "text-green-600" : "text-gray-300")} />
                                                            <span className="text-sm font-medium">Đã gửi hướng dẫn bảo quản</span>
                                                        </div>
                                                        <Checkbox
                                                            id="hd_sent"
                                                            checked={formData.hd_sent}
                                                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hd_sent: !!checked }))}
                                                        />
                                                    </label>
                                                ) : (
                                                    <div className="bg-white p-4 rounded-xl border border-green-50 shadow-sm flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <BookOpen className={cn("h-5 w-5", formData.hd_sent ? "text-green-600" : "text-gray-300")} />
                                                            <span className="text-sm font-medium">Đã gửi hướng dẫn bảo quản</span>
                                                        </div>
                                                        <Badge variant="outline" className="bg-green-50 text-green-700">{order.hd_sent ? 'Đã gửi' : 'Chưa gửi'}</Badge>
                                                    </div>
                                                )}

                                                {roomId.startsWith('after3') ? (
                                                    <label htmlFor="fb_req" className="bg-white p-4 rounded-xl border border-green-50 shadow-sm flex items-center justify-between cursor-pointer hover:bg-green-50/30 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <MessageSquare className={cn("h-5 w-5", formData.feedback_requested ? "text-green-600" : "text-gray-300")} />
                                                            <span className="text-sm font-medium">Yêu cầu Feedback</span>
                                                        </div>
                                                        <Checkbox
                                                            id="fb_req"
                                                            checked={formData.feedback_requested}
                                                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, feedback_requested: !!checked }))}
                                                        />
                                                    </label>
                                                ) : (
                                                    <div className="bg-white p-4 rounded-xl border border-green-50 shadow-sm flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <MessageSquare className={cn("h-5 w-5", formData.feedback_requested ? "text-green-600" : "text-gray-300")} />
                                                            <span className="text-sm font-medium">Yêu cầu Feedback</span>
                                                        </div>
                                                        <Badge variant="outline" className="bg-green-50 text-green-700">{order.feedback_requested ? 'Đã gửi' : 'Chưa gửi'}</Badge>
                                                    </div>
                                                )}

                                                {roomId.startsWith('after3') && (
                                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                                        <Button
                                                            variant="outline"
                                                            className="h-14 rounded-2xl border-green-200 hover:bg-green-50 hover:text-green-700 flex flex-col items-center justify-center gap-1 group"
                                                            onClick={() => handleFeedbackAction(true)}
                                                            disabled={saving}
                                                        >
                                                            <ThumbsUp className="h-5 w-5 text-green-500 group-hover:scale-110 transition-transform" />
                                                            <span className="text-[10px] font-black uppercase tracking-tighter">Hài lòng (Khen)</span>
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            className="h-14 rounded-2xl border-red-200 hover:bg-red-50 hover:text-red-700 flex flex-col items-center justify-center gap-1 group"
                                                            onClick={() => handleFeedbackAction(false)}
                                                            disabled={saving}
                                                        >
                                                            <ThumbsDown className="h-5 w-5 text-red-500 group-hover:scale-110 transition-transform" />
                                                            <span className="text-[10px] font-black uppercase tracking-tighter">Góp ý (Chê)</span>
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {isAftersale && (
                                        <div className="flex-1 flex flex-col min-h-[400px] gap-6 pt-6 border-t mt-4">
                                            <div className="flex-1 flex flex-col min-h-[250px]">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
                                                    <h4 className="font-semibold text-xs uppercase tracking-[0.2em] text-gray-400">Thảo luận nội bộ</h4>
                                                </div>
                                                <ProductChat
                                                    orderId={order?.id || ''}
                                                    entityId={entityId}
                                                    entityType={entityType}
                                                    roomId={roomId}
                                                    currentUserId={currentUserId}
                                                    highlightMessageId={highlightMessageId}
                                                />
                                            </div>

                                            <div className="flex-1 flex flex-col min-h-[150px]">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <History className="h-3.5 w-3.5 text-gray-400" />
                                                    <h4 className="font-semibold text-xs uppercase tracking-[0.2em] text-gray-400">Lịch sử thay đổi</h4>
                                                </div>
                                                <ScrollArea className="flex-1 bg-white rounded-xl border border-gray-100 p-3">
                                                    <div className="space-y-3">
                                                        {roomLogs.length > 0 ? roomLogs.map((log: any) => (
                                                            <div key={log.id} className="text-[11px] border-b border-gray-50 pb-2 last:border-0 relative">
                                                                <div className="flex justify-between items-start mb-1">
                                                                    <span className="font-bold text-gray-700 uppercase">
                                                                        {log.order_item_step_id ? (
                                                                            <span className={log.action === 'failed' ? "text-red-500" : "text-blue-700"}>
                                                                                {log.action === 'failed' && <span className="mr-1">THẤT BẠI:</span>}
                                                                                {log.step_name}
                                                                            </span>
                                                                        ) : (
                                                                            `${log.from_status || log.from_stage || 'START'} → ${log.to_status || log.to_stage}`
                                                                        )}
                                                                    </span>
                                                                    <span className="text-[9px] text-gray-400 tabular-nums">{formatDateTime(log.created_at)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                                                                    <div className="h-3 w-3 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[8px] font-bold">
                                                                        {log.created_by_user?.name?.charAt(0) || '?'}
                                                                    </div>
                                                                    {log.created_by_user?.name || 'Hệ thống'}
                                                                </div>
                                                            </div>
                                                        )) : (
                                                            <div className="text-center py-8 text-gray-400 italic text-[11px]">Chưa có lịch sử thay đổi</div>
                                                        )}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        </div>
                                    )}

                                    {isAftersale && !roomId.startsWith('after4') && (
                                        <Button
                                            className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20"
                                            onClick={handleSave}
                                            disabled={saving}
                                        >
                                            {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                                            Cập nhật thông tin
                                        </Button>
                                    )}
                                </div>
                            ) : isCareFlow && order ? (
                                <div className="flex-1 flex flex-col gap-4">
                                    <h3 className={cn(
                                        "font-semibold text-xs uppercase tracking-[0.2em]",
                                        roomId.startsWith('war') ? "text-red-700" : "text-teal-700"
                                    )}>
                                        {roomId.startsWith('war') ? 'Tình trạng Bảo hành' : 'Tình trạng Chăm sóc'}
                                    </h3>

                                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                                        {/* Current stage badge */}
                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                                            {roomId.startsWith('war') ? (
                                                <ShieldCheck className="h-5 w-5 text-red-500 shrink-0" />
                                            ) : (
                                                <Heart className="h-5 w-5 text-teal-500 shrink-0" />
                                            )}
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">TRẠNG THÁI HIỆN TẠI</span>
                                                <span className="text-sm font-black text-gray-800">{getCareWarrantyStageLabel((productItem || (services?.[0] as any))?.care_warranty_stage)}</span>
                                            </div>
                                        </div>

                                        {/* Staff info — warranty only */}
                                        {roomId.startsWith('war') && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-100 flex items-center gap-2">
                                                    <Wrench className="h-4 w-4 text-purple-500 shrink-0" />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Kỹ Thuật Viên</span>
                                                        <span className="text-xs font-bold text-gray-800 truncate">
                                                            {Array.from(new Set(services.filter(s => (s as any).technician).map(s => (s as any).technician.name))).join(', ') || '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 flex items-center gap-2">
                                                    <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0" />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">NV Sale</span>
                                                        <span className="text-xs font-bold text-gray-800 truncate">{order?.sales_user?.name || '—'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Single photo: "Ảnh Trước Bảo hành" (warranty) or "Ảnh Chăm sóc" (care) */}
                                        <div className={cn(
                                            "p-4 rounded-2xl border space-y-2",
                                            roomId.startsWith('war') ? "bg-red-50/40 border-red-100" : "bg-teal-50/40 border-teal-100"
                                        )}>
                                            <div className="flex items-center gap-2">
                                                <Camera className={cn("h-4 w-4", roomId.startsWith('war') ? "text-red-500" : "text-teal-500")} />
                                                <span className={cn("text-[11px] font-black uppercase tracking-tight", roomId.startsWith('war') ? "text-red-900" : "text-teal-900")}>
                                                    {roomId.startsWith('war') ? 'Ảnh Trước Bảo hành' : 'Ảnh Chăm sóc'}
                                                </span>
                                            </div>
                                            <div className="flex gap-2 flex-wrap">
                                                <ImageUpload
                                                    key="care-main"
                                                    value={(formData.completion_photos as string[])?.[0] || null}
                                                    onChange={(url) => {
                                                        setFormData(prev => ({ ...prev, completion_photos: url ? [url] : [] }));
                                                    }}
                                                    className="w-20 h-20 rounded-xl border-2"
                                                    bucket="orders" folder="warranty" hideInfo
                                                />
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Ghi chú tiến độ</Label>
                                            <Textarea
                                                placeholder="Nhập ghi chú cập nhật tiến độ chăm sóc/bảo hành..."
                                                className="bg-gray-50/50 min-h-[80px] text-sm"
                                                value={formData.notes || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                            />
                                        </div>

                                        {/* Tạo HD Bảo hành button — warranty only */}
                                        {roomId.startsWith('war') && (
                                            <Button
                                                variant="outline"
                                                className="w-full h-10 rounded-xl font-bold border-red-300 text-red-700 hover:bg-red-50 gap-2"
                                                disabled={saving}
                                                onClick={async () => {
                                                    if (!entityId || !onReloadOrder) return;
                                                    setSaving(true);
                                                    try {
                                                        const isCustomerItem = !!product;
                                                        const api = isCustomerItem ? (await import('@/lib/api')).orderProductsApi : (await import('@/lib/api')).orderItemsApi;
                                                        
                                                        // Update item status to 'step1'
                                                        await api.updateStatus(entityId, 'step1', 'Bảo hành lại');
                                                        
                                                        const code = `HDBH${order?.order_code || ''}.${entityId.slice(-4)}`;
                                                        toast.success(`Đã tạo HD Bảo hành: ${code} và chuyển về Nhận đồ & Chụp ảnh`);
                                                        onOpenChange(false);
                                                        if (setActiveTab) setActiveTab('sales');
                                                        onReloadOrder();
                                                    } catch (error: any) {
                                                        toast.error(error?.response?.data?.message || 'Lỗi khi tạo HD Bảo hành');
                                                    } finally {
                                                        setSaving(false);
                                                    }
                                                }}
                                            >
                                                <ClipboardList className="h-4 w-4" />
                                                Tạo HD Bảo hành
                                            </Button>
                                        )}

                                        {/* Save */}
                                        <Button
                                            className={cn(
                                                "w-full h-11 rounded-xl font-bold transition-all",
                                                roomId.startsWith('war') ? "bg-red-600 hover:bg-red-700" : "bg-teal-600 hover:bg-teal-700"
                                            )}
                                            onClick={handleSave}
                                            disabled={saving}
                                        >
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                            Lưu ghi chú
                                        </Button>
                                    </div>

                                    <div className="mt-auto bg-gray-100/50 p-4 rounded-xl space-y-3">
                                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">
                                            <History className="h-3 w-3" /> Tóm tắt đơn hàng
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-1">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-gray-400 font-bold tracking-tight">NGÀY HOÀN THÀNH</span>
                                                <span className="text-xs font-bold text-gray-600 tabular-nums">{order?.completed_at ? formatDateTime(order.completed_at) : '—'}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-gray-400 font-bold tracking-tight">TỔNG THANH TOÁN</span>
                                                <span className="text-xs font-bold text-gray-600 tabular-nums">{order ? formatCurrency(order.total_amount) : '—'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col min-h-[400px] gap-6 pt-6 border-t mt-4">
                                        <div className="flex-1 flex flex-col min-h-[250px]">
                                            <div className="flex items-center gap-2 mb-2">
                                                <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
                                                <h4 className="font-semibold text-xs uppercase tracking-[0.2em] text-gray-400">Thảo luận nội bộ</h4>
                                            </div>
                                            <ProductChat
                                                orderId={order?.id || ''}
                                                entityId={entityId}
                                                entityType={entityType}
                                                roomId={roomId}
                                                currentUserId={currentUserId}
                                                highlightMessageId={highlightMessageId}
                                            />
                                        </div>

                                        <div className="flex-1 flex flex-col min-h-[150px]">
                                            <div className="flex items-center gap-2 mb-2">
                                                <History className="h-3.5 w-3.5 text-gray-400" />
                                                <h4 className="font-semibold text-xs uppercase tracking-[0.2em] text-gray-400">Lịch sử thay đổi</h4>
                                            </div>
                                            <ScrollArea className="flex-1 bg-white rounded-xl border border-gray-100 p-3">
                                                <div className="space-y-3">
                                                    {roomLogs.length > 0 ? roomLogs.map((log: any) => (
                                                        <div key={log.id} className="text-[11px] border-b border-gray-50 pb-2 last:border-0 relative">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className="font-bold text-gray-700 uppercase">
                                                                    {log.order_item_step_id ? (
                                                                        <span className={log.action === 'failed' ? "text-red-500" : "text-blue-700"}>
                                                                            {log.action === 'failed' && <span className="mr-1">THẤT BẠI:</span>}
                                                                            {log.step_name}
                                                                        </span>
                                                                    ) : (
                                                                        `${log.from_status || log.from_stage || 'START'} → ${log.to_status || log.to_stage}`
                                                                    )}
                                                                </span>
                                                                <span className="text-[9px] text-gray-400 tabular-nums">{formatDateTime(log.created_at)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                                                                <div className="h-3 w-3 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[8px] font-bold">
                                                                    {log.created_by_user?.name?.charAt(0) || '?'}
                                                                </div>
                                                                {log.created_by_user?.name || 'Hệ thống'}
                                                            </div>

                                                            {log.action === 'assigned' && (
                                                                <div className="mt-1.5 space-y-1 bg-blue-50/50 p-2 rounded-lg border border-blue-50">
                                                                    {log.reason && (
                                                                        <div className="flex gap-2">
                                                                            <span className="font-semibold text-gray-500 min-w-[65px]">Lý do:</span>
                                                                            <span className="text-gray-700">{log.reason}</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex gap-2">
                                                                        <span className="font-semibold text-gray-500 min-w-[65px]">KTV:</span>
                                                                        <span className="font-medium text-blue-700">{log.assigned_tech?.name || 'Chưa phân công'}</span>
                                                                    </div>
                                                                    {log.deadline_days > 0 && (
                                                                        <div className="flex gap-2">
                                                                            <span className="font-semibold text-gray-500 min-w-[65px]">Hạn:</span>
                                                                            <span className="text-gray-700">{log.deadline_days} ngày</span>
                                                                        </div>
                                                                    )}
                                                                    {log.notes && (
                                                                        <div className="flex gap-2 mt-1 pt-1 border-t border-blue-100/50">
                                                                            <span className="font-semibold text-gray-500 min-w-[65px]">Ghi chú:</span>
                                                                            <span className="text-gray-700 italic">{log.notes}</span>
                                                                        </div>
                                                                    )}
                                                                    {log.photos && log.photos.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-blue-100/50">
                                                                            {log.photos.map((url: string, idx: number) => (
                                                                                <a key={idx} href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                                                                                    <img src={url} alt={`Evidence ${idx}`} className="h-8 w-8 object-cover rounded shadow-sm border border-gray-200" />
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {log.action === 'failed' && log.notes && (
                                                                <div className="mt-1.5 bg-red-50 p-2 rounded-lg border border-red-100 text-red-700 italic">
                                                                    {log.notes}
                                                                    {log.photos && log.photos.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-red-100">
                                                                            {log.photos.map((url: string, idx: number) => (
                                                                                <a key={idx} href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                                                                                    <img src={url} alt={`Evidence ${idx}`} className="h-8 w-8 object-cover rounded shadow-sm border border-red-200" />
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {log.order_item_step_id && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    className="h-6 px-2 absolute top-1 right-1 text-[10px] text-primary hover:bg-primary/10 font-bold border border-primary/20 rounded-md"
                                                                    onClick={() => {
                                                                        setSelectedLogDetail(log);
                                                                        setShowLogDetailDialog(true);
                                                                    }}
                                                                >
                                                                    <Maximize2 className="h-3 w-3 mr-1" />
                                                                    Xem chi tiết
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )) : (
                                                        <div className="text-center py-8 text-gray-400 italic text-[11px]">Chưa có lịch sử thay đổi</div>
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    </div>
                                </div>

                            ) : isSalesStep ? (
                                <div className="flex-1 flex flex-col gap-4 min-h-0">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-semibold text-xs uppercase tracking-[0.2em] text-gray-400">
                                            {SALES_STATUS_LABELS[roomId] || 'Thông tin bước'}
                                        </h3>
                                        <Badge variant="secondary" className="text-[10px] px-2 py-0 font-bold">
                                            {SALES_STATUS_LABELS[roomId]?.toUpperCase() || roomId.toUpperCase()}
                                        </Badge>
                                    </div>

                                    {/* Step 1: Nhận đồ - Receiver Info */}
                                    {roomId === 'step1' && (
                                        <div className="space-y-4">
                                            <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm space-y-4">
                                                <div className="flex items-center gap-2 text-blue-700 mb-1">
                                                    <UserIcon className="h-4 w-4" />
                                                    <span className="text-xs font-black uppercase tracking-tight">Thông tin người nhận đồ</span>
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs font-bold text-gray-500">TÊN NHÂN VIÊN SALE NHẬN <span className="text-red-500">*</span></Label>
                                                            <Select
                                                                value={stepData.step1_receiver_name || ''}
                                                                onValueChange={(val) => setStepData(prev => ({ ...prev, step1_receiver_name: val }))}
                                                             >
                                                                 <SelectTrigger className="bg-white h-9">
                                                                     <SelectValue placeholder="Chọn nhân viên..." />
                                                                 </SelectTrigger>
                                                                 <SelectContent>
                                                                     {users.filter(u => ['sale', 'manager', 'admin'].includes(u.role)).map(u => (
                                                                         <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                                                                     ))}
                                                                 </SelectContent>
                                                             </Select>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs font-bold text-gray-500">TIỀN SHIP (NẾU CÓ)</Label>
                                                            <Input
                                                                placeholder="Nhập số tiền..."
                                                                type="text"
                                                                value={stepData.step1_shipping_fee ? stepData.step1_shipping_fee.toLocaleString('vi-VN') : ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.replace(/\D/g, '');
                                                                    setStepData(prev => ({ ...prev, step1_shipping_fee: val ? parseInt(val, 10) : 0 }));
                                                                }}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-bold text-gray-500 uppercase font-bold tracking-tight mb-2 flex items-center gap-1.5">
                                                            <Camera className="h-3.5 w-3.5 text-blue-500" />
                                                            ẢNH & VIDEO LÀM BẰNG CHỨNG <span className="text-red-500">*</span>
                                                         </Label>
                                                         <MultiMediaUpload 
                                                            value={stepData.step1_evidence_photos || []}
                                                            onChange={(urls) => setStepData(prev => ({ ...prev, step1_evidence_photos: urls }))}
                                                         />
                                                     </div>

                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-bold text-gray-500">GHI CHÚ NHẬN ĐỒ</Label>
                                                        <Textarea
                                                            placeholder="Tình trạng đồ khi nhận, ghi chú thêm..."
                                                            className="min-h-[80px]"
                                                            value={stepData.step1_notes || ''}
                                                            onChange={(e) => setStepData(prev => ({ ...prev, step1_notes: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                className="w-full h-11 rounded-xl font-bold shadow-lg shadow-blue-200 bg-blue-600 hover:bg-blue-700"
                                                onClick={async () => {
                                                    await handleSaveStepData();
                                                    // Nếu có tiền ship thì tạo phiếu chi (expense)
                                                    if (roomId === 'step1' && stepData.step1_shipping_fee > 0 && order) {
                                                        const { transactionsApi } = await import('@/lib/api');
                                                        try {
                                                            await transactionsApi.create({
                                                                type: 'expense',
                                                                category: 'Phí ship nhận hàng',
                                                                amount: stepData.step1_shipping_fee,
                                                                notes: `Tiền ship nhận đồ cho đơn ${order.order_code || order.id}`,
                                                                order_id: order.id,
                                                                order_code: order.order_code,
                                                                date: new Date().toISOString().split('T')[0],
                                                                payment_method: 'cash'
                                                            });
                                                            toast.success('Đã tạo phiếu chi cho tiền ship');
                                                        } catch (error) {
                                                            console.error('Lỗi tạo phiếu chi:', error);
                                                            toast.error('Lỗi khi tạo phiếu chi tự động');
                                                        }
                                                    }
                                                }}
                                                disabled={savingStepData}
                                            >
                                                {savingStepData ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                                Lưu thông tin nhận đồ
                                            </Button>
                                        </div>
                                    )}

                                    {/* Step 2: TAGS + FORM TÚI + SHOESTREE */}
                                    {roomId === 'step2' && (
                                        <div className="space-y-4">
                                            <div className="bg-white p-5 rounded-2xl border border-green-100 shadow-sm space-y-4">
                                                <div className="flex items-center gap-2 text-green-700 mb-1">
                                                    <Tag className="h-4 w-4" />
                                                    <span className="text-xs font-black uppercase tracking-tight">Gắn Tags & Phụ kiện bảo quản</span>
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-bold text-gray-500 uppercase font-bold tracking-tight mb-2 flex items-center gap-1.5">
                                                            <Camera className="h-3.5 w-3.5 text-green-500" />
                                                            ẢNH CHỨNG MINH ĐÃ GẮN TAGS <span className="text-red-500">*</span>
                                                        </Label>
                                                        <MultiMediaUpload 
                                                           value={stepData.step2_tags_photos || []}
                                                           onChange={(urls) => setStepData(prev => ({ ...prev, step2_tags_photos: urls }))}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-bold text-gray-500 uppercase font-bold tracking-tight mb-2 flex items-center gap-1.5">
                                                            <Camera className="h-3.5 w-3.5 text-green-500" />
                                                            ẢNH ĐÃ GẮN FORM TÚI/SHOESTREE <span className="text-red-500">*</span>
                                                        </Label>
                                                        <MultiMediaUpload 
                                                           value={stepData.step2_form_photos || []}
                                                           onChange={(urls) => setStepData(prev => ({ ...prev, step2_form_photos: urls }))}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                className="w-full h-11 rounded-xl font-bold shadow-lg shadow-green-200 bg-green-600 hover:bg-green-700"
                                                onClick={handleSaveStepData}
                                                disabled={savingStepData}
                                            >
                                                {savingStepData ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                                Lưu thông tin Step 2
                                            </Button>
                                        </div>
                                    )}

                                    {/* Step 3: Trao đổi KT - Technician Exchange */}
                                    {roomId === 'step3' && (
                                        <div className="space-y-4">
                                            <div className="bg-white p-5 rounded-2xl border border-orange-100 shadow-sm space-y-4">
                                                <div className="flex items-center gap-2 text-orange-700 mb-1">
                                                    <ClipboardList className="h-4 w-4" />
                                                    <span className="text-xs font-black uppercase tracking-tight">Trao đổi với Kỹ thuật</span>
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-bold text-gray-500">TÊN KỸ THUẬT VIÊN</Label>
                                                        <Input
                                                            placeholder="VD: KT Hùng, KT Minh..."
                                                            value={stepData.step3_technician_name || ''}
                                                            onChange={(e) => setStepData(prev => ({ ...prev, step3_technician_name: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-bold text-gray-500">CHI TIẾT CÔNG VIỆC CẦN LÀM</Label>
                                                        <Textarea
                                                            placeholder="VD: Đánh bóng mũi giày, gia cố đế, vệ sinh lót trong..."
                                                            className="min-h-[100px]"
                                                            value={stepData.step3_work_details || ''}
                                                            onChange={(e) => setStepData(prev => ({ ...prev, step3_work_details: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-bold text-gray-500">VỊ TRÍ CẦN XỬ LÝ</Label>
                                                        <Input
                                                            placeholder="VD: Mũi giày bên trái, gót phải..."
                                                            value={stepData.step3_work_location || ''}
                                                            onChange={(e) => setStepData(prev => ({ ...prev, step3_work_location: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-bold text-gray-500">GHI CHÚ THÊM</Label>
                                                        <Textarea
                                                            placeholder="Ghi chú trao đổi thêm với KT..."
                                                            className="min-h-[60px]"
                                                            value={stepData.step3_notes || ''}
                                                            onChange={(e) => setStepData(prev => ({ ...prev, step3_notes: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>
                                                <Button
                                                    className="w-full h-11 rounded-xl font-bold shadow-lg shadow-orange-200 bg-orange-600 hover:bg-orange-700"
                                                    onClick={handleSaveStepData}
                                                    disabled={savingStepData}
                                                >
                                                    {savingStepData ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                                    Lưu thông tin trao đổi KT
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                        <div className="flex-1 flex flex-col min-h-[250px] gap-4">
                                            <div className="flex-1 flex flex-col min-h-[250px]">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
                                                    <h4 className="font-semibold text-xs uppercase tracking-[0.2em] text-gray-400">Trao đổi nội bộ</h4>
                                                </div>
                                                <ProductChat
                                                    orderId={order?.id || ''}
                                                    entityId={entityId}
                                                    entityType={entityType}
                                                    roomId={roomId}
                                                    currentUserId={currentUserId}
                                                    highlightMessageId={highlightMessageId}
                                                />
                                            </div>

                                            <div className="flex-1 flex flex-col min-h-[150px]">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <History className="h-3.5 w-3.5 text-gray-400" />
                                                    <h4 className="font-semibold text-xs uppercase tracking-[0.2em] text-gray-400">Lịch sử thay đổi</h4>
                                                </div>
                                                <ScrollArea className="flex-1 bg-white rounded-xl border border-gray-100 p-3">
                                                    <div className="space-y-3">
                                                        {roomLogs.length > 0 ? roomLogs.map((log: any) => (
                                                            <div key={log.id} className="text-[11px] border-b border-gray-50 pb-2 last:border-0 relative">
                                                                <div className="flex justify-between items-start mb-1">
                                                                    <span className="font-bold text-gray-700 uppercase">
                                                                        {log.order_item_step_id ? (
                                                                            <span className={log.action === 'failed' ? "text-red-500" : "text-blue-700"}>
                                                                                {log.action === 'failed' && <span className="mr-1">THẤT BẠI:</span>}
                                                                                {log.step_name}
                                                                            </span>
                                                                        ) : (
                                                                            `${log.from_status || log.from_stage || 'START'} → ${log.to_status || log.to_stage}`
                                                                        )}
                                                                    </span>
                                                                    <span className="text-[9px] text-gray-400 tabular-nums">{formatDateTime(log.created_at)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                                                                    <div className="h-3 w-3 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[8px] font-bold">
                                                                        {log.created_by_user?.name?.charAt(0) || '?'}
                                                                    </div>
                                                                    {log.created_by_user?.name || 'Hệ thống'}
                                                                </div>

                                                                {log.action === 'assigned' && (
                                                                    <div className="mt-1.5 space-y-1 bg-blue-50/50 p-2 rounded-lg border border-blue-50">
                                                                        {log.reason && (
                                                                            <div className="flex gap-2">
                                                                                <span className="font-semibold text-gray-500 min-w-[65px]">Lý do:</span>
                                                                                <span className="text-gray-700">{log.reason}</span>
                                                                            </div>
                                                                        )}
                                                                        <div className="flex gap-2">
                                                                            <span className="font-semibold text-gray-500 min-w-[65px]">KTV:</span>
                                                                            <span className="font-medium text-blue-700">{log.assigned_tech?.name || 'Chưa phân công'}</span>
                                                                        </div>
                                                                        {log.deadline_days > 0 && (
                                                                            <div className="flex gap-2">
                                                                                <span className="font-semibold text-gray-500 min-w-[65px]">Hạn:</span>
                                                                                <span className="text-gray-700">{log.deadline_days} ngày</span>
                                                                            </div>
                                                                        )}
                                                                        {log.notes && (
                                                                            <div className="flex gap-2 mt-1 pt-1 border-t border-blue-100/50">
                                                                                <span className="font-semibold text-gray-500 min-w-[65px]">Ghi chú:</span>
                                                                                <span className="text-gray-700 italic">{log.notes}</span>
                                                                            </div>
                                                                        )}
                                                                        {log.photos && log.photos.length > 0 && (
                                                                            <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-blue-100/50">
                                                                                {log.photos.map((url: string, idx: number) => (
                                                                                    <a key={idx} href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                                                                                        <img src={url} alt={`Evidence ${idx}`} className="h-8 w-8 object-cover rounded shadow-sm border border-gray-200" />
                                                                                    </a>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {log.action === 'failed' && log.notes && (
                                                                    <div className="mt-1.5 bg-red-50 p-2 rounded-lg border border-red-100 text-red-700 italic">
                                                                        {log.notes}
                                                                        {log.photos && log.photos.length > 0 && (
                                                                            <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-red-100">
                                                                                {log.photos.map((url: string, idx: number) => (
                                                                                    <a key={idx} href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                                                                                        <img src={url} alt={`Evidence ${idx}`} className="h-8 w-8 object-cover rounded shadow-sm border border-red-200" />
                                                                                    </a>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {log.order_item_step_id && (
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm" 
                                                                        className="h-6 px-2 absolute top-1 right-1 text-[10px] text-primary hover:bg-primary/10 font-bold border border-primary/20 rounded-md"
                                                                        onClick={() => {
                                                                            setSelectedLogDetail(log);
                                                                            setShowLogDetailDialog(true);
                                                                        }}
                                                                    >
                                                                        <Maximize2 className="h-3 w-3 mr-1" />
                                                                        Xem chi tiết
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        )) : (
                                                            <div className="text-center py-8 text-gray-400 italic text-[11px]">Chưa có lịch sử thay đổi</div>
                                                        )}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                <div className="flex-1 flex flex-col gap-4 min-h-0">
                                    <div className="flex-1 flex flex-col min-h-[250px]">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="font-semibold text-xs uppercase tracking-[0.2em] text-gray-400">Trao đổi nội bộ</h3>
                                            <Badge variant="secondary" className="text-[10px] px-2 py-0 font-bold">
                                                {SALES_STATUS_LABELS[roomId]?.toUpperCase() || `PHÒNG ${roomId.toUpperCase()}`}
                                            </Badge>
                                        </div>

                                        {entityId && (
                                            <ProductChat
                                                orderId={order?.id || ''}
                                                entityId={entityId}
                                                entityType={entityType}
                                                roomId={roomId}
                                                currentUserId={currentUserId}
                                                highlightMessageId={highlightMessageId}
                                            />
                                        )}
                                    </div>

                                    <div className="flex-1 flex flex-col min-h-[150px]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <History className="h-3.5 w-3.5 text-gray-400" />
                                            <h4 className="font-semibold text-xs uppercase tracking-[0.2em] text-gray-400">Lịch sử thay đổi</h4>
                                        </div>
                                        <ScrollArea className="flex-1 bg-white rounded-xl border border-gray-100 p-3">
                                            <div className="space-y-3">
                                                {roomLogs.length > 0 ? roomLogs.map((log: any) => (
                                                    <div key={log.id} className="text-[11px] border-b border-gray-50 pb-2 last:border-0 relative">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="font-bold text-gray-700 uppercase">
                                                                {log.order_item_step_id ? (
                                                                    <span className={log.action === 'failed' ? "text-red-500" : "text-blue-700"}>
                                                                        {log.action === 'failed' && <span className="mr-1">THẤT BẠI:</span>}
                                                                        {log.step_name}
                                                                    </span>
                                                                ) : (
                                                                    `${log.from_status || log.from_stage || 'START'} → ${log.to_status || log.to_stage}`
                                                                )}
                                                            </span>
                                                            <span className="text-[9px] text-gray-400 tabular-nums">{formatDateTime(log.created_at)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                                                            <div className="h-3 w-3 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[8px] font-bold">
                                                                {log.created_by_user?.name?.charAt(0) || '?'}
                                                            </div>
                                                            {log.created_by_user?.name || 'Hệ thống'}
                                                        </div>

                                                        {log.order_item_step_id && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="h-6 px-2 absolute top-1 right-1 text-[10px] text-primary hover:bg-primary/10 font-bold border border-primary/20 rounded-md"
                                                                onClick={() => {
                                                                    setSelectedLogDetail(log);
                                                                    setShowLogDetailDialog(true);
                                                                }}
                                                            >
                                                                <Maximize2 className="h-3 w-3 mr-1" />
                                                                Xem chi tiết
                                                            </Button>
                                                        )}
                                                    </div>
                                                )) : (
                                                    <div className="text-center py-8 text-gray-400 italic text-[11px]">Chưa có lịch sử thay đổi</div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </div>

                                    {/* Mark Failed Button - Only for Workflow stages */}
                                    {!isSalesStep && !isAftersale && !isCareFlow && (
                                        <div className="pt-4 mt-auto">
                                            <Button
                                                variant="outline"
                                                className="w-full h-10 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold gap-2 text-xs"
                                                onClick={() => {
                                                    toast.info("Vui lòng sử dụng nút 'Thất bại' bên ngoài Kanban để ghi nhận chi tiết.");
                                                }}
                                            >
                                                <XCircle className="h-4 w-4" />
                                                ĐÁNH DẤU THẤT BẠI
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

            <WorkflowLogDetailDialog 
                open={showLogDetailDialog} 
                onOpenChange={setShowLogDetailDialog} 
                log={selectedLogDetail} 
            />

            <UpsellDialog
                open={showUpsellDialog}
                onOpenChange={setShowUpsellDialog}
                orderId={order?.id || ''}
                preselectedProduct={product ? {
                    id: product.id,
                    name: productName,
                    type: (product as any).product_type || (product as any).type || (product as any).item_type || 'giày'
                } : null}
                onSuccess={async () => {
                    if (onReloadOrder) await onReloadOrder();
                }}
            />

            <Dialog open={!!mainPreviewUrl} onOpenChange={(open) => !open && setMainPreviewUrl(null)}>
                <DialogContent className="max-w-5xl p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
                    <DialogTitle className="sr-only">Xem phương tiện</DialogTitle>
                    {mainPreviewUrl && (
                        mainPreviewUrl.match(/\.(mp4|webm|ogg|mov|m4v)$|^data:video/i) || mainPreviewUrl.includes('/video/') ? (
                            <video src={mainPreviewUrl} controls autoPlay className="max-w-full max-h-[90vh] rounded-lg shadow-2xl bg-black" />
                        ) : (
                            <img src={mainPreviewUrl} alt="" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl bg-white" />
                        )
                    )}
                </DialogContent>
            </Dialog>
        </DialogContent>
    </Dialog>
);
}
