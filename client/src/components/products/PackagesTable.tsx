import { Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { ServicePackage } from './types';

interface PackagesTableProps {
    packages: ServicePackage[];
    onEdit: (pkg: ServicePackage) => void;
    onDelete: (id: string) => void;
}

export function PackagesTable({ packages, onEdit, onDelete }: PackagesTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-muted/50 border-b">
                    <tr>
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">Mã</th>
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">Tên gói</th>
                        <th className="p-3 text-center text-sm font-medium text-muted-foreground">Số mục</th>
                        <th className="p-3 text-right text-sm font-medium text-muted-foreground">Giá bán</th>
                        <th className="p-3 text-center text-sm font-medium text-muted-foreground">Trạng thái</th>
                        <th className="p-3 text-right text-sm font-medium text-muted-foreground">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    {packages.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                Không tìm thấy gói dịch vụ nào
                            </td>
                        </tr>
                    ) : (
                        packages.map((pkg) => (
                            <tr key={pkg.id} className="border-b hover:bg-muted/30 transition-colors">
                                <td className="p-3 font-mono text-sm">{pkg.code}</td>
                                <td className="p-3">
                                    <p className="font-medium">{pkg.name}</p>
                                    <p className="text-xs text-muted-foreground">{pkg.description}</p>
                                </td>
                                <td className="p-3 text-center">
                                    <Badge variant="outline">{pkg.items?.length || 0} mục</Badge>
                                </td>
                                <td className="p-3 text-right font-semibold text-primary">{formatCurrency(pkg.price)}</td>
                                <td className="p-3 text-center">
                                    <Badge variant={pkg.status === 'active' ? 'success' : 'secondary'}>
                                        {pkg.status === 'active' ? 'Hoạt động' : 'Ngưng'}
                                    </Badge>
                                </td>
                                <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => onEdit(pkg)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => onDelete(pkg.id)}>
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
