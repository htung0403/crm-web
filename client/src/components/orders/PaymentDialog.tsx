import { useState } from 'react';
import { CreditCard, Loader2, Banknote, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatCurrency } from '@/lib/utils';
import { invoicesApi } from '@/lib/api';
import type { Order } from '@/hooks/useOrders';

interface PaymentDialogProps {
    order: Order | null;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function PaymentDialog({
    order,
    open,
    onClose,
    onSuccess
}: PaymentDialogProps) {
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!order) return null;

    const paymentMethods = [
        { value: 'cash', label: 'Tiền mặt', icon: Banknote, color: 'text-green-600 bg-green-50 border-green-200' },
        { value: 'transfer', label: 'Chuyển khoản', icon: Wallet, color: 'text-blue-600 bg-blue-50 border-blue-200' },
        { value: 'card', label: 'Thẻ', icon: CreditCard, color: 'text-purple-600 bg-purple-50 border-purple-200' }
    ];

    const handlePayment = async () => {
        setSubmitting(true);
        try {
            // Create invoice
            const invoiceResponse = await invoicesApi.create({
                order_id: order.id,
                payment_method: paymentMethod,
                notes: notes || undefined
            });

            // Mark invoice as paid
            const invoice = invoiceResponse.data.data?.invoice;
            if (invoice) {
                await invoicesApi.updateStatus(invoice.id, 'paid');
            }

            onSuccess();
            onClose();
            // Reset form
            setPaymentMethod('cash');
            setNotes('');
        } catch (error: any) {
            throw error;
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-primary" />
                        Thanh toán đơn hàng
                    </DialogTitle>
                    <DialogDescription>
                        Xác nhận thanh toán và tạo hóa đơn
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Order Info */}
                    <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/20">
                        <div className="flex items-center gap-3 mb-3">
                            <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-primary text-white text-sm">
                                    {order.customer?.name?.charAt(0) || 'K'}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-semibold">{order.customer?.name}</p>
                                <p className="text-sm text-muted-foreground">{order.order_code}</p>
                            </div>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-primary/20">
                            <span className="text-muted-foreground">Tổng thanh toán:</span>
                            <span className="text-2xl font-bold text-primary">
                                {formatCurrency(order.total_amount)}
                            </span>
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-2">
                        <Label>Phương thức thanh toán</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {paymentMethods.map((method) => {
                                const Icon = method.icon;
                                const isSelected = paymentMethod === method.value;
                                return (
                                    <button
                                        key={method.value}
                                        type="button"
                                        onClick={() => setPaymentMethod(method.value as typeof paymentMethod)}
                                        className={`p-3 rounded-xl border-2 transition-all ${isSelected
                                            ? `${method.color} border-current`
                                            : 'bg-white border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <Icon className={`h-6 w-6 mx-auto mb-1 ${isSelected ? '' : 'text-gray-400'}`} />
                                        <p className={`text-xs font-medium ${isSelected ? '' : 'text-gray-500'}`}>
                                            {method.label}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>Ghi chú (tùy chọn)</Label>
                        <textarea
                            className="w-full min-h-[60px] px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                            placeholder="Nhập ghi chú thanh toán..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={submitting}>
                        Hủy
                    </Button>
                    <Button onClick={handlePayment} disabled={submitting} className="gap-2">
                        {submitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                <CreditCard className="h-4 w-4" />
                                Xác nhận thanh toán
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
