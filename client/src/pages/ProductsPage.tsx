import { useState, useEffect } from 'react';
import { Plus, Search, Package, Wrench, Gift, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useProducts } from '@/hooks/useProducts';
import { usePackages } from '@/hooks/usePackages';
import { useVouchers } from '@/hooks/useVouchers';
import { useDepartments } from '@/hooks/useDepartments';
import { toast } from 'sonner';

import {
    ProductFormDialog,
    ServiceFormDialog,
    PackageFormDialog,
    VoucherFormDialog,
    ProductsTable,
    ServicesTable,
    PackagesTable,
    VouchersTable,
    type Product,
    type Service,
    type ServicePackage,
    type APIVoucher,
} from '@/components/products';

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
        fetchPackages,
        createPackage,
        updatePackage,
        deletePackage,
    } = usePackages();

    const {
        vouchers,
        fetchVouchers,
        createVoucher,
        updateVoucher,
        deleteVoucher,
    } = useVouchers();

    const { departments, fetchDepartments } = useDepartments();

    // Fetch data on mount
    useEffect(() => {
        fetchProducts();
        fetchServices();
        fetchPackages();
        fetchVouchers();
        fetchDepartments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync activeTab with initialTab when sidebar navigation changes
    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    // Handle tab change and notify parent
    const handleTabChange = (tab: string) => {
        const typedTab = tab as 'products' | 'services' | 'packages' | 'vouchers';
        setActiveTab(typedTab);
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

    // Filtered data
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

    // Product handlers
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

    // Service handlers
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

    // Package handlers
    const handleCreatePackage = async (data: Partial<ServicePackage>) => {
        try {
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

    // Voucher handlers
    const handleCreateVoucher = async (data: Partial<APIVoucher>) => {
        try {
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

    // Helper to open add dialog based on active tab
    const handleAddClick = () => {
        setEditingItem(null);
        if (activeTab === 'products') setShowProductForm(true);
        else if (activeTab === 'services') setShowServiceForm(true);
        else if (activeTab === 'packages') setShowPackageForm(true);
        else setShowVoucherForm(true);
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
                                <Button onClick={handleAddClick}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Thêm mới
                                </Button>
                            </div>
                        </div>

                        {/* Products Tab */}
                        <TabsContent value="products" className="m-0">
                            <ProductsTable
                                products={filteredProducts}
                                loading={loading}
                                onEdit={(product) => { setEditingItem(product); setShowProductForm(true); }}
                                onDelete={handleDeleteProduct}
                            />
                        </TabsContent>

                        {/* Services Tab */}
                        <TabsContent value="services" className="m-0">
                            <ServicesTable
                                services={filteredServices}
                                loading={loading}
                                onEdit={(service) => { setEditingItem(service); setShowServiceForm(true); }}
                                onDelete={handleDeleteService}
                                departments={departments}
                            />
                        </TabsContent>

                        {/* Packages Tab */}
                        <TabsContent value="packages" className="m-0">
                            <PackagesTable
                                packages={filteredPackages}
                                onEdit={(pkg) => { setEditingItem(pkg); setShowPackageForm(true); }}
                                onDelete={handleDeletePackage}
                            />
                        </TabsContent>

                        {/* Vouchers Tab */}
                        <TabsContent value="vouchers" className="m-0">
                            <VouchersTable
                                vouchers={filteredVouchers}
                                onEdit={(voucher) => { setEditingItem(voucher); setShowVoucherForm(true); }}
                                onDelete={handleDeleteVoucher}
                            />
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
                departments={departments}
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
