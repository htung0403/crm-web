
import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, ShoppingBag, Wrench, Package, Info, Sparkles } from 'lucide-react';
import { ServiceSelector } from './ServiceSelector';
import { servicesApi, packagesApi, productsApi, ordersApi } from '@/lib/api';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string;
    preselectedProduct?: {
        id: string;
        name: string;
        type: string;
    } | null;
    onSuccess?: () => void;
}

export function UpsellDialog({ open, onOpenChange, orderId, preselectedProduct, onSuccess }: Props) {
    const [loading, setLoading] = useState(false);
    const [services, setServices] = useState<any[]>([]);
    const [packages, setPackages] = useState<any[]>([]);
    const [catalogProducts, setCatalogProducts] = useState<any[]>([]);

    // items to be serviced (V2 style)
    const [customerItems, setCustomerItems] = useState<any[]>([]);
    // items for direct sale (V1 style)
    const [saleItems, setSaleItems] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            fetchCatalog();
            if (preselectedProduct) {
                setCustomerItems([{
                    order_product_id: preselectedProduct.id,
                    name: preselectedProduct.name,
                    type: normalizeProductType(preselectedProduct.type),
                    services: []
                }]);
            } else {
                setCustomerItems([]);
            }
            setSaleItems([]);
        }
    }, [open, preselectedProduct]);

    const fetchCatalog = async () => {
        try {
            const [svcRes, pkgRes, prodRes] = await Promise.all([
                servicesApi.getAll(),
                packagesApi.getAll(),
                productsApi.getAll()
            ]);
            setServices(svcRes.data?.data?.services || []);
            setPackages(pkgRes.data?.data?.packages || []);
            setCatalogProducts(prodRes.data?.data?.products || []);
        } catch (error) {
            console.error('Error fetching catalog:', error);
            toast.error('Không thể tải danh sách dịch vụ');
        }
    };

    const normalizeProductType = (type: any): string => {
        if (!type) return 'khác';
        const lower = String(type).toLowerCase().trim();
        if (lower === 'shoe' || lower.includes('giày') || lower.includes('giay') || lower.includes('giây')) return 'giày';
        if (lower === 'bag' || lower.includes('túi') || lower.includes('tui')) return 'túi';
        if (lower === 'wallet' || lower.includes('ví') || lower.includes('vi')) return 'ví';
        if (lower === 'belt' || lower.includes('thắt lưng') || lower.includes('that lung')) return 'thắt lưng';
        if (lower.includes('dép') || lower.includes('dep')) return 'dép';
        if (lower.includes('mũ') || lower.includes('mu') || lower.includes('nón') || lower.includes('non')) return 'mũ';
        return 'khác';
    };

    const addCustomerItem = () => {
        setCustomerItems([...customerItems, {
            name: '',
            type: 'giày',
            services: []
        }]);
    };

    const removeCustomerItem = (index: number) => {
        setCustomerItems(customerItems.filter((_, i) => i !== index));
    };

    const updateCustomerItem = (index: number, field: string, value: any) => {
        const newItems = [...customerItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setCustomerItems(newItems);
    };

    const addServiceToItem = (itemIndex: number, service: any) => {
        const newItems = [...customerItems];
        const item = newItems[itemIndex];

        // Prevent duplicate services for the same item
        if (item.services.find((s: any) => s.id === service.id && s.type === service.type)) {
            toast.warning('Dịch vụ này đã được chọn');
            return;
        }

        item.services.push(service);
        setCustomerItems(newItems);
    };

    const removeServiceFromItem = (itemIndex: number, svcIndex: number) => {
        const newItems = [...customerItems];
        newItems[itemIndex].services.splice(svcIndex, 1);
        setCustomerItems(newItems);
    };

    const addSaleItem = (product: any) => {
        const existing = saleItems.find(p => p.id === product.id);
        if (existing) {
            updateSaleItemQuantity(product.id, existing.quantity + 1);
        } else {
            setSaleItems([...saleItems, {
                ...product,
                quantity: 1,
                unit_price: product.price
            }]);
        }
    };

    const updateSaleItemQuantity = (id: string, quantity: number) => {
        if (quantity < 1) return;
        setSaleItems(saleItems.map(p => p.id === id ? { ...p, quantity } : p));
    };

    const removeSaleItem = (id: string) => {
        setSaleItems(saleItems.filter(p => p.id !== id));
    };

    const calculateTotal = () => {
        let total = 0;
        customerItems.forEach(item => {
            item.services.forEach((s: any) => {
                total += Number(s.price) || 0;
            });
        });
        saleItems.forEach(item => {
            total += (Number(item.unit_price) || 0) * (item.quantity || 1);
        });
        return total;
    };

    const handleUpsell = async () => {
        if (customerItems.length === 0 && saleItems.length === 0) {
            toast.warning('Vui lòng chọn ít nhất một hạng mục');
            return;
        }

        // Validate customer items
        for (const item of customerItems) {
            if (!item.name.trim()) {
                toast.warning('Vui lòng nhập tên sản phẩm khách gửi');
                return;
            }
            if (item.services.length === 0) {
                toast.warning(`Vui lòng chọn dịch vụ cho ${item.name}`);
                return;
            }
        }

        setLoading(true);
        try {
            const data = {
                customer_items: customerItems.map(item => ({
                    ...item,
                    order_product_id: item.order_product_id,
                    services: item.services.map((s: any) => ({
                        id: s.id,
                        type: s.type,
                        name: s.name,
                        price: s.price
                    }))
                })),
                sale_items: saleItems.map(item => ({
                    id: item.id,
                    product_id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    unit_price: item.unit_price
                }))
            };

            const response = await ordersApi.upsell(orderId, data);

            if (response.data.status === 'success') {
                toast.success(response.data.message || 'Đã thêm hạng mục upsell thành công');
                onOpenChange(false);
                if (onSuccess) onSuccess();
            }
        } catch (error: any) {
            console.error('Upsell error:', error);
            toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi thực hiện upsell');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="px-8 py-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                            <Sparkles className="h-6 w-6 text-yellow-300 fill-yellow-300" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-bold">
                                Đề xuất Upsell
                            </DialogTitle>
                            <DialogDescription className="text-indigo-100 italic">
                                Gia tăng giá trị đơn hàng bằng cách đề xuất thêm dịch vụ hoặc sản phẩm.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden p-8 bg-slate-50">
                    <Tabs defaultValue="customer_items" className="h-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-2 mb-8 bg-white p-1 rounded-xl shadow-sm border">
                            <TabsTrigger value="customer_items" className="flex items-center gap-2 rounded-lg py-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 text-sm font-medium">
                                <Wrench className="h-4 w-4" />
                                Thêm dịch vụ / Đồ gửi mới
                            </TabsTrigger>
                            <TabsTrigger value="sale_items" className="flex items-center gap-2 rounded-lg py-2 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 text-sm font-medium">
                                <Package className="h-4 w-4" />
                                Sản phẩm bán thêm
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-hidden">
                            <TabsContent value="customer_items" className="h-full m-0">
                                <ScrollArea className="h-full pr-4">
                                    <div className="space-y-6">
                                        {customerItems.map((item, index) => (
                                            <Card key={index} className="border-none shadow-sm overflow-hidden bg-white hover:shadow-md transition-shadow">
                                                <CardContent className="p-0">
                                                    <div className="bg-slate-100/50 px-4 py-2 border-b flex justify-between items-center">
                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hạng mục #{index + 1}</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-slate-400 hover:text-red-500 h-8 w-8"
                                                            onClick={() => removeCustomerItem(index)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <div className="p-5 space-y-4">
                                                        <div className="grid grid-cols-12 gap-4">
                                                            <div className="col-span-8 space-y-2">
                                                                <Label className="text-xs font-bold text-slate-600 uppercase tracking-tight">Tên sản phẩm / Model</Label>
                                                                <Input
                                                                    placeholder="VD: Jordan 1 High OG, Handbag..."
                                                                    value={item.name}
                                                                    className="border-slate-200 focus:border-indigo-500 bg-slate-50/30 text-sm"
                                                                    onChange={(e) => updateCustomerItem(index, 'name', e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="col-span-4 space-y-2">
                                                                <Label className="text-xs font-bold text-slate-600 uppercase tracking-tight">Loại</Label>
                                                                <Select
                                                                    value={item.type}
                                                                    onValueChange={(val) => updateCustomerItem(index, 'type', val)}
                                                                >
                                                                    <SelectTrigger className="border-slate-200 bg-slate-50/30 text-sm">
                                                                        <SelectValue placeholder="Chọn loại" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="giày">Giày</SelectItem>
                                                                        <SelectItem value="túi">Túi xách</SelectItem>
                                                                        <SelectItem value="ví">Ví</SelectItem>
                                                                        <SelectItem value="thắt lưng">Thắt lưng</SelectItem>
                                                                        <SelectItem value="dép">Dép</SelectItem>
                                                                        <SelectItem value="mũ">Mũ/Nón</SelectItem>
                                                                        <SelectItem value="khác">Khác</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-3 bg-indigo-50/30 p-4 rounded-xl border border-indigo-100/50">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <div className="flex items-center gap-2">
                                                                    <Wrench className="h-4 w-4 text-indigo-500" />
                                                                    <span className="text-xs font-bold text-indigo-900">Dịch vụ áp dụng</span>
                                                                </div>
                                                                <div className="flex-1 max-w-[200px]">
                                                                    <ServiceSelector
                                                                        services={services}
                                                                        packages={packages}
                                                                        productType={item.type}
                                                                        onSelect={(svc) => addServiceToItem(index, svc)}
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-wrap gap-2 pt-2">
                                                                {item.services.length === 0 ? (
                                                                    <p className="text-xs text-slate-400 italic">Chưa chọn dịch vụ nào cho hạng mục này.</p>
                                                                ) : (
                                                                    item.services.map((svc: any, sIdx: number) => (
                                                                        <Badge
                                                                            key={sIdx}
                                                                            variant="secondary"
                                                                            className="pl-3 pr-1 py-1 flex items-center gap-2 bg-white border border-indigo-100 text-indigo-700 shadow-sm"
                                                                        >
                                                                            <span className="text-[11px] font-medium">{svc.name} - {formatCurrency(svc.price)}</span>
                                                                            <button
                                                                                onClick={() => removeServiceFromItem(index, sIdx)}
                                                                                className="hover:bg-red-50 text-red-500 rounded-full p-0.5 transition-colors"
                                                                            >
                                                                                <Trash2 className="h-3 w-3" />
                                                                            </button>
                                                                        </Badge>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}

                                        <Button
                                            variant="outline"
                                            className="w-full border-dashed border-2 py-10 flex flex-col items-center gap-3 hover:bg-white hover:border-indigo-300 hover:text-indigo-600 transition-all bg-transparent group"
                                            onClick={addCustomerItem}
                                        >
                                            <div className="bg-slate-100 p-2 rounded-full group-hover:bg-indigo-50">
                                                <Plus className="h-6 w-6 text-slate-400 group-hover:text-indigo-500" />
                                            </div>
                                            <span className="text-slate-500 group-hover:text-indigo-600 font-medium">Thêm sản phẩm khách gửi mới</span>
                                        </Button>
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="sale_items" className="h-full m-0 flex flex-col gap-8">
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold text-slate-600 uppercase px-1 tracking-tight">Danh mục sản phẩm bán lẻ (Sẵn có)</Label>
                                    <ScrollArea className="max-h-[160px] pb-2">
                                        <div className="flex flex-wrap gap-3 p-1">
                                            {catalogProducts.filter(p => p.status === 'active' && p.stock_quantity > 0).map(product => (
                                                <Button
                                                    key={product.id}
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-auto py-3 flex-col items-start gap-1 w-[150px] bg-white border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-all text-left group"
                                                    onClick={() => addSaleItem(product)}
                                                >
                                                    <span className="text-[11px] font-bold line-clamp-1 group-hover:text-violet-700">{product.name}</span>
                                                    <span className="text-[10px] text-emerald-600 font-bold">{formatCurrency(product.price)}</span>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <Badge variant="outline" className="text-[9px] h-4 px-1 text-slate-400 font-normal">Kho: {product.stock_quantity}</Badge>
                                                    </div>
                                                </Button>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>

                                <div className="flex-1 overflow-hidden flex flex-col gap-3">
                                    <div className="flex items-center justify-between px-1">
                                        <Label className="text-xs font-bold text-slate-600 uppercase tracking-tight">Sản phẩm đã chọn</Label>
                                        {saleItems.length > 0 && <span className="text-xs text-slate-400">{saleItems.length} mặt hàng</span>}
                                    </div>
                                    <ScrollArea className="flex-1 bg-white border border-slate-100 rounded-xl shadow-sm p-4">
                                        {saleItems.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-slate-300 space-y-3 py-16">
                                                <div className="bg-slate-50 p-4 rounded-full">
                                                    <ShoppingBag className="h-10 w-10" />
                                                </div>
                                                <p className="text-sm font-medium">Chưa có sản phẩm bán kèm nào</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {saleItems.map(item => (
                                                    <div key={item.id} className="flex items-center justify-between group bg-slate-50/50 p-3 rounded-lg hover:bg-violet-50/30 transition-colors">
                                                        <div className="flex-1">
                                                            <p className="text-sm font-bold text-slate-800">{item.name}</p>
                                                            <p className="text-xs text-emerald-600 font-bold">{formatCurrency(item.unit_price)}</p>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex items-center bg-white border rounded-lg shadow-sm">
                                                                <button
                                                                    className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 text-slate-500 font-bold"
                                                                    onClick={() => updateSaleItemQuantity(item.id, item.quantity - 1)}
                                                                >
                                                                    -
                                                                </button>
                                                                <span className="w-8 text-center text-xs font-bold text-slate-700">{item.quantity}</span>
                                                                <button
                                                                    className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 text-slate-500 font-bold"
                                                                    onClick={() => updateSaleItemQuantity(item.id, item.quantity + 1)}
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-slate-300 hover:text-red-500 hover:bg-red-50 h-8 w-8"
                                                                onClick={() => removeSaleItem(item.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>

                <div className="bg-white px-8 py-6 flex items-center justify-between border-t shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tổng giá trị thêm mới</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-indigo-600">{calculateTotal().toLocaleString()}</span>
                            <span className="text-xs font-bold text-indigo-400 pl-1">VNĐ</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" className="border-slate-200 hover:bg-slate-50 px-6 py-4 h-auto font-bold text-slate-600 text-sm" onClick={() => onOpenChange(false)}>
                            Bỏ qua
                        </Button>
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-700 px-8 py-4 h-auto font-bold shadow-lg shadow-indigo-200 text-sm"
                            onClick={handleUpsell}
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Đang áp dụng...</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4" />
                                    <span>Xác nhận Upsell</span>
                                </div>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
