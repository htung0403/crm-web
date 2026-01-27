import { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Product } from './types';
import { unitOptions } from './types';
import { formatNumber, parseNumber } from './utils';

interface ProductFormDialogProps {
    open: boolean;
    onClose: () => void;
    product?: Product | null;
    onSubmit: (data: Partial<Product>) => Promise<void>;
}

export function ProductFormDialog({ open, onClose, product, onSubmit }: ProductFormDialogProps) {
    const [name, setName] = useState('');
    const [unit, setUnit] = useState('cái');
    const [price, setPrice] = useState(0);
    const [priceDisplay, setPriceDisplay] = useState('0');
    const [stock, setStock] = useState(0);
    const [stockDisplay, setStockDisplay] = useState('0');
    const [submitting, setSubmitting] = useState(false);

    // Reset form when product changes
    useEffect(() => {
        if (product) {
            setName(product.name || '');
            setUnit(product.unit || 'cái');
            setPrice(product.price || 0);
            setPriceDisplay(formatNumber(product.price || 0));
            setStock(product.stock || 0);
            setStockDisplay(formatNumber(product.stock || 0));
        } else {
            setName('');
            setUnit('cái');
            setPrice(0);
            setPriceDisplay('0');
            setStock(0);
            setStockDisplay('0');
        }
    }, [product, open]);

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numValue = parseNumber(value);
        setPrice(numValue);
        setPriceDisplay(numValue === 0 ? '0' : formatNumber(numValue));
    };

    const handleStockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numValue = parseNumber(value);
        setStock(numValue);
        setStockDisplay(numValue === 0 ? '0' : formatNumber(numValue));
    };

    const handlePriceFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (price === 0) e.target.select();
    };

    const handleStockFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (stock === 0) e.target.select();
    };

    const handleSubmit = async () => {
        if (!name || price <= 0) {
            toast.error('Vui lòng điền đầy đủ thông tin');
            return;
        }
        setSubmitting(true);
        try {
            await onSubmit({ name, unit, price, stock, status: 'active' });
            onClose();
        } catch (error) {
            console.error('Error saving product:', error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        {product ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
                    </DialogTitle>
                    <DialogDescription>Nhập thông tin sản phẩm</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Mã sản phẩm</Label>
                        <Input value={product?.code || 'SP...'} disabled className="bg-muted" />
                        <p className="text-xs text-muted-foreground">Mã tự động sinh khi tạo</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Tên sản phẩm *</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên sản phẩm" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Đơn vị tính *</Label>
                            <Select value={unit} onValueChange={setUnit}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {unitOptions.map(u => (
                                        <SelectItem key={u} value={u}>{u}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Giá bán *</Label>
                            <Input
                                type="text"
                                value={priceDisplay}
                                onChange={handlePriceChange}
                                onFocus={handlePriceFocus}
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Số lượng tồn</Label>
                        <Input
                            type="text"
                            value={stockDisplay}
                            onChange={handleStockChange}
                            onFocus={handleStockFocus}
                            placeholder="0"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Huỷ</Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Đang lưu...' : 'Lưu'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
