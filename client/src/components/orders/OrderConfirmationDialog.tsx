import { useState } from 'react';
import {
    CheckCircle2,
    XCircle,
    Printer,
    Phone,
    User,
    Package,
    CalendarCheck,
    Loader2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Order {
    id: string;
    order_code: string;
    status: string;
    total_amount: number;
    discount?: number;
    subtotal?: number;
    paid_amount?: number;
    customer?: {
        id: string;
        name: string;
        phone: string;
        email?: string;
    };
    items?: {
        id: string;
        item_name: string;
        quantity: number;
        unit_price: number;
        total_price: number;
        item_type: string;
    }[];
}

interface OrderConfirmationDialogProps {
    open: boolean;
    onClose: () => void;
    order: Order | null;
    onConfirm: () => void;
    onPrint?: () => void;
}

export function OrderConfirmationDialog({
    open,
    onClose,
    order,
    onConfirm,
    onPrint
}: OrderConfirmationDialogProps) {
    const [confirming, setConfirming] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    if (!order) return null;

    const handleConfirm = async () => {
        setConfirming(true);
        try {
            await api.patch(`/orders/${order.id}/status`, { status: 'confirmed' });
            toast.success('Đơn hàng đã được xác nhận!');
            onConfirm();
            onClose();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi xác nhận đơn hàng');
        } finally {
            setConfirming(false);
        }
    };

    const handleCancel = async () => {
        setCancelling(true);
        try {
            await api.patch(`/orders/${order.id}/status`, { status: 'cancelled' });
            toast.info('Đơn hàng đã bị hủy');
            onClose();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi hủy đơn hàng');
        } finally {
            setCancelling(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="flex items-center justify-center mb-4">
                        <div className="p-4 rounded-full bg-green-100">
                            <CheckCircle2 className="h-10 w-10 text-green-600" />
                        </div>
                    </div>
                    <DialogTitle className="text-center text-xl">
                        Đơn hàng đã được tạo!
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Bạn có muốn xác nhận đơn hàng này không?
                    </DialogDescription>
                </DialogHeader>

                {/* Order Summary */}
                <div className="space-y-4 py-4">
                    {/* Order Code */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" />
                            <span className="font-medium">Mã đơn hàng</span>
                        </div>
                        <Badge variant="secondary" className="text-lg font-mono">
                            {order.order_code}
                        </Badge>
                    </div>

                    {/* Customer Info */}
                    {order.customer && (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <User className="h-4 w-4" />
                                <span>Khách hàng</span>
                            </div>
                            <div className="text-right">
                                <p className="font-medium">{order.customer.name}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {order.customer.phone}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Items Summary */}
                    {order.items && order.items.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                                {order.items.length} sản phẩm/dịch vụ
                            </p>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {order.items.slice(0, 3).map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="truncate flex-1">{item.item_name} x{item.quantity}</span>
                                        <span className="font-medium ml-2">{formatCurrency(item.total_price)}</span>
                                    </div>
                                ))}
                                {order.items.length > 3 && (
                                    <p className="text-xs text-muted-foreground text-center">
                                        và {order.items.length - 3} sản phẩm khác...
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Total */}
                    <div className="flex items-center justify-between pt-3 border-t">
                        <span className="font-semibold">Tổng thanh toán</span>
                        <span className="text-xl font-bold text-primary">
                            {formatCurrency(order.total_amount)}
                        </span>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    {/* Cancel Order Button */}
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                        disabled={confirming || cancelling}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                        {cancelling ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <XCircle className="h-4 w-4 mr-2" />
                        )}
                        Hủy đơn
                    </Button>

                    {/* Print Button */}
                    {onPrint && (
                        <Button
                            variant="outline"
                            onClick={onPrint}
                            disabled={confirming || cancelling}
                        >
                            <Printer className="h-4 w-4 mr-2" />
                            In phiếu
                        </Button>
                    )}

                    {/* Confirm Button */}
                    <Button
                        onClick={handleConfirm}
                        disabled={confirming || cancelling}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {confirming ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <CalendarCheck className="h-4 w-4 mr-2" />
                        )}
                        Xác nhận đơn
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
