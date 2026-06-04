import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface CancelInvoiceDialogProps {
    open: boolean;
    invoiceCode: string;
    hasPayments?: boolean;
    onClose: () => void;
    onConfirm: (cancelRelatedPayments: boolean) => Promise<void>;
}

export function CancelInvoiceDialog({
    open,
    invoiceCode,
    hasPayments = false,
    onClose,
    onConfirm,
}: CancelInvoiceDialogProps) {
    const [cancelPayments, setCancelPayments] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const handleConfirm = async () => {
        setSubmitting(true);
        try {
            await onConfirm(cancelPayments);
            onClose();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Hủy hóa đơn</DialogTitle>
                    <DialogDescription>
                        Bạn có chắc chắn muốn hủy hóa đơn <strong>{invoiceCode}</strong>?
                    </DialogDescription>
                </DialogHeader>

                {hasPayments && (
                    <div className="space-y-2">
                        <p className="text-xs text-muted-foreground leading-snug">
                            Hóa đơn hủy sẽ không còn tính vào doanh thu. Công nợ khách được tính lại theo phiếu thu và HĐ còn hiệu lực.
                        </p>
                        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                            <Checkbox
                                id="cancel-related-payments"
                                checked={cancelPayments}
                                onCheckedChange={(v) => setCancelPayments(v === true)}
                                disabled={submitting}
                            />
                            <Label htmlFor="cancel-related-payments" className="text-sm font-medium leading-snug cursor-pointer">
                                Hủy các Phiếu thanh toán có liên quan
                            </Label>
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose} disabled={submitting}>
                        Bỏ qua
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={submitting || (hasPayments && !cancelPayments)}
                    >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Đồng ý'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
