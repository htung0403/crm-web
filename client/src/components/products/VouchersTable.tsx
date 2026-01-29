import { Edit, Trash2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { APIVoucher } from './types';

interface VouchersTableProps {
    vouchers: APIVoucher[];
    onEdit: (voucher: APIVoucher) => void;
    onDelete: (id: string) => void;
}

export function VouchersTable({ vouchers, onEdit, onDelete }: VouchersTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-muted/50 border-b">
                    <tr>
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">Hình ảnh</th>
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">Mã</th>
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">Tên voucher</th>
                        <th className="p-3 text-center text-sm font-medium text-muted-foreground">Loại</th>
                        <th className="p-3 text-right text-sm font-medium text-muted-foreground">Giá trị</th>
                        <th className="p-3 text-center text-sm font-medium text-muted-foreground">Số lượng</th>
                        <th className="p-3 text-center text-sm font-medium text-muted-foreground">Ngày hết hạn</th>
                        <th className="p-3 text-center text-sm font-medium text-muted-foreground">Trạng thái</th>
                        <th className="p-3 text-right text-sm font-medium text-muted-foreground">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    {vouchers.length === 0 ? (
                        <tr>
                            <td colSpan={9} className="p-8 text-center text-muted-foreground">
                                Không tìm thấy voucher nào
                            </td>
                        </tr>
                    ) : (
                        vouchers.map((voucher) => (
                            <tr key={voucher.id} className="border-b hover:bg-muted/30 transition-colors">
                                <td className="p-3">
                                    {voucher.image ? (
                                        <img
                                            src={voucher.image}
                                            alt={voucher.name}
                                            className="w-12 h-12 rounded-lg object-cover border shadow-sm"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                    )}
                                </td>
                                <td className="p-3 font-mono text-sm">{voucher.code}</td>
                                <td className="p-3 font-medium">{voucher.name}</td>
                                <td className="p-3 text-center">
                                    <Badge variant={voucher.type === 'percentage' ? 'info' : 'secondary'}>
                                        {voucher.type === 'percentage' ? 'Phần trăm' : 'Cố định'}
                                    </Badge>
                                </td>
                                <td className="p-3 text-right font-semibold text-primary">
                                    {voucher.type === 'percentage' ? `${voucher.value}%` : formatCurrency(voucher.value)}
                                </td>
                                <td className="p-3 text-center">
                                    {voucher.used_count || 0}/{voucher.quantity}
                                </td>
                                <td className="p-3 text-center text-sm">{voucher.end_date}</td>
                                <td className="p-3 text-center">
                                    <Badge variant={voucher.status === 'active' ? 'success' : 'secondary'}>
                                        {voucher.status === 'active' ? 'Hoạt động' : 'Ngưng'}
                                    </Badge>
                                </td>
                                <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => onEdit(voucher)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => onDelete(voucher.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

