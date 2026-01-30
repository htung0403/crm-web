import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
    ArrowLeft, Plus, Trash, Package, Gift, Search, Sparkles, ShoppingBag,
    Loader2, User, Wrench, QrCode, CheckCircle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { useCustomers } from '@/hooks/useCustomers';
import { useProducts } from '@/hooks/useProducts';
import { usePackages } from '@/hooks/usePackages';
import { useVouchers } from '@/hooks/useVouchers';
import { useUsers } from '@/hooks/useUsers';
import { useDepartments } from '@/hooks/useDepartments';
import { useOrders } from '@/hooks/useOrders';
import type { Package as PackageType, Voucher } from '@/types';
import { getItemTypeLabel, getItemTypeColor, type OrderItem } from '@/components/orders/constants';
import { OrderConfirmationDialog } from '@/components/orders/OrderConfirmationDialog';

// Simple helper to display department - look up name from ID
const getDepartmentLabel = (deptId: string | undefined, departments: { id: string; name: string }[]) => {
    if (!deptId) return '';
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || '';
};

export function CreateOrderPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialCustomerPhone = searchParams.get('phone');
    const initialCustomerName = searchParams.get('name');

    // Hooks for data
    const { customers, fetchCustomers } = useCustomers();
    const { products, services, fetchProducts, fetchServices } = useProducts();
    const { packages, fetchPackages } = usePackages();
    const { vouchers, fetchVouchers } = useVouchers();
    const { users: technicians, fetchTechnicians } = useUsers();
    const { departments, fetchDepartments } = useDepartments();
    const { createOrder } = useOrders();

    // Form state
    const [customerId, setCustomerId] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [notes, setNotes] = useState('');
    const [manualDiscount, setManualDiscount] = useState(0);
    const [itemSearch, setItemSearch] = useState('');
    const [activeTab, setActiveTab] = useState('product');
    const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
    const [items, setItems] = useState<OrderItem[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    // Technician dialog state
    const [techDialogOpen, setTechDialogOpen] = useState(false);
    const [techDialogItemIndex, setTechDialogItemIndex] = useState<number | null>(null);
    const [techDialogServiceId, setTechDialogServiceId] = useState<string | null>(null); // for package services
    const [techDialogCommissions, setTechDialogCommissions] = useState<Record<string, number>>({}); // track commission by tech id
    // Confirmation dialog state
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [createdOrder, setCreatedOrder] = useState<any>(null);

    // Fetch all required data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                await Promise.all([
                    fetchCustomers({ status: 'active' }),
                    fetchProducts({ status: 'active' }),
                    fetchServices({ status: 'active' }),
                    fetchPackages(),
                    fetchVouchers(),
                    fetchTechnicians(),
                    fetchDepartments()
                ]);
            } catch {
                toast.error('Lỗi khi tải dữ liệu');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [fetchCustomers, fetchProducts, fetchServices, fetchPackages, fetchVouchers, fetchTechnicians, fetchDepartments]);

    // Handle initial customer from URL params
    useEffect(() => {
        if (initialCustomerPhone && customers.length > 0) {
            const matchedCustomer = customers.find(c => c.phone === initialCustomerPhone);
            if (matchedCustomer) {
                setCustomerId(matchedCustomer.id);
                setCustomerSearch('');
            } else {
                setCustomerSearch(initialCustomerPhone || initialCustomerName || '');
            }
        }
    }, [initialCustomerPhone, initialCustomerName, customers]);

    // Filter only active customers
    const activeCustomers = customers.filter(c => c.status === 'active' || !c.status);

    // Filter customers by search
    const filteredCustomers = activeCustomers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone.includes(customerSearch)
    );

    // Get selected customer info
    const selectedCustomer = customers.find(c => c.id === customerId);

    // Filter technicians by role
    const availableTechnicians = technicians.filter(t =>
        t.role === 'technician' || t.role === 'tech' as string
    );

    // Get technicians for a specific department
    const getTechniciansForDepartment = (department?: string) => {
        if (!department) return availableTechnicians;
        return availableTechnicians.filter(t =>
            t.department?.toLowerCase().includes(department.toLowerCase()) ||
            !t.department
        );
    };

    // Generate unique item code for QR
    const generateItemCode = () => {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `IT${timestamp}${random}`;
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

        let item: { id: string; name: string; price: number; department?: string; commission_sale?: number; commission_tech?: number } | undefined;
        let packageServices: { service_id: string; service_name: string; department?: string }[] | undefined;

        if (type === 'product') {
            const prod = products.find(i => i.id === itemId);
            if (prod) {
                item = { id: prod.id, name: prod.name, price: prod.price, commission_sale: prod.commission_sale, commission_tech: prod.commission_tech };
            }
        } else if (type === 'service') {
            const svc = services.find(i => i.id === itemId);
            if (svc) {
                item = { id: svc.id, name: svc.name, price: svc.price, department: svc.department, commission_sale: svc.commission_sale, commission_tech: svc.commission_tech };
            }
        } else if (type === 'package') {
            const pkg = packages.find(i => i.id === itemId);
            if (pkg) {
                item = { id: pkg.id, name: pkg.name, price: pkg.price, commission_sale: pkg.commission_sale, commission_tech: pkg.commission_tech };
                if (pkg.items && pkg.items.length > 0) {
                    packageServices = pkg.items.map(pkgItem => {
                        const svc = services.find(s => s.id === pkgItem.service_id);
                        return {
                            service_id: pkgItem.service_id,
                            service_name: svc?.name || pkgItem.service_name || 'Dịch vụ',
                            department: svc?.department
                        };
                    }).filter(s => s.department);
                }
            }
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
                item_code: generateItemCode(),
                name: item!.name,
                quantity: 1,
                unit_price: item!.price,
                commission_sale: item!.commission_sale || 0,
                commission_tech: item!.commission_tech || 0,
                department: item!.department,
                package_services: type === 'package' && packageServices && packageServices.length > 0 ? packageServices : undefined
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

    const handleUpdateCommission = (index: number, field: 'commission_sale' | 'commission_tech', value: number) => {
        if (value < 0 || value > 100) return;
        setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const handleToggleTechnician = (index: number, technicianId: string, technicianName: string, defaultCommission: number = 0) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== index) return item;
            const currentTechs = item.technicians || [];
            const exists = currentTechs.find(t => t.technician_id === technicianId);
            const newTechs = exists
                ? currentTechs.filter(t => t.technician_id !== technicianId)
                : [...currentTechs, { technician_id: technicianId, technician_name: technicianName, commission_rate: defaultCommission }];
            return { ...item, technicians: newTechs.length > 0 ? newTechs : undefined };
        }));
    };

    const handleUpdateTechnicianCommission = (index: number, technicianId: string, commissionRate: number) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== index || !item.technicians) return item;
            return {
                ...item,
                technicians: item.technicians.map(t =>
                    t.technician_id === technicianId ? { ...t, commission_rate: commissionRate } : t
                )
            };
        }));
    };

    const handleTogglePackageServiceTechnician = (itemIndex: number, serviceId: string, technicianId: string, technicianName: string, defaultCommission: number = 0) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== itemIndex || !item.package_services) return item;
            return {
                ...item,
                package_services: item.package_services.map(svc => {
                    if (svc.service_id !== serviceId) return svc;
                    const currentTechs = svc.technicians || [];
                    const exists = currentTechs.find(t => t.technician_id === technicianId);
                    const newTechs = exists
                        ? currentTechs.filter(t => t.technician_id !== technicianId)
                        : [...currentTechs, { technician_id: technicianId, technician_name: technicianName, commission_rate: defaultCommission }];
                    return { ...svc, technicians: newTechs.length > 0 ? newTechs : undefined };
                })
            };
        }));
    };

    const handleUpdatePackageServiceTechnicianCommission = (itemIndex: number, serviceId: string, technicianId: string, commissionRate: number) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== itemIndex || !item.package_services) return item;
            return {
                ...item,
                package_services: item.package_services.map(svc => {
                    if (svc.service_id !== serviceId || !svc.technicians) return svc;
                    return {
                        ...svc,
                        technicians: svc.technicians.map(t =>
                            t.technician_id === technicianId ? { ...t, commission_rate: commissionRate } : t
                        )
                    };
                })
            };
        }));
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
            const order = await createOrder({
                customer_id: customerId,
                items: items.map(item => ({
                    type: item.type,
                    item_id: item.item_id,
                    name: item.name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    technicians: item.technicians
                })),
                notes: notes || undefined,
                discount: totalDiscount > 0 ? totalDiscount : undefined
            });

            // Store created order and show confirmation dialog
            setCreatedOrder({
                ...order,
                customer: selectedCustomer,
                items: items.map(item => ({
                    id: item.item_id,
                    item_name: item.name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total_price: item.quantity * item.unit_price,
                    item_type: item.type
                })),
                total_amount: total
            });
            setShowConfirmDialog(true);
            toast.success('Đã tạo đơn hàng thành công!');
        } catch {
            toast.error('Lỗi khi tạo đơn hàng');
        } finally {
            setSubmitting(false);
        }
    };

    // Handle dialog close - navigate to order detail
    const handleConfirmDialogClose = () => {
        setShowConfirmDialog(false);
        if (createdOrder?.id) {
            navigate(`/orders/${createdOrder.id}`);
        } else {
            navigate('/orders');
        }
    };

    // Handle after confirm - navigate to order detail
    const handleOrderConfirmed = () => {
        if (createdOrder?.id) {
            navigate(`/orders/${createdOrder.id}`);
        } else {
            navigate('/orders');
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                    <p className="mt-4 text-muted-foreground">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ShoppingBag className="h-6 w-6 text-primary" />
                        Tạo đơn hàng mới
                    </h1>
                    <p className="text-muted-foreground">Chọn khách hàng và thêm sản phẩm/dịch vụ vào đơn hàng</p>
                </div>
            </div>

            {/* Main Content - 2 Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Customer & Items Selection (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer Selection */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" />
                                Khách hàng <span className="text-red-500">*</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {selectedCustomer ? (
                                <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                                    <Avatar className="h-12 w-12">
                                        <AvatarFallback className="bg-primary text-white text-lg">
                                            {selectedCustomer.name.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <p className="font-semibold text-lg">{selectedCustomer.name}</p>
                                        <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCustomerId('')}
                                    >
                                        Đổi khách
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Tìm kiếm theo tên hoặc số điện thoại..."
                                            value={customerSearch}
                                            onChange={(e) => setCustomerSearch(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                    <div className="max-h-60 overflow-y-auto border rounded-lg">
                                        {filteredCustomers.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-8">
                                                Không tìm thấy khách hàng
                                            </p>
                                        ) : (
                                            <div className="divide-y">
                                                {filteredCustomers.slice(0, 15).map(c => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setCustomerId(c.id);
                                                            setCustomerSearch('');
                                                        }}
                                                        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                                                    >
                                                        <Avatar className="h-10 w-10">
                                                            <AvatarFallback className="text-sm bg-primary/10 text-primary">
                                                                {c.name.charAt(0)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium truncate">{c.name}</p>
                                                            <p className="text-sm text-muted-foreground">{c.phone}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Add Items with Tabs */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Plus className="h-4 w-4 text-primary" />
                                Thêm vào đơn hàng
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
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
                                <div className="relative mt-4">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder={`Tìm kiếm ${activeTab === 'product' ? 'sản phẩm' : activeTab === 'service' ? 'dịch vụ' : activeTab === 'package' ? 'gói dịch vụ' : 'voucher'}...`}
                                        value={itemSearch}
                                        onChange={(e) => setItemSearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>

                                {/* Product Tab */}
                                <TabsContent value="product" className="mt-3">
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
                                        {filteredProducts.length === 0 ? (
                                            <p className="col-span-full text-sm text-muted-foreground text-center py-8">
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
                                                    <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center mb-2">
                                                        {p.image ? (
                                                            <img src={p.image} alt={p.name} className="w-full h-full rounded-lg object-cover" />
                                                        ) : (
                                                            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                    <span className="font-medium text-sm truncate w-full">{p.name}</span>
                                                    <span className="text-primary font-semibold text-sm">{formatCurrency(p.price)}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </TabsContent>

                                {/* Service Tab */}
                                <TabsContent value="service" className="mt-3">
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
                                        {filteredServices.length === 0 ? (
                                            <p className="col-span-full text-sm text-muted-foreground text-center py-8">
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
                                                    <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center mb-2">
                                                        {s.image ? (
                                                            <img src={s.image} alt={s.name} className="w-full h-full rounded-lg object-cover" />
                                                        ) : (
                                                            <Sparkles className="h-8 w-8 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                    <span className="font-medium text-sm truncate w-full">{s.name}</span>
                                                    <span className="text-purple-600 font-semibold text-sm">{formatCurrency(s.price)}</span>
                                                    {s.department && getDepartmentLabel(s.department, departments) && (
                                                        <span className="text-xs text-muted-foreground truncate w-full">
                                                            {getDepartmentLabel(s.department, departments)}
                                                        </span>
                                                    )}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </TabsContent>

                                {/* Package Tab */}
                                <TabsContent value="package" className="mt-3">
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
                                        {filteredPackages.length === 0 ? (
                                            <p className="col-span-full text-sm text-muted-foreground text-center py-8">
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
                                                    <div className="flex items-center gap-1 mb-2">
                                                        <Package className="h-4 w-4 text-emerald-600" />
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
                                <TabsContent value="voucher" className="mt-3">
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
                                        {filteredVouchers.length === 0 ? (
                                            <p className="col-span-full text-sm text-muted-foreground text-center py-8">
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
                                                        <Gift className="h-4 w-4 text-amber-600" />
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
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Selected Items + Summary (1/3 width) */}
                <div className="lg:col-span-1">
                    <div className="lg:sticky lg:top-24 space-y-4">
                        {/* Selected Items List */}
                        {items.length > 0 && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-primary" />
                                            Danh sách đã chọn ({items.length})
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-red-500 hover:text-red-600 h-7"
                                            onClick={() => setItems([])}
                                        >
                                            Xóa tất cả
                                        </Button>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="divide-y max-h-[350px] overflow-y-auto">
                                        {items.map((item, index) => (
                                            <div key={index} className="py-4 first:pt-0 last:pb-0">
                                                <div className="flex items-start gap-3">
                                                    <div className="shrink-0 p-1 bg-white border rounded-lg">
                                                        {item.item_code ? (
                                                            <QRCodeSVG
                                                                value={`${window.location.origin}/item/${item.type}/${item.item_id}`}
                                                                size={48}
                                                                level="M"
                                                            />
                                                        ) : (
                                                            <QrCode className="h-12 w-12 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Badge className={`${getItemTypeColor(item.type)} shrink-0`}>
                                                                {getItemTypeLabel(item.type)}
                                                            </Badge>
                                                            <p className="font-medium truncate">{item.name}</p>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">{formatCurrency(item.unit_price)}</p>

                                                        {/* Quantity controls */}
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="h-8 w-8"
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
                                                                className="w-16 text-center h-8"
                                                            />
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => handleUpdateQuantity(index, item.quantity + 1)}
                                                            >
                                                                +
                                                            </Button>
                                                            <span className="font-semibold ml-auto">
                                                                {formatCurrency(item.quantity * item.unit_price)}
                                                            </span>
                                                        </div>

                                                        {/* Commission inputs */}
                                                        <div className="mt-3 flex items-center gap-4 text-sm">
                                                            <span className="text-muted-foreground">Hoa hồng:</span>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs text-muted-foreground">Sale</span>
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    max={100}
                                                                    value={item.commission_sale || 0}
                                                                    onChange={(e) => handleUpdateCommission(index, 'commission_sale', Number(e.target.value))}
                                                                    className="w-16 h-7 text-center text-xs"
                                                                />
                                                                <span className="text-xs text-muted-foreground">%</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs text-muted-foreground">KTV</span>
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    max={100}
                                                                    value={item.commission_tech || 0}
                                                                    onChange={(e) => handleUpdateCommission(index, 'commission_tech', Number(e.target.value))}
                                                                    className="w-16 h-7 text-center text-xs"
                                                                />
                                                                <span className="text-xs text-muted-foreground">%</span>
                                                            </div>
                                                        </div>

                                                        {/* Technician Assignment for Services */}
                                                        {item.type === 'service' && (
                                                            <div className="mt-3">
                                                                <div className="flex items-center gap-2">
                                                                    <Wrench className="h-4 w-4 text-muted-foreground" />
                                                                    <span className="text-sm text-muted-foreground">KTV:</span>
                                                                    {item.department && (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            {getDepartmentLabel(item.department, departments)}
                                                                        </Badge>
                                                                    )}
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-7 px-2 ml-auto"
                                                                        onClick={() => {
                                                                            setTechDialogItemIndex(index);
                                                                            setTechDialogServiceId(null);
                                                                            setTechDialogOpen(true);
                                                                        }}
                                                                    >
                                                                        <Plus className="h-3.5 w-3.5 mr-1" />
                                                                        Thêm KTV
                                                                    </Button>
                                                                </div>
                                                                {/* Display assigned technicians */}
                                                                {item.technicians && item.technicians.length > 0 && (
                                                                    <div className="mt-2 space-y-1 ml-6">
                                                                        {item.technicians.map(t => {
                                                                            const commissionAmount = Math.round(item.unit_price * item.quantity * t.commission_rate / 100);
                                                                            return (
                                                                                <div key={t.technician_id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-2 py-1.5">
                                                                                    <span className="text-sm font-medium flex-1 truncate">{t.technician_name}</span>
                                                                                    <span className="text-xs text-muted-foreground">HH:</span>
                                                                                    <input
                                                                                        type="number"
                                                                                        min="0"
                                                                                        max="100"
                                                                                        value={t.commission_rate || ''}
                                                                                        onChange={(e) => handleUpdateTechnicianCommission(index, t.technician_id, Number(e.target.value) || 0)}
                                                                                        onFocus={(e) => e.target.select()}
                                                                                        placeholder="0"
                                                                                        className="w-14 h-6 text-xs px-2 border rounded text-center"
                                                                                    />
                                                                                    <span className="text-xs text-muted-foreground">%</span>
                                                                                    <span className="text-xs font-medium text-green-600">
                                                                                        = {formatCurrency(commissionAmount)}
                                                                                    </span>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-6 w-6 text-red-500 hover:bg-red-100"
                                                                                        onClick={() => handleToggleTechnician(index, t.technician_id, t.technician_name || '', 0)}
                                                                                    >
                                                                                        <Trash className="h-3.5 w-3.5" />
                                                                                    </Button>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Technician Assignment for Package Services */}
                                                        {item.type === 'package' && item.package_services && item.package_services.length > 0 && availableTechnicians.length > 0 && (
                                                            <div className="mt-3 space-y-3 border-l-2 border-purple-200 pl-3">
                                                                <span className="text-xs text-muted-foreground font-medium">Phân công KTV cho dịch vụ trong gói:</span>
                                                                {item.package_services.map(svc => (
                                                                    <div key={svc.service_id} className="space-y-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <Wrench className="h-3 w-3 text-purple-500" />
                                                                            <span className="text-xs font-medium text-foreground" title={svc.service_name}>
                                                                                {svc.service_name}
                                                                            </span>
                                                                            {svc.department && (
                                                                                <Badge variant="outline" className="text-xs">
                                                                                    {getDepartmentLabel(svc.department, departments)}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-2 ml-5">
                                                                            {getTechniciansForDepartment(svc.department).map(tech => (
                                                                                <label key={tech.id} className="flex items-center gap-1.5 cursor-pointer">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={svc.technicians?.some(t => t.technician_id === tech.id) || false}
                                                                                        onChange={() => handleTogglePackageServiceTechnician(index, svc.service_id, tech.id, tech.name, 0)}
                                                                                        className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                                                                                    />
                                                                                    <span className="text-xs">{tech.name}</span>
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                        {svc.technicians && svc.technicians.length > 0 && (
                                                                            <div className="ml-5 space-y-1 border-l-2 border-purple-200 pl-2">
                                                                                {svc.technicians.map(t => (
                                                                                    <div key={t.technician_id} className="flex items-center gap-2">
                                                                                        <span className="text-xs text-muted-foreground w-24 truncate">{t.technician_name}</span>
                                                                                        <span className="text-xs text-muted-foreground">Hoa hồng:</span>
                                                                                        <input
                                                                                            type="number"
                                                                                            min="0"
                                                                                            max="100"
                                                                                            value={t.commission_rate}
                                                                                            onChange={(e) => handleUpdatePackageServiceTechnicianCommission(index, svc.service_id, t.technician_id, Number(e.target.value))}
                                                                                            className="w-14 h-5 text-xs px-1 border rounded text-center"
                                                                                        />
                                                                                        <span className="text-xs text-muted-foreground">%</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveItem(index)}
                                                        className="text-red-500 hover:bg-red-50 shrink-0 h-9 w-9"
                                                    >
                                                        <Trash className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                        {/* Applied Voucher */}
                        {appliedVoucher && (
                            <Card className={voucherValid ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Gift className={`h-5 w-5 ${voucherValid ? 'text-amber-600' : 'text-red-600'}`} />
                                            <div>
                                                <span className={`font-medium ${voucherValid ? 'text-amber-700' : 'text-red-700'}`}>
                                                    {appliedVoucher.name}
                                                </span>
                                                <Badge variant="outline" className="ml-2 text-xs">
                                                    {appliedVoucher.code}
                                                </Badge>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-red-500 hover:bg-red-100"
                                            onClick={handleRemoveVoucher}
                                        >
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <p className={`text-sm font-semibold mt-1 ${voucherValid ? 'text-amber-700' : 'text-red-700'}`}>
                                        {appliedVoucher.type === 'percentage'
                                            ? `-${appliedVoucher.value}%`
                                            : `-${formatCurrency(appliedVoucher.value)}`}
                                    </p>
                                    {!voucherValid && appliedVoucher.min_order_value && (
                                        <p className="text-xs text-red-600 mt-1">
                                            Đơn hàng tối thiểu {formatCurrency(appliedVoucher.min_order_value)} để áp dụng
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Order Summary */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Tổng đơn hàng</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span>Tạm tính ({items.length} sản phẩm):</span>
                                    <span className="font-semibold">{formatCurrency(subtotal)}</span>
                                </div>

                                {appliedVoucher && voucherValid && effectiveVoucherDiscount > 0 && (
                                    <div className="flex justify-between text-sm text-amber-600">
                                        <span className="flex items-center gap-1">
                                            <Gift className="h-3.5 w-3.5" />
                                            Voucher:
                                        </span>
                                        <span className="font-semibold">-{formatCurrency(effectiveVoucherDiscount)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center">
                                    <Label className="text-sm">Giảm giá thêm:</Label>
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
                                    <div className="flex justify-between text-sm text-green-600">
                                        <span>Tổng giảm:</span>
                                        <span className="font-semibold">-{formatCurrency(totalDiscount)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between text-lg font-bold pt-3 border-t">
                                    <span>Tổng thanh toán:</span>
                                    <span className="text-primary text-xl">{formatCurrency(total)}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Notes */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Ghi chú</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <textarea
                                    className="w-full min-h-20 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Ghi chú thêm về đơn hàng..."
                                />
                            </CardContent>
                        </Card>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => navigate('/orders')} disabled={submitting}>
                                Hủy
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleSubmit}
                                disabled={submitting || !customerId || items.length === 0}
                            >
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
                        </div>
                    </div>
                </div>
            </div>

            {/* Technician Selection Dialog */}
            <Dialog open={techDialogOpen} onOpenChange={(open) => {
                setTechDialogOpen(open);
                if (!open) setTechDialogCommissions({});
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-primary" />
                            Chọn kỹ thuật viên
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                        {(() => {
                            // Get the current item to determine department filter
                            const currentItem = techDialogItemIndex !== null ? items[techDialogItemIndex] : null;
                            const filteredTechs = currentItem
                                ? getTechniciansForDepartment(currentItem.department)
                                : availableTechnicians;

                            // Filter out already assigned technicians
                            const assignedIds = currentItem?.technicians?.map(t => t.technician_id) || [];
                            const availableToAdd = filteredTechs.filter(tech => !assignedIds.includes(tech.id));

                            if (availableToAdd.length === 0) {
                                return (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        {assignedIds.length > 0
                                            ? 'Tất cả KTV đã được phân công'
                                            : 'Không có KTV khả dụng'}
                                    </p>
                                );
                            }

                            return availableToAdd.map(tech => (
                                <div
                                    key={tech.id}
                                    className="p-3 rounded-lg border hover:border-primary/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <User className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{tech.name}</p>
                                            {tech.department && (
                                                <p className="text-xs text-muted-foreground">
                                                    {getDepartmentLabel(tech.department, departments)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-sm text-muted-foreground">Hoa hồng:</span>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={techDialogCommissions[tech.id] ?? ''}
                                            onChange={(e) => setTechDialogCommissions(prev => ({
                                                ...prev,
                                                [tech.id]: Number(e.target.value) || 0
                                            }))}
                                            onFocus={(e) => e.target.select()}
                                            placeholder="0"
                                            className="w-20 h-8 text-center"
                                        />
                                        <span className="text-sm text-muted-foreground">%</span>
                                        <Button
                                            size="sm"
                                            className="ml-auto h-8"
                                            onClick={() => {
                                                if (techDialogItemIndex !== null) {
                                                    const commission = techDialogCommissions[tech.id] || 0;
                                                    if (techDialogServiceId) {
                                                        handleTogglePackageServiceTechnician(
                                                            techDialogItemIndex,
                                                            techDialogServiceId,
                                                            tech.id,
                                                            tech.name,
                                                            commission
                                                        );
                                                    } else {
                                                        handleToggleTechnician(techDialogItemIndex, tech.id, tech.name, commission);
                                                    }
                                                }
                                                setTechDialogOpen(false);
                                                setTechDialogCommissions({});
                                            }}
                                        >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Thêm
                                        </Button>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Order Confirmation Dialog */}
            <OrderConfirmationDialog
                open={showConfirmDialog}
                onClose={handleConfirmDialogClose}
                order={createdOrder}
                onConfirm={handleOrderConfirmed}
            />
        </div>
    );
}

