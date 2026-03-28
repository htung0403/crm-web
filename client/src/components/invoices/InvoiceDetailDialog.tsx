import React from 'react';
import { FileText, Calculator, XCircle, CheckCircle, Package, Gift, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';

export interface Invoice {
    id: string;
    invoice_code: string;
    order_id: string;
    customer_id: string;
    customer?: { id: string; name: string; phone: string; email?: string };
    order?: { id: string; order_code: string; items?: any[]; remaining_debt?: number };
    subtotal: number;
    discount: number;
    total_amount: number;
    payment_method: string;
    status: string;
    notes?: string;
    paid_at?: string;
    created_at: string;
    created_user?: { id: string; name: string };
    order_item_ids?: string[];
    order_product_service_ids?: string[];
    transactions?: any[];
}

interface InvoiceDetailDialogProps {
    invoice: Invoice | null;
    open: boolean;
    onClose: () => void;
    onStatusChange?: (id: string, status: string) => void;
    onPayButtonClick?: (invoice: Invoice) => void;
    canEdit?: boolean;
}

export function InvoiceDetailDialog({
    invoice,
    open,
    onClose,
    onStatusChange,
    onPayButtonClick,
    canEdit = false
}: InvoiceDetailDialogProps) {
    if (!invoice) return null;

    const receipts = invoice.transactions?.filter(t => t.id.startsWith('p-') || t.code?.startsWith('PT')) || [];
    const expenses = invoice.transactions?.filter(t => t.code?.startsWith('PC')) || [];

    const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'secondary' | 'info' }> = {
        draft: { label: 'Nháp', variant: 'secondary' },
        pending: { label: 'Chờ thanh toán', variant: 'warning' },
        paid: { label: 'Đã thanh toán', variant: 'success' },
        cancelled: { label: 'Đã hủy', variant: 'danger' }
    };

    const paymentMethodLabels: Record<string, string> = {
        cash: 'Tiền mặt',
        transfer: 'Chuyển khoản',
        zalopay: 'Zalo Pay'
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="font-bold">{invoice.invoice_code}</span>
                        <Badge variant={statusConfig[invoice.status]?.variant || 'secondary'}>
                            {statusConfig[invoice.status]?.label || invoice.status}
                        </Badge>
                    </DialogTitle>
                    <DialogDescription>Chi tiết hóa đơn</DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="bg-muted/50 p-1 mx-6 mt-2">
                        <TabsTrigger value="details" className="flex-1 text-xs sm:text-sm">Chi tiết</TabsTrigger>
                        <TabsTrigger value="receipts" className="flex-1 text-xs sm:text-sm">Phiếu thu ({receipts.length})</TabsTrigger>
                        <TabsTrigger value="expenses" className="flex-1 text-xs sm:text-sm">Phiếu chi ({expenses.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="details" className="flex-1 overflow-y-auto p-6 pt-2 space-y-4 outline-none">
                        {/* Customer Info */}
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                            <Avatar className="h-12 w-12">
                                <AvatarFallback className="bg-primary text-white">
                                    {invoice.customer?.name?.charAt(0) || 'K'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="font-semibold">{invoice.customer?.name || 'N/A'}</p>
                                <p className="text-sm text-muted-foreground">{invoice.customer?.phone || 'Không có SĐT'}</p>
                            </div>
                        </div>

                        {/* Order Info */}
                        {invoice.order && (
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex justify-between items-center">
                                <p className="text-sm text-blue-600 font-medium">
                                    Đơn hàng: {invoice.order.order_code}
                                </p>
                                {invoice.order.remaining_debt !== undefined && (
                                    <div className="text-right">
                                        <p className="text-[10px] text-blue-500 uppercase font-bold">Còn nợ đơn hàng</p>
                                        <p className="text-sm font-bold text-red-600">
                                            {formatCurrency(invoice.order.remaining_debt)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}


                        {/* Items Table */}
                        {invoice.order && (
                            <div className="space-y-4">
                                {(() => {
                                    const saleItems = invoice.order?.items || [];
                                    const products = (invoice.order as any).products || [];

                                    if (saleItems.length === 0 && products.length === 0) return null;

                                    return (
                                        <>
                                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                                <Package className="h-4 w-4" />
                                                Chi tiết sản phẩm/dịch vụ
                                            </p>
                                            <div className="border rounded-lg overflow-hidden overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-muted/50">
                                                        <tr>
                                                            <th className="text-left p-3 font-medium">Tên khoản mục</th>
                                                            <th className="text-center p-3 font-medium">SL</th>
                                                            <th className="text-right p-3 font-medium">Đơn giá</th>
                                                            <th className="text-right p-3 font-medium">Thành tiền</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {products.map((p: any, pIdx: number) => {
                                                            const services = p.services || [];
                                                            const servicesTotal = services.reduce((acc: number, s: any) => acc + (Number(s.unit_price) * (s.quantity || 1)), 0);
                                                            const productSurchargesTotal = Number(p.surcharge_amount) || 0;
                                                            const rowTotal = servicesTotal + productSurchargesTotal;

                                                            return (
                                                                <React.Fragment key={`p-${pIdx}`}>
                                                                    <tr className="bg-blue-50/50">
                                                                        <td className="p-3 font-bold text-blue-700">
                                                                            <div className="flex items-center gap-2">
                                                                                <Badge className="bg-blue-600">Sản phẩm khách</Badge>
                                                                                <span>{p.name}</span>
                                                                                <span className="text-[10px] font-normal opacity-70">({p.product_code})</span>
                                                                            </div>
                                                                            {p.surcharges && p.surcharges.length > 0 && (
                                                                                <div className="flex flex-wrap gap-1 mt-1 px-1">
                                                                                    {p.surcharges.map((sur: any, idx: number) => {
                                                                                        const amount = sur.isPercent ? (servicesTotal * Number(sur.value) / 100) : Number(sur.value);
                                                                                        return (
                                                                                            <Badge key={idx} variant="outline" className="text-[10px] py-0 h-4 bg-orange-50 text-orange-700 border-orange-200">
                                                                                                +{sur.label} {sur.isPercent ? `(${sur.value}%)` : ''}: {formatCurrency(amount)}
                                                                                            </Badge>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-3 text-center">1</td>
                                                                        <td className="p-3 text-right text-muted-foreground">—</td>
                                                                        <td className="p-3 text-right font-bold text-blue-700">
                                                                            {formatCurrency(rowTotal)}
                                                                        </td>
                                                                    </tr>
                                                                    {services.map((s: any, sIdx: number) => {
                                                                        const isPaidByThisInvoice = invoice.order_product_service_ids?.includes(s.id);
                                                                        const qty = s.quantity || 1;
                                                                        const unitPrice = Number(s.unit_price) || 0;
                                                                        const totalPrice = qty * unitPrice;

                                                                        return (
                                                                            <tr key={`s-${sIdx}`} className={cn("hover:bg-muted/30", !isPaidByThisInvoice && invoice.order_product_service_ids?.length && "opacity-50")}>
                                                                                <td className="p-3 pl-8">
                                                                                    <div className="flex flex-col">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Dịch vụ</Badge>
                                                                                            <span className="font-medium">{s.item_name}</span>
                                                                                        </div>
                                                                                        {s.surcharges && s.surcharges.length > 0 && (
                                                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                                                {s.surcharges.map((sur: any, idx: number) => {
                                                                                                    const amount = sur.isPercent ? (unitPrice * qty * Number(sur.value) / 100) : Number(sur.value);
                                                                                                    return (
                                                                                                        <Badge key={idx} variant="outline" className="text-[10px] py-0 h-4 bg-orange-50 text-orange-700 border-orange-200">
                                                                                                            +{sur.label} {sur.isPercent ? `(${sur.value}%)` : ''}: {formatCurrency(amount)}
                                                                                                        </Badge>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="p-3 text-center">{qty}</td>
                                                                                <td className="p-3 text-right text-muted-foreground">{formatCurrency(unitPrice)}</td>
                                                                                <td className="p-3 text-right font-semibold">{formatCurrency(totalPrice)}</td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </React.Fragment>
                                                            );
                                                        })}

                                                        {saleItems.length > 0 && (
                                                            <>
                                                                <tr className="bg-emerald-50/50">
                                                                    <td colSpan={4} className="p-3 font-bold text-emerald-700">
                                                                        Sản phẩm bán kèm / Voucher
                                                                    </td>
                                                                </tr>
                                                                {saleItems.map((item: any, i: number) => {
                                                                    const isPaidByThisInvoice = invoice.order_item_ids?.includes(item.id);
                                                                    const qty = item.quantity || 1;
                                                                    const unitPrice = Number(item.unit_price) || 0;
                                                                    const totalPrice = qty * unitPrice;

                                                                    return (
                                                                        <tr key={`sale-${i}`} className={cn("hover:bg-muted/30", !isPaidByThisInvoice && invoice.order_item_ids?.length && "opacity-50")}>
                                                                            <td className="p-3 pl-8">
                                                                                <div className="flex flex-col">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                                                                            {item.item_type === 'voucher' ? 'Voucher' : 'Sản phẩm'}
                                                                                        </Badge>
                                                                                        <span className="font-medium">{item.item_name}</span>
                                                                                    </div>
                                                                                    {item.surcharges && item.surcharges.length > 0 && (
                                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                                            {item.surcharges.map((sur: any, idx: number) => {
                                                                                                const amount = sur.isPercent ? (unitPrice * qty * Number(sur.value) / 100) : Number(sur.value);
                                                                                                return (
                                                                                                    <Badge key={idx} variant="outline" className="text-[10px] py-0 h-4 bg-orange-50 text-orange-700 border-orange-200">
                                                                                                        +{sur.label} {sur.isPercent ? `(${sur.value}%)` : ''}: {formatCurrency(amount)}
                                                                                                    </Badge>
                                                                                                );
                                                                                            })}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="p-3 text-center">{qty}</td>
                                                                            <td className="p-3 text-right text-muted-foreground">{formatCurrency(unitPrice)}</td>
                                                                            <td className="p-3 text-right font-semibold">{formatCurrency(totalPrice)}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Summary */}
                        <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/10 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Tạm tính:</span>
                                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
                            </div>
                            {invoice.discount > 0 && (
                                <div className="flex justify-between text-sm text-green-600">
                                    <span className="flex items-center gap-1">
                                        <Gift className="h-3.5 w-3.5" />
                                        Giảm giá:
                                    </span>
                                    <span className="font-medium">-{formatCurrency(invoice.discount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold pt-2 border-t border-primary/20">
                                <span>Tổng thanh toán:</span>
                                <span className="text-primary">{formatCurrency(invoice.total_amount)}</span>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">Ngày tạo</p>
                                <p className="font-medium">{formatDateTime(invoice.created_at)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Người tạo</p>
                                <p className="font-medium">{invoice.created_user?.name || 'N/A'}</p>
                            </div>
                        </div>

                        {/* Notes */}
                        {invoice.notes && (
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Ghi chú</p>
                                <p className="text-sm p-3 bg-muted/50 rounded-lg">{invoice.notes}</p>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="receipts" className="flex-1 overflow-y-auto p-6 pt-2 space-y-4 outline-none text-sm leading-relaxed">
                        <div className="space-y-3">
                            {receipts.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Calculator className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                    <p>Chưa có phiếu thu nào cho hóa đơn này</p>
                                </div>
                            ) : (
                                receipts.map((trans: any, i: number) => (
                                    <div key={i} className="p-4 rounded-xl border bg-card hover:border-primary/30 transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <Badge className="bg-green-100 text-green-700 border-green-200">
                                                    {trans.code || 'PT...'}
                                                </Badge>
                                                <span className="text-sm font-medium text-muted-foreground">
                                                    {formatDateTime(trans.created_at)}
                                                </span>
                                            </div>
                                            <span className="text-lg font-bold text-primary">
                                                {formatCurrency(trans.amount)}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p className="text-muted-foreground text-xs uppercase font-bold tracking-tight">Phương thức</p>
                                                <p className="font-medium">{paymentMethodLabels[trans.payment_method] || trans.payment_method || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground text-xs uppercase font-bold tracking-tight">Trạng thái</p>
                                                <Badge
                                                    variant={trans.status === 'approved' ? 'success' : 'secondary'}
                                                    className={cn(
                                                        "text-[10px] py-0 h-4",
                                                        trans.status === 'approved' ? "bg-green-50 text-green-700 border-green-200" : ""
                                                    )}
                                                >
                                                    {trans.status === 'approved' ? 'Đã duyệt' : trans.status}
                                                </Badge>
                                            </div>
                                        </div>
                                        {trans.description && (
                                            <div className="mt-2 pt-2 border-t text-xs text-muted-foreground italic">
                                                {trans.description}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="expenses" className="flex-1 overflow-y-auto p-6 pt-2 space-y-4 outline-none text-sm leading-relaxed">
                        <div className="space-y-3">
                            {expenses.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Calculator className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                    <p>Chưa có phiếu chi nào cho hóa đơn này</p>
                                </div>
                            ) : (
                                expenses.map((trans: any, i: number) => (
                                    <div key={i} className="p-4 rounded-xl border bg-card hover:border-red-300 transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <Badge className="bg-red-100 text-red-700 border-red-200">
                                                    {trans.code || 'PC...'}
                                                </Badge>
                                                <span className="text-sm font-medium text-muted-foreground">
                                                    {formatDateTime(trans.created_at)}
                                                </span>
                                            </div>
                                            <span className="text-lg font-bold text-red-600">
                                                -{formatCurrency(trans.amount)}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p className="text-muted-foreground text-xs uppercase font-bold tracking-tight">Phương thức</p>
                                                <p className="font-medium">{paymentMethodLabels[trans.payment_method] || trans.payment_method || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground text-xs uppercase font-bold tracking-tight">Trạng thái</p>
                                                <Badge
                                                    variant={trans.status === 'approved' ? 'success' : 'secondary'}
                                                    className={cn(
                                                        "text-[10px] py-0 h-4",
                                                        trans.status === 'approved' ? "bg-green-50 text-green-700 border-green-200" : ""
                                                    )}
                                                >
                                                    {trans.status === 'approved' ? 'Đã duyệt' : trans.status}
                                                </Badge>
                                            </div>
                                        </div>
                                        {trans.description && (
                                            <div className="mt-2 pt-2 border-t text-xs text-muted-foreground italic">
                                                {trans.description}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Actions */}
                {canEdit && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                    <div className="flex gap-2 pt-4 border-t px-6 pb-4">
                        <Button
                            variant="outline"
                            className="flex-1 text-red-600 hover:bg-red-50"
                            onClick={() => {
                                onStatusChange?.(invoice.id, 'cancelled');
                                onClose();
                            }}
                        >
                            <XCircle className="h-4 w-4 mr-2" />
                            Hủy hóa đơn
                        </Button>
                        <Button
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={() => {
                                onPayButtonClick?.(invoice);
                                onClose();
                            }}
                        >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Xác nhận thanh toán
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
