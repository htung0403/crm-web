import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd';
import { Plus, Loader2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrders } from '@/hooks/useOrders';
import type { Order } from '@/hooks/useOrders';
import { useCustomers } from '@/hooks/useCustomers';
import { useProducts } from '@/hooks/useProducts';
import { usePackages } from '@/hooks/usePackages';
import { useVouchers } from '@/hooks/useVouchers';
import { useUsers } from '@/hooks/useUsers';
import { useDepartments } from '@/hooks/useDepartments';
import type { OrderStatus } from '@/types';

import {
    OrderCard,
    EditOrderDialog,
    OrderConfirmationDialog,
    PaymentDialog,
    columns
} from '@/components/orders';

export function OrdersPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { orders, loading, error, fetchOrders, updateOrderStatus, updateOrder, createOrder } = useOrders();
    const { customers, fetchCustomers } = useCustomers();
    const { products, services, fetchProducts, fetchServices } = useProducts();
    const { packages, fetchPackages } = usePackages();
    const { vouchers, fetchVouchers } = useVouchers();
    const { users: technicians, fetchTechnicians } = useUsers();
    const { departments, fetchDepartments } = useDepartments();
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [payingOrder, setPayingOrder] = useState<Order | null>(null);
    const [pendingDrop, setPendingDrop] = useState<{ orderId: string; targetStatus: string } | null>(null);
    const [newlyCreatedOrder, setNewlyCreatedOrder] = useState<Order | null>(null);

    // Fetch data on mount and when navigating back to this page
    useEffect(() => {
        fetchOrders();
        fetchCustomers({ status: 'active' }); // Only fetch active customers
        fetchProducts({ status: 'active' });
        fetchServices({ status: 'active' });
        fetchPackages();
        fetchVouchers();
        fetchTechnicians();
        fetchDepartments();
    }, [location.pathname, fetchOrders, fetchCustomers, fetchProducts, fetchServices, fetchPackages, fetchVouchers, fetchTechnicians, fetchDepartments]);

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
        const order = orders.find(o => o.id === draggableId);

        // If dropping to completed, show payment dialog
        if (newStatus === 'completed' && order) {
            setPendingDrop({ orderId: draggableId, targetStatus: newStatus });
            setPayingOrder(order);
            return;
        }

        // Otherwise, update status normally
        try {
            await updateOrderStatus(draggableId, newStatus);
            toast.success('Đã cập nhật trạng thái đơn hàng');
            await fetchOrders();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi khi cập nhật trạng thái';
            toast.error(message);
        }
    };

    const getOrdersByStatus = (status: OrderStatus) => {
        return orders.filter(order => order.status === status);
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
            setEditingOrder(null);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi khi cập nhật đơn hàng';
            toast.error(message);
            throw error;
        }
    };

    const handlePaymentSuccess = async () => {
        try {
            // Update order status to completed after successful payment
            if (pendingDrop) {
                await updateOrderStatus(pendingDrop.orderId, 'completed');
            } else if (payingOrder) {
                await updateOrderStatus(payingOrder.id, 'completed');
            }
            toast.success('Thanh toán thành công! Đơn hàng đã hoàn thành.');
            await fetchOrders();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi khi cập nhật trạng thái đơn hàng';
            toast.error(message);
        } finally {
            setPendingDrop(null);
            setPayingOrder(null);
        }
    };

    const handlePaymentClose = () => {
        setPendingDrop(null);
        setPayingOrder(null);
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
            <div className="space-y-6 animate-fade-in max-w-screen-2xl mx-auto" style={{ contain: 'inline-size' }}>
                {/* Page Header + Stats Container - Contained width */}
                <div className="space-y-6">
                    {/* Page Header */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            <h1 className="text-2xl font-bold text-foreground">Quản lý đơn hàng</h1>
                            <p className="text-muted-foreground">Theo dõi và xử lý đơn hàng theo trạng thái</p>
                        </div>
                        <Button onClick={() => navigate('/orders/new')} className="shrink-0">
                            <Plus className="h-4 w-4 mr-2" />
                            Tạo đơn hàng
                        </Button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                            {error}
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        {columns.map((column) => {
                            const count = getOrdersByStatus(column.id).length;
                            return (
                                <Card key={column.id} className={`${column.bgColor} border-0`}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <span className={`text-sm font-medium ${column.color}`}>{column.title}</span>
                                            <span className={`text-2xl font-bold ${column.color}`}>{count}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                {/* Kanban Board - Full viewport width with scroll */}
                <div
                    className="relative"
                    style={{
                        marginLeft: 'calc(-1 * var(--page-padding, 1rem))',
                        marginRight: 'calc(-1 * var(--page-padding, 1rem))',
                        width: 'calc(100% + 2 * var(--page-padding, 1rem))'
                    }}
                >
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <div
                            className="flex gap-4 overflow-x-auto pb-4"
                            style={{ paddingLeft: 'var(--page-padding, 1rem)', paddingRight: 'var(--page-padding, 1rem)' }}
                        >
                            {columns.map((column) => (
                                <div key={column.id} className="shrink-0 w-72 lg:flex-1 lg:min-w-0">
                                    <Card className={`${column.bgColor} border ${column.borderColor}`}>
                                        <CardHeader className="p-3 pb-2">
                                            <CardTitle className={`text-sm font-semibold flex items-center justify-between ${column.color}`}>
                                                <span>{column.title}</span>
                                                <Badge variant="secondary" className="bg-white/80">
                                                    {getOrdersByStatus(column.id).length}
                                                </Badge>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-2">
                                            <Droppable droppableId={column.id}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        className={`kanban-column space-y-3 min-h-100 p-1 rounded-lg transition-colors ${snapshot.isDraggingOver ? 'bg-white/50' : ''
                                                            }`}
                                                    >
                                                        {getOrdersByStatus(column.id).map((order, index) => (
                                                            <OrderCard
                                                                key={order.id}
                                                                order={order}
                                                                index={index}
                                                                onClick={() => navigate(`/orders/${order.id}`)}
                                                            />
                                                        ))}
                                                        {provided.placeholder}

                                                        {getOrdersByStatus(column.id).length === 0 && (
                                                            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                                                                Không có đơn hàng
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </Droppable>
                                        </CardContent>
                                    </Card>
                                </div>
                            ))}
                        </div>
                    </DragDropContext>
                </div>
            </div>

            {/* Edit Order Dialog */}
            <EditOrderDialog
                order={editingOrder}
                open={!!editingOrder}
                onClose={() => setEditingOrder(null)}
                onSubmit={handleUpdateOrder}
                products={products}
                services={services}
                packages={packages}
                vouchers={vouchers}
            />

            {/* Payment Dialog */}
            <PaymentDialog
                order={payingOrder}
                open={!!payingOrder}
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
