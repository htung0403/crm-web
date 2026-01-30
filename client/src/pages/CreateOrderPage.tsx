import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
    ArrowLeft, ArrowRight, Plus, Trash2, Camera, Package, Sparkles,
    Loader2, User, Search, CheckCircle, ShoppingBag, QrCode, Image as ImageIcon,
    Tag, Palette, Layers, FileText, Check, Wrench, UserCheck, X, UserPlus
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { useCustomers } from '@/hooks/useCustomers';
import { useProducts } from '@/hooks/useProducts';
import { usePackages } from '@/hooks/usePackages';
import { useUsers } from '@/hooks/useUsers';
import { ordersApi } from '@/lib/api';
import { CreateCustomerDialog } from '@/components/customers/CreateCustomerDialog';

// Product types for cleaning services
const PRODUCT_TYPES = [
    { value: 'giày', label: 'Giày' },
    { value: 'túi', label: 'Túi xách' },
    { value: 'ví', label: 'Ví' },
    { value: 'thắt lưng', label: 'Thắt lưng' },
    { value: 'dép', label: 'Dép' },
    { value: 'mũ', label: 'Mũ/Nón' },
    { value: 'khác', label: 'Khác' },
];

// Common brands
const COMMON_BRANDS = [
    'Nike', 'Adidas', 'Gucci', 'Louis Vuitton', 'Chanel', 'Hermes',
    'Prada', 'Dior', 'Balenciaga', 'Converse', 'Vans', 'Khác'
];

interface CustomerProduct {
    id: string;
    name: string;
    type: string;
    brand: string;
    color: string;
    size: string;
    material: string;
    condition_before: string;
    images: string[];
    notes: string;
    services: Array<{
        id: string;
        type: 'service' | 'package';
        name: string;
        price: number;
        technicians: Array<{
            id: string;
            name: string;
            commission: number; // phần trăm hoa hồng
        }>;
    }>;
}

const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export function CreateOrderPage() {
    const navigate = useNavigate();

    // Steps: 1 = Customer, 2 = Products, 3 = Services, 4 = Review
    const [step, setStep] = useState(1);

    // Data hooks
    const { customers, fetchCustomers, createCustomer } = useCustomers();
    const { services, fetchServices } = useProducts();
    const { packages, fetchPackages } = usePackages();
    const { users: technicians, fetchTechnicians } = useUsers();

    // Form state
    const [customerId, setCustomerId] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [products, setProducts] = useState<CustomerProduct[]>([]);
    const [currentProductIndex, setCurrentProductIndex] = useState<number | null>(null);
    const [notes, setNotes] = useState('');
    const [discount, setDiscount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [createdOrder, setCreatedOrder] = useState<any>(null);

    // Confirmation dialog state
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

    // Technician selection dialog state
    const [techDialogOpen, setTechDialogOpen] = useState(false);
    const [pendingService, setPendingService] = useState<{
        productIndex: number;
        service: { id: string; type: 'service' | 'package'; name: string; price: number };
    } | null>(null);

    // Create customer dialog state
    const [showCreateCustomerDialog, setShowCreateCustomerDialog] = useState(false);

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                await Promise.all([
                    fetchCustomers({ status: 'active' }),
                    fetchServices({ status: 'active' }),
                    fetchPackages(),
                    fetchTechnicians()
                ]);
            } catch {
                toast.error('Lỗi khi tải dữ liệu');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [fetchCustomers, fetchServices, fetchPackages, fetchTechnicians]);

    // Filter technicians by role
    const availableTechnicians = technicians.filter(t =>
        t.role === 'technician' || t.role === 'tech' as string
    );

    // Helpers
    const activeCustomers = customers.filter(c => c.status === 'active' || !c.status);
    const filteredCustomers = activeCustomers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone.includes(customerSearch)
    );
    const selectedCustomer = customers.find(c => c.id === customerId);
    const activePackages = packages.filter(p => p.status === 'active');

    // Handle create new customer
    const handleCreateCustomer = async (data: Parameters<typeof createCustomer>[0]) => {
        try {
            const newCustomer = await createCustomer(data);
            toast.success('Đã thêm khách hàng mới!');
            setShowCreateCustomerDialog(false);
            // Auto-select the newly created customer
            setCustomerId(newCustomer.id);
            await fetchCustomers({ status: 'active' });
            return newCustomer;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi khi tạo khách hàng';
            toast.error(message);
            throw error;
        }
    };

    // Add new product
    const handleAddProduct = () => {
        const newProduct: CustomerProduct = {
            id: generateTempId(),
            name: '',
            type: 'giày',
            brand: '',
            color: '',
            size: '',
            material: '',
            condition_before: '',
            images: [],
            notes: '',
            services: []
        };
        setProducts(prev => [...prev, newProduct]);
        setCurrentProductIndex(products.length);
    };

    // Update product
    const handleUpdateProduct = (index: number, field: keyof CustomerProduct, value: any) => {
        setProducts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
    };

    // Remove product
    const handleRemoveProduct = (index: number) => {
        setProducts(prev => prev.filter((_, i) => i !== index));
        if (currentProductIndex === index) {
            setCurrentProductIndex(null);
        } else if (currentProductIndex !== null && currentProductIndex > index) {
            setCurrentProductIndex(currentProductIndex - 1);
        }
    };

    // Add service to product (opens technician dialog first)
    const handleServiceClick = (productIndex: number, service: { id: string; type: 'service' | 'package'; name: string; price: number }) => {
        // Check if service already exists
        const product = products[productIndex];
        const exists = product?.services.find(s => s.id === service.id && s.type === service.type);
        if (exists) {
            toast.info('Dịch vụ này đã được thêm');
            return;
        }
        // Open dialog to select technician
        setPendingService({ productIndex, service });
        setTechDialogOpen(true);
    };

    // Confirm adding service with technicians
    const handleConfirmAddService = (selectedTechnicians: Array<{ id: string; name: string; commission: number }> = []) => {
        if (!pendingService) return;

        const { productIndex, service } = pendingService;

        setProducts(prev => prev.map((p, i) => {
            if (i !== productIndex) return p;
            return {
                ...p,
                services: [...p.services, {
                    ...service,
                    technicians: selectedTechnicians
                }]
            };
        }));

        setTechDialogOpen(false);
        setPendingService(null);
        const techNames = selectedTechnicians.map(t => t.name).join(', ');
        toast.success(`Đã thêm ${service.name}${techNames ? ` - KTV: ${techNames}` : ''}`);
    };

    // Add technician to a service
    const handleAddTechnicianToService = (productIndex: number, serviceIndex: number, technicianId: string, commission: number = 0) => {
        const technician = availableTechnicians.find(t => t.id === technicianId);
        if (!technician) return;

        setProducts(prev => prev.map((p, i) => {
            if (i !== productIndex) return p;
            return {
                ...p,
                services: p.services.map((s, si) => {
                    if (si !== serviceIndex) return s;
                    // Check if already added
                    if (s.technicians.some(t => t.id === technicianId)) {
                        toast.error('KTV đã được thêm');
                        return s;
                    }
                    return {
                        ...s,
                        technicians: [...s.technicians, { id: technician.id, name: technician.name, commission }]
                    };
                })
            };
        }));
    };

    // Remove technician from service
    const handleRemoveTechnicianFromService = (productIndex: number, serviceIndex: number, technicianId: string) => {
        setProducts(prev => prev.map((p, i) => {
            if (i !== productIndex) return p;
            return {
                ...p,
                services: p.services.map((s, si) => {
                    if (si !== serviceIndex) return s;
                    return {
                        ...s,
                        technicians: s.technicians.filter(t => t.id !== technicianId)
                    };
                })
            };
        }));
    };

    // Update technician commission
    const handleUpdateTechnicianCommission = (productIndex: number, serviceIndex: number, technicianId: string, commission: number) => {
        setProducts(prev => prev.map((p, i) => {
            if (i !== productIndex) return p;
            return {
                ...p,
                services: p.services.map((s, si) => {
                    if (si !== serviceIndex) return s;
                    return {
                        ...s,
                        technicians: s.technicians.map(t =>
                            t.id === technicianId ? { ...t, commission } : t
                        )
                    };
                })
            };
        }));
    };

    // Remove service from product
    const handleRemoveService = (productIndex: number, serviceIndex: number) => {
        setProducts(prev => prev.map((p, i) => {
            if (i !== productIndex) return p;
            return { ...p, services: p.services.filter((_, si) => si !== serviceIndex) };
        }));
    };

    // Calculate totals
    const subtotal = products.reduce((sum, p) =>
        sum + p.services.reduce((ssum, s) => ssum + s.price, 0), 0
    );
    const total = Math.max(0, subtotal - discount);

    // Order Sidebar Component
    const OrderSidebar = () => (
        <div className="space-y-4 sticky top-4">
            {/* Customer Info */}
            {selectedCustomer && (
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Khách hàng
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                                <AvatarFallback className="bg-primary text-white">
                                    {selectedCustomer.name.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-semibold">{selectedCustomer.name}</p>
                                <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Order Summary */}
            {products.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <ShoppingBag className="h-4 w-4" />
                            Tóm tắt đơn hàng
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* Products list */}
                        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                            {products.map((product, idx) => (
                                <div key={product.id} className="text-sm border-b pb-2 last:border-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium truncate flex-1">
                                            {product.name || `Sản phẩm ${idx + 1}`}
                                        </span>
                                        <Badge variant="outline" className="text-xs shrink-0">
                                            {PRODUCT_TYPES.find(t => t.value === product.type)?.label || 'Khác'}
                                        </Badge>
                                    </div>
                                    {product.services.length > 0 && (
                                        <div className="ml-2 mt-1 space-y-1">
                                            {product.services.map((s, si) => (
                                                <div key={si} className="flex justify-between text-xs text-muted-foreground">
                                                    <span className="truncate">{s.name}</span>
                                                    <span className="text-green-600 font-medium">{formatCurrency(s.price)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Totals */}
                        <div className="pt-2 border-t space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Số sản phẩm</span>
                                <span className="font-medium">{products.length}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tạm tính</span>
                                <span className="font-medium">{formatCurrency(subtotal)}</span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between text-sm text-red-600">
                                    <span>Giảm giá</span>
                                    <span>-{formatCurrency(discount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-base font-bold pt-1 border-t">
                                <span>Tổng cộng</span>
                                <span className="text-primary">{formatCurrency(total)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );

    // Submit order
    const handleSubmit = async (status: 'pending' | 'confirmed' = 'pending') => {
        if (!customerId) {
            toast.error('Vui lòng chọn khách hàng');
            return;
        }
        if (products.length === 0) {
            toast.error('Vui lòng thêm ít nhất một sản phẩm');
            return;
        }
        if (products.some(p => p.services.length === 0)) {
            toast.error('Mỗi sản phẩm cần có ít nhất một dịch vụ');
            return;
        }
        if (products.some(p => !p.name.trim())) {
            toast.error('Vui lòng nhập tên cho tất cả sản phẩm');
            return;
        }

        setSubmitting(true);
        setConfirmDialogOpen(false);
        try {
            const response = await ordersApi.createV2({
                customer_id: customerId,
                status: status,
                products: products.map(p => ({
                    name: p.name,
                    type: p.type,
                    brand: p.brand,
                    color: p.color,
                    size: p.size,
                    material: p.material,
                    condition_before: p.condition_before,
                    images: p.images,
                    notes: p.notes,
                    services: p.services.map(s => ({
                        id: s.id,
                        type: s.type,
                        name: s.name,
                        price: s.price,
                        technicians: s.technicians.map(t => ({
                            technician_id: t.id,
                            commission: t.commission
                        }))
                    }))
                })),
                notes: notes || undefined,
                discount: discount > 0 ? discount : undefined
            });

            setCreatedOrder(response.data.data);
            setStep(5); // Success step
            toast.success('Đã tạo đơn hàng thành công!');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Lỗi khi tạo đơn hàng');
        } finally {
            setSubmitting(false);
        }
    };

    // Navigation
    const canGoNext = () => {
        switch (step) {
            case 1: return !!customerId;
            case 2: return products.length > 0 && products.every(p => p.name.trim());
            case 3: return products.every(p => p.services.length > 0);
            case 4: return true;
            default: return false;
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
        <div className="space-y-4 animate-fade-in w-full">
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
                    <p className="text-muted-foreground">Nhận sản phẩm khách và chọn dịch vụ</p>
                </div>
            </div>

            {/* Progress Steps */}
            {step < 5 && (
                <div className="flex items-center justify-between">
                    {[
                        { num: 1, label: 'Khách hàng', icon: User },
                        { num: 2, label: 'Sản phẩm', icon: Package },
                        { num: 3, label: 'Dịch vụ', icon: Sparkles },
                        { num: 4, label: 'Xác nhận', icon: CheckCircle }
                    ].map((s, i) => (
                        <div key={s.num} className="flex items-center flex-1">
                            <div className={`flex items-center gap-2 ${step >= s.num ? 'text-primary' : 'text-muted-foreground'}`}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step > s.num ? 'bg-primary text-white' :
                                    step === s.num ? 'bg-primary/10 border-2 border-primary' :
                                        'bg-muted'
                                    }`}>
                                    {step > s.num ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
                                </div>
                                <span className="hidden md:inline font-medium">{s.label}</span>
                            </div>
                            {i < 3 && (
                                <div className={`flex-1 h-1 mx-2 rounded ${step > s.num ? 'bg-primary' : 'bg-muted'}`} />
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Step 1: Customer Selection */}
            {step === 1 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-primary" />
                                Chọn khách hàng
                            </CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowCreateCustomerDialog(true)}
                                className="gap-2"
                            >
                                <UserPlus className="h-4 w-4" />
                                Thêm khách hàng
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {selectedCustomer ? (
                            <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
                                <Avatar className="h-16 w-16">
                                    <AvatarFallback className="bg-primary text-white text-xl">
                                        {selectedCustomer.name.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <p className="font-semibold text-xl">{selectedCustomer.name}</p>
                                    <p className="text-muted-foreground">{selectedCustomer.phone}</p>
                                </div>
                                <Button variant="outline" onClick={() => setCustomerId('')}>
                                    Đổi khách
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Tìm theo tên hoặc số điện thoại..."
                                            value={customerSearch}
                                            onChange={(e) => setCustomerSearch(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                                <div className="max-h-[60vh] overflow-y-auto border rounded-lg divide-y">
                                    {filteredCustomers.length === 0 ? (
                                        <div className="text-center py-8">
                                            <p className="text-muted-foreground mb-4">
                                                Không tìm thấy khách hàng
                                            </p>
                                            <Button
                                                variant="outline"
                                                onClick={() => setShowCreateCustomerDialog(true)}
                                                className="gap-2"
                                            >
                                                <UserPlus className="h-4 w-4" />
                                                Thêm khách hàng mới
                                            </Button>
                                        </div>
                                    ) : (
                                        filteredCustomers.slice(0, 20).map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => {
                                                    setCustomerId(c.id);
                                                    setCustomerSearch('');
                                                }}
                                                className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                                            >
                                                <Avatar>
                                                    <AvatarFallback className="bg-primary/10 text-primary">
                                                        {c.name.charAt(0)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="text-left">
                                                    <p className="font-medium">{c.name}</p>
                                                    <p className="text-sm text-muted-foreground">{c.phone}</p>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Add Products */}
            {step === 2 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Sản phẩm khách hàng ({products.length})</h2>
                            <Button onClick={handleAddProduct} className="gap-2">
                                <Plus className="h-4 w-4" />
                                Thêm sản phẩm
                            </Button>
                        </div>

                        {products.length === 0 ? (
                            <Card className="border-dashed">
                                <CardContent className="py-8 text-center">
                                    <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-lg font-medium mb-2">Chưa có sản phẩm nào</h3>
                                    <p className="text-muted-foreground mb-4">
                                        Thêm sản phẩm khách hàng mang đến (giày, túi, ví...)
                                    </p>
                                    <Button onClick={handleAddProduct} className="gap-2">
                                        <Plus className="h-4 w-4" />
                                        Thêm sản phẩm đầu tiên
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-4">
                                {products.map((product, index) => (
                                    <Card key={product.id} className={currentProductIndex === index ? 'ring-2 ring-primary' : ''}>
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="shrink-0">
                                                        {PRODUCT_TYPES.find(t => t.value === product.type)?.label || 'Khác'}
                                                    </Badge>
                                                    <CardTitle className="text-base">
                                                        {product.name || `Sản phẩm ${index + 1}`}
                                                    </CardTitle>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setCurrentProductIndex(currentProductIndex === index ? null : index)}
                                                    >
                                                        {currentProductIndex === index ? 'Thu gọn' : 'Sửa'}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-red-500 hover:text-red-600"
                                                        onClick={() => handleRemoveProduct(index)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>

                                        {currentProductIndex === index && (
                                            <CardContent className="space-y-4 border-t pt-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Tên sản phẩm *</Label>
                                                        <Input
                                                            placeholder="VD: Giày Nike Air Max đen"
                                                            value={product.name}
                                                            onChange={(e) => handleUpdateProduct(index, 'name', e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label>Loại sản phẩm</Label>
                                                        <Select
                                                            value={product.type}
                                                            onValueChange={(v) => handleUpdateProduct(index, 'type', v)}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {PRODUCT_TYPES.map(t => (
                                                                    <SelectItem key={t.value} value={t.value}>
                                                                        {t.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label>Hãng/Thương hiệu</Label>
                                                        <Select
                                                            value={product.brand}
                                                            onValueChange={(v) => handleUpdateProduct(index, 'brand', v)}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Chọn hoặc nhập" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {COMMON_BRANDS.map(b => (
                                                                    <SelectItem key={b} value={b}>{b}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label>Màu sắc</Label>
                                                        <Input
                                                            placeholder="VD: Đen, trắng, xanh navy"
                                                            value={product.color}
                                                            onChange={(e) => handleUpdateProduct(index, 'color', e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label>Size</Label>
                                                        <Input
                                                            placeholder="VD: 42, M, 25cm"
                                                            value={product.size}
                                                            onChange={(e) => handleUpdateProduct(index, 'size', e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label>Chất liệu</Label>
                                                        <Input
                                                            placeholder="VD: Da thật, vải canvas"
                                                            value={product.material}
                                                            onChange={(e) => handleUpdateProduct(index, 'material', e.target.value)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Tình trạng ban đầu</Label>
                                                    <Textarea
                                                        placeholder="Mô tả tình trạng sản phẩm khi nhận: vết bẩn, trầy xước, phai màu..."
                                                        value={product.condition_before}
                                                        onChange={(e) => handleUpdateProduct(index, 'condition_before', e.target.value)}
                                                        rows={2}
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Ghi chú</Label>
                                                    <Textarea
                                                        placeholder="Ghi chú thêm về sản phẩm này..."
                                                        value={product.notes}
                                                        onChange={(e) => handleUpdateProduct(index, 'notes', e.target.value)}
                                                        rows={2}
                                                    />
                                                </div>
                                            </CardContent>
                                        )}

                                        {/* Show brief info when collapsed */}
                                        {currentProductIndex !== index && product.name && (
                                            <CardContent className="pt-0">
                                                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                                    {product.brand && <Badge variant="outline">{product.brand}</Badge>}
                                                    {product.color && <Badge variant="outline">{product.color}</Badge>}
                                                    {product.size && <Badge variant="outline">Size {product.size}</Badge>}
                                                    {product.services.length > 0 && (
                                                        <Badge className="bg-green-100 text-green-700">
                                                            {product.services.length} dịch vụ
                                                        </Badge>
                                                    )}
                                                </div>
                                            </CardContent>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="hidden lg:block">
                        <OrderSidebar />
                    </div>
                </div>
            )}

            {/* Step 3: Add Services */}
            {step === 3 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Products List */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold">Sản phẩm ({products.length})</h2>
                            {products.map((product, index) => (
                                <Card
                                    key={product.id}
                                    className={`cursor-pointer transition-all ${currentProductIndex === index ? 'ring-2 ring-primary' : 'hover:border-primary/50'
                                        }`}
                                    onClick={() => setCurrentProductIndex(index)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <Badge variant="outline" className="shrink-0">
                                                {PRODUCT_TYPES.find(t => t.value === product.type)?.label || 'Khác'}
                                            </Badge>
                                            <div className="flex-1">
                                                <p className="font-medium">{product.name}</p>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {product.brand && <Badge variant="outline" className="text-xs">{product.brand}</Badge>}
                                                    {product.color && <Badge variant="outline" className="text-xs">{product.color}</Badge>}
                                                </div>
                                                {product.services.length > 0 && (
                                                    <div className="mt-2 space-y-1">
                                                        {product.services.map((s, si) => (
                                                            <div key={si} className="flex items-center justify-between text-sm">
                                                                <span className="text-muted-foreground">{s.name}</span>
                                                                <span className="font-medium text-green-600">{formatCurrency(s.price)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {product.services.length > 0 ? (
                                                <CheckCircle className="h-5 w-5 text-green-500" />
                                            ) : (
                                                <Badge variant="destructive" className="text-xs">Chưa có DV</Badge>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Services Selection */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold">
                                {currentProductIndex !== null
                                    ? `Dịch vụ cho: ${products[currentProductIndex]?.name || 'Sản phẩm'}`
                                    : 'Chọn sản phẩm để thêm dịch vụ'
                                }
                            </h2>

                            {currentProductIndex !== null && (
                                <>
                                    {/* Selected services */}
                                    {products[currentProductIndex]?.services.length > 0 && (
                                        <Card className="bg-green-50 border-green-200">
                                            <CardContent className="p-4">
                                                <p className="text-sm font-medium text-green-700 mb-2">Đã chọn:</p>
                                                <div className="space-y-3">
                                                    {products[currentProductIndex].services.map((s, si) => (
                                                        <div key={si} className="bg-white p-3 rounded border space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex-1">
                                                                    <p className="font-medium text-sm">{s.name}</p>
                                                                    <p className="text-xs text-green-600 font-medium">{formatCurrency(s.price)}</p>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-red-500 hover:text-red-600"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRemoveService(currentProductIndex, si);
                                                                    }}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>

                                                            {/* Technicians list */}
                                                            <div className="space-y-1">
                                                                {s.technicians.map((tech, ti) => (
                                                                    <div key={ti} className="flex items-center gap-2 bg-blue-50 p-2 rounded text-sm">
                                                                        <span className="flex-1 font-medium">{tech.name}</span>
                                                                        <div className="flex items-center gap-1">
                                                                            <Input
                                                                                type="number"
                                                                                value={tech.commission}
                                                                                onChange={(e) => handleUpdateTechnicianCommission(
                                                                                    currentProductIndex, si, tech.id, Number(e.target.value)
                                                                                )}
                                                                                onFocus={(e) => e.target.select()}
                                                                                className="w-14 h-7 text-xs text-center"
                                                                                min={0}
                                                                                max={100}
                                                                            />
                                                                            <span className="text-xs text-muted-foreground">%</span>
                                                                            <span className="text-xs font-medium text-green-600 ml-1">
                                                                                = {formatCurrency(s.price * tech.commission / 100)}
                                                                            </span>
                                                                        </div>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6 text-red-500"
                                                                            onClick={() => handleRemoveTechnicianFromService(currentProductIndex, si, tech.id)}
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* Add technician */}
                                                            <Select
                                                                value=""
                                                                onValueChange={(v) => handleAddTechnicianToService(currentProductIndex, si, v, 0)}
                                                            >
                                                                <SelectTrigger className="h-8 text-xs">
                                                                    <SelectValue placeholder="+ Thêm KTV" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {availableTechnicians
                                                                        .filter(tech => !s.technicians.some(t => t.id === tech.id))
                                                                        .map(tech => (
                                                                            <SelectItem key={tech.id} value={tech.id}>
                                                                                {tech.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Services list */}
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm flex items-center gap-2">
                                                <Sparkles className="h-4 w-4" />
                                                Dịch vụ đơn lẻ
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                                                {services.map(s => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => handleServiceClick(currentProductIndex, {
                                                            id: s.id,
                                                            type: 'service',
                                                            name: s.name,
                                                            price: s.price
                                                        })}
                                                        className="p-3 text-left border rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
                                                    >
                                                        <p className="font-medium text-sm truncate">{s.name}</p>
                                                        <p className="text-purple-600 font-semibold text-sm">{formatCurrency(s.price)}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Packages list */}
                                    {activePackages.length > 0 && (
                                        <Card>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm flex items-center gap-2">
                                                    <Package className="h-4 w-4" />
                                                    Gói dịch vụ
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                                                    {activePackages.map(pkg => (
                                                        <button
                                                            key={pkg.id}
                                                            onClick={() => handleServiceClick(currentProductIndex, {
                                                                id: pkg.id,
                                                                type: 'package',
                                                                name: pkg.name,
                                                                price: pkg.price
                                                            })}
                                                            className="p-3 text-left border rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
                                                        >
                                                            <p className="font-medium text-sm truncate">{pkg.name}</p>
                                                            <p className="text-emerald-600 font-semibold text-sm">{formatCurrency(pkg.price)}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="hidden lg:block">
                        <OrderSidebar />
                    </div>
                </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
                <div className="space-y-6">
                    {/* Customer */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-muted-foreground">Khách hàng</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12">
                                    <AvatarFallback className="bg-primary text-white">
                                        {selectedCustomer?.name.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{selectedCustomer?.name}</p>
                                    <p className="text-muted-foreground">{selectedCustomer?.phone}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Products Summary */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-muted-foreground">
                                Sản phẩm & Dịch vụ ({products.length} sản phẩm)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {products.map((product, index) => (
                                <div key={product.id} className="border rounded-lg p-4">
                                    <div className="flex items-start gap-3 mb-3">
                                        <Badge variant="outline" className="shrink-0">
                                            {PRODUCT_TYPES.find(t => t.value === product.type)?.label || 'Khác'}
                                        </Badge>
                                        <div>
                                            <p className="font-semibold">{product.name}</p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {product.brand && <Badge variant="outline" className="text-xs">{product.brand}</Badge>}
                                                {product.color && <Badge variant="outline" className="text-xs">{product.color}</Badge>}
                                                {product.size && <Badge variant="outline" className="text-xs">Size {product.size}</Badge>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pl-10 space-y-2">
                                        {product.services.map((s, si) => (
                                            <div key={si} className="flex justify-between items-start text-sm bg-muted/30 p-2 rounded">
                                                <div className="flex-1">
                                                    <span className="font-medium">{s.name}</span>
                                                    {s.technicians.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {s.technicians.map((tech, ti) => (
                                                                <span key={ti} className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                                    {tech.name}: {tech.commission}% = {formatCurrency(s.price * tech.commission / 100)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="font-semibold text-green-600">{formatCurrency(s.price)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Notes & Discount */}
                    <Card>
                        <CardContent className="p-4 space-y-4">
                            <div className="space-y-2">
                                <Label>Ghi chú đơn hàng</Label>
                                <Textarea
                                    placeholder="Ghi chú thêm..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Giảm giá</Label>
                                <Input
                                    type="number"
                                    placeholder="0"
                                    value={discount || ''}
                                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Total */}
                    <Card className="bg-gradient-to-r from-primary/10 to-purple-100">
                        <CardContent className="p-4">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Tạm tính</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                                {discount > 0 && (
                                    <div className="flex justify-between text-red-600">
                                        <span>Giảm giá</span>
                                        <span>-{formatCurrency(discount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-xl font-bold pt-2 border-t">
                                    <span>Tổng cộng</span>
                                    <span className="text-primary">{formatCurrency(total)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Step 5: Success */}
            {step === 5 && createdOrder && (
                <Card className="text-center py-12">
                    <CardContent>
                        <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6" />
                        <h2 className="text-2xl font-bold mb-2">Tạo đơn hàng thành công!</h2>
                        <p className="text-muted-foreground mb-6">
                            Mã đơn: <span className="font-mono font-bold">{createdOrder.order?.order_code}</span>
                        </p>

                        {/* QR Codes */}
                        {createdOrder.products && createdOrder.products.length > 0 && (
                            <div className="mb-8">
                                <h3 className="font-semibold mb-4">Mã QR sản phẩm</h3>
                                <div className="flex flex-wrap justify-center gap-4">
                                    {createdOrder.products.map((p: any, index: number) => (
                                        <div key={index} className="p-4 border rounded-lg bg-white">
                                            <QRCodeSVG
                                                value={`${window.location.origin}/product/${p.product_code || p.qr_code}`}
                                                size={120}
                                                level="M"
                                            />
                                            <p className="text-xs font-mono mt-2">{p.product_code || p.qr_code}</p>
                                            <p className="text-sm text-muted-foreground">{p.name}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-4 justify-center flex-wrap">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    const printWindow = window.open('', '_blank');
                                    if (printWindow) {
                                        const qrHtml = createdOrder.products?.map((p: any) => `
                                            <div style="display: inline-block; padding: 20px; margin: 10px; border: 1px solid #ccc; border-radius: 8px; text-align: center;">
                                                <canvas id="qr-${p.product_code || p.qr_code}"></canvas>
                                                <p style="font-family: monospace; font-size: 14px; margin-top: 10px;">${p.product_code || p.qr_code}</p>
                                                <p style="font-size: 12px; color: #666;">${p.name || ''}</p>
                                            </div>
                                        `).join('') || '';

                                        printWindow.document.write(`
                                            <html>
                                                <head>
                                                    <title>In mã QR - ${createdOrder.order?.order_code}</title>
                                                    <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
                                                    <style>
                                                        body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
                                                        h2 { margin-bottom: 20px; }
                                                        .qr-container { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; }
                                                        @media print { button { display: none; } }
                                                    </style>
                                                </head>
                                                <body>
                                                    <h2>Mã QR sản phẩm - Đơn hàng ${createdOrder.order?.order_code}</h2>
                                                    <div class="qr-container">${qrHtml}</div>
                                                    <script>
                                                        ${createdOrder.products?.map((p: any) => `
                                                            QRCode.toCanvas(document.getElementById('qr-${p.product_code || p.qr_code}'), 
                                                                '${window.location.origin}/product/${p.product_code || p.qr_code}', 
                                                                { width: 150 }, function(err) { if(err) console.error(err); });
                                                        `).join('') || ''}
                                                        setTimeout(() => window.print(), 500);
                                                    </script>
                                                </body>
                                            </html>
                                        `);
                                        printWindow.document.close();
                                    }
                                }}
                            >
                                <QrCode className="h-4 w-4 mr-2" />
                                In mã QR
                            </Button>
                            <Button onClick={() => navigate(`/orders/${createdOrder.order?.id}`)}>
                                Xem chi tiết đơn
                            </Button>
                            <Button variant="outline" onClick={() => navigate('/orders')}>
                                Về danh sách đơn
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Navigation Buttons */}
            {step < 5 && (
                <div className="flex justify-between pt-4 border-t">
                    <Button
                        variant="outline"
                        onClick={() => setStep(s => Math.max(1, s - 1))}
                        disabled={step === 1}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Quay lại
                    </Button>

                    {step < 4 ? (
                        <Button
                            onClick={() => setStep(s => s + 1)}
                            disabled={!canGoNext()}
                        >
                            Tiếp tục
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    ) : (
                        <Button
                            onClick={() => setConfirmDialogOpen(true)}
                            disabled={submitting}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Đang tạo...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Tạo đơn hàng
                                </>
                            )}
                        </Button>
                    )}
                </div>
            )}

            {/* Confirmation Dialog */}
            <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Xác nhận tạo đơn hàng</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p>Bạn muốn tạo đơn hàng này với trạng thái nào?</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            - <strong>Lưu nháp:</strong> Đơn hàng sẽ được lưu vào danh sách "Đơn nháp", bạn có thể chỉnh sửa sau.<br />
                            - <strong>Xác nhận:</strong> Đơn hàng sẽ được chuyển sang trạng thái "Đã xác nhận" để xử lý ngay.
                        </p>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => handleSubmit('pending')}
                            disabled={submitting}
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu nháp'}
                        </Button>
                        <Button
                            onClick={() => handleSubmit('confirmed')}
                            disabled={submitting}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Xác nhận ngay'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Technician Selection Dialog */}
            <Dialog open={techDialogOpen} onOpenChange={setTechDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-primary" />
                            Chọn kỹ thuật viên
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Dịch vụ: <span className="font-medium text-foreground">{pendingService?.service.name}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Giá: <span className="font-medium text-green-600">{formatCurrency(pendingService?.service.price || 0)}</span>
                        </p>

                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {availableTechnicians.length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">
                                    Không có kỹ thuật viên nào
                                </p>
                            ) : (
                                availableTechnicians.map(tech => (
                                    <button
                                        key={tech.id}
                                        onClick={() => handleConfirmAddService([{ id: tech.id, name: tech.name, commission: 0 }])}
                                        className="w-full flex items-center gap-3 p-3 border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors group"
                                    >
                                        <Avatar className="h-10 w-10">
                                            {tech.avatar ? (
                                                <AvatarImage src={tech.avatar} alt={tech.name} />
                                            ) : null}
                                            <AvatarFallback className="bg-blue-100 text-blue-700">
                                                {tech.name.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="text-left flex-1">
                                            <p className="font-medium">{tech.name}</p>
                                            <p className="text-xs text-muted-foreground">{tech.phone}</p>
                                        </div>
                                        <UserCheck className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                    <DialogFooter className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setTechDialogOpen(false);
                                setPendingService(null);
                            }}
                        >
                            Hủy
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => handleConfirmAddService()}
                        >
                            Thêm không chọn KTV
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Customer Dialog */}
            <CreateCustomerDialog
                open={showCreateCustomerDialog}
                onClose={() => setShowCreateCustomerDialog(false)}
                onSubmit={handleCreateCustomer}
            />
        </div>
    );
}
