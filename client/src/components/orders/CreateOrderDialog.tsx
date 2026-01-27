import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Trash, Package, Gift, Search, Sparkles, ShoppingBag, Loader2, User, Wrench } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import type { Package as PackageType, Voucher, User as UserType } from '@/types';
import { getItemTypeLabel, getItemTypeColor, type CreateOrderData, type OrderItem, type CustomerOption } from './constants';

// Simple helper to display department - just return the value for now
const getDepartmentLabel = (value?: string) => value || '';

interface CreateOrderDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateOrderData) => Promise<void>;
    customers: CustomerOption[];
    products: { id: string; name: string; price: number }[];
    services: { id: string; name: string; price: number; department?: string }[];
    packages: PackageType[];
    vouchers: Voucher[];
    technicians?: UserType[]; // List of technicians for assignment
}

export function CreateOrderDialog({
    open,
    onClose,
    onSubmit,
    customers,
    products,
    services,
    packages,
    vouchers,
    technicians = []
}: CreateOrderDialogProps) {
    const [customerId, setCustomerId] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [notes, setNotes] = useState('');
    const [manualDiscount, setManualDiscount] = useState(0);
    const [itemSearch, setItemSearch] = useState('');
    const [activeTab, setActiveTab] = useState('product');
    const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
    const [items, setItems] = useState<OrderItem[]>([]);
    const [submitting, setSubmitting] = useState(false);

    // Filter only active customers
    const activeCustomers = customers.filter(c => c.status === 'active' || !c.status);

    // Filter customers by search
    const filteredCustomers = activeCustomers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone.includes(customerSearch)
    );

    // Get selected customer info
    const selectedCustomer = customers.find(c => c.id === customerId);

    // Filter technicians by department (role = tech or technician)
    const availableTechnicians = technicians.filter(t =>
        t.role === 'technician' || t.role === 'tech' as string
    );

    // Get technicians for a specific department
    const getTechniciansForDepartment = (department?: string) => {
        if (!department) return availableTechnicians;
        return availableTechnicians.filter(t =>
            t.department?.toLowerCase().includes(department.toLowerCase()) ||
            !t.department // Show technicians without department as available
        );
    };

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
                // Check if already applied
                if (appliedVoucher?.id === voucher.id) {
                    toast.info('Voucher này đã được áp dụng');
                    return;
                }
                setAppliedVoucher(voucher);
                toast.success(`Đã áp dụng voucher: ${voucher.name}`);
            }
            return;
        }

        let item: { id: string; name: string; price: number; department?: string } | undefined;
        let packageServices: { service_id: string; service_name: string; department?: string }[] | undefined;

        if (type === 'product') {
            item = products.find(i => i.id === itemId);
        } else if (type === 'service') {
            item = services.find(i => i.id === itemId);
        } else if (type === 'package') {
            const pkg = packages.find(i => i.id === itemId);
            if (pkg) {
                item = { id: pkg.id, name: pkg.name, price: pkg.price };
                // Get services in package with their department info
                if (pkg.items && pkg.items.length > 0) {
                    packageServices = pkg.items.map(pkgItem => {
                        const svc = services.find(s => s.id === pkgItem.service_id);
                        return {
                            service_id: pkgItem.service_id,
                            service_name: svc?.name || pkgItem.service_name || 'Dịch vụ',
                            department: svc?.department
                        };
                    }).filter(s => s.department); // Only include services with department
                }
            }
        }

        if (!item) return;

        // Check if item already exists
        const existingIndex = items.findIndex(i => i.item_id === itemId && i.type === type);
        if (existingIndex >= 0) {
            // Increase quantity
            setItems(prev => prev.map((item, i) =>
                i === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
            ));
        } else {
            setItems(prev => [...prev, {
                type,
                item_id: item!.id,
                name: item!.name,
                quantity: 1,
                unit_price: item!.price,
                department: type === 'service' ? (item as { department?: string }).department : undefined,
                package_services: type === 'package' && packageServices && packageServices.length > 0 ? packageServices : undefined
            }]);
        }

        // Clear search after adding
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

    const handleAssignTechnician = (index: number, technicianId: string) => {
        setItems(prev => prev.map((item, i) =>
            i === index ? { ...item, technician_id: technicianId || undefined } : item
        ));
    };

    // Assign technician to a specific service within a package
    const handleAssignPackageServiceTechnician = (itemIndex: number, serviceId: string, technicianId: string) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== itemIndex || !item.package_services) return item;
            return {
                ...item,
                package_services: item.package_services.map(svc =>
                    svc.service_id === serviceId
                        ? { ...svc, technician_id: technicianId || undefined }
                        : svc
                )
            };
        }));
    };

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    // Calculate voucher discount
    const voucherDiscount = appliedVoucher
        ? (appliedVoucher.type === 'percentage'
            ? Math.min(
                (subtotal * appliedVoucher.value) / 100,
                appliedVoucher.max_discount || Infinity
            )
            : appliedVoucher.value)
        : 0;

    // Check min order value for voucher
    const voucherValid = !appliedVoucher || subtotal >= (appliedVoucher.min_order_value || 0);
    const effectiveVoucherDiscount = voucherValid ? voucherDiscount : 0;

    // Total discount = voucher + manual discount
    const totalDiscount = effectiveVoucherDiscount + manualDiscount;
    const total = Math.max(0, subtotal - totalDiscount);

    const handleSubmit = async () => {
        if (!customerId || items.length === 0) {
            toast.error('Vui lòng chọn khách hàng và thêm ít nhất một sản phẩm/dịch vụ');
            return;
        }

        if (appliedVoucher && !voucherValid) {
            toast.error(`Đơn hàng phải đạt tối thiểu ${formatCurrency(appliedVoucher.min_order_value || 0)} để áp dụng voucher`);
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit({
                customer_id: customerId,
                items: items.map(item => ({
                    type: item.type,
                    item_id: item.item_id,
                    name: item.name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    technician_id: item.technician_id
                })),
                notes: notes || undefined,
                discount: totalDiscount > 0 ? totalDiscount : undefined
            });
            // Reset form
            setCustomerId('');
            setCustomerSearch('');
            setNotes('');
            setManualDiscount(0);
            setAppliedVoucher(null);
            setItems([]);
            setItemSearch('');
            onClose();
        } catch {
            // Error handled in parent
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-primary" />
                        Tạo đơn hàng mới
                    </DialogTitle>
                    <DialogDescription>Chọn khách hàng và thêm sản phẩm/dịch vụ vào đơn hàng</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-4">
                    {/* Customer Selection with Search */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            Khách hàng <span className="text-red-500">*</span>
                            <span className="text-xs text-muted-foreground ml-2">(Chỉ hiển thị khách hàng đang hoạt động)</span>
                        </Label>

                        {selectedCustomer ? (
                            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                                <Avatar className="h-10 w-10">
                                    <AvatarFallback className="bg-primary text-white">
                                        {selectedCustomer.name.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <p className="font-semibold">{selectedCustomer.name}</p>
                                    <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCustomerId('')}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    Thay đổi
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Tìm kiếm theo tên hoặc số điện thoại..."
                                        value={customerSearch}
                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                <div className="max-h-40 overflow-y-auto border rounded-lg">
                                    {filteredCustomers.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            Không tìm thấy khách hàng
                                        </p>
                                    ) : (
                                        <div className="divide-y">
                                            {filteredCustomers.slice(0, 10).map(c => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setCustomerId(c.id);
                                                        setCustomerSearch('');
                                                    }}
                                                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                                                >
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                                            {c.name.charAt(0)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm truncate">{c.name}</p>
                                                        <p className="text-xs text-muted-foreground">{c.phone}</p>
                                                    </div>
                                                </button>
                                            ))}
                                            {filteredCustomers.length > 10 && (
                                                <p className="text-xs text-center py-2 text-muted-foreground">
                                                    Và {filteredCustomers.length - 10} khách hàng khác...
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Add Items with Tabs */}
                    <div className="space-y-3">
                        <Label className="flex items-center gap-1">
                            <Plus className="h-4 w-4" />
                            Thêm vào đơn hàng
                        </Label>

                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="grid grid-cols-4 w-full">
                                <TabsTrigger value="product" className="gap-1">
                                    <ShoppingBag className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Sản phẩm</span>
                                    <span className="sm:hidden">SP</span>
                                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                                        {products.length}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="service" className="gap-1">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Dịch vụ</span>
                                    <span className="sm:hidden">DV</span>
                                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                                        {services.length}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="package" className="gap-1">
                                    <Package className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Gói DV</span>
                                    <span className="sm:hidden">Gói</span>
                                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                                        {packages.filter(p => p.status === 'active').length}
                                    </Badge>
                                </TabsTrigger>
                                <TabsTrigger value="voucher" className="gap-1">
                                    <Gift className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Voucher</span>
                                    <span className="sm:hidden">VC</span>
                                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                                        {vouchers.filter(v => v.status === 'active').length}
                                    </Badge>
                                </TabsTrigger>
                            </TabsList>

                            {/* Search */}
                            <div className="relative mt-3">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={`Tìm kiếm ${activeTab === 'product' ? 'sản phẩm' : activeTab === 'service' ? 'dịch vụ' : activeTab === 'package' ? 'gói dịch vụ' : 'voucher'}...`}
                                    value={itemSearch}
                                    onChange={(e) => setItemSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>

                            {/* Product Tab */}
                            <TabsContent value="product" className="mt-2">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                                    {filteredProducts.length === 0 ? (
                                        <p className="col-span-full text-sm text-muted-foreground text-center py-4">
                                            Không tìm thấy sản phẩm
                                        </p>
                                    ) : (
                                        filteredProducts.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => handleAddItem('product', p.id)}
                                                className="flex flex-col items-start p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                                            >
                                                <span className="font-medium text-sm truncate w-full">{p.name}</span>
                                                <span className="text-primary font-semibold">{formatCurrency(p.price)}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </TabsContent>

                            {/* Service Tab */}
                            <TabsContent value="service" className="mt-2">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                                    {filteredServices.length === 0 ? (
                                        <p className="col-span-full text-sm text-muted-foreground text-center py-4">
                                            Không tìm thấy dịch vụ
                                        </p>
                                    ) : (
                                        filteredServices.map(s => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => handleAddItem('service', s.id)}
                                                className="flex flex-col items-start p-3 rounded-lg border hover:border-purple-500 hover:bg-purple-50 transition-colors text-left"
                                            >
                                                <span className="font-medium text-sm truncate w-full">{s.name}</span>
                                                <span className="text-purple-600 font-semibold">{formatCurrency(s.price)}</span>
                                                {s.department && (
                                                    <span className="text-xs text-muted-foreground mt-1">
                                                        <Wrench className="h-3 w-3 inline mr-1" />
                                                        {getDepartmentLabel(s.department)}
                                                    </span>
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </TabsContent>

                            {/* Package Tab */}
                            <TabsContent value="package" className="mt-2">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                                    {filteredPackages.length === 0 ? (
                                        <p className="col-span-full text-sm text-muted-foreground text-center py-4">
                                            Không có gói dịch vụ nào
                                        </p>
                                    ) : (
                                        filteredPackages.map(pkg => (
                                            <button
                                                key={pkg.id}
                                                type="button"
                                                onClick={() => handleAddItem('package', pkg.id)}
                                                className="flex flex-col items-start p-3 rounded-lg border hover:border-emerald-500 hover:bg-emerald-50 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-1 mb-1">
                                                    <Package className="h-3.5 w-3.5 text-emerald-600" />
                                                    <span className="font-medium text-sm truncate">{pkg.name}</span>
                                                </div>
                                                <span className="text-emerald-600 font-semibold">{formatCurrency(pkg.price)}</span>
                                                {pkg.items && pkg.items.length > 0 && (
                                                    <span className="text-xs text-muted-foreground mt-1">
                                                        {pkg.items.length} dịch vụ
                                                    </span>
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </TabsContent>

                            {/* Voucher Tab */}
                            <TabsContent value="voucher" className="mt-2">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                                    {filteredVouchers.length === 0 ? (
                                        <p className="col-span-full text-sm text-muted-foreground text-center py-4">
                                            Không có voucher nào
                                        </p>
                                    ) : (
                                        filteredVouchers.map(v => (
                                            <button
                                                key={v.id}
                                                type="button"
                                                onClick={() => handleAddItem('voucher', v.id)}
                                                className="flex flex-col items-start p-3 rounded-lg border hover:border-amber-500 hover:bg-amber-50 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-1 mb-1">
                                                    <Gift className="h-3.5 w-3.5 text-amber-600" />
                                                    <span className="font-medium text-sm truncate">{v.name}</span>
                                                </div>
                                                <Badge variant="outline" className="text-xs">{v.code}</Badge>
                                                <span className="text-amber-600 font-semibold mt-1">
                                                    {v.type === 'percentage' ? `Giảm ${v.value}%` : formatCurrency(v.value)}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Items List */}
                    {items.length > 0 && (
                        <div className="space-y-2">
                            <Label className="flex items-center justify-between">
                                <span>Danh sách đã chọn ({items.length})</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-red-500 hover:text-red-600 h-7"
                                    onClick={() => setItems([])}
                                >
                                    Xóa tất cả
                                </Button>
                            </Label>
                            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                                {items.map((item, index) => (
                                    <div key={index} className="p-3 hover:bg-muted/30">
                                        <div className="flex items-center gap-3">
                                            <Badge className={`${getItemTypeColor(item.type)} shrink-0`}>
                                                {getItemTypeLabel(item.type)}
                                            </Badge>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{item.name}</p>
                                                <p className="text-xs text-muted-foreground">{formatCurrency(item.unit_price)}</p>
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

                                        {/* Technician Assignment for Services */}
                                        {item.type === 'service' && (
                                            <div className="mt-2 ml-16 flex items-center gap-2">
                                                <Wrench className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-sm text-muted-foreground">KTV:</span>
                                                {availableTechnicians.length > 0 ? (
                                                    <Select
                                                        value={item.technician_id || 'none'}
                                                        onValueChange={(value) => handleAssignTechnician(index, value === 'none' ? '' : value)}
                                                    >
                                                        <SelectTrigger className="h-8 w-48">
                                                            <SelectValue placeholder="Chọn kỹ thuật viên" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Chưa phân công</SelectItem>
                                                            {getTechniciansForDepartment(item.department).map(tech => (
                                                                <SelectItem key={tech.id} value={tech.id}>
                                                                    {tech.name}
                                                                    {tech.department && (
                                                                        <span className="text-xs text-muted-foreground ml-1">
                                                                            ({tech.department})
                                                                        </span>
                                                                    )}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">Không có KTV</span>
                                                )}
                                                {item.department && (
                                                    <Badge variant="outline" className="text-xs">
                                                        {getDepartmentLabel(item.department)}
                                                    </Badge>
                                                )}
                                            </div>
                                        )}

                                        {/* Technician Assignment for Package Services */}
                                        {item.type === 'package' && item.package_services && item.package_services.length > 0 && availableTechnicians.length > 0 && (
                                            <div className="mt-2 ml-16 space-y-2 border-l-2 border-purple-200 pl-3">
                                                <span className="text-xs text-muted-foreground font-medium">Phân công KTV cho dịch vụ trong gói:</span>
                                                {item.package_services.map(svc => (
                                                    <div key={svc.service_id} className="flex items-center gap-2">
                                                        <Wrench className="h-3 w-3 text-purple-500" />
                                                        <span className="text-xs text-foreground w-32 truncate" title={svc.service_name}>
                                                            {svc.service_name}
                                                        </span>
                                                        <Select
                                                            value={svc.technician_id || 'none'}
                                                            onValueChange={(value) => handleAssignPackageServiceTechnician(index, svc.service_id, value === 'none' ? '' : value)}
                                                        >
                                                            <SelectTrigger className="h-7 w-40 text-xs">
                                                                <SelectValue placeholder="Chọn KTV" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">Chưa phân công</SelectItem>
                                                                {getTechniciansForDepartment(svc.department).map(tech => (
                                                                    <SelectItem key={tech.id} value={tech.id}>
                                                                        {tech.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        {svc.department && (
                                                            <Badge variant="outline" className="text-xs">
                                                                {getDepartmentLabel(svc.department)}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Applied Voucher */}
                    {appliedVoucher && (
                        <div className={`p-3 rounded-lg border ${voucherValid ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Gift className={`h-4 w-4 ${voucherValid ? 'text-amber-600' : 'text-red-600'}`} />
                                    <div>
                                        <span className={`font-medium text-sm ${voucherValid ? 'text-amber-700' : 'text-red-700'}`}>
                                            {appliedVoucher.name}
                                        </span>
                                        <Badge variant="outline" className="ml-2 text-xs">
                                            {appliedVoucher.code}
                                        </Badge>
                                    </div>
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
                            {!voucherValid && appliedVoucher.min_order_value && (
                                <p className="text-xs text-red-600 mt-1">
                                    Đơn hàng tối thiểu {formatCurrency(appliedVoucher.min_order_value)} để áp dụng voucher này
                                </p>
                            )}
                            {appliedVoucher.max_discount && voucherValid && (
                                <p className="text-xs text-amber-600 mt-1">
                                    Giảm tối đa: {formatCurrency(appliedVoucher.max_discount)}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Summary */}
                    {items.length > 0 && (
                        <div className="space-y-2 p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/10">
                            <div className="flex justify-between text-sm">
                                <span>Tạm tính ({items.length} sản phẩm):</span>
                                <span className="font-semibold">{formatCurrency(subtotal)}</span>
                            </div>

                            {/* Voucher Discount */}
                            {appliedVoucher && voucherValid && effectiveVoucherDiscount > 0 && (
                                <div className="flex justify-between text-sm text-amber-600">
                                    <span className="flex items-center gap-1">
                                        <Gift className="h-3.5 w-3.5" />
                                        Voucher ({appliedVoucher.code}):
                                    </span>
                                    <span className="font-semibold">-{formatCurrency(effectiveVoucherDiscount)}</span>
                                </div>
                            )}

                            {/* Manual Discount */}
                            <div className="flex justify-between items-center">
                                <span className="text-sm">Giảm giá thêm:</span>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min="0"
                                        max={subtotal - effectiveVoucherDiscount}
                                        value={manualDiscount}
                                        onChange={(e) => setManualDiscount(Math.min(subtotal - effectiveVoucherDiscount, Number(e.target.value)))}
                                        className="w-32 text-right h-8"
                                    />
                                </div>
                            </div>

                            {/* Total Discount */}
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
                            placeholder="Ghi chú thêm về đơn hàng..."
                        />
                    </div>
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button variant="outline" onClick={onClose} disabled={submitting}>Huỷ</Button>
                    <Button onClick={handleSubmit} disabled={submitting || !customerId || items.length === 0}>
                        {submitting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Đang tạo...
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4 mr-2" />
                                Tạo đơn hàng
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
