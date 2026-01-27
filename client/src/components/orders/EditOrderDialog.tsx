import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Trash, Package, Gift, Search, Sparkles, ShoppingBag, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import type { Package as PackageType, Voucher } from '@/types';
import type { Order } from '@/hooks/useOrders';
import { getItemTypeLabel, getItemTypeColor, type UpdateOrderData, type OrderItem } from './constants';

interface EditOrderDialogProps {
    order: Order | null;
    open: boolean;
    onClose: () => void;
    onSubmit: (orderId: string, data: UpdateOrderData) => Promise<void>;
    products: { id: string; name: string; price: number }[];
    services: { id: string; name: string; price: number }[];
    packages: PackageType[];
    vouchers: Voucher[];
}

export function EditOrderDialog({
    order,
    open,
    onClose,
    onSubmit,
    products,
    services,
    packages,
    vouchers
}: EditOrderDialogProps) {
    const [notes, setNotes] = useState('');
    const [manualDiscount, setManualDiscount] = useState(0);
    const [itemSearch, setItemSearch] = useState('');
    const [activeTab, setActiveTab] = useState('product');
    const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
    const [items, setItems] = useState<OrderItem[]>([]);
    const [submitting, setSubmitting] = useState(false);

    // Initialize form with order data when order changes
    useEffect(() => {
        if (order) {
            setNotes(order.notes || '');
            setManualDiscount(order.discount || 0);
            // Convert order items to edit format
            const orderItems = (order.items || []).map(item => ({
                type: item.item_type as 'product' | 'service' | 'package',
                item_id: item.product_id || item.service_id || item.id,
                name: item.item_name,
                quantity: item.quantity,
                unit_price: item.unit_price
            }));
            setItems(orderItems);
        }
    }, [order]);

    // Filter items by search
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(itemSearch.toLowerCase())
    );
    const filteredServices = services.filter(s =>
        s.name.toLowerCase().includes(itemSearch.toLowerCase())
    );
    const filteredPackages = packages.filter(p =>
        p.name.toLowerCase().includes(itemSearch.toLowerCase()) &&
        p.status === 'active'
    );
    const filteredVouchers = vouchers.filter(v =>
        (v.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
            v.code.toLowerCase().includes(itemSearch.toLowerCase())) &&
        v.status === 'active'
    );

    const handleAddItem = (type: 'product' | 'service' | 'package' | 'voucher', itemId: string) => {
        // Handle voucher separately - apply as discount
        if (type === 'voucher') {
            const voucher = vouchers.find(i => i.id === itemId);
            if (voucher) {
                if (appliedVoucher?.id === voucher.id) {
                    toast.info('Voucher này đã được áp dụng');
                    return;
                }
                setAppliedVoucher(voucher);
                toast.success(`Đã áp dụng voucher: ${voucher.name}`);
            }
            return;
        }

        let item: { id: string; name: string; price: number } | undefined;

        if (type === 'product') {
            item = products.find(i => i.id === itemId);
        } else if (type === 'service') {
            item = services.find(i => i.id === itemId);
        } else if (type === 'package') {
            const pkg = packages.find(i => i.id === itemId);
            if (pkg) item = { id: pkg.id, name: pkg.name, price: pkg.price };
        }

        if (!item) return;

        const existingIndex = items.findIndex(i => i.item_id === itemId && i.type === type);
        if (existingIndex >= 0) {
            setItems(prev => prev.map((item, i) =>
                i === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
            ));
        } else {
            setItems(prev => [...prev, {
                type,
                item_id: item!.id,
                name: item!.name,
                quantity: 1,
                unit_price: item!.price
            }]);
        }
        setItemSearch('');
    };

    const handleRemoveVoucher = () => {
        setAppliedVoucher(null);
        toast.info('Đã gỡ voucher');
    };

    const handleRemoveItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdateQuantity = (index: number, quantity: number) => {
        if (quantity < 1) return;
        setItems(prev => prev.map((item, i) => i === index ? { ...item, quantity } : item));
    };

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    const voucherDiscount = appliedVoucher
        ? (appliedVoucher.type === 'percentage'
            ? Math.min(
                (subtotal * appliedVoucher.value) / 100,
                appliedVoucher.max_discount || Infinity
            )
            : appliedVoucher.value)
        : 0;

    const voucherValid = !appliedVoucher || subtotal >= (appliedVoucher.min_order_value || 0);
    const effectiveVoucherDiscount = voucherValid ? voucherDiscount : 0;
    const totalDiscount = effectiveVoucherDiscount + manualDiscount;
    const total = Math.max(0, subtotal - totalDiscount);

    const handleSubmit = async () => {
        if (!order) return;

        if (items.length === 0) {
            toast.error('Vui lòng thêm ít nhất một sản phẩm/dịch vụ');
            return;
        }

        if (appliedVoucher && !voucherValid) {
            toast.error(`Đơn hàng phải đạt tối thiểu ${formatCurrency(appliedVoucher.min_order_value || 0)} để áp dụng voucher`);
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit(order.id, {
                items,
                notes: notes || undefined,
                discount: totalDiscount > 0 ? totalDiscount : undefined
            });
            onClose();
        } catch {
            // Error handled in parent
        } finally {
            setSubmitting(false);
        }
    };

    if (!order) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Sửa đơn hàng {order.order_code}
                    </DialogTitle>
                    <DialogDescription>
                        Khách hàng: <strong>{order.customer?.name}</strong>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-4">
                    {/* Add Items with Tabs */}
                    <div className="space-y-3">
                        <Label className="flex items-center gap-1">
                            <Plus className="h-4 w-4" />
                            Thêm vào đơn hàng
                        </Label>

                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="grid grid-cols-4 w-full">
                                <TabsTrigger value="product" className="text-xs sm:text-sm">
                                    <ShoppingBag className="h-3.5 w-3.5 mr-1" />
                                    Sản phẩm
                                </TabsTrigger>
                                <TabsTrigger value="service" className="text-xs sm:text-sm">
                                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                                    Dịch vụ
                                </TabsTrigger>
                                <TabsTrigger value="package" className="text-xs sm:text-sm">
                                    <Package className="h-3.5 w-3.5 mr-1" />
                                    Gói
                                </TabsTrigger>
                                <TabsTrigger value="voucher" className="text-xs sm:text-sm">
                                    <Gift className="h-3.5 w-3.5 mr-1" />
                                    Voucher
                                </TabsTrigger>
                            </TabsList>

                            {/* Search Input */}
                            <div className="relative mt-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={`Tìm ${activeTab === 'product' ? 'sản phẩm' : activeTab === 'service' ? 'dịch vụ' : activeTab === 'package' ? 'gói dịch vụ' : 'voucher'}...`}
                                    value={itemSearch}
                                    onChange={(e) => setItemSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>

                            <TabsContent value="product" className="mt-3">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                                    {filteredProducts.map(product => (
                                        <Button
                                            key={product.id}
                                            variant="outline"
                                            size="sm"
                                            className="justify-start h-auto py-2 px-3"
                                            onClick={() => handleAddItem('product', product.id)}
                                        >
                                            <div className="text-left">
                                                <p className="font-medium text-xs truncate">{product.name}</p>
                                                <p className="text-xs text-primary">{formatCurrency(product.price)}</p>
                                            </div>
                                        </Button>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="service" className="mt-3">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                                    {filteredServices.map(service => (
                                        <Button
                                            key={service.id}
                                            variant="outline"
                                            size="sm"
                                            className="justify-start h-auto py-2 px-3"
                                            onClick={() => handleAddItem('service', service.id)}
                                        >
                                            <div className="text-left">
                                                <p className="font-medium text-xs truncate">{service.name}</p>
                                                <p className="text-xs text-primary">{formatCurrency(service.price)}</p>
                                            </div>
                                        </Button>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="package" className="mt-3">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                                    {filteredPackages.map(pkg => (
                                        <Button
                                            key={pkg.id}
                                            variant="outline"
                                            size="sm"
                                            className="justify-start h-auto py-2 px-3"
                                            onClick={() => handleAddItem('package', pkg.id)}
                                        >
                                            <div className="text-left">
                                                <p className="font-medium text-xs truncate">{pkg.name}</p>
                                                <p className="text-xs text-primary">{formatCurrency(pkg.price)}</p>
                                            </div>
                                        </Button>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="voucher" className="mt-3">
                                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                    {filteredVouchers.map(voucher => (
                                        <Button
                                            key={voucher.id}
                                            variant="outline"
                                            size="sm"
                                            className={`justify-start h-auto py-2 px-3 ${appliedVoucher?.id === voucher.id ? 'border-amber-500 bg-amber-50' : ''}`}
                                            onClick={() => handleAddItem('voucher', voucher.id)}
                                            disabled={appliedVoucher?.id === voucher.id}
                                        >
                                            <div className="text-left">
                                                <p className="font-medium text-xs truncate">{voucher.name}</p>
                                                <div className="flex items-center gap-1">
                                                    <Badge variant="outline" className="text-xs">
                                                        {voucher.code}
                                                    </Badge>
                                                    <span className="text-xs text-amber-600 font-semibold">
                                                        {voucher.type === 'percentage' ? `-${voucher.value}%` : `-${formatCurrency(voucher.value)}`}
                                                    </span>
                                                </div>
                                            </div>
                                        </Button>
                                    ))}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Applied Voucher */}
                    {appliedVoucher && (
                        <div className={`p-3 rounded-lg border ${voucherValid ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Gift className={`h-4 w-4 ${voucherValid ? 'text-amber-600' : 'text-red-600'}`} />
                                    <span className={`font-medium text-sm ${voucherValid ? 'text-amber-700' : 'text-red-700'}`}>
                                        {appliedVoucher.name}
                                    </span>
                                    <Badge variant="outline" className="text-xs">{appliedVoucher.code}</Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`font-semibold ${voucherValid ? 'text-amber-700' : 'text-red-700'}`}>
                                        {appliedVoucher.type === 'percentage'
                                            ? `-${appliedVoucher.value}%`
                                            : `-${formatCurrency(appliedVoucher.value)}`}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-red-500 hover:bg-red-100"
                                        onClick={handleRemoveVoucher}
                                    >
                                        <Trash className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Items List */}
                    {items.length > 0 && (
                        <div className="space-y-2">
                            <Label>Danh sách sản phẩm/dịch vụ ({items.length})</Label>
                            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                                {items.map((item, index) => (
                                    <div key={index} className="flex items-center gap-3 p-3 hover:bg-muted/30">
                                        <Badge className={getItemTypeColor(item.type)}>
                                            {getItemTypeLabel(item.type)}
                                        </Badge>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatCurrency(item.unit_price)} / đơn vị
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => handleUpdateQuantity(index, item.quantity - 1)}
                                                disabled={item.quantity <= 1}
                                            >
                                                -
                                            </Button>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => handleUpdateQuantity(index, Number(e.target.value))}
                                                className="w-14 text-center h-7"
                                            />
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => handleUpdateQuantity(index, item.quantity + 1)}
                                            >
                                                +
                                            </Button>
                                        </div>
                                        <div className="w-28 text-right font-semibold shrink-0">
                                            {formatCurrency(item.quantity * item.unit_price)}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveItem(index)}
                                            className="text-red-500 hover:bg-red-50 shrink-0 h-8 w-8"
                                        >
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Summary */}
                    {items.length > 0 && (
                        <div className="space-y-2 p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/10">
                            <div className="flex justify-between text-sm">
                                <span>Tạm tính ({items.length} sản phẩm):</span>
                                <span className="font-semibold">{formatCurrency(subtotal)}</span>
                            </div>

                            {appliedVoucher && voucherValid && effectiveVoucherDiscount > 0 && (
                                <div className="flex justify-between text-sm text-amber-600">
                                    <span className="flex items-center gap-1">
                                        <Gift className="h-3.5 w-3.5" />
                                        Voucher ({appliedVoucher.code}):
                                    </span>
                                    <span className="font-semibold">-{formatCurrency(effectiveVoucherDiscount)}</span>
                                </div>
                            )}

                            <div className="flex justify-between items-center">
                                <span className="text-sm">Giảm giá thêm:</span>
                                <Input
                                    type="number"
                                    min="0"
                                    max={subtotal - effectiveVoucherDiscount}
                                    value={manualDiscount}
                                    onChange={(e) => setManualDiscount(Math.min(subtotal - effectiveVoucherDiscount, Number(e.target.value)))}
                                    className="w-32 text-right h-8"
                                />
                            </div>

                            {totalDiscount > 0 && (
                                <div className="flex justify-between text-sm text-green-600 pt-1">
                                    <span>Tổng giảm:</span>
                                    <span className="font-semibold">-{formatCurrency(totalDiscount)}</span>
                                </div>
                            )}

                            <div className="flex justify-between text-lg font-bold pt-3 border-t border-primary/20">
                                <span>Tổng thanh toán:</span>
                                <span className="text-primary text-xl">{formatCurrency(total)}</span>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>Ghi chú</Label>
                        <textarea
                            className="w-full min-h-16 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Nhập ghi chú cho đơn hàng..."
                        />
                    </div>
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button variant="outline" onClick={onClose} disabled={submitting}>
                        Hủy
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || items.length === 0}>
                        {submitting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Đang lưu...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Cập nhật đơn hàng
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
