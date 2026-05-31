import { useEffect, useMemo, useState } from 'react';
import { Loader2, Wallet, Banknote, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import { CustomerOrderPaymentDetailDialog } from './CustomerOrderPaymentDetailDialog';
import { CustomerCollectPaymentConfirmDialog } from './CustomerCollectPaymentConfirmDialog';

export type CustomerDebtProductRow = {
    id: string;
    product_code: string;
    name: string;
    image_url: string | null;
    total_amount: number;
    deposit_amount: number;
    paid_amount?: number;
    remaining_debt?: number;
};

export interface CustomerDebtOrderRow {
    id: string;
    order_code: string;
    created_at: string;
    total_amount: number;
    paid_amount: number;
    deposit_amount: number;
    remaining_debt: number;
    products?: CustomerDebtProductRow[];
}

interface CustomerCollectPaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    customerId: string;
    customerName: string;
    customerPhone?: string;
    totalDebt: number;
    orders: CustomerDebtOrderRow[];
    onSuccess: () => void;
}

const PAYMENT_METHODS = [
    { value: 'cash', label: 'Tiền mặt', icon: Banknote },
    { value: 'transfer', label: 'Chuyển khoản', icon: Smartphone },
    { value: 'zalopay', label: 'Zalo Pay', icon: Wallet },
] as const;

function formatInputCurrency(value: number): string {
    if (!value) return '';
    return value.toLocaleString('vi-VN');
}

function parseInputCurrency(value: string): number {
    return parseInt(value.replace(/[^\d]/g, ''), 10) || 0;
}

export function CustomerCollectPaymentDialog({
    open,
    onOpenChange,
    customerId,
    customerName,
    customerPhone,
    totalDebt,
    orders,
    onSuccess,
}: CustomerCollectPaymentDialogProps) {
    const openOrders = useMemo(
        () => orders.filter((o) => o.remaining_debt > 0).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
        [orders]
    );

    const [paidAt, setPaidAt] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'zalopay'>('cash');
    const [notes, setNotes] = useState('');
    const [amounts, setAmounts] = useState<Record<string, number>>({});
    const [showConfirm, setShowConfirm] = useState(false);
    const [detailOrder, setDetailOrder] = useState<CustomerDebtOrderRow | null>(null);

    useEffect(() => {
        if (!open) {
            setShowConfirm(false);
            return;
        }
        const now = new Date();
        const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setPaidAt(local);
        setPaymentMethod('cash');
        setNotes('');
        const initial: Record<string, number> = {};
        openOrders.forEach((o) => {
            initial[o.id] = o.remaining_debt;
        });
        setAmounts(initial);
    }, [open, openOrders]);

    const allocSum = useMemo(
        () => Object.values(amounts).reduce((s, v) => s + (v || 0), 0),
        [amounts]
    );

    const distributeFullFifo = () => {
        const next: Record<string, number> = {};
        openOrders.forEach((o) => {
            next[o.id] = o.remaining_debt;
        });
        setAmounts(next);
    };

    const handleOpenConfirm = () => {
        if (allocSum <= 0) {
            toast.error('Nhập số tiền thanh toán vào từng đơn');
            return;
        }
        if (allocSum > totalDebt) {
            toast.error('Tổng phân bổ không được vượt quá nợ hiện tại');
            return;
        }
        const hasAllocation = openOrders.some((o) => (amounts[o.id] || 0) > 0);
        if (!hasAllocation) {
            toast.error('Phân bổ ít nhất một đơn');
            return;
        }
        setShowConfirm(true);
    };

    const handleSuccess = () => {
        setShowConfirm(false);
        onSuccess();
        onOpenChange(false);
    };

    return (
        <>
            <Dialog open={open && !showConfirm} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Thanh toán</DialogTitle>
                        <DialogDescription>
                            {customerName}
                            {customerPhone ? ` · ${customerPhone}` : ''}
                            {' · '}
                            <span className="font-semibold text-red-600">Nợ hiện tại: {formatCurrency(totalDebt)}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Thời gian</Label>
                            <Input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Phương thức</Label>
                            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PAYMENT_METHODS.map((m) => (
                                        <SelectItem key={m.value} value={m.value}>
                                            {m.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">Ghi chú</Label>
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                    </div>

                    <div className="rounded-lg border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[640px]">
                                <thead className="bg-muted/60 text-xs uppercase">
                                    <tr>
                                        <th className="p-2 text-left font-semibold">Mã hóa đơn</th>
                                        <th className="p-2 text-right font-semibold">Giá trị HĐ</th>
                                        <th className="p-2 text-right font-semibold">Đã cọc</th>
                                        <th className="p-2 text-right font-semibold">Đã thu trước</th>
                                        <th className="p-2 text-right font-semibold">Còn cần thu</th>
                                        <th className="p-2 text-right font-semibold w-36">Thanh toán</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {openOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-6 text-center text-muted-foreground">
                                                Không có đơn còn nợ
                                            </td>
                                        </tr>
                                    ) : (
                                        openOrders.map((o) => (
                                            <tr key={o.id} className="border-t">
                                                <td className="p-2">
                                                    <div className="font-semibold text-primary">{o.order_code}</div>
                                                    <div className="text-[11px] text-muted-foreground">{formatDateTime(o.created_at)}</div>
                                                </td>
                                                <td className="p-2 text-right tabular-nums">{formatCurrency(o.total_amount)}</td>
                                                <td className="p-2 text-right tabular-nums text-amber-700">
                                                    {o.deposit_amount > 0 ? formatCurrency(o.deposit_amount) : '—'}
                                                </td>
                                                <td className="p-2 text-right tabular-nums">
                                                    {o.paid_amount > 0 ? (
                                                        <button
                                                            type="button"
                                                            className={cn(
                                                                'font-medium text-green-700 hover:text-green-900',
                                                                'hover:underline underline-offset-2 cursor-pointer'
                                                            )}
                                                            onClick={() => setDetailOrder(o)}
                                                            title="Xem chi tiết phiếu thu"
                                                        >
                                                            {formatCurrency(o.paid_amount)}
                                                        </button>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="p-2 text-right tabular-nums font-medium">{formatCurrency(o.remaining_debt)}</td>
                                                <td className="p-2">
                                                    <Input
                                                        type="text"
                                                        className="h-9 text-right"
                                                        value={formatInputCurrency(amounts[o.id] || 0)}
                                                        onFocus={(e) => e.target.select()}
                                                        onChange={(e) => {
                                                            const val = parseInputCurrency(e.target.value);
                                                            setAmounts((prev) => ({
                                                                ...prev,
                                                                [o.id]: Math.min(o.remaining_debt, val),
                                                            }));
                                                        }}
                                                    />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">
                            Tổng phân bổ:{' '}
                            <strong className={allocSum > 0 && allocSum <= totalDebt ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency(allocSum)}
                            </strong>
                        </span>
                        <Button type="button" variant="outline" size="sm" onClick={distributeFullFifo}>
                            Phân bổ theo thứ tự đơn
                        </Button>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Bỏ qua
                        </Button>
                        <Button type="button" onClick={handleOpenConfirm} disabled={openOrders.length === 0}>
                            Tạo phiếu thu
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CustomerCollectPaymentConfirmDialog
                open={showConfirm}
                onOpenChange={setShowConfirm}
                onBack={() => setShowConfirm(false)}
                customerId={customerId}
                customerName={customerName}
                paymentMethod={paymentMethod}
                notes={notes}
                orders={openOrders}
                amounts={amounts}
                onSuccess={handleSuccess}
            />

            <CustomerOrderPaymentDetailDialog
                open={!!detailOrder}
                onOpenChange={(open) => !open && setDetailOrder(null)}
                order={detailOrder}
            />
        </>
    );
}
