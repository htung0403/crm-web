import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package, Wrench, Gift, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';

import { useProducts, type Product as APIProduct, type Service as APIService } from '@/hooks/useProducts';
import { usePackages } from '@/hooks/usePackages';
import { useVouchers } from '@/hooks/useVouchers';
import type { Package as APIPackage, Voucher as APIVoucher } from '@/types';
import { toast } from 'sonner';

// Extended types for products (extending API types)
interface Product extends APIProduct {
    hasInventory?: boolean;
}

interface Service extends APIService {
    slaDefault?: number;
    commissionSale?: number;
    commissionTech?: number;
    consumables?: ConsumableMaterial[];
}

interface ConsumableMaterial {
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
}

interface ServicePackage extends APIPackage {
    validityDays?: number;
    commissionSale?: number;
    commissionTech?: number;
    totalPrice?: number;
    discountedPrice?: number;
}

const unitOptions = ['cái', 'bộ', 'gói', 'module', 'user/tháng', 'tháng', 'năm', 'lần', 'buổi', 'ngày'];

// Helper functions for number formatting
const formatNumber = (value: number): string => {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parseNumber = (value: string): number => {
    const cleaned = value.replace(/\./g, '');
    return cleaned === '' ? 0 : parseInt(cleaned, 10);
};

// Product Form Dialog
function ProductFormDialog({
    open,
    onClose,
    product,
    onSubmit
}: {
    open: boolean;
    onClose: () => void;
    product?: Product | null;
    onSubmit: (data: Partial<Product>) => Promise<void>;
}) {
    const [name, setName] = useState(product?.name || '');
    const [unit, setUnit] = useState(product?.unit || 'cái');
    const [price, setPrice] = useState(product?.price || 0);
    const [priceDisplay, setPriceDisplay] = useState(formatNumber(product?.price || 0));
    const [stock, setStock] = useState(product?.stock || 0);
    const [stockDisplay, setStockDisplay] = useState(formatNumber(product?.stock || 0));
    const [submitting, setSubmitting] = useState(false);

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

// Service Form Dialog
function ServiceFormDialog({
    open,
    onClose,
    service,
    onSubmit
}: {
    open: boolean;
    onClose: () => void;
    service?: Service | null;
    onSubmit: (data: Partial<Service>) => Promise<void>;
}) {
    const [name, setName] = useState(service?.name || '');
    const [price, setPrice] = useState(service?.price || 0);
    const [priceDisplay, setPriceDisplay] = useState(formatNumber(service?.price || 0));
    const [duration, setDuration] = useState(service?.duration || 24);
    const [commissionRate, setCommissionRate] = useState(service?.commission_rate || 0);
    const [submitting, setSubmitting] = useState(false);

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numValue = parseNumber(value);
        setPrice(numValue);
        setPriceDisplay(numValue === 0 ? '0' : formatNumber(numValue));
    };

    const handlePriceFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (price === 0) e.target.select();
    };

    const handleCommissionFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (commissionRate === 0) e.target.select();
    };

    const handleSubmit = async () => {
        if (!name || price <= 0) {
            toast.error('Vui lòng điền đầy đủ thông tin');
            return;
        }
        setSubmitting(true);
        try {
            await onSubmit({ name, price, duration, commission_rate: commissionRate, status: 'active' });
            onClose();
        } catch (error) {
            console.error('Error saving service:', error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5 text-primary" />
                        {service ? 'Sửa dịch vụ' : 'Thêm dịch vụ mới'}
                    </DialogTitle>
                    <DialogDescription>Nhập thông tin dịch vụ</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Mã dịch vụ</Label>
                        <Input value={service?.code || 'DV...'} disabled className="bg-muted" />
                        <p className="text-xs text-muted-foreground">Mã tự động sinh khi tạo</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Tên dịch vụ *</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên dịch vụ" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Giá dịch vụ *</Label>
                            <Input 
                                type="text" 
                                value={priceDisplay} 
                                onChange={handlePriceChange}
                                onFocus={handlePriceFocus}
                                placeholder="0" 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Thời lượng (giờ)</Label>
                            <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Tỷ lệ hoa hồng (%)</Label>
                        <Input 
                            type="number" 
                            min="0" 
                            max="100" 
                            value={commissionRate} 
                            onChange={(e) => setCommissionRate(Number(e.target.value))}
                            onFocus={handleCommissionFocus}
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

// Package Form Dialog
function PackageFormDialog({
    open,
    onClose,
    pkg,
    services,
    onSubmit
}: {
    open: boolean;
    onClose: () => void;
    pkg?: ServicePackage | null;
    services: Service[];
    onSubmit: (data: Partial<ServicePackage>) => Promise<void>;
}) {
    const [name, setName] = useState(pkg?.name || '');
    const [description, setDescription] = useState(pkg?.description || '');
    const [items, setItems] = useState(pkg?.items || []);
    const [price, setPrice] = useState(pkg?.price || 0);
    const [priceDisplay, setPriceDisplay] = useState(formatNumber(pkg?.price || 0));
    const [submitting, setSubmitting] = useState(false);

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numValue = parseNumber(value);
        setPrice(numValue);
        setPriceDisplay(numValue === 0 ? '0' : formatNumber(numValue));
    };

    const handlePriceFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (price === 0) e.target.select();
    };

    const addItem = () => {
        setItems([...items, { service_id: '', quantity: 1 }]);
    };

    const updateItem = (index: number, field: string, value: string | number) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== index) return item;
            return { ...item, [field]: value };
        }));
    };

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!name || items.length === 0 || price <= 0) {
            toast.error('Vui lòng điền đầy đủ thông tin');
            return;
        }
        
        setSubmitting(true);
        try {
            await onSubmit({ 
                name, 
                description, 
                price,
                items: items.map(item => ({
                    service_id: item.service_id,
                    quantity: item.quantity
                }))
            });
            onClose();
        } catch (error) {
            // Error is already handled by onSubmit
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Gift className="h-5 w-5 text-primary" />
                        {pkg ? 'Sửa gói dịch vụ' : 'Thêm gói dịch vụ mới'}
                    </DialogTitle>
                    <DialogDescription>Nhập thông tin gói dịch vụ / liệu trình</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Mã gói</Label>
                            <Input value={pkg?.code || 'GOI...'} disabled className="bg-muted" />
                            <p className="text-xs text-muted-foreground">Mã tự động sinh khi tạo</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Giá bán gói *</Label>
                            <Input 
                                value={priceDisplay} 
                                onChange={handlePriceChange}
                                onFocus={handlePriceFocus}
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Tên gói *</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên gói" />
                    </div>

                    <div className="space-y-2">
                        <Label>Mô tả</Label>
                        <textarea
                            className="w-full min-h-15 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Mô tả gói dịch vụ"
                        />
                    </div>

                    {/* Package Items */}
                    <div className="space-y-3 pt-4 border-t">
                        <div className="flex items-center justify-between">
                            <Label className="text-base font-semibold">Dịch vụ trong gói</Label>
                            <Button variant="outline" size="sm" onClick={addItem}>
                                <Wrench className="h-4 w-4 mr-1" />
                                Thêm dịch vụ
                            </Button>
                        </div>

                        {items.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Chưa có dịch vụ trong gói</p>
                        ) : (
                            <div className="space-y-2">
                                {items.map((item, index) => (
                                    <div key={index} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                                        <Select value={item.service_id} onValueChange={(v) => updateItem(index, 'service_id', v)}>
                                            <SelectTrigger className="flex-1">
                                                <SelectValue placeholder="Chọn dịch vụ" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {services.map(s => (
                                                    <SelectItem key={s.id} value={s.id}>{s.name} - {formatCurrency(s.price)}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            type="number"
                                            className="w-20"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                                            min="1"
                                        />
                                        <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="text-red-500">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
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

// Voucher Form Dialog
function VoucherFormDialog({
    open,
    onClose,
    voucher,
    onSubmit
}: {
    open: boolean;
    onClose: () => void;
    voucher?: APIVoucher | null;
    onSubmit: (data: Partial<APIVoucher>) => Promise<void>;
}) {
    const [name, setName] = useState(voucher?.name || '');
    const [type, setType] = useState<'percentage' | 'fixed'>(voucher?.type || 'percentage');
    const [value, setValue] = useState(voucher?.value || 0);
    const [valueDisplay, setValueDisplay] = useState(formatNumber(voucher?.value || 0));
    const [minOrderValue, setMinOrderValue] = useState(voucher?.min_order_value || 0);
    const [minOrderDisplay, setMinOrderDisplay] = useState(formatNumber(voucher?.min_order_value || 0));
    const [maxDiscount, setMaxDiscount] = useState(voucher?.max_discount || 0);
    const [maxDiscountDisplay, setMaxDiscountDisplay] = useState(formatNumber(voucher?.max_discount || 0));
    const [quantity, setQuantity] = useState(voucher?.quantity || 0);
    const [quantityDisplay, setQuantityDisplay] = useState(formatNumber(voucher?.quantity || 0));
    const [startDate, setStartDate] = useState(voucher?.start_date || '');
    const [endDate, setEndDate] = useState(voucher?.end_date || '');
    const [submitting, setSubmitting] = useState(false);

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        const numValue = parseNumber(v);
        setValue(numValue);
        setValueDisplay(numValue === 0 ? '0' : formatNumber(numValue));
    };

    const handleMinOrderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        const numValue = parseNumber(v);
        setMinOrderValue(numValue);
        setMinOrderDisplay(numValue === 0 ? '0' : formatNumber(numValue));
    };

    const handleMaxDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        const numValue = parseNumber(v);
        setMaxDiscount(numValue);
        setMaxDiscountDisplay(numValue === 0 ? '0' : formatNumber(numValue));
    };

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        const numValue = parseNumber(v);
        setQuantity(numValue);
        setQuantityDisplay(numValue === 0 ? '0' : formatNumber(numValue));
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        const numValue = parseNumber(e.target.value);
        if (numValue === 0) e.target.select();
    };

    const handleSubmit = async () => {
        if (!name || value <= 0 || quantity <= 0 || !startDate || !endDate) {
            toast.error('Vui lòng điền đầy đủ thông tin');
            return;
        }
        
        setSubmitting(true);
        try {
            await onSubmit({ 
                name, 
                type,
                value,
                min_order_value: minOrderValue || undefined,
                max_discount: maxDiscount || undefined,
                quantity,
                start_date: startDate,
                end_date: endDate
            });
            onClose();
        } catch (error) {
            // Error is already handled by onSubmit
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-primary" />
                        {voucher ? 'Sửa voucher' : 'Thêm voucher mới'}
                    </DialogTitle>
                    <DialogDescription>Nhập thông tin voucher giảm giá</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Mã voucher</Label>
                        <Input value={voucher?.code || 'VC...'} disabled className="bg-muted" />
                        <p className="text-xs text-muted-foreground">Mã tự động sinh khi tạo</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Tên voucher *</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên voucher" />
                    </div>

                    <div className="space-y-2">
                        <Label>Loại giảm giá *</Label>
                        <Select value={type} onValueChange={(v: 'percentage' | 'fixed') => setType(v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="percentage">Phần trăm (%)</SelectItem>
                                <SelectItem value="fixed">Số tiền cố định (VNĐ)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Giá trị *</Label>
                            <Input 
                                type="text" 
                                value={valueDisplay} 
                                onChange={handleValueChange}
                                onFocus={handleFocus}
                                placeholder="0" 
                            />
                            <p className="text-xs text-muted-foreground">
                                {type === 'percentage' ? '% giảm giá' : 'Số tiền giảm'}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Số lượng *</Label>
                            <Input 
                                type="text" 
                                value={quantityDisplay} 
                                onChange={handleQuantityChange}
                                onFocus={handleFocus}
                                placeholder="0" 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Đơn hàng tối thiểu</Label>
                            <Input 
                                type="text" 
                                value={minOrderDisplay} 
                                onChange={handleMinOrderChange}
                                onFocus={handleFocus}
                                placeholder="0" 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Giảm tối đa</Label>
                            <Input 
                                type="text" 
                                value={maxDiscountDisplay} 
                                onChange={handleMaxDiscountChange}
                                onFocus={handleFocus}
                                placeholder="0" 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Ngày bắt đầu *</Label>
                            <Input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Ngày kết thúc *</Label>
                            <Input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
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

// Main Page Component
interface ProductsPageProps {
    initialTab?: 'products' | 'services' | 'packages' | 'vouchers';
    onTabChange?: (tab: string) => void;
}

export function ProductsPage({ initialTab = 'products', onTabChange }: ProductsPageProps) {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [searchTerm, setSearchTerm] = useState('');
    const {
        products,
        services,
        loading,
        fetchProducts,
        fetchServices,
        createProduct,
        updateProduct,
        deleteProduct,
        createService,
        updateService,
        deleteService,
    } = useProducts();

    const {
        packages,
        loading: _packagesLoading,
        fetchPackages,
        createPackage,
        updatePackage,
        deletePackage,
    } = usePackages();

    const {
        vouchers,
        loading: _vouchersLoading,
        fetchVouchers,
        createVoucher,
        updateVoucher,
        deleteVoucher,
    } = useVouchers();

    // Fetch data on mount
    useEffect(() => {
        fetchProducts();
        fetchServices();
        fetchPackages();
        fetchVouchers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    // Sync activeTab with initialTab when sidebar navigation changes
    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    // Handle tab change and notify parent
    const handleTabChange = (tab: string) => {
        const typedTab = tab as 'products' | 'services' | 'packages' | 'vouchers';
        setActiveTab(typedTab);
        // Map tab to page id for sidebar
        const tabToPageMap: Record<string, string> = {
            'products': 'product-list',
            'services': 'services',
            'packages': 'packages',
            'vouchers': 'vouchers'
        };
        if (onTabChange) {
            onTabChange(tabToPageMap[tab]);
        }
    };

    // Dialog states
    const [showProductForm, setShowProductForm] = useState(false);
    const [showServiceForm, setShowServiceForm] = useState(false);
    const [showPackageForm, setShowPackageForm] = useState(false);
    const [showVoucherForm, setShowVoucherForm] = useState(false);
    const [editingItem, setEditingItem] = useState<Product | Service | ServicePackage | APIVoucher | null>(null);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredServices = services.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredPackages = packages.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredVouchers = vouchers.filter(v =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Handle create/update product
    const handleCreateProduct = async (data: Partial<Product>) => {
        try {
            await createProduct(data);
            toast.success('Đã tạo sản phẩm mới!');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Lỗi khi tạo sản phẩm');
        }
    };

    const handleUpdateProduct = async (data: Partial<Product>) => {
        if (!editingItem?.id) return;
        try {
            await updateProduct(editingItem.id, data);
            toast.success('Đã cập nhật sản phẩm!');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Lỗi khi cập nhật sản phẩm');
        }
    };

    const handleDeleteProduct = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;
        try {
            await deleteProduct(id);
            toast.success('Đã xóa sản phẩm!');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Lỗi khi xóa sản phẩm');
        }
    };

    // Handle create/update service
    const handleCreateService = async (data: Partial<Service>) => {
        try {
            await createService(data);
            toast.success('Đã tạo dịch vụ mới!');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Lỗi khi tạo dịch vụ');
        }
    };

    const handleUpdateService = async (data: Partial<Service>) => {
        if (!editingItem?.id) return;
        try {
            await updateService(editingItem.id, data);
            toast.success('Đã cập nhật dịch vụ!');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Lỗi khi cập nhật dịch vụ');
        }
    };

    const handleDeleteService = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xóa dịch vụ này?')) return;
        try {
            await deleteService(id);
            toast.success('Đã xóa dịch vụ!');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Lỗi khi xóa dịch vụ');
        }
    };

    // Handle create/update package
    const handleCreatePackage = async (data: Partial<ServicePackage>) => {
        try {
            // Remove code since it's auto-generated
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { code, ...packageData } = data;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await createPackage(packageData as any);
            toast.success('Đã tạo gói dịch vụ mới!');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Lỗi khi tạo gói dịch vụ');
        }
    };

    const handleUpdatePackage = async (data: Partial<ServicePackage>) => {
        if (!editingItem?.id) return;
        try {
            await updatePackage(editingItem.id, data);
            toast.success('Đã cập nhật gói dịch vụ!');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Lỗi khi cập nhật gói dịch vụ');
        }
    };

    const handleDeletePackage = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xóa gói dịch vụ này?')) return;
        try {
            await deletePackage(id);
            toast.success('Đã xóa gói dịch vụ!');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Lỗi khi xóa gói dịch vụ');
        }
    };

    // Handle create/update voucher
    const handleCreateVoucher = async (data: Partial<APIVoucher>) => {
        try {
            // Remove code and used_count since they're auto-generated
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { code, used_count, ...voucherData } = data;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await createVoucher(voucherData as any);
            toast.success('Đã tạo voucher mới!');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Lỗi khi tạo voucher');
        }
    };

    const handleUpdateVoucher = async (data: Partial<APIVoucher>) => {
        if (!editingItem?.id) return;
        try {
            await updateVoucher(editingItem.id, data);
            toast.success('Đã cập nhật voucher!');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Lỗi khi cập nhật voucher');
        }
    };

    const handleDeleteVoucher = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xóa voucher này?')) return;
        try {
            await deleteVoucher(id);
            toast.success('Đã xóa voucher!');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Lỗi khi xóa voucher');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Sản phẩm & Dịch vụ</h1>
                    <p className="text-muted-foreground">Quản lý danh mục sản phẩm, dịch vụ, gói và thẻ</p>
                </div>
            </div>

            {/* Tabs */}
            <Card>
                <CardContent className="p-0">
                    <Tabs value={activeTab} onValueChange={handleTabChange}>
                        <div className="border-b px-4 pt-4">
                            <TabsList className="mb-4 flex-wrap h-auto gap-2">
                                <TabsTrigger value="products" className="gap-2">
                                    <Package className="h-4 w-4" />
                                    Sản phẩm
                                    <Badge variant="secondary">{products.length}</Badge>
                                </TabsTrigger>
                                <TabsTrigger value="services" className="gap-2">
                                    <Wrench className="h-4 w-4" />
                                    Dịch vụ
                                    <Badge variant="secondary">{services.length}</Badge>
                                </TabsTrigger>
                                <TabsTrigger value="packages" className="gap-2">
                                    <Gift className="h-4 w-4" />
                                    Gói dịch vụ
                                    <Badge variant="secondary">{packages.length}</Badge>
                                </TabsTrigger>
                                <TabsTrigger value="vouchers" className="gap-2">
                                    <CreditCard className="h-4 w-4" />
                                    Thẻ/Voucher
                                    <Badge variant="secondary">{vouchers.length}</Badge>
                                </TabsTrigger>
                            </TabsList>

                            {/* Search & Add Button */}
                            <div className="flex flex-col sm:flex-row gap-3 pb-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Tìm theo mã, tên..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                <Button onClick={() => {
                                    setEditingItem(null);
                                    if (activeTab === 'products') setShowProductForm(true);
                                    else if (activeTab === 'services') setShowServiceForm(true);
                                    else if (activeTab === 'packages') setShowPackageForm(true);
                                    else setShowVoucherForm(true);
                                }}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Thêm mới
                                </Button>
                            </div>
                        </div>

                        {/* Products Tab */}
                        <TabsContent value="products" className="m-0">
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
                                        ) : filteredProducts.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                                    Không tìm thấy sản phẩm nào
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredProducts.map((product) => (
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
                                                            <Button variant="ghost" size="icon" onClick={() => { setEditingItem(product); setShowProductForm(true); }}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(product.id)} className="text-red-500">
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
                        </TabsContent>

                        {/* Services Tab */}
                        <TabsContent value="services" className="m-0">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-muted/50 border-b">
                                        <tr>
                                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Mã</th>
                                            <th className="p-3 text-left text-sm font-medium text-muted-foreground">Tên dịch vụ</th>
                                            <th className="p-3 text-right text-sm font-medium text-muted-foreground">Giá</th>
                                            <th className="p-3 text-center text-sm font-medium text-muted-foreground">Thời lượng (giờ)</th>
                                            <th className="p-3 text-center text-sm font-medium text-muted-foreground">Hoa hồng (%)</th>
                                            <th className="p-3 text-right text-sm font-medium text-muted-foreground">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading && services.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                                    Đang tải dữ liệu...
                                                </td>
                                            </tr>
                                        ) : filteredServices.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                                    Không tìm thấy dịch vụ nào
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredServices.map((service) => (
                                                <tr key={service.id} className="border-b hover:bg-muted/30 transition-colors">
                                                    <td className="p-3 font-mono text-sm">{service.code}</td>
                                                    <td className="p-3 font-medium">{service.name}</td>
                                                    <td className="p-3 text-right font-semibold text-primary">{formatCurrency(service.price)}</td>
                                                    <td className="p-3 text-center">{service.duration || 0}h</td>
                                                    <td className="p-3 text-center">
                                                        <Badge variant="info">{service.commission_rate || 0}%</Badge>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button variant="ghost" size="icon" onClick={() => { setEditingItem(service); setShowServiceForm(true); }}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteService(service.id)} className="text-red-500">
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
                        </TabsContent>

                        {/* Packages Tab */}
                        <TabsContent value="packages" className="m-0">
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
                                        {filteredPackages.map((pkg) => (
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
                                                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(pkg); setShowPackageForm(true); }}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => handleDeletePackage(pkg.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>

                        {/* Vouchers Tab */}
                        <TabsContent value="vouchers" className="m-0">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-muted/50 border-b">
                                        <tr>
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
                                        {filteredVouchers.map((voucher) => (
                                            <tr key={voucher.id} className="border-b hover:bg-muted/30 transition-colors">
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
                                                        <Button variant="ghost" size="icon" onClick={() => { setEditingItem(voucher); setShowVoucherForm(true); }}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => handleDeleteVoucher(voucher.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Dialogs */}
            <ProductFormDialog
                open={showProductForm}
                onClose={() => { setShowProductForm(false); setEditingItem(null); }}
                product={editingItem as Product}
                onSubmit={editingItem ? handleUpdateProduct : handleCreateProduct}
            />
            <ServiceFormDialog
                open={showServiceForm}
                onClose={() => { setShowServiceForm(false); setEditingItem(null); }}
                service={editingItem as Service}
                onSubmit={editingItem ? handleUpdateService : handleCreateService}
            />
            <PackageFormDialog
                open={showPackageForm}
                onClose={() => { setShowPackageForm(false); setEditingItem(null); }}
                pkg={editingItem as ServicePackage}
                services={services}
                onSubmit={editingItem ? handleUpdatePackage : handleCreatePackage}
            />
            <VoucherFormDialog
                open={showVoucherForm}
                onClose={() => { setShowVoucherForm(false); setEditingItem(null); }}
                voucher={editingItem as APIVoucher}
                onSubmit={editingItem ? handleUpdateVoucher : handleCreateVoucher}
            />
        </div>
    );
}
