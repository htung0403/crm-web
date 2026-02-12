import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
    ArrowLeft, ArrowRight, Plus, Trash2, Camera, Package, Sparkles,
    Loader2, User, Search, CheckCircle, ShoppingBag, QrCode, Image as ImageIcon,
    Tag, Palette, Layers, FileText, Check, Wrench, UserCheck, X, UserPlus,
    Percent, DollarSign, ChevronDown, CreditCard, Calendar
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
import { ImageUpload } from '@/components/products/ImageUpload';
import { useProductTypes } from '@/hooks/useProductTypes';
import { useAuth } from '@/contexts/AuthContext';
import { ServiceSelector } from '@/components/orders/ServiceSelector';

// Product types will be fetched from API

// Common surcharge types
const SURCHARGE_TYPES = [
    { value: 'shipping', label: 'Phí giao hàng' },
    { value: 'express', label: 'Phí gấp' },
    { value: 'insurance', label: 'Phí bảo hiểm' },
    { value: 'special_material', label: 'Phí chất liệu đặc biệt' },
    { value: 'pickup', label: 'Phí lấy hàng' },
    { value: 'other', label: 'Phụ phí khác' },
];

// Common brands
const COMMON_BRANDS = [
    'Nike', 'Adidas', 'Gucci', 'Louis Vuitton', 'Chanel', 'Hermes',
    'Prada', 'Dior', 'Balenciaga', 'Converse', 'Vans', 'Khác'
];

interface Surcharge {
    id: string;
    type: string;
    label: string;
    value: number;
    isPercent: boolean;
}

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
        sales: Array<{
            id: string;
            name: string;
            commission: number; // phần trăm hoa hồng
        }>;
    }>;
}

const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export function CreateOrderPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { id } = useParams();
    const isEditMode = !!id;
    const { user } = useAuth();

    // Steps: 1 = Customer, 2 = Products (with Services), 3 = Review
    const [step, setStep] = useState(1);

    // Data hooks
    const { customers, fetchCustomers, createCustomer } = useCustomers();
    const { products: catalogProducts, services, fetchProducts, fetchServices } = useProducts();
    const { packages, fetchPackages } = usePackages();
    const { users, fetchUsers, fetchTechnicians, fetchSales } = useUsers();
    const { productTypes, fetchProductTypes } = useProductTypes();

    // Form state
    const [customerId, setCustomerId] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [products, setProducts] = useState<CustomerProduct[]>([]);
    const [currentProductIndex, setCurrentProductIndex] = useState<number | null>(null);
    const [notes, setNotes] = useState('');
    const [discount, setDiscount] = useState(0);
    const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
    const [surcharges, setSurcharges] = useState<Surcharge[]>([]);
    const [paidAmount, setPaidAmount] = useState(0);
    const [dueAt, setDueAt] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [createdOrder, setCreatedOrder] = useState<any>(null);

    // Confirmation dialog state
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

    // Technician selection dialog state
    const [techDialogOpen, setTechDialogOpen] = useState(false);
    const [pendingService, setPendingService] = useState<{
        productIndex: number;
        service: {
            id: string;
            type: 'service' | 'package';
            name: string;
            price: number;
            commission_sale?: number;
            commission_tech?: number;
        };
    } | null>(null);

    // Create customer dialog state
    const [showCreateCustomerDialog, setShowCreateCustomerDialog] = useState(false);
    const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);

    // Track confirmed products (products with info confirmed, ready for services)
    const [confirmedProducts, setConfirmedProducts] = useState<Set<number>>(new Set());

    // Next order code for QR preview
    const [nextOrderCode, setNextOrderCode] = useState<string>('');

    // Sản phẩm bán kèm (từ danh mục, không gắn dịch vụ)
    interface AddOnProduct {
        id: string;
        name: string;
        price: number;
        quantity: number;
        sales: Array<{
            id: string;
            name: string;
            commission: number;
        }>;
    }
    const [addOnProducts, setAddOnProducts] = useState<AddOnProduct[]>([]);
    const [addOnDialogOpen, setAddOnDialogOpen] = useState(false);
    const [addOnSearch, setAddOnSearch] = useState('');

    // Sales selection dialog state
    const [saleDialogOpen, setSaleDialogOpen] = useState(false);
    const [pendingSaleItem, setPendingSaleItem] = useState<{
        type: 'service' | 'addon';
        productIndex?: number;
        serviceIndex?: number;
        addonId?: string;
    } | null>(null);

    const [lastAddedAddOnSale, setLastAddedAddOnSale] = useState<{ addOnId: string; saleId: string } | null>(null);

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                await Promise.all([
                    fetchCustomers({ status: 'active' }),
                    fetchProducts({ status: 'active' }),
                    fetchServices({ status: 'active' }),
                    fetchServices({ status: 'active' }),
                    fetchPackages(),
                    fetchTechnicians(),
                    fetchSales(),
                    fetchProductTypes()
                ]);
            } catch {
                toast.error('Lỗi khi tải dữ liệu');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [fetchCustomers, fetchProducts, fetchServices, fetchPackages, fetchTechnicians, fetchSales, fetchProductTypes]);

    // Fetch next order code separately (for QR preview)
    useEffect(() => {
        const fetchNextCode = async () => {
            try {
                const codeResponse = await fetch('/api/orders/next-code', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                if (codeResponse.ok) {
                    const codeData = await codeResponse.json();
                    setNextOrderCode(codeData.data?.nextOrderCode || 'A-1');
                } else {
                    setNextOrderCode('A-1');
                }
            } catch {
                setNextOrderCode('A-1');
            }
        };
        fetchNextCode();
    }, []);

    // Flag to prevent duplicate lead processing
    const leadProcessedRef = useRef(false);
    const orderFetchedRef = useRef(false);

    // Fetch Order Data for Edit Mode
    useEffect(() => {
        if (isEditMode && id && !orderFetchedRef.current && !loading) {
            const fetchOrderData = async () => {
                try {
                    const response = await ordersApi.getById(id);
                    const order = response.data.data?.order;
                    if (order) {
                        setCustomerId(order.customer_id);
                        setNotes(order.notes || '');
                        setDiscount(order.discount_value || order.discount || 0);
                        setDiscountType(order.discount_type || 'amount');
                        setDueAt(order.due_at ? new Date(order.due_at).toISOString().split('T')[0] : '');

                        // Map Customer Items (order_products + services)
                        const customerItems: CustomerProduct[] = (order.customer_items || []).map((item: any) => ({
                            id: item.id,
                            name: item.name,
                            type: item.type || 'giày',
                            brand: item.brand || '',
                            color: item.color || '',
                            size: item.size || '',
                            material: item.material || '',
                            condition_before: item.condition_before || '',
                            images: item.images || [],
                            notes: item.notes || '',
                            services: (item.services || []).map((s: any) => ({
                                id: s.service_id || s.package_id || s.id,
                                type: s.item_type,
                                name: s.item_name,
                                price: s.unit_price,
                                technicians: (s.technicians || []).map((t: any) => ({
                                    id: t.technician_id,
                                    name: t.technician?.name || 'Unknown',
                                    commission: t.commission || 0
                                })),
                                sales: (s.sales || []).map((sale: any) => ({
                                    id: sale.sale_id || sale.id,
                                    name: sale.sale?.name || 'Unknown',
                                    commission: sale.commission || 0
                                }))
                            }))
                        }));

                        // Map Sale Items (add-on products)
                        const saleItems: AddOnProduct[] = (order.sale_items || []).map((item: any) => ({
                            id: item.product_id || item.id,
                            name: item.item_name,
                            price: item.unit_price,
                            quantity: item.quantity,
                            sales: (item.sales || []).map((s: any) => ({
                                id: s.sale_id || s.id,
                                name: s.sale?.name || 'Unknown',
                                commission: s.commission || 0
                            }))
                        }));

                        setProducts(customerItems);
                        setAddOnProducts(saleItems);

                        // Set surcharges
                        if (order.surcharges && Array.isArray(order.surcharges)) {
                            setSurcharges(order.surcharges.map((s: any) => ({
                                id: generateTempId(),
                                type: s.type,
                                label: s.label,
                                value: s.value,
                                isPercent: s.is_percent
                            })));
                        }

                        // Mark all products as confirmed since it's an existing order
                        const confirmed = new Set<number>();
                        const totalProducts = customerItems.length;
                        for (let i = 0; i < totalProducts; i++) confirmed.add(i);
                        setConfirmedProducts(confirmed);

                        orderFetchedRef.current = true;
                    }
                } catch (err) {
                    console.error('Error fetching order for edit:', err);
                    toast.error('Không thể tải dữ liệu đơn hàng để sửa');
                }
            };
            fetchOrderData();
        }
    }, [isEditMode, id, loading]);

    // Handle lead info from URL params (when coming from Lead Detail page)
    useEffect(() => {
        // Skip if already processed
        if (leadProcessedRef.current) return;

        const leadId = searchParams.get('lead_id');
        const leadName = searchParams.get('lead_name');
        const leadPhone = searchParams.get('lead_phone');
        const leadEmail = searchParams.get('lead_email');

        if (leadPhone && customers.length > 0) {
            leadProcessedRef.current = true; // Mark as processed

            // Try to find existing customer by phone
            const existingCustomer = customers.find(c => c.phone === leadPhone);

            if (existingCustomer) {
                // Auto-select the existing customer
                setCustomerId(existingCustomer.id);
                setStep(2); // Move to products step
                toast.success(`Đã chọn khách hàng: ${existingCustomer.name}`);
            } else if (leadName) {
                // Create new customer from lead info
                const createNewCustomer = async () => {
                    try {
                        const newCustomer = await createCustomer({
                            name: leadName,
                            phone: leadPhone,
                            email: leadEmail || undefined,
                            status: 'active',
                            notes: leadId ? `Tạo từ lead #${leadId}` : undefined,
                        });
                        setCustomerId(newCustomer.id);
                        setStep(2); // Move to products step
                        toast.success(`Đã tạo khách hàng mới: ${leadName}`);
                    } catch (error) {
                        toast.error('Không thể tạo khách hàng từ lead');
                    }
                };
                createNewCustomer();
            }
        }
    }, [searchParams, customers, createCustomer]);

    // List of users filtered by role for selection
    const availableTechnicians = users.filter(t =>
        t.role === 'technician'
    );
    const availableSales = users.filter(u => u.role === 'sale');

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
    const handleServiceClick = (productIndex: number, service: {
        id: string;
        type: 'service' | 'package';
        name: string;
        price: number;
        commission_sale?: number;
        commission_tech?: number;
    }) => {
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
                    technicians: selectedTechnicians.map(t => ({
                        ...t,
                        commission: t.commission || service.commission_tech || (availableTechnicians.find(at => at.id === t.id)?.commission || 0)
                    })),
                    sales: [] // Initialize with empty sales
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
                    const service = s.type === 'service'
                        ? services.find(sv => sv.id === s.id)
                        : packages.find(pk => pk.id === s.id);

                    return {
                        ...s,
                        technicians: [...s.technicians, {
                            id: technician.id,
                            name: technician.name,
                            commission: commission || service?.commission_tech || technician.commission || 0
                        }]
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

    // Add sale to a service
    const handleAddSaleToService = (productIndex: number, serviceIndex: number, saleId: string, commission: number = 0) => {
        const sale = availableSales.find(s => s.id === saleId);
        if (!sale) return;

        setProducts(prev => prev.map((p, i) => {
            if (i !== productIndex) return p;
            return {
                ...p,
                services: p.services.map((s, si) => {
                    if (si !== serviceIndex) return s;
                    // Check if already added
                    if (s.sales.some(sl => sl.id === saleId)) {
                        toast.error('Sales này đã được thêm');
                        return s;
                    }
                    const service = s.type === 'service'
                        ? services.find(sv => sv.id === s.id)
                        : packages.find(pk => pk.id === s.id);

                    return {
                        ...s,
                        sales: [...s.sales, {
                            id: sale.id,
                            name: sale.name,
                            commission: commission || service?.commission_sale || sale.commission || 0
                        }]
                    };
                })
            };
        }));
    };

    // Remove sale from service
    const handleRemoveSaleFromService = (productIndex: number, serviceIndex: number, saleId: string) => {
        setProducts(prev => prev.map((p, i) => {
            if (i !== productIndex) return p;
            return {
                ...p,
                services: p.services.map((s, si) => {
                    if (si !== serviceIndex) return s;
                    return {
                        ...s,
                        sales: s.sales.filter(sl => sl.id !== saleId)
                    };
                })
            };
        }));
    };

    // Update sale commission for service
    const handleUpdateSaleCommission = (productIndex: number, serviceIndex: number, saleId: string, commission: number) => {
        setProducts(prev => prev.map((p, i) => {
            if (i !== productIndex) return p;
            return {
                ...p,
                services: p.services.map((s, si) => {
                    if (si !== serviceIndex) return s;
                    return {
                        ...s,
                        sales: s.sales.map(sl =>
                            sl.id === saleId ? { ...sl, commission } : sl
                        )
                    };
                })
            };
        }));
    };

    // Add sản phẩm bán kèm
    const handleAddAddOn = (product: { id: string; name: string; price: number }, quantity: number = 1) => {
        const existing = addOnProducts.find(a => a.id === product.id);
        if (existing) {
            setAddOnProducts(prev => prev.map(a => a.id === product.id ? { ...a, quantity: a.quantity + quantity } : a));
        } else {
            const catalogProduct = catalogProducts.find(p => p.id === product.id);
            setAddOnProducts(prev => [...prev, {
                id: product.id,
                name: product.name,
                price: product.price,
                quantity,
                sales: []
            }]);
        }
        setAddOnDialogOpen(false);
        setAddOnSearch('');
    };

    const handleUpdateAddOnQuantity = (id: string, quantity: number) => {
        if (quantity < 1) {
            setAddOnProducts(prev => prev.filter(a => a.id !== id));
            return;
        }
        setAddOnProducts(prev => prev.map(a => a.id === id ? { ...a, quantity } : a));
    };

    const handleRemoveAddOn = (id: string) => {
        setAddOnProducts(prev => prev.filter(a => a.id !== id));
    };

    // Add sale to an add-on product
    const handleAddSaleToAddOn = (addOnId: string, saleId: string, commission: number = 0) => {
        const sale = availableSales.find(s => s.id === saleId);
        if (!sale) return;

        setAddOnProducts(prev => prev.map(a => {
            if (a.id !== addOnId) return a;
            if (a.sales.some(sl => sl.id === saleId)) {
                toast.error('Sales này đã được thêm');
                return a;
            }
            const catalogProduct = catalogProducts.find(p => p.id === addOnId);
            setLastAddedAddOnSale({ addOnId, saleId });
            return {
                ...a,
                sales: [...a.sales, {
                    id: sale.id,
                    name: sale.name,
                    commission: commission || catalogProduct?.commission_sale || sale.commission || 0
                }]
            };
        }));
    };

    // Remove sale from add-on product
    const handleRemoveSaleFromAddOn = (addOnId: string, saleId: string) => {
        setAddOnProducts(prev => prev.map(a => {
            if (a.id !== addOnId) return a;
            return {
                ...a,
                sales: a.sales.filter(sl => sl.id !== saleId)
            };
        }));
    };

    // Update sale commission for add-on product
    const handleUpdateAddOnSaleCommission = (addOnId: string, saleId: string, commission: number) => {
        setAddOnProducts(prev => prev.map(a => {
            if (a.id !== addOnId) return a;
            return {
                ...a,
                sales: a.sales.map(sl =>
                    sl.id === saleId ? { ...sl, commission } : sl
                )
            };
        }));
    };

    // Calculate totals (sản phẩm khách + dịch vụ + sản phẩm bán kèm)
    const subtotalFromCustomerProducts = products.reduce((sum, p) =>
        sum + p.services.reduce((ssum, s) => ssum + s.price, 0), 0
    );
    const subtotalFromAddOns = addOnProducts.reduce((sum, a) => sum + a.price * a.quantity, 0);
    const subtotal = subtotalFromCustomerProducts + subtotalFromAddOns;

    // Calculate discount amount
    const discountAmount = discountType === 'percent'
        ? Math.round(subtotal * discount / 100)
        : discount;

    // Calculate total surcharges
    const totalSurcharges = surcharges.reduce((sum, s) => {
        return sum + (s.isPercent ? Math.round(subtotal * s.value / 100) : s.value);
    }, 0);

    const total = Math.max(0, subtotal - discountAmount + totalSurcharges);
    const remainingDebt = total - paidAmount;

    // Helper to format number with dots for display
    const formatInputCurrency = (value: number): string => {
        if (!value) return '';
        return value.toLocaleString('vi-VN');
    };

    // Helper to parse formatted string back to number
    const parseInputCurrency = (value: string): number => {
        const cleanValue = value.replace(/\./g, '').replace(/,/g, '');
        return Number(cleanValue) || 0;
    };

    // Add surcharge handler
    const handleAddSurcharge = (type: string) => {
        const surchargeType = SURCHARGE_TYPES.find(s => s.value === type);
        if (!surchargeType) return;

        // Check if already exists
        if (surcharges.some(s => s.type === type)) {
            return;
        }

        setSurcharges(prev => [...prev, {
            id: `surcharge_${Date.now()}`,
            type: type,
            label: surchargeType.label,
            value: 0,
            isPercent: false
        }]);
    };

    const handleUpdateSurcharge = (id: string, field: 'value' | 'isPercent', value: number | boolean) => {
        setSurcharges(prev => prev.map(s => {
            if (s.id !== id) return s;

            if (field === 'value' && typeof value === 'number') {
                // If percent mode, limit to 100
                if (s.isPercent && value > 100) {
                    return { ...s, value: 100 };
                }
                return { ...s, value };
            }

            if (field === 'isPercent' && typeof value === 'boolean') {
                // When switching to percent, limit existing value to 100
                const newValue = value && s.value > 100 ? 100 : s.value;
                return { ...s, isPercent: value, value: newValue };
            }

            return s;
        }));
    };

    const handleRemoveSurcharge = (id: string) => {
        setSurcharges(prev => prev.filter(s => s.id !== id));
    };

    // Order Sidebar JSX - not a component to avoid re-mount on state changes
    const orderSidebarContent = (
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

            {/* Order Summary - Compact */}
            {products.length > 0 && (
                <Card>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-4 gap-3 text-center">
                            <div>
                                <p className="text-xs text-muted-foreground">Tổng tiền</p>
                                <p className="font-bold text-primary">{formatCurrency(total)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Đã thanh toán</p>
                                <p className="font-bold text-green-600">{formatCurrency(paidAmount)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Còn nợ</p>
                                <p className={`font-bold ${remainingDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatCurrency(remainingDebt)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Trạng thái</p>
                                <Badge
                                    variant={remainingDebt <= 0 ? 'default' : 'destructive'}
                                    className={remainingDebt <= 0 ? 'bg-green-500' : ''}
                                >
                                    {remainingDebt <= 0 ? 'Không nợ' : 'Còn nợ'}
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );

    // Submit order
    const handleSubmit = async (status: 'before_sale' | 'in_progress' | 'after_sale' = 'before_sale') => {
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
            const payload = {
                customer_id: customerId,
                status: isEditMode ? undefined : status, // keep status if editing, or handle separately
                customer_items: products.map(p => ({
                    id: p.id.startsWith('temp_') ? undefined : p.id,
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
                        id: s.id.startsWith('temp_') ? undefined : s.id,
                        type: s.type,
                        name: s.name,
                        price: s.price,
                        technicians: s.technicians.map(t => ({
                            technician_id: t.id,
                            commission: t.commission
                        })),
                        sales: s.sales.map(sl => ({
                            sale_id: sl.id,
                            commission: sl.commission
                        }))
                    }))
                })),
                sale_items: addOnProducts.map(a => ({
                    product_id: a.id,
                    name: a.name,
                    unit_price: a.price,
                    quantity: a.quantity,
                    sales: a.sales.map(sl => ({
                        sale_id: sl.id,
                        commission: sl.commission
                    }))
                })),
                notes,
                discount: discountAmount,
                discount_type: discountType,
                discount_value: discount,
                surcharges: surcharges.map(s => ({
                    type: s.type,
                    label: s.label,
                    value: s.value,
                    is_percent: s.isPercent,
                    amount: s.isPercent ? Math.round(subtotal * s.value / 100) : s.value
                })),
                paid_amount: paidAmount,
                due_at: dueAt ? new Date(dueAt + 'T17:00:00').toISOString() : undefined
            };

            const response = isEditMode && id
                ? await ordersApi.updateFull(id, payload)
                : await ordersApi.create(payload);

            setCreatedOrder(response.data.data);
            setStep(4); // Success step
            toast.success(isEditMode ? 'Đã cập nhật đơn hàng thành công!' : 'Đã tạo đơn hàng thành công!');
        } catch (error: any) {
            toast.error(error.response?.data?.message || (isEditMode ? 'Lỗi khi cập nhật đơn hàng' : 'Lỗi khi tạo đơn hàng'));
        } finally {
            setSubmitting(false);
        }
    };

    // Navigation - Now 3 steps: Customer, Products (with Services), Review
    const canGoNext = () => {
        switch (step) {
            case 1: return !!customerId;
            case 2: return products.length > 0 && products.every(p => p.name.trim() && p.services.length > 0);
            case 3: return true;
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

            {/* Progress Steps - 3 steps now */}
            {step < 4 && (
                <div className="flex items-center justify-between">
                    {[
                        { num: 1, label: 'Khách hàng', icon: User },
                        { num: 2, label: 'Sản phẩm & Dịch vụ', icon: Package },
                        { num: 3, label: 'Xác nhận', icon: CheckCircle }
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
                            {i < 2 && (
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
                            <div className="space-y-2">
                                <div className="relative">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Tìm theo tên hoặc số điện thoại..."
                                            value={customerSearch}
                                            onChange={(e) => setCustomerSearch(e.target.value)}
                                            onFocus={() => setCustomerDropdownOpen(true)}
                                            className="pl-10"
                                        />
                                    </div>

                                    {/* Dropdown results */}
                                    {customerDropdownOpen && (
                                        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-[300px] overflow-y-auto">
                                            {filteredCustomers.length === 0 ? (
                                                <div className="text-center py-4 px-3">
                                                    <p className="text-sm text-muted-foreground mb-2">
                                                        Không tìm thấy khách hàng
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setShowCreateCustomerDialog(true);
                                                            setCustomerDropdownOpen(false);
                                                        }}
                                                        className="gap-1"
                                                    >
                                                        <UserPlus className="h-3 w-3" />
                                                        Thêm mới
                                                    </Button>
                                                </div>
                                            ) : (
                                                filteredCustomers.slice(0, 10).map(c => (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => {
                                                            setCustomerId(c.id);
                                                            setCustomerSearch('');
                                                            setCustomerDropdownOpen(false);
                                                        }}
                                                        className="w-full flex items-center gap-2 p-2 hover:bg-muted/50 transition-colors text-left"
                                                    >
                                                        <Avatar className="h-7 w-7">
                                                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                                                {c.name.charAt(0)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-medium text-sm">{c.name}</span>
                                                        <span className="text-xs text-muted-foreground">• {c.phone}</span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Click outside to close dropdown */}
                                {customerDropdownOpen && (
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setCustomerDropdownOpen(false)}
                                    />
                                )}
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
                                            <div className="flex items-center justify-between gap-3">
                                                {/* QR Code on left for confirmed products */}
                                                {confirmedProducts.has(index) && (
                                                    <div className="bg-white p-1 rounded border shadow-sm flex-shrink-0">
                                                        <QRCodeSVG
                                                            value={`${nextOrderCode || 'A-1'}-${index + 1}`}
                                                            size={50}
                                                            level="M"
                                                        />
                                                        <p className="text-[10px] font-mono font-bold text-primary text-center mt-0.5">
                                                            {nextOrderCode || 'A-1'}-{index + 1}
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <Badge variant="outline" className="shrink-0">
                                                        {productTypes.find(t => t.code === product.type)?.name || 'Khác'}
                                                    </Badge>
                                                    <CardTitle className="text-base truncate">
                                                        {product.name || `Sản phẩm ${index + 1}`}
                                                    </CardTitle>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            if (currentProductIndex === index) {
                                                                setCurrentProductIndex(null);
                                                            } else {
                                                                setCurrentProductIndex(index);
                                                                // If previously confirmed, un-confirm to allow editing
                                                                if (confirmedProducts.has(index)) {
                                                                    const next = new Set(confirmedProducts);
                                                                    next.delete(index);
                                                                    setConfirmedProducts(next);
                                                                }
                                                            }
                                                        }}
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

                                        {currentProductIndex === index && !confirmedProducts.has(index) && (
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
                                                                {productTypes.map(t => (
                                                                    <SelectItem key={t.code} value={t.code}>
                                                                        {t.name}
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
                                                    <Label>Ảnh sản phẩm</Label>
                                                    <ImageUpload
                                                        value={product.images[0] ?? null}
                                                        onChange={(url) => handleUpdateProduct(index, 'images', url ? [url] : [])}
                                                        bucket="products"
                                                        folder="images"
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

                                                {/* Confirm Button */}
                                                <div className="flex justify-end pt-2 border-t">
                                                    <Button
                                                        onClick={() => {
                                                            if (!product.name.trim()) {
                                                                toast.error('Vui lòng nhập tên sản phẩm');
                                                                return;
                                                            }
                                                            setConfirmedProducts(prev => new Set([...prev, index]));
                                                            setCurrentProductIndex(null);
                                                        }}
                                                        className="bg-green-600 hover:bg-green-700"
                                                    >
                                                        <Check className="h-4 w-4 mr-2" />
                                                        Xác nhận thông tin
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        )}

                                        {/* Show collapsed info with service selection for confirmed products */}
                                        {currentProductIndex !== index && product.name && (
                                            <CardContent className="pt-0 space-y-3">
                                                {/* Product info badges */}
                                                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                                    {product.brand && <Badge variant="outline">{product.brand}</Badge>}
                                                    {product.color && <Badge variant="outline">{product.color}</Badge>}
                                                    {product.size && <Badge variant="outline">Size {product.size}</Badge>}
                                                    {confirmedProducts.has(index) && (
                                                        <Badge className="bg-green-100 text-green-700">
                                                            <Check className="h-3 w-3 mr-1" /> Đã xác nhận
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* Service selection for confirmed products */}
                                                {confirmedProducts.has(index) && (
                                                    <div className="border-t pt-3 space-y-3">
                                                        {/* Added services list with technicians */}
                                                        {product.services.length > 0 && (
                                                            <div className="space-y-3">
                                                                <p className="text-sm font-medium text-green-700">Dịch vụ đã chọn:</p>
                                                                {product.services.map((s, si) => (
                                                                    <div key={si} className="bg-green-50 p-2 rounded-lg space-y-1">
                                                                        {/* Service info row */}
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex-1">
                                                                                <p className="text-sm font-medium">{s.name}</p>
                                                                                <p className="text-xs text-green-600">{formatCurrency(s.price)}</p>
                                                                            </div>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-6 w-6 text-red-500 hover:text-red-600"
                                                                                onClick={() => handleRemoveService(index, si)}
                                                                            >
                                                                                <Trash2 className="h-3 w-3" />
                                                                            </Button>
                                                                        </div>

                                                                        {/* Technicians section - compact */}
                                                                        <div className="pt-1">
                                                                            <p className="text-xs text-muted-foreground mb-1">Kỹ thuật viên:</p>

                                                                            {/* Assigned technicians */}
                                                                            {s.technicians && s.technicians.length > 0 ? (
                                                                                <div className="space-y-2 mb-2">
                                                                                    {s.technicians.map((tech, ti) => (
                                                                                        <div key={ti} className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-lg border text-xs">
                                                                                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                                                                <Avatar className="h-6 w-6 flex-shrink-0">
                                                                                                    <AvatarFallback className="bg-blue-100 text-blue-700 text-[10px]">
                                                                                                        {tech.name.charAt(0)}
                                                                                                    </AvatarFallback>
                                                                                                </Avatar>
                                                                                                <span className="font-medium truncate">{tech.name}</span>
                                                                                            </div>
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <Input
                                                                                                    type="number"
                                                                                                    min="0"
                                                                                                    max="100"
                                                                                                    value={tech.commission || 0}
                                                                                                    onChange={(e) => handleUpdateTechnicianCommission(index, si, tech.id, Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                                                                                    onFocus={(e) => e.target.select()}
                                                                                                    className="w-14 h-7 text-xs text-center p-1"
                                                                                                />
                                                                                                <span className="text-[10px]">%=</span>
                                                                                                <span className="font-semibold text-emerald-600 min-w-[55px] text-right text-xs">
                                                                                                    {formatCurrency(s.price * (tech.commission || 0) / 100)}
                                                                                                </span>
                                                                                                <Button
                                                                                                    variant="ghost"
                                                                                                    size="icon"
                                                                                                    className="h-7 w-7 text-red-400 hover:text-red-600 flex-shrink-0 touch-manipulation"
                                                                                                    onClick={() => handleRemoveTechnicianFromService(index, si, tech.id)}
                                                                                                >
                                                                                                    <X className="h-3.5 w-3.5" />
                                                                                                </Button>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : null}

                                                                            {/* Add technician dropdown */}
                                                                            <Select
                                                                                value=""
                                                                                onValueChange={(techId) => {
                                                                                    if (techId) handleAddTechnicianToService(index, si, techId, 0);
                                                                                }}
                                                                            >
                                                                                <SelectTrigger className="h-7 text-xs">
                                                                                    <SelectValue placeholder="+ Chọn kỹ thuật viên" />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    {availableTechnicians
                                                                                        .filter(tech => !s.technicians?.some(t => t.id === tech.id))
                                                                                        .map(tech => (
                                                                                            <SelectItem key={tech.id} value={tech.id}>
                                                                                                {tech.name}
                                                                                            </SelectItem>
                                                                                        ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>

                                                                        {/* Sales section - compact */}
                                                                        <div className="pt-1 mt-2 border-t border-dashed">
                                                                            <p className="text-xs text-muted-foreground mb-1">Nhân viên sales:</p>

                                                                            {/* Assigned sales */}
                                                                            {s.sales && s.sales.length > 0 ? (
                                                                                <div className="space-y-2 mb-2">
                                                                                    {s.sales.map((sale, sai) => (
                                                                                        <div key={sai} className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-lg border text-xs">
                                                                                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                                                                <Avatar className="h-6 w-6 flex-shrink-0">
                                                                                                    <AvatarFallback className="bg-amber-100 text-amber-700 text-[10px]">
                                                                                                        {sale.name.charAt(0)}
                                                                                                    </AvatarFallback>
                                                                                                </Avatar>
                                                                                                <span className="font-medium truncate">{sale.name}</span>
                                                                                            </div>
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <Input
                                                                                                    type="number"
                                                                                                    min="0"
                                                                                                    max="100"
                                                                                                    value={sale.commission || 0}
                                                                                                    onChange={(e) => handleUpdateSaleCommission(index, si, sale.id, Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                                                                                    onFocus={(e) => e.target.select()}
                                                                                                    className="w-14 h-7 text-xs text-center p-1"
                                                                                                />
                                                                                                <span className="text-[10px]">%</span>
                                                                                                <span className="font-semibold text-amber-600 min-w-[65px] text-right text-xs">
                                                                                                    = {formatCurrency(s.price * (sale.commission || 0) / 100)}
                                                                                                </span>
                                                                                                <Button
                                                                                                    variant="ghost"
                                                                                                    size="icon"
                                                                                                    className="h-7 w-7 text-red-400 hover:text-red-600 flex-shrink-0 touch-manipulation"
                                                                                                    onClick={() => handleRemoveSaleFromService(index, si, sale.id)}
                                                                                                >
                                                                                                    <X className="h-3.5 w-3.5" />
                                                                                                </Button>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : null}

                                                                            {/* Add sale dropdown */}
                                                                            <Select
                                                                                value=""
                                                                                onValueChange={(saleId) => {
                                                                                    if (saleId) handleAddSaleToService(index, si, saleId, 0);
                                                                                }}
                                                                            >
                                                                                <SelectTrigger className="h-7 text-xs">
                                                                                    <SelectValue placeholder="+ Chọn nhân viên sales" />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    {availableSales
                                                                                        .filter(sale => !s.sales?.some(sl => sl.id === sale.id))
                                                                                        .map(sale => (
                                                                                            <SelectItem key={sale.id} value={sale.id}>
                                                                                                {sale.name}
                                                                                            </SelectItem>
                                                                                        ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Add Service Button */}
                                                        <div className="w-full">
                                                            <ServiceSelector
                                                                services={services}
                                                                packages={packages}
                                                                productType={product.type}
                                                                onSelect={(service) => handleServiceClick(index, service)}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Show service count for non-confirmed products */}
                                                {!confirmedProducts.has(index) && product.services.length > 0 && (
                                                    <Badge className="bg-green-100 text-green-700">
                                                        {product.services.length} dịch vụ
                                                    </Badge>
                                                )}
                                            </CardContent>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        )}

                        {/* Sản phẩm bán kèm */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Tag className="h-5 w-5 text-amber-600" />
                                        Sản phẩm bán kèm
                                    </CardTitle>
                                    <Button variant="outline" size="sm" onClick={() => setAddOnDialogOpen(true)} className="gap-1">
                                        <Plus className="h-4 w-4" />
                                        Thêm SP bán kèm
                                    </Button>
                                </div>
                                <p className="text-sm text-muted-foreground">Sản phẩm từ danh mục bán kèm theo đơn (không gắn dịch vụ)</p>
                            </CardHeader>
                            {addOnProducts.length > 0 ? (
                                <CardContent className="space-y-2">
                                    {addOnProducts.map((a) => (
                                        <div key={a.id} className="flex flex-col gap-3 p-3 bg-amber-50/50 rounded-lg border border-amber-200/50">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{a.name}</p>
                                                    <p className="text-sm text-muted-foreground">{formatCurrency(a.price)} × {a.quantity}</p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        value={a.quantity}
                                                        onChange={(e) => handleUpdateAddOnQuantity(a.id, Math.max(1, parseInt(e.target.value, 10) || 1))}
                                                        className="w-16 h-8 text-center"
                                                    />
                                                    <span className="font-semibold text-amber-700 w-24 text-right">{formatCurrency(a.price * a.quantity)}</span>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemoveAddOn(a.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Sales assignment for add-on */}
                                            <div className="pt-2 border-t border-amber-200/60">
                                                <p className="text-[10px] font-medium text-amber-800 uppercase mb-2">Nhân viên sales</p>
                                                {a.sales && a.sales.length > 0 && (
                                                    <div className="space-y-2 mb-2">
                                                        {a.sales.map((sale, sai) => (
                                                            <div key={sai} className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-lg border text-xs">
                                                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                                    <Avatar className="h-6 w-6 flex-shrink-0">
                                                                        <AvatarFallback className="bg-amber-100 text-amber-700 text-[10px]">
                                                                            {sale.name.charAt(0)}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <span className="font-medium truncate">{sale.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        max="100"
                                                                        value={sale.commission || 0}
                                                                        onChange={(e) => handleUpdateAddOnSaleCommission(a.id, sale.id, Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                                                        onFocus={(e) => {
                                                                            e.target.select();
                                                                            if (lastAddedAddOnSale?.addOnId === a.id && lastAddedAddOnSale?.saleId === sale.id) {
                                                                                setLastAddedAddOnSale(null);
                                                                            }
                                                                        }}
                                                                        className="w-14 h-7 text-xs text-center p-1"
                                                                        autoFocus={lastAddedAddOnSale?.addOnId === a.id && lastAddedAddOnSale?.saleId === sale.id}
                                                                    />
                                                                    <span className="text-[10px]">%</span>
                                                                    <span className="font-semibold text-amber-600 min-w-[65px] text-right text-xs">
                                                                        = {formatCurrency(((a.price * a.quantity) * (sale.commission || 0)) / 100)}
                                                                    </span>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-red-400 hover:text-red-600 flex-shrink-0 touch-manipulation"
                                                                        onClick={() => handleRemoveSaleFromAddOn(a.id, sale.id)}
                                                                    >
                                                                        <X className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <Select value="" onValueChange={(val) => handleAddSaleToAddOn(a.id, val, 0)}>
                                                    <SelectTrigger className="h-7 text-[10px] bg-white/40 border-amber-200/50">
                                                        <SelectValue placeholder="+ Thêm nhân viên sales" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {availableSales
                                                            .filter(s => !a.sales?.some(as => as.id === s.id))
                                                            .map(s => (
                                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    ))}
                                    <p className="text-sm text-muted-foreground pt-1">Tổng SP bán kèm: <span className="font-semibold text-foreground">{formatCurrency(subtotalFromAddOns)}</span></p>
                                </CardContent>
                            ) : (
                                <CardContent className="py-6 text-center text-muted-foreground">
                                    <Tag className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Chưa có sản phẩm bán kèm</p>
                                    <Button variant="outline" size="sm" className="mt-2" onClick={() => setAddOnDialogOpen(true)}>Thêm sản phẩm bán kèm</Button>
                                </CardContent>
                            )}
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="hidden lg:block">
                        {orderSidebarContent}
                    </div>
                </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Products */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Products Summary */}
                        <Card>
                            <CardHeader className="pb-3 border-b">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <ShoppingBag className="h-5 w-5 text-primary" />
                                        Sản phẩm & Dịch vụ
                                    </CardTitle>
                                    <Badge variant="secondary" className="text-sm">
                                        {products.length} sản phẩm khách
                                        {addOnProducts.length > 0 && ` + ${addOnProducts.length} SP bán kèm`}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                                {/* Sản phẩm của khách + dịch vụ */}
                                {products.map((product, index) => (
                                    <div key={product.id} className="bg-muted/30 rounded-xl p-4 hover:bg-muted/50 transition-colors">
                                        <div className="flex items-start gap-4">
                                            {/* QR Code Preview */}
                                            <div className="shrink-0 p-2 bg-white rounded-lg border shadow-sm">
                                                <QRCodeSVG
                                                    value={`${nextOrderCode}-${index + 1}`}
                                                    size={64}
                                                    level="M"
                                                />
                                                <p className="text-[10px] text-center text-muted-foreground mt-1 font-mono font-bold">
                                                    {nextOrderCode}-{index + 1}
                                                </p>
                                            </div>

                                            {/* Product Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge className="bg-primary/10 text-primary border-0">
                                                        {productTypes.find(t => t.code === product.type)?.name || 'Khác'}
                                                    </Badge>
                                                    {product.brand && (
                                                        <Badge variant="outline" className="text-xs bg-white">
                                                            {product.brand}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="font-semibold text-lg">{product.name}</p>
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {product.color && (
                                                        <span className="text-xs text-muted-foreground bg-white px-2 py-1 rounded border">
                                                            Màu: {product.color}
                                                        </span>
                                                    )}
                                                    {product.size && (
                                                        <span className="text-xs text-muted-foreground bg-white px-2 py-1 rounded border">
                                                            Size: {product.size}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Services */}
                                                {product.services.length > 0 && (
                                                    <div className="mt-3 space-y-2">
                                                        {product.services.map((s, si) => (
                                                            <div key={si} className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 bg-white p-3 rounded-lg border">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <Sparkles className="h-4 w-4 text-purple-500 flex-shrink-0" />
                                                                        <span className="font-medium truncate">{s.name}</span>
                                                                    </div>
                                                                    {s.technicians.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                                            {s.technicians.map((tech, ti) => (
                                                                                <span key={ti} className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded-full whitespace-nowrap">
                                                                                    KTV: {tech.name} ({tech.commission}%)
                                                                                </span>
                                                                            ))}
                                                                            {s.sales && s.sales.length > 0 && s.sales.map((sale, sai) => (
                                                                                <span key={`s-${sai}`} className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded-full whitespace-nowrap">
                                                                                    Sales: {sale.name} ({sale.commission}%)
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {s.technicians.length === 0 && s.sales && s.sales.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                                            {s.sales.map((sale, sai) => (
                                                                                <span key={`s-${sai}`} className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded-full whitespace-nowrap">
                                                                                    Sales: {sale.name} ({sale.commission}%)
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <span className="font-bold text-green-600 text-base sm:text-lg flex-shrink-0">{formatCurrency(s.price)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {product.services.length === 0 && (
                                                    <p className="text-sm text-muted-foreground mt-2 italic">Chưa có dịch vụ</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Sản phẩm bán kèm - Step 3 Review */}
                                {addOnProducts.length > 0 && (
                                    <div className="pt-4 border-t mt-4">
                                        <p className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-2">
                                            <Tag className="h-4 w-4" />
                                            Sản phẩm bán kèm
                                        </p>
                                        <div className="space-y-2">
                                            {addOnProducts.map((a) => (
                                                <div key={a.id} className="bg-amber-50/50 p-3 rounded-lg border border-amber-200/50">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-medium">{a.name}</span>
                                                        <span className="text-amber-700 font-semibold">{a.quantity} × {formatCurrency(a.price)} = {formatCurrency(a.price * a.quantity)}</span>
                                                    </div>
                                                    {a.sales && a.sales.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {a.sales.map((sale, sai) => (
                                                                <span key={sai} className="text-[10px] text-amber-600 bg-amber-100/50 px-1.5 py-0.5 rounded border border-amber-200/50">
                                                                    Sales: {sale.name} ({sale.commission}%)
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Notes */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Ghi chú đơn hàng
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    placeholder="Nhập ghi chú cho đơn hàng..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={3}
                                    className="resize-none"
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column - Summary & Payment */}
                    <div className="space-y-4">
                        {/* Customer Info */}
                        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Khách hàng
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                                        <AvatarFallback className="bg-primary text-white font-bold">
                                            {selectedCustomer?.name.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold">{selectedCustomer?.name}</p>
                                        <p className="text-sm text-muted-foreground">{selectedCustomer?.phone}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Ngày hẹn trả */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Ngày hẹn trả
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Input
                                    type="date"
                                    value={dueAt}
                                    onChange={(e) => setDueAt(e.target.value)}
                                    className="w-full"
                                />
                            </CardContent>
                        </Card>

                        {/* Discount & Surcharges */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Giảm giá & Phụ phí</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Discount */}
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Giảm giá</Label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Input
                                                type="text"
                                                value={discountType === 'amount' ? formatInputCurrency(discount) : (discount || '')}
                                                onChange={(e) => {
                                                    if (discountType === 'amount') {
                                                        setDiscount(parseInputCurrency(e.target.value));
                                                    } else {
                                                        const val = Number(e.target.value.replace(/[^0-9]/g, '')) || 0;
                                                        setDiscount(Math.min(val, 100));
                                                    }
                                                }}
                                                placeholder="0"
                                                className="pr-10"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                                {discountType === 'percent' ? '%' : 'đ'}
                                            </span>
                                        </div>
                                        <div className="flex border rounded-md overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDiscountType('amount');
                                                }}
                                                className={`px-2.5 py-1.5 text-xs transition-colors ${discountType === 'amount' ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'}`}
                                            >
                                                <DollarSign className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDiscountType('percent');
                                                    if (discount > 100) setDiscount(100);
                                                }}
                                                className={`px-2.5 py-1.5 text-xs transition-colors ${discountType === 'percent' ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'}`}
                                            >
                                                <Percent className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Surcharges */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs text-muted-foreground">Phụ phí</Label>
                                        <Select onValueChange={handleAddSurcharge}>
                                            <SelectTrigger className="w-auto h-7 text-xs gap-1 px-2">
                                                <Plus className="h-3 w-3" />
                                                <span>Thêm</span>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {SURCHARGE_TYPES.filter(st => !surcharges.some(s => s.type === st.value)).map(st => (
                                                    <SelectItem key={st.value} value={st.value}>
                                                        {st.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {surcharges.length > 0 && (
                                        <div className="space-y-2">
                                            {surcharges.map(surcharge => (
                                                <div key={surcharge.id} className="p-2 bg-muted/50 rounded-lg">
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-xs font-medium">{surcharge.label}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveSurcharge(surcharge.id)}
                                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                    <div className="flex gap-1.5">
                                                        <div className="relative flex-1">
                                                            <Input
                                                                type="text"
                                                                value={surcharge.isPercent ? (surcharge.value || '') : formatInputCurrency(surcharge.value)}
                                                                onChange={(e) => {
                                                                    if (surcharge.isPercent) {
                                                                        const val = Number(e.target.value.replace(/[^0-9]/g, '')) || 0;
                                                                        handleUpdateSurcharge(surcharge.id, 'value', Math.min(val, 100));
                                                                    } else {
                                                                        handleUpdateSurcharge(surcharge.id, 'value', parseInputCurrency(e.target.value));
                                                                    }
                                                                }}
                                                                className="h-8 text-sm pr-8"
                                                                placeholder="0"
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                                                                {surcharge.isPercent ? '%' : 'đ'}
                                                            </span>
                                                        </div>
                                                        <div className="flex border rounded overflow-hidden">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateSurcharge(surcharge.id, 'isPercent', false)}
                                                                className={`px-1.5 py-1 text-xs ${!surcharge.isPercent ? 'bg-primary text-white' : 'bg-background'}`}
                                                            >
                                                                <DollarSign className="h-3 w-3" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateSurcharge(surcharge.id, 'isPercent', true)}
                                                                className={`px-1.5 py-1 text-xs ${surcharge.isPercent ? 'bg-primary text-white' : 'bg-background'}`}
                                                            >
                                                                <Percent className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Payment Summary */}
                        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                                    <CreditCard className="h-4 w-4" />
                                    Thanh toán
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Totals */}
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Tạm tính</span>
                                        <span>{formatCurrency(subtotal)}</span>
                                    </div>
                                    {discountAmount > 0 && (
                                        <div className="flex justify-between text-red-600">
                                            <span>Giảm giá {discountType === 'percent' ? `(${discount}%)` : ''}</span>
                                            <span>-{formatCurrency(discountAmount)}</span>
                                        </div>
                                    )}
                                    {totalSurcharges > 0 && (
                                        <div className="flex justify-between text-orange-600">
                                            <span>Phụ phí</span>
                                            <span>+{formatCurrency(totalSurcharges)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-green-200">
                                        <span>Tổng cộng</span>
                                        <span className="text-green-600">{formatCurrency(total)}</span>
                                    </div>
                                </div>

                                {/* Payment Input */}
                                <div className="space-y-2 pt-2 border-t border-green-200">
                                    <Label className="text-xs text-green-700">Nhận thanh toán</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="text"
                                            value={formatInputCurrency(paidAmount)}
                                            onChange={(e) => setPaidAmount(parseInputCurrency(e.target.value))}
                                            placeholder="Số tiền khách trả"
                                            className="flex-1 border-green-200 focus:ring-green-500"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPaidAmount(total)}
                                            className="whitespace-nowrap border-green-300 text-green-600 hover:bg-green-50"
                                        >
                                            Đủ
                                        </Button>
                                    </div>
                                </div>

                                {/* Payment Status */}
                                <div className="flex items-center justify-between pt-2 border-t border-green-200">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Còn nợ</p>
                                        <p className={`text-lg font-bold ${remainingDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {formatCurrency(remainingDebt)}
                                        </p>
                                    </div>
                                    <Badge
                                        className={remainingDebt <= 0 ? 'bg-green-500' : remainingDebt < total ? 'bg-yellow-500' : 'bg-red-500'}
                                    >
                                        {remainingDebt <= 0 ? 'Đã thanh toán' : remainingDebt < total ? 'Một phần' : 'Chưa thanh toán'}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* Step 4: Success */}
            {step === 4 && createdOrder && (
                <Card className="text-center py-12">
                    <CardContent>
                        <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6" />
                        <h2 className="text-2xl font-bold mb-2">Tạo đơn hàng thành công!</h2>
                        <p className="text-muted-foreground mb-6">
                            Mã đơn: <span className="font-mono font-bold">{createdOrder.order?.order_code}</span>
                        </p>

                        {/* QR Codes */}
                        {createdOrder.customer_items && createdOrder.customer_items.length > 0 && (
                            <div className="mb-8">
                                <h3 className="font-semibold mb-4">Mã QR sản phẩm</h3>
                                <div className="flex flex-wrap justify-center gap-6">
                                    {createdOrder.customer_items.map((p: any, index: number) => (
                                        <div key={index} className="p-4 border rounded-lg bg-white shadow-sm">
                                            <QRCodeSVG
                                                value={p.product_code || p.qr_code || `Product-${index + 1}`}
                                                size={140}
                                                level="M"
                                                includeMargin={true}
                                            />
                                            <p className="text-lg font-mono font-bold mt-3 text-primary">{p.product_code || p.qr_code}</p>
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
                                        const qrHtml = createdOrder.customer_items?.map((p: any) => `
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
                                                        ${createdOrder.customer_items?.map((p: any) => `
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
            {step < 4 && (
                <div className="flex justify-between pt-4 border-t">
                    <Button
                        variant="outline"
                        onClick={() => setStep(s => Math.max(1, s - 1))}
                        disabled={step === 1}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Quay lại
                    </Button>

                    {step < 3 ? (
                        <Button
                            onClick={() => setStep(s => s + 1)}
                            disabled={!canGoNext()}
                        >
                            Tiếp tục
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    ) : (
                        <Button
                            onClick={() => handleSubmit('before_sale')}
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
                </div >
            )}

            {/* Confirmation Dialog */}


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
                            {pendingService?.service.commission_tech !== undefined && (
                                <span className="ml-3">
                                    Hoa hồng: <span className="font-medium text-blue-600">{pendingService.service.commission_tech}%</span>
                                </span>
                            )}
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
                initialName={/^[a-zA-Z\sÀ-ỹ]+$/.test(customerSearch) ? customerSearch : ''}
                initialPhone={/^[0-9\s.+]+$/.test(customerSearch) && customerSearch.replace(/[^0-9]/g, '').length >= 9 ? customerSearch : ''}
            />

            {/* Sản phẩm bán kèm Dialog */}
            <Dialog open={addOnDialogOpen} onOpenChange={setAddOnDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Tag className="h-5 w-5 text-amber-600" />
                            Chọn sản phẩm bán kèm
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground">Sản phẩm từ danh mục bán kèm theo đơn (không gắn dịch vụ)</p>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Tìm sản phẩm..."
                                value={addOnSearch}
                                onChange={(e) => setAddOnSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
                            {(catalogProducts || [])
                                .filter((p: { status: string; name: string }) => p.status === 'active')
                                .filter((p: { name: string }) => !addOnSearch.trim() || p.name.toLowerCase().includes(addOnSearch.toLowerCase()))
                                .map((p: any) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => handleAddAddOn(p)}
                                        className="p-3 text-left border rounded-lg hover:border-amber-500 hover:bg-amber-50/50 transition-colors"
                                    >
                                        <p className="font-medium text-sm truncate">{p.name}</p>
                                        <p className="text-amber-700 font-semibold text-sm mt-1">{formatCurrency(p.price)}</p>
                                    </button>
                                ))}
                        </div>
                        {(catalogProducts || []).filter((p: { status: string }) => p.status === 'active').length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">Chưa có sản phẩm trong danh mục</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>


            {/* Service Selection Dialog for confirmed products - REMOVED */}
        </div >
    );
}

