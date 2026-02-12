import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    ShoppingBag, Tag, FileText, Package, Truck, Wrench,
    User as UserIcon, CheckCircle2, MessageSquare, Receipt,
    History, Save, Loader2, Heart, ShieldCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProductChat } from '@/components/orders/workflow/ProductChat';
import type { Order, OrderItem } from '@/hooks/useOrders';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';

interface ProductDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    group: { product: OrderItem | null; services: OrderItem[] } | null;
    roomId: string;
    currentUserId?: string;
    order?: Order | null;
    onUpdateOrder?: (patch: Partial<Order>) => Promise<void>;
}

export function ProductDetailDialog({
    open,
    onOpenChange,
    group,
    roomId,
    currentUserId,
    order,
    onUpdateOrder
}: ProductDetailDialogProps) {
    if (!group) return null;

    const [activeImageIdx, setActiveImageIdx] = useState(0);
    const [saving, setSaving] = useState(false);

    // Local form state
    const [formData, setFormData] = useState<Partial<Order>>({});

    // Reset/Initialize form data when order or roomId changes
    useEffect(() => {
        if (order) {
            setFormData({
                debt_checked: order.debt_checked || false,
                debt_checked_notes: order.debt_checked_notes || '',
                delivery_carrier: order.delivery_carrier || '',
                delivery_address: order.delivery_address || '',
                delivery_notes: order.delivery_notes || '',
                hd_sent: order.hd_sent || false,
                feedback_requested: order.feedback_requested || false,
                notes: order.notes || '',
            });
        }
    }, [order, open]);

    const product = group.product;
    const services = group.services;
    const productName = product?.item_name ?? services[0]?.item_name ?? '—';
    const productItem = product as any;

    // Build image list based on stage
    const productImages = [...(productItem?.product_images ?? (productItem?.product?.image ? [productItem.product.image] : []))];

    if (order?.completion_photos && (roomId.startsWith('after1') || roomId.startsWith('after4'))) {
        order.completion_photos.forEach(img => {
            if (img && !productImages.includes(img)) productImages.push(img);
        });
    }

    if (order?.packaging_photos && (roomId.startsWith('after2') || roomId.startsWith('after4'))) {
        order.packaging_photos.forEach(img => {
            if (img && !productImages.includes(img)) productImages.push(img);
        });
    }

    const entityId = product?.id ?? services[0]?.id;
    const entityType = product ? 'order_product' : 'order_item';
    const isAftersale = roomId.startsWith('after');
    const isCareFlow = roomId.startsWith('care') || roomId.startsWith('war');

    const handleSave = async () => {
        if (!onUpdateOrder) return;
        setSaving(true);
        try {
            await onUpdateOrder(formData);
            toast.success('Đã cập nhật thông tin thành công');
        } catch (error: any) {
            toast.error(error?.message || 'Lỗi khi cập nhật thông tin');
        } finally {
            setSaving(false);
        }
    };

    const getStageTitle = () => {
        if (roomId.startsWith('after')) {
            switch (roomId) {
                case 'after1': return 'Kiểm nợ & Ảnh hoàn thiện';
                case 'after2': return 'Đóng gói & Giao hàng';
                case 'after3': return 'Nhắn HD & Feedback';
                case 'after4': return 'Lưu Trữ';
                default: return 'Sau bán hàng';
            }
        }
        if (roomId.startsWith('war')) return 'Quy trình Bảo hành';
        if (roomId.startsWith('care')) return 'Chăm sóc khách hàng';
        return 'Chi tiết sản phẩm';
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden flex flex-col h-[90vh]">
                <DialogHeader className="p-6 pb-2">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                <ShoppingBag className="h-6 w-6 text-primary" />
                                {productName}
                            </DialogTitle>
                            <DialogDescription>
                                {isAftersale || isCareFlow ? getStageTitle() : 'Thông tin chi tiết sản phẩm và trao đổi nội bộ'}
                            </DialogDescription>
                        </div>
                        {product?.status && (
                            <Badge variant="outline" className="capitalize">
                                {product.status}
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                <div className="flex-1 flex flex-col md:flex-row overflow-hidden border-t">
                    {/* Product Info - Left Side */}
                    <ScrollArea className="flex-1 p-6 md:max-w-[50%] border-r">
                        <div className="space-y-6">
                            {productImages?.length > 0 && (
                                <div className="space-y-3">
                                    <div className="rounded-xl overflow-hidden border bg-gray-50 aspect-video relative group">
                                        <img
                                            src={productImages[activeImageIdx]}
                                            alt={`${productName}-${activeImageIdx}`}
                                            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                                        />
                                    </div>
                                    {productImages.length > 1 && (
                                        <div className="flex flex-wrap gap-2">
                                            {productImages.map((img: string, idx: number) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setActiveImageIdx(idx)}
                                                    className={cn(
                                                        "w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                                                        activeImageIdx === idx ? "border-primary ring-2 ring-primary/20 scale-95" : "border-transparent opacity-60 hover:opacity-100"
                                                    )}
                                                >
                                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-4">
                                <h3 className="font-semibold text-xs uppercase tracking-[0.2em] text-gray-400">Thông tin chi tiết</h3>
                                <div className="grid grid-cols-1 gap-4 text-sm bg-gray-50/50 p-4 rounded-xl border border-gray-100">
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

                            <div className="space-y-4">
                                <h3 className="font-semibold text-xs uppercase tracking-[0.2em] text-gray-400">Dịch vụ yêu cầu</h3>
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
                        </div>
                    </ScrollArea>

                    {/* Contextual Right Sidebar */}
                    <div className="flex-1 flex flex-col p-6 bg-gray-50/40 min-h-0">
                        {isAftersale && order ? (
                            <div className="flex-1 flex flex-col gap-6">
                                {/* Only show Payment info in after1 and after4 */}
                                {(roomId.startsWith('after1') || roomId.startsWith('after4')) && (
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-xs uppercase tracking-[0.2em] text-purple-800">Thông tin thanh toán</h3>

                                        <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm space-y-5">
                                            <div className="flex justify-between items-center bg-purple-50/50 p-3 rounded-xl border border-purple-50">
                                                <span className="text-xs font-semibold text-purple-700">NGƯỜI TRẢ ĐỒ:</span>
                                                <Badge className="bg-purple-600 font-bold hover:bg-purple-700 transition-colors">
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
                                                <div className="pt-4 mt-2 border-t-2 border-dashed border-purple-100">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm font-black text-purple-900 uppercase tracking-tight">Cần thu:</span>
                                                        <span className="font-black text-2xl text-red-600">
                                                            {formatCurrency(order.remaining_debt ?? (order.total_amount - (order.paid_amount || 0)))}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {roomId.startsWith('after1') && (
                                            <div className="space-y-3 pt-2">
                                                <div className="flex items-center space-x-2 bg-white p-4 rounded-xl border shadow-sm">
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
                                                        className="bg-white"
                                                        value={formData.debt_checked_notes || ''}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, debt_checked_notes: e.target.value }))}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Delivery Info in after2 and after4 */}
                                {(roomId.startsWith('after2') || roomId.startsWith('after4')) && (
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-xs uppercase tracking-[0.2em] text-blue-800">Giao hàng</h3>
                                        <div className="bg-white p-5 rounded-2xl border border-blue-50 shadow-sm space-y-4">
                                            {roomId.startsWith('after2') ? (
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold text-gray-500">ĐƠN VỊ VẬN CHUYỂN</Label>
                                                        <Input
                                                            placeholder="VD: GHTK, Viettel Post..."
                                                            value={formData.delivery_carrier || ''}
                                                            onChange={(e) => setFormData(prev => ({ ...prev, delivery_carrier: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold text-gray-500">ĐỊA CHỈ GIAO HÀNG</Label>
                                                        <Input
                                                            placeholder="Địa chỉ nhận đồ của khách..."
                                                            value={formData.delivery_address || ''}
                                                            onChange={(e) => setFormData(prev => ({ ...prev, delivery_address: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold text-gray-500">GHI CHÚ GIAO HÀNG</Label>
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
                                        </div>
                                    </div>
                                )}

                                {/* Feedback & HD status in after3 and after4 */}
                                {(roomId.startsWith('after3') || roomId.startsWith('after4')) && (
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-xs uppercase tracking-[0.2em] text-green-800">HD & Phản hồi</h3>
                                        <div className="space-y-3">
                                            <div className="bg-white p-4 rounded-xl border border-green-50 shadow-sm flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Receipt className={cn("h-5 w-5", formData.hd_sent ? "text-green-600" : "text-gray-300")} />
                                                    <Label htmlFor="hd_sent" className="text-sm font-medium cursor-pointer">Đã gửi HD (Invoice)</Label>
                                                </div>
                                                {roomId.startsWith('after3') ? (
                                                    <Checkbox
                                                        id="hd_sent"
                                                        checked={formData.hd_sent}
                                                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hd_sent: !!checked }))}
                                                    />
                                                ) : (
                                                    <Badge variant="outline" className="bg-green-50 text-green-700">{order.hd_sent ? 'Đã gửi' : 'Chưa gửi'}</Badge>
                                                )}
                                            </div>

                                            <div className="bg-white p-4 rounded-xl border border-green-50 shadow-sm flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <MessageSquare className={cn("h-5 w-5", formData.feedback_requested ? "text-green-600" : "text-gray-300")} />
                                                    <Label htmlFor="fb_req" className="text-sm font-medium cursor-pointer">Yêu cầu Feedback</Label>
                                                </div>
                                                {roomId.startsWith('after3') ? (
                                                    <Checkbox
                                                        id="fb_req"
                                                        checked={formData.feedback_requested}
                                                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, feedback_requested: !!checked }))}
                                                    />
                                                ) : (
                                                    <Badge variant="outline" className="bg-green-50 text-green-700">{order.feedback_requested ? 'Đã gửi' : 'Chưa gửi'}</Badge>
                                                )}
                                            </div>
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
                            <div className="flex-1 flex flex-col gap-6">
                                <div className="space-y-4">
                                    <h3 className={cn(
                                        "font-semibold text-xs uppercase tracking-[0.2em] mb-4",
                                        roomId.startsWith('war') ? "text-red-700" : "text-teal-700"
                                    )}>
                                        {roomId.startsWith('war') ? 'Trình trạng Bảo hành' : 'Trình trạng Chăm sóc'}
                                    </h3>

                                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                                            {roomId.startsWith('war') ? (
                                                <ShieldCheck className="h-5 w-5 text-red-500" />
                                            ) : (
                                                <Heart className="h-5 w-5 text-teal-500" />
                                            )}
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">TRẠNG THÁI HIỆN TẠI</span>
                                                <span className="text-sm font-black text-gray-800 capitalize">{(order as any).care_warranty_stage || 'N/A'}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Ghi chú tiến độ</Label>
                                            <Textarea
                                                placeholder="Nhập ghi chú cập nhật tiến độ chăm sóc/bảo hành..."
                                                className="bg-gray-50/50 min-h-[120px]"
                                                value={formData.notes || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                            />
                                        </div>

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
                                </div>

                                <div className="mt-auto bg-gray-100/50 p-4 rounded-xl space-y-3">
                                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">
                                        <History className="h-3 w-3" /> Tóm tắt đơn hàng
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-1">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-gray-400 font-bold tracking-tight">NGÀY HOÀN THÀNH</span>
                                            <span className="text-xs font-bold text-gray-600 tabular-nums">{order.completed_at ? formatDateTime(order.completed_at) : '—'}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-gray-400 font-bold tracking-tight">TỔNG THANH TOÁN</span>
                                            <span className="text-xs font-bold text-gray-600 tabular-nums">{formatCurrency(order.total_amount)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col gap-4 min-h-0">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-semibold text-xs uppercase tracking-[0.2em] text-gray-400">Trao đổi nội bộ</h3>
                                    <Badge variant="secondary" className="text-[10px] px-2 py-0 font-bold">
                                        PHÒNG {roomId.toUpperCase()}
                                    </Badge>
                                </div>

                                {entityId && (
                                    <ProductChat
                                        entityId={entityId}
                                        entityType={entityType}
                                        roomId={roomId}
                                        currentUserId={currentUserId}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
