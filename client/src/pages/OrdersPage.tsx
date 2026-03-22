import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd';
import { Plus, Loader2, Search } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useOrders } from '@/hooks/useOrders';
import type { Order, OrderItem } from '@/hooks/useOrders';
import { useCustomers } from '@/hooks/useCustomers';
import { useProducts } from '@/hooks/useProducts';
import { usePackages } from '@/hooks/usePackages';
import { useVouchers } from '@/hooks/useVouchers';
import { useUsers } from '@/hooks/useUsers';
import { useDepartments } from '@/hooks/useDepartments';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { OrderStatus } from '@/types';

import {
    OrderCard,
    OrderConfirmationDialog,
    PaymentDialog,
    columns
} from '@/components/orders';
import { orderItemsApi } from '@/lib/api';
import { normalizeSearchText } from '@/lib/utils';

export function OrdersPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { orders, loading, error, fetchOrders, updateOrderStatus, updateOrder, createOrder } = useOrders();
    const { customers, fetchCustomers } = useCustomers();
    const { products, services, fetchProducts, fetchServices } = useProducts();
    const { packages, fetchPackages } = usePackages();
    const { vouchers, fetchVouchers } = useVouchers();
    const { technicians, salesPersons, fetchTechnicians, fetchSales } = useUsers();
    const { departments, fetchDepartments } = useDepartments();
    const [payingOrder, setPayingOrder] = useState<Order | null>(null);
    const [payingGroup, setPayingGroup] = useState<{ product: OrderItem | null; services: OrderItem[] } | null>(null);
    const [pendingDrop, setPendingDrop] = useState<{ orderId: string; targetStatus: string } | null>(null);
    const [newlyCreatedOrder, setNewlyCreatedOrder] = useState<Order | null>(null);
    const [columnSearch, setColumnSearch] = useState<{ [key: string]: string }>({});
    const [globalSearch, setGlobalSearch] = useState('');
    const [selectedStaffId, setSelectedStaffId] = useState<string>('all');

    // Fetch data on mount and when navigating back to this page
    useEffect(() => {
        fetchOrders();
        fetchCustomers({ status: 'active' }); // Only fetch active customers
        fetchProducts({ status: 'active' });
        fetchServices({ status: 'active' });
        fetchPackages();
        fetchVouchers();
        fetchTechnicians();
        fetchSales();
        fetchDepartments();
    }, [location.pathname, fetchOrders, fetchCustomers, fetchProducts, fetchServices, fetchPackages, fetchVouchers, fetchTechnicians, fetchSales, fetchDepartments]);

    // Refetch orders when page becomes visible (e.g., after navigation)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                fetchOrders();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [fetchOrders]);

    const handleDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStatus = destination.droppableId;
        const [orderId, groupIndexStr] = draggableId.split('__');
        const order = orders.find(o => o.id === orderId);

        if (!order) return;

        const groups = getOrderProductGroups(order);
        const groupIndex = parseInt(groupIndexStr, 10);
        const group = groups[groupIndex];

        if (!group) return;

        // If dropping to after_sale, show payment dialog if order is not fully paid
        if (newStatus === 'after_sale') {
            if (order.payment_status !== 'paid') {
                setPendingDrop({ orderId, targetStatus: newStatus });
                setPayingOrder(order);
                setPayingGroup(group);
                return;
            }
        }

        try {
            // Identify all items in this group
            const itemIds: string[] = [];
            if (group.product) itemIds.push(group.product.id);
            group.services.forEach(s => itemIds.push(s.id));

            // Map target column status to valid item status for API
            let targetStatus = newStatus;
            if (newStatus === 'done') targetStatus = 'completed';
            if (newStatus === 'before_sale') targetStatus = 'step1';

            // Update status of all items in the group
            await Promise.all(itemIds.map(id => orderItemsApi.updateStatus(id, targetStatus)));
            
            toast.success('Đã cập nhật trạng thái sản phẩm');
            await fetchOrders();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi khi cập nhật trạng thái';
            toast.error(message);
        }
    };

    const getGroupStatus = (group: { product: OrderItem | null; services: OrderItem[] }, fallbackOrder: Order): string => {
        const itemStatus = group.product?.status || group.services?.[0]?.status;
        
        // If item has no specific status or is in early steps, use the order's status as default
        if (!itemStatus || ['step1', 'step2', 'step3', 'step4', 'pending'].includes(itemStatus)) {
            return fallbackOrder.status;
        }

        // Map item statuses to Kanban columns
        if (['assigned', 'in_progress', 'processing'].includes(itemStatus)) return 'in_progress';
        if (['completed', 'done'].includes(itemStatus)) return 'done';
        if (['delivered', 'after_sale'].includes(itemStatus)) return 'after_sale';
        
        return itemStatus;
    };

    const getCardsByStatus = (status: string) => {
        let result: { order: Order; group: { product: OrderItem | null; services: OrderItem[] }; groupIndex: number }[] = [];
        orders.forEach(order => {
            const groups = getOrderProductGroups(order);
            groups.forEach((group, index) => {
                const groupStatus = getGroupStatus(group, order);
                if (groupStatus === status) {
                    result.push({ order, group, groupIndex: index });
                }
            });
        });

        // Apply staff filter
        if (selectedStaffId && selectedStaffId !== 'all') {
            result = result.filter(v => {
                const salesMatch = v.order.sales_id === selectedStaffId;
                const techMatch = 
                    v.group.product?.technician_id === selectedStaffId ||
                    v.group.product?.technicians?.some(t => t.technician_id === selectedStaffId) ||
                    v.group.services?.some(s => s.technician_id === selectedStaffId || s.technicians?.some(t => t.technician_id === selectedStaffId));
                
                return salesMatch || techMatch;
            });
        }

        // Apply global search
        if (globalSearch) {
            const gTerm = normalizeSearchText(globalSearch);
            return result.filter(v => 
                normalizeSearchText(v.order.order_code || '').includes(gTerm) ||
                normalizeSearchText(v.order.customer?.name || '').includes(gTerm) ||
                (v.order.customer?.phone || '').includes(gTerm) ||
                normalizeSearchText(v.order.sales_user?.name || '').includes(gTerm)
            );
        }

        return result;
    };

    const getOrdersByStatus = (status: OrderStatus) => {
        return orders.filter(order => order.status === status);
    };

    /** Nhóm items theo product + services (giống OrderDetailPage workflowKanbanGroups) */
    const getOrderProductGroups = (order: Order): { product: OrderItem | null; services: OrderItem[] }[] => {
        const items = order?.items || [];
        // Check if this order has Customer Items (Sản phẩm khách gửi)
        const hasCustomerItems = items.some((item: any) => item.is_customer_item);

        const groups: { product: OrderItem | null; services: OrderItem[] }[] = [];
        let i = 0;
        while (i < items.length) {
            const item = items[i] as OrderItem & { is_customer_item?: boolean };
            if (item.is_customer_item && item.item_type === 'product') {
                const services: OrderItem[] = [];
                let j = i + 1;
                while (j < items.length) {
                    const next = items[j] as OrderItem & { is_customer_item?: boolean };
                    if (next.is_customer_item && next.item_type === 'product') break;
                    if (next.item_type === 'service' || next.item_type === 'package') services.push(items[j] as OrderItem);
                    j++;
                }
                groups.push({ product: item, services });
                i = j;
            } else if (item.item_type === 'service' || item.item_type === 'package') {
                groups.push({ product: null, services: [item] });
                i++;
            } else if (item.item_type === 'product' && item.product_id) {
                // If order has Customer Items, skip Sale Items (add-ons) to prevent duplicate cards
                if (hasCustomerItems && !item.is_customer_item) {
                    i++;
                    continue;
                }
                groups.push({ product: item, services: [] });
                i++;
            } else if (item.item_name) {
                // Skip Sale Items that are product-type in orders with Customer Items
                if (hasCustomerItems && item.item_type === 'product' && !item.is_customer_item) {
                    i++;
                    continue;
                }
                groups.push({ product: null, services: [item] });
                i++;
            } else {
                i++;
            }
        }
        if (groups.length === 0 && items.length > 0) {
            // If all items were filtered out (e.g. only add-ons?), show something?
            // Customer Item orders should have at least one Customer Item, so this shouldn't happen unless data is corrupt.
            // Fallback to showing everything if no groups found
            return [{ product: items[0] as OrderItem, services: items.slice(1).filter((it: OrderItem) => it.item_name) as OrderItem[] }];
        }
        if (groups.length === 0) return [{ product: null, services: [] }];
        return groups;
    };

    const handleCreateOrder = async (data: {
        customer_id: string;
        items: Array<{ type: string; item_id: string; name: string; quantity: number; unit_price: number }>;
        notes?: string;
        discount?: number;
    }) => {
        try {
            const newOrder = await createOrder(data);
            toast.success('Đã tạo đơn hàng mới!');
            await fetchOrders();

            // Show confirmation dialog for the new order
            if (newOrder) {
                setNewlyCreatedOrder(newOrder);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi khi tạo đơn hàng';
            toast.error(message);
            throw error;
        }
    };

    const handleUpdateOrder = async (orderId: string, data: {
        items: Array<{ type: string; item_id: string; name: string; quantity: number; unit_price: number }>;
        notes?: string;
        discount?: number;
    }) => {
        try {
            await updateOrder(orderId, data);
            toast.success('Đã cập nhật đơn hàng!');
            await fetchOrders();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi khi cập nhật đơn hàng';
            toast.error(message);
            throw error;
        }
    };

    const handlePaymentSuccess = async () => {
        try {
            toast.success('Thanh toán thành công!');

            // If there's a pending drop (waiting for payment), proceed with status update
            if (pendingDrop) {
                const { orderId, targetStatus } = pendingDrop;
                const order = orders.find(o => o.id === orderId);
                if (order && payingGroup) {
                    const itemIds: string[] = [];
                    if (payingGroup.product) itemIds.push(payingGroup.product.id);
                    payingGroup.services.forEach(s => itemIds.push(s.id));

                    // Update status of all items in the group
                    await Promise.all(itemIds.map(id => orderItemsApi.updateStatus(id, targetStatus)));
                }
            }

            await fetchOrders();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi khi cập nhật trạng thái đơn hàng';
            toast.error(message);
        } finally {
            setPendingDrop(null);
            setPayingOrder(null);
            setPayingGroup(null);
        }
    };

    const handlePaymentClose = () => {
        setPendingDrop(null);
        setPayingOrder(null);
        setPayingGroup(null);
    };

    if (loading && orders.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-100">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <Toaster position="top-right" richColors />
            <div className="space-y-6 animate-fade-in w-full px-2" style={{ contain: 'inline-size' }}>
                {/* Page Header + Stats Container - Contained width */}
                <div className="space-y-6">
                    {/* Page Header */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-2xl font-bold text-foreground">Quản lý đơn hàng</h1>
                            <p className="text-muted-foreground">Theo dõi và xử lý đơn hàng theo trạng thái</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                            <div className="flex-1 sm:min-w-[200px]">
                                <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                                    <SelectTrigger className="h-10 w-full bg-white">
                                        <SelectValue placeholder="Lọc theo nhân viên" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tất cả nhân viên</SelectItem>
                                        {salesPersons.length > 0 && (
                                            <>
                                                <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase bg-muted/50">Sales</div>
                                                {salesPersons.map(s => (
                                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                ))}
                                            </>
                                        )}
                                        {technicians.length > 0 && (
                                            <>
                                                <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase bg-muted/50">Kỹ thuật</div>
                                                {technicians.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                ))}
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="relative flex-1 sm:min-w-[250px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Số HĐ, tên NV, SĐT khách..."
                                    className="pl-10 h-10 w-full bg-white"
                                    value={globalSearch}
                                    onChange={(e) => setGlobalSearch(e.target.value)}
                                />
                            </div>
                            <Button onClick={() => navigate('/orders/new')} className="shrink-0 h-10 px-6">
                                <Plus className="h-4 w-4 mr-2" />
                                Tạo đơn
                            </Button>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                            {error}
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                        {columns.map((column) => {
                            const count = getCardsByStatus(column.id).length;
                            return (
                                <Card key={column.id} className={`${column.bgColor} border-0`}>
                                    <CardContent className="p-3 sm:p-4">
                                        <div className="flex items-center justify-between">
                                            <span className={`text-sm font-medium ${column.color}`}>{column.title}</span>
                                            <span className={`text-xl sm:text-2xl font-bold ${column.color}`}>{count}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                {/* Kanban Board - Grid on large screens so all 6 columns (including Đã hoàn thiện kỹ thuật, Đã huỷ) are visible */}
                <div className="pb-6">
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                            {columns.map((column) => (
                                <div key={column.id} className="min-w-0">
                                    <Card className={`${column.bgColor} border ${column.borderColor} h-full`}>
                                        <CardHeader className="p-3 pb-2">
                                            <CardTitle className={`text-sm font-semibold flex items-center justify-between ${column.color}`}>
                                                <span>{column.title}</span>
                                                <Badge variant="secondary" className="bg-white/80">
                                                    {(() => {
                                                        const searchText = normalizeSearchText(columnSearch[column.id] || '');
                                                        const statusCards = getCardsByStatus(column.id);
                                                        if (!searchText) return statusCards.length;
                                                        return statusCards.filter(c =>
                                                            normalizeSearchText(c.order.customer?.name || '').includes(searchText) ||
                                                            (c.order.customer?.phone || '').includes(searchText) ||
                                                            normalizeSearchText(c.order.order_code || '').includes(searchText) ||
                                                            normalizeSearchText(c.order.sales_user?.name || '').includes(searchText)
                                                        ).length;
                                                    })()}
                                                </Badge>
                                            </CardTitle>
                                            <div className="relative mt-1.5 px-0.5">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                                <Input
                                                    placeholder="Khách hàng, SĐT..."
                                                    value={columnSearch[column.id] || ''}
                                                    onChange={(e) => setColumnSearch({ ...columnSearch, [column.id]: e.target.value })}
                                                    className="h-7 pl-6.5 text-[11px] bg-white/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/20 placeholder:text-muted-foreground/60"
                                                />
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-2">
                                            <Droppable droppableId={column.id}>
                                                {(provided, snapshot) => {
                                                    const cardsByStatus = getCardsByStatus(column.id);
                                                    const searchText = normalizeSearchText(columnSearch[column.id] || '');
                                                    const filteredCards = searchText
                                                        ? cardsByStatus.filter(c =>
                                                            normalizeSearchText(c.order.customer?.name || '').includes(searchText) ||
                                                            (c.order.customer?.phone || '').includes(searchText) ||
                                                            normalizeSearchText(c.order.order_code || '').includes(searchText) ||
                                                            normalizeSearchText(c.order.sales_user?.name || '').includes(searchText)
                                                        )
                                                        : cardsByStatus;
                                                    return (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.droppableProps}
                                                            className={`kanban-column space-y-3 min-h-[100px] lg:min-h-[calc(100vh-300px)] p-1 rounded-lg transition-colors ${snapshot.isDraggingOver ? 'bg-white/50' : ''
                                                                }`}
                                                        >
                                                                {filteredCards.map(({ order, group, groupIndex }, index) => (
                                                                    <OrderCard
                                                                        key={`${order.id}__${groupIndex}`}
                                                                        draggableId={`${order.id}__${groupIndex}`}
                                                                        order={order}
                                                                        productGroup={group}
                                                                        columnId={column.id}
                                                                        index={index}
                                                                        onClick={() => navigate(`/orders/${order.id}`)}
                                                                    />
                                                                ))}
                                                            {provided.placeholder}

                                                            {filteredCards.length === 0 && (
                                                                <div className="flex items-center justify-center h-20 lg:h-32 text-muted-foreground text-sm">
                                                                    Không có đơn hàng
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                }}
                                            </Droppable>
                                        </CardContent>
                                    </Card>
                                </div>
                            ))}
                        </div>
                    </DragDropContext>
                </div>
            </div>

            {/* Payment Dialog */}
            <PaymentDialog
                order={payingOrder}
                open={!!payingOrder}
                productGroup={payingGroup}
                onClose={handlePaymentClose}
                onSuccess={handlePaymentSuccess}
            />

            {/* Order Confirmation Dialog (after creating new order) */}
            <OrderConfirmationDialog
                open={!!newlyCreatedOrder}
                onClose={() => setNewlyCreatedOrder(null)}
                order={newlyCreatedOrder}
                onConfirm={async () => {
                    await fetchOrders();
                    setNewlyCreatedOrder(null);
                }}
            />
        </>
    );
}
