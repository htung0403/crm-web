import React from 'react';
import { Eye, Trash2, Download, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Invoice {
    id: string;
    invoice_code?: string;
    order_id: string;
    order?: { order_code: string; customer?: { name: string; phone: string } };
    amount?: number;
    total_amount?: number;
    paid_amount?: number;
    payment_method?: string;
    status?: string;
    created_at: string;
    notes?: string;
}

interface MobileInvoicesListProps {
    invoices: Invoice[];
    loading: boolean;
    onView?: (invoice: Invoice) => void;
    onDelete?: (invoiceId: string) => void;
}

const statusBadgeColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    partial: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
};

const paymentMethodLabel: Record<string, string> = {
    cash: 'Tiền mặt',
    transfer: 'Chuyển khoản',
    zalopay: 'ZaloPay',
    other: 'Khác',
};

export function MobileInvoicesList({ invoices, loading, onView, onDelete }: MobileInvoicesListProps) {
    if (loading) {
        return (
            <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                        <CardContent className="p-3 h-24 bg-muted rounded" />
                    </Card>
                ))}
            </div>
        );
    }

    if (invoices.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <p className="text-muted-foreground">Không có hóa đơn</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {invoices.map((invoice) => (
                <Card key={invoice.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-foreground truncate">
                                    {invoice.invoice_code || `HĐ-${invoice.id.slice(0, 8)}`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {invoice.order?.order_code}
                                </p>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {onView && (
                                        <DropdownMenuItem onClick={() => onView(invoice)}>
                                            <Eye className="h-4 w-4 mr-2" />
                                            Xem
                                        </DropdownMenuItem>
                                    )}
                                    {onDelete && (
                                        <DropdownMenuItem
                                            onClick={() => onDelete(invoice.id)}
                                            className="text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Xóa
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Customer Info */}
                        <div className="mb-2">
                            <p className="text-xs font-medium text-foreground">
                                {invoice.order?.customer?.name || 'N/A'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {invoice.order?.customer?.phone || ''}
                            </p>
                        </div>

                        {/* Amount & Status */}
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <p className="text-xs text-muted-foreground">Tổng tiền</p>
                                <p className="font-bold text-primary">
                                    {formatCurrency(invoice.total_amount ?? invoice.amount ?? 0)}
                                </p>
                            </div>
                            <Badge className={statusBadgeColor[invoice.status || 'pending']}>
                                {invoice.status === 'paid' ? 'Đã thanh toán' : 'Chờ thanh toán'}
                            </Badge>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                            <span>{paymentMethodLabel[invoice.payment_method || 'cash']}</span>
                            <span>{formatDate(invoice.created_at)}</span>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
