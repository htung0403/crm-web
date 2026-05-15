import { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Receipt, X, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import type { Order } from '@/hooks/useOrders';
import { getPaymentConfig, isPaymentConfigured } from '@/lib/paymentConfig';
import { buildVietQrPayload } from '@/lib/vietqr';
import { getOrderPayAmount, printThermalInvoice } from '@/lib/thermalInvoicePrint';

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
                    Khổ giấy 80mm (ZyWell Zy303 / ESC-POS). QR VietQR gồm số tiền cần thanh toán.
                </p>

                {!configured && (
                    <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium">Chưa cấu hình tài khoản nhận tiền</p>
                            <p className="text-xs mt-1 opacity-90">
                                Thêm vào <code className="bg-amber-100 px-1 rounded">client/.env</code>:
                                VITE_PAYMENT_BANK_BIN, VITE_PAYMENT_ACCOUNT_NUMBER,
                                VITE_PAYMENT_ACCOUNT_NAME, VITE_COMPANY_NAME — sau đó{' '}
                                <strong>lưu file</strong> và <strong>khởi động lại</strong>{' '}
                                <code className="bg-amber-100 px-1 rounded">npm run dev</code> (Vite chỉ đọc .env khi start).
                            </p>
                        </div>
                    </div>
                )}

                {/* Preview 80mm */}
                <div
                    className="mx-auto border rounded-lg bg-white text-black p-3 font-mono text-[11px] leading-snug shadow-inner"
                    style={{ width: '72mm', maxWidth: '100%' }}
                >
                    <p className="text-center font-bold text-[13px]">{config.companyName}</p>
                    {config.companyAddress && (
                        <p className="text-center text-[10px] text-gray-600">{config.companyAddress}</p>
                    )}
                    <div className="border-t border-dashed border-gray-400 my-2" />
                    <p className="text-center font-bold">HÓA ĐƠN BÁN HÀNG</p>
                    <div className="border-t border-dashed border-gray-400 my-2" />
                    <div className="flex justify-between">
                        <span>Mã đơn</span>
                        <span className="font-bold">{order.order_code}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Khách</span>
                        <span className="truncate max-w-[140px]">{order.customer?.name || '—'}</span>
                    </div>
                    <div className="border-t border-dashed border-gray-400 my-2" />
                    {(order.items || []).slice(0, 5).map((item: { id?: string; item_name?: string; total_price?: number }) => (
                        <div key={item.id} className="mb-1">
                            <p className="font-semibold truncate">{item.item_name}</p>
                            <p className="text-right">{formatCurrency(item.total_price ?? 0)}</p>
                        </div>
                    ))}
                    {(order.items?.length ?? 0) > 5 && (
                        <p className="text-center text-gray-500">… và {(order.items?.length ?? 0) - 5} dòng khác</p>
                    )}
                    <div className="border-t border-dashed border-gray-400 my-2" />
                    <div className="flex justify-between font-bold">
                        <span>TỔNG</span>
                        <span>{formatCurrency(order.total_amount)}</span>
                    </div>
                    {payAmount > 0 && (
                        <div className="flex justify-between font-bold text-emerald-700">
                            <span>CÒN TT</span>
                            <span>{formatCurrency(payAmount)}</span>
                        </div>
                    )}

                    {qrPayload && (
                        <>
                            <div className="border-t border-dashed border-gray-400 my-2" />
                            <p className="text-center font-bold">QUÉT MÃ THANH TOÁN</p>
                            <p className="text-center text-base font-bold my-1">{formatCurrency(payAmount)}</p>
                            <div className="flex justify-center my-2">
                                <QRCodeSVG value={qrPayload} size={168} level="M" />
                            </div>
                            <p className="text-center text-[10px]">{config.bankName}</p>
                            <p className="text-center text-[10px]">{config.accountNumber}</p>
                            <p className="text-center text-[10px] text-gray-600">ND: {order.order_code}</p>
                        </>
                    )}
                </div>

                <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
                        <X className="h-4 w-4 mr-2" />
                        Đóng
                    </Button>
                    <Button
                        className="flex-1"
                        onClick={() => {
                            printThermalInvoice(order);
                        }}
                    >
                        <Printer className="h-4 w-4 mr-2" />
                        In hóa đơn
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
