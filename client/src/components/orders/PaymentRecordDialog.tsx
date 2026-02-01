import { useState, useRef } from 'react';
import { Loader2, Upload, X, CreditCard, Banknote, Smartphone, ImagePlus, CheckCircle2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { ordersApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { uploadFile } from '@/lib/supabase';

interface PaymentRecordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string;
    orderCode: string;
    remainingDebt: number;
    onSuccess: () => void;
}

const PAYMENT_METHODS = [
    { value: 'cash', label: 'Tiền mặt', icon: Banknote },
    { value: 'transfer', label: 'Chuyển khoản', icon: Smartphone },
    { value: 'card', label: 'Thẻ', icon: CreditCard },
] as const;

const CONTENT_SUGGESTIONS = [
    'Đặt cọc',
    'Thanh toán đợt 1',
    'Thanh toán đợt 2',
    'Thanh toán hết',
    'Thanh toán một phần',
];

export function PaymentRecordDialog({
    open,
    onOpenChange,
    orderId,
    orderCode,
    remainingDebt,
    onSuccess,
}: PaymentRecordDialogProps) {
    const [content, setContent] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');
    const [imageUrl, setImageUrl] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Format input currency
    const formatInputCurrency = (value: number): string => {
        if (value === 0) return '';
        return value.toLocaleString('vi-VN');
    };

    const parseInputCurrency = (value: string): number => {
        const cleaned = value.replace(/[^\d]/g, '');
        return parseInt(cleaned) || 0;
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Vui lòng chọn file ảnh');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Kích thước ảnh không được vượt quá 5MB');
            return;
        }

        setUploading(true);
        try {
            const { url, error } = await uploadFile('payment-proofs', `orders/${orderId}`, file);

            if (error) {
                throw error;
            }

            if (url) {
                setImageUrl(url);
                toast.success('Tải ảnh lên thành công');
            }
        } catch (error: any) {
            toast.error('Lỗi khi tải ảnh lên: ' + (error.message || 'Vui lòng thử lại'));
        } finally {
            setUploading(false);
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleRemoveImage = () => {
        setImageUrl('');
    };

    const handleSubmit = async () => {
        if (!content.trim()) {
            toast.error('Vui lòng nhập nội dung thanh toán');
            return;
        }

        if (amount <= 0) {
            toast.error('Số tiền phải lớn hơn 0');
            return;
        }

        setLoading(true);
        try {
            await ordersApi.createPayment(orderId, {
                content: content.trim(),
                amount,
                payment_method: paymentMethod,
                image_url: imageUrl || undefined,
                notes: notes || undefined,
            });

            toast.success(`Đã ghi nhận thanh toán ${formatCurrency(amount)}`);
            onSuccess();
            handleClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi tạo thanh toán');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setContent('');
        setAmount(0);
        setPaymentMethod('cash');
        setImageUrl('');
        setNotes('');
        onOpenChange(false);
    };

    const handlePayFull = () => {
        setAmount(remainingDebt);
        setContent('Thanh toán hết');
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                            <CreditCard className="h-5 w-5 text-green-600" />
                        </div>
                        Ghi nhận thanh toán
                    </DialogTitle>
                    <DialogDescription>
                        Đơn hàng: <span className="font-semibold text-foreground">{orderCode}</span>
                        <br />
                        Còn nợ: <span className="font-semibold text-red-600">{formatCurrency(remainingDebt)}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Content */}
                    <div className="space-y-2">
                        <Label>Nội dung thanh toán *</Label>
                        <Input
                            placeholder="VD: Đặt cọc, Thanh toán đợt 1..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-1">
                            {CONTENT_SUGGESTIONS.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => setContent(suggestion)}
                                    className="px-2 py-1 text-xs rounded-full bg-muted hover:bg-muted/80 transition-colors"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                        <Label>Số tiền *</Label>
                        <div className="relative">
                            <Input
                                type="text"
                                placeholder="0"
                                value={formatInputCurrency(amount)}
                                onChange={(e) => setAmount(parseInputCurrency(e.target.value))}
                                className="pr-16"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                VNĐ
                            </span>
                        </div>
                        {remainingDebt > 0 && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handlePayFull}
                                className="text-green-600 border-green-200 hover:bg-green-50"
                            >
                                Thanh toán hết ({formatCurrency(remainingDebt)})
                            </Button>
                        )}
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-2">
                        <Label>Phương thức thanh toán</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {PAYMENT_METHODS.map((method) => {
                                const Icon = method.icon;
                                return (
                                    <button
                                        key={method.value}
                                        type="button"
                                        onClick={() => setPaymentMethod(method.value)}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${paymentMethod === method.value
                                            ? 'border-primary bg-primary/5'
                                            : 'border-muted hover:border-muted-foreground/30'
                                            }`}
                                    >
                                        <Icon className={`h-5 w-5 ${paymentMethod === method.value ? 'text-primary' : 'text-muted-foreground'}`} />
                                        <span className={`text-xs ${paymentMethod === method.value ? 'font-medium' : ''}`}>
                                            {method.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Payment Verification - Image Upload */}
                    <div className="space-y-2">
                        <Label>Xác minh thanh toán</Label>
                        {/* Hidden file input for gallery */}
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            ref={fileInputRef}
                            className="hidden"
                        />
                        {/* Hidden file input for camera */}
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileUpload}
                            id="cameraInput"
                            className="hidden"
                        />

                        {!imageUrl ? (
                            <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${uploading ? 'opacity-50' : ''}`}>
                                {uploading ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground">Đang tải ảnh lên...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                            <ImagePlus className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Tải ảnh chứng từ</p>
                                            <p className="text-xs text-muted-foreground">QR code, biên lai, ảnh chuyển khoản...</p>
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={uploading}
                                            >
                                                <Upload className="h-4 w-4 mr-2" />
                                                Chọn ảnh
                                            </Button>
                                            {/* Camera button - only visible on mobile */}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => document.getElementById('cameraInput')?.click()}
                                                disabled={uploading}
                                                className="md:hidden text-blue-600 border-blue-200 hover:bg-blue-50"
                                            >
                                                <Camera className="h-4 w-4 mr-2" />
                                                Chụp ảnh
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="border rounded-lg p-3 bg-green-50/50 border-green-200">
                                    <div className="flex items-start gap-3">
                                        <img
                                            src={imageUrl}
                                            alt="Payment proof"
                                            className="h-24 w-24 object-cover rounded-lg border shadow-sm"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 text-green-600 mb-1">
                                                <CheckCircle2 className="h-4 w-4" />
                                                <span className="text-sm font-medium">Đã tải lên</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mb-2">
                                                Ảnh xác minh thanh toán đã được lưu
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    disabled={uploading}
                                                >
                                                    Đổi ảnh
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleRemoveImage}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <X className="h-4 w-4 mr-1" />
                                                    Xóa
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>Ghi chú</Label>
                        <Textarea
                            placeholder="Ghi chú thêm..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="resize-none"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={loading || uploading}>
                        Hủy
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || uploading || !content.trim() || amount <= 0}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Xác nhận thanh toán
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
