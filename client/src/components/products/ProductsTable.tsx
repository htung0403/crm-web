import { Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { Product } from './types';

interface ProductsTableProps {
    products: Product[];
    loading: boolean;
    onEdit: (product: Product) => void;
    onDelete: (id: string) => void;
}

export function ProductsTable({ products, loading, onEdit, onDelete }: ProductsTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-muted/50 border-b">
                    <tr>
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">Mã</th>
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">Tên sản phẩm</th>
                        <th className="p-3 text-left text-sm font-medium text-muted-foreground">Đơn vị</th>
                        <th className="p-3 text-right text-sm font-medium text-muted-foreground">Giá</th>
                        <th className="p-3 text-center text-sm font-medium text-muted-foreground">Tồn kho</th>
                        <th className="p-3 text-center text-sm font-medium text-muted-foreground">Trạng thái</th>
                        <th className="p-3 text-right text-sm font-medium text-muted-foreground">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    {loading && products.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                Đang tải dữ liệu...
                            </td>
                        </tr>
                    ) : products.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                Không tìm thấy sản phẩm nào
                            </td>
                        </tr>
                    ) : (
                        products.map((product) => (
                            <tr key={product.id} className="border-b hover:bg-muted/30 transition-colors">
                                <td className="p-3 font-mono text-sm">{product.code}</td>
                                <td className="p-3 font-medium">{product.name}</td>
                                <td className="p-3 text-sm">{product.unit}</td>
                                <td className="p-3 text-right font-semibold text-primary">{formatCurrency(product.price)}</td>
                                <td className="p-3 text-center">
                                    <Badge variant={product.stock > 10 ? 'success' : product.stock > 0 ? 'warning' : 'danger'}>
                                        {product.stock}
                                    </Badge>
                                </td>
                                <td className="p-3 text-center">
                                    <Badge variant={product.status === 'active' ? 'success' : 'secondary'}>
                                        {product.status === 'active' ? 'Hoạt động' : 'Ngừng'}
                                    </Badge>
                                </td>
                                <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => onEdit(product)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => onDelete(product.id)} className="text-red-500">
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
