import { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Receipt, X, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Order } from '@/hooks/useOrders';
import { getPaymentConfig, isPaymentConfigured } from '@/lib/paymentConfig';
import { buildVietQrPayload } from '@/lib/vietqr';
import {
    buildThermalInvoicePreviewHtml,
    formatThermalMoney,
    getOrderPayAmount,
    printThermalInvoice,
} from '@/lib/thermalInvoicePrint';

interface PrintThermalInvoiceDialogProps {
    order: Order | null;
    open: boolean;
    onClose: () => void;
}

export function PrintThermalInvoiceDialog({ order, open, onClose }: PrintThermalInvoiceDialogProps) {
    const config = getPaymentConfig();
    const payAmount = order ? getOrderPayAmount(order) : 0;
    const configured = isPaymentConfigured();

    const qrPayload = useMemo(() => {
        if (!order || !configured || payAmount <= 0) return '';
        return buildVietQrPayload({
            bankBin: config.bankBin,
            accountNumber: config.accountNumber,
            amount: payAmount,
            description: order.order_code,
            merchantName: config.accountName,
        });
    }, [order, configured, payAmount, config]);

    const previewHtml = useMemo(() => {
        if (!order) return '';
        return buildThermalInvoicePreviewHtml(order, config);
    }, [order, config]);

    if (!order) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-primary" />
                        In hóa đơn — {order.order_code}
                    </DialogTitle>
                </DialogHeader>

                <p className="text-xs text-muted-foreground">
                    Mẫu XOXO 80mm (ZyWell Zy303). VietQR in kèm khi còn số tiền thanh toán.
                </p>

                {!configured && payAmount > 0 && (
                    <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium">Chưa cấu hình tài khoản nhận tiền</p>
                            <p className="text-xs mt-1 opacity-90">
                                Cấu hình <code className="bg-amber-100 px-1 rounded">VITE_PAYMENT_*</code> trong{' '}
                                <code className="bg-amber-100 px-1 rounded">client/.env</code>, lưu file và khởi động
                                lại dev server.
                            </p>
                        </div>
                    </div>
                )}

                <div className="mx-auto border rounded-lg bg-gray-50 shadow-inner overflow-hidden flex flex-col items-center">
                    <div
                        className="overflow-y-auto max-h-[55vh] bg-white"
                        style={{ width: '72mm', maxWidth: '100%' }}
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                    {qrPayload && (
                        <div className="border-t p-3 bg-muted/30 text-center">
                            <p className="text-xs font-bold mb-1">Xem trước QR thanh toán</p>
                            <QRCodeSVG value={qrPayload} size={120} level="M" className="mx-auto" />
                            <p className="text-sm font-bold mt-1">{formatThermalMoney(payAmount)}</p>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
                        <X className="h-4 w-4 mr-2" />
                        Đóng
                    </Button>
                    <Button className="flex-1" onClick={() => printThermalInvoice(order)}>
                        <Printer className="h-4 w-4 mr-2" />
                        In hóa đơn
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

