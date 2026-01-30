import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { Search, Plus, Loader2, Phone, Users, TrendingUp, UserPlus } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLeads } from '@/hooks/useLeads';
import type { Lead } from '@/hooks/useLeads';
import { useEmployees } from '@/hooks/useEmployees';
import { useUsers } from '@/hooks/useUsers';
import { CreateOrderDialog } from '@/components/orders/CreateOrderDialog';
import { OrderConfirmationDialog } from '@/components/orders/OrderConfirmationDialog';
import { OrderDetailDialog } from '@/components/orders/OrderDetailDialog';
import { useCustomers } from '@/hooks/useCustomers';
import { useProducts } from '@/hooks/useProducts';
import { usePackages } from '@/hooks/usePackages';
import { useVouchers } from '@/hooks/useVouchers';
import { useOrders } from '@/hooks/useOrders';

import {
    CreateLeadDialog,
    KanbanColumn,
    kanbanColumns,
} from '@/components/leads';
import type { CreateLeadFormData } from '@/components/leads';

export function LeadsPage() {
    const navigate = useNavigate();
    const { leads, loading, error, fetchLeads, createLead, updateLead, convertLead } = useLeads();
    const { employees, fetchEmployees } = useEmployees();
    const { users: technicians, fetchTechnicians } = useUsers();

    // Hooks for CreateOrderDialog
    const { customers, fetchCustomers } = useCustomers();
    const { products, services, fetchProducts, fetchServices } = useProducts();
    const { packages, fetchPackages } = usePackages();
    const { vouchers, fetchVouchers } = useVouchers();
    const { createOrder, getOrder } = useOrders();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSource, setSelectedSource] = useState<string>('all');
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    // State for CreateOrderDialog
    const [showOrderDialog, setShowOrderDialog] = useState(false);
    const [leadForOrder, setLeadForOrder] = useState<Lead | null>(null);
    const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
    const [createdOrder, setCreatedOrder] = useState<any>(null);
    const [showOrderDetail, setShowOrderDetail] = useState(false);
    const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

    // Fetch data on mount
    useEffect(() => {
        fetchLeads();
        fetchEmployees({ role: 'sale' });
        // Fetch data for CreateOrderDialog
        fetchCustomers();
        fetchProducts();
        fetchServices();
        fetchPackages();
        fetchVouchers();
        fetchTechnicians(); // Fetch technicians for order dialog
    }, [fetchLeads, fetchEmployees, fetchCustomers, fetchProducts, fetchServices, fetchPackages, fetchVouchers, fetchTechnicians]);

    // Filter leads
    const filteredLeads = useMemo(() => {
        return leads.filter(lead => {
            const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lead.phone.includes(searchTerm);
            const matchesSource = selectedSource === 'all' || lead.source === selectedSource;
            const matchesEmployee = selectedEmployee === 'all' || lead.assigned_to === selectedEmployee;
            return matchesSearch && matchesSource && matchesEmployee;
        });
    }, [leads, searchTerm, selectedSource, selectedEmployee]);

    // Group leads by pipeline_stage (or status as fallback) for Kanban
    const leadsByStatus = useMemo(() => {
        const grouped: Record<string, Lead[]> = {};
        kanbanColumns.forEach(col => {
            grouped[col.id] = [];
        });
        filteredLeads.forEach(lead => {
            const stage = (lead as any).pipeline_stage || lead.status || 'xac_dinh_nhu_cau';
            if (grouped[stage]) {
                grouped[stage].push(lead);
            } else {
                // Fallback to first column if status doesn't match any column
                grouped['xac_dinh_nhu_cau'].push(lead);
            }
        });
        return grouped;
    }, [filteredLeads]);

    // Calculate stats
    const stats = useMemo(() => {
        const total = filteredLeads.length;
        const newLeads = leadsByStatus['xac_dinh_nhu_cau']?.length || 0;
        const qualified = (leadsByStatus['hen_qua_ship']?.length || 0) + (leadsByStatus['chot_don']?.length || 0);
        const nurturing = (leadsByStatus['hen_gui_anh']?.length || 0) + (leadsByStatus['dam_phan_gia']?.length || 0);
        return { total, newLeads, qualified, nurturing };
    }, [filteredLeads, leadsByStatus]);

    const handleDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) {
            return;
        }

        const newPipelineStage = destination.droppableId;

        // Optimistic update - immediately update UI
        const leadToUpdate = leads.find(l => l.id === draggableId);
        if (!leadToUpdate) return;

        try {
            await updateLead(draggableId, { pipeline_stage: newPipelineStage, status: newPipelineStage });
            const statusLabel = kanbanColumns.find(c => c.id === newPipelineStage)?.label || newPipelineStage;
            toast.success(`Đã chuyển "${leadToUpdate.name}" sang "${statusLabel}"`);

            // If pipeline_stage is 'chot_don' (Chốt đơn), open CreateOrderDialog
            if (newPipelineStage === 'chot_don') {
                // Convert lead to customer first
                await convertLead(draggableId);
                // Refresh customers list to include the new customer
                await fetchCustomers();
                setLeadForOrder(leadToUpdate);
                setShowOrderDialog(true);
            }

            await fetchLeads(); // Refresh data
        } catch {
            toast.error('Lỗi khi cập nhật trạng thái');
            await fetchLeads(); // Revert by refreshing
        }
    };

    const handleConvert = async (lead: Lead) => {
        try {
            await convertLead(lead.id);
            toast.success(`Đã chuyển đổi ${lead.name} thành khách hàng!`);
            await fetchLeads();
        } catch {
            toast.error('Lỗi khi chuyển đổi lead');
        }
    };

    const handleCreateLead = async (data: CreateLeadFormData) => {
        try {
            await createLead(data);
            toast.success('Đã tạo lead thành công!');
            await fetchLeads();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Lỗi khi tạo lead';
            toast.error(message);
            throw error;
        }
    };

    if (loading && leads.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <Toaster position="top-right" richColors />
            <div className="space-y-5 animate-fade-in" style={{ contain: 'inline-size' }}>
                {/* Page Header + Stats + Filters Container - Contained width */}
                <div className="space-y-5">
                    {/* Page Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Quản lý Leads</h1>
                            <p className="text-muted-foreground">Theo dõi và chăm sóc khách hàng tiềm năng</p>
                        </div>
                        <Button onClick={() => setShowCreateDialog(true)} className="shadow-md">
                            <Plus className="h-4 w-4 mr-2" />
                            Thêm Lead
                        </Button>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="overflow-hidden">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-lg bg-blue-100">
                                        <Users className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Tổng leads</p>
                                        <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="overflow-hidden">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-lg bg-amber-100">
                                        <UserPlus className="h-5 w-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Leads mới</p>
                                        <p className="text-2xl font-bold text-foreground">{stats.newLeads}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="overflow-hidden">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-lg bg-purple-100">
                                        <Phone className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Đang chăm</p>
                                        <p className="text-2xl font-bold text-foreground">{stats.nurturing}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="overflow-hidden">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-lg bg-green-100">
                                        <TrendingUp className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Qualified</p>
                                        <p className="text-2xl font-bold text-foreground">{stats.qualified}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                            {error}
                        </div>
                    )}

                    {/* Filters */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Search */}
                                <div className="relative lg:col-span-2">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Tìm theo tên, số điện thoại..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>

                                {/* Source Filter */}
                                <Select value={selectedSource} onValueChange={setSelectedSource}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Nguồn" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tất cả nguồn</SelectItem>
                                        <SelectItem value="facebook">Facebook</SelectItem>
                                        <SelectItem value="google">Google</SelectItem>
                                        <SelectItem value="zalo">Zalo</SelectItem>
                                        <SelectItem value="website">Website</SelectItem>
                                        <SelectItem value="referral">Giới thiệu</SelectItem>
                                        <SelectItem value="walk-in">Walk-in</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Employee Filter */}
                                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Nhân viên" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tất cả NV</SelectItem>
                                        {employees.map(user => (
                                            <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
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
                            className="flex gap-3 overflow-x-auto pb-4"
                            style={{ paddingLeft: 'var(--page-padding, 1rem)', paddingRight: 'var(--page-padding, 1rem)' }}
                        >
                            {kanbanColumns.map(column => (
                                <KanbanColumn
                                    key={column.id}
                                    column={column}
                                    leads={leadsByStatus[column.id] || []}
                                    onCardClick={(lead) => navigate(`/leads/${lead.id}`)}
                                />
                            ))}
                        </div>
                    </DragDropContext>
                </div>

                {/* Create Lead Dialog */}
                <CreateLeadDialog
                    open={showCreateDialog}
                    onClose={() => setShowCreateDialog(false)}
                    onSubmit={handleCreateLead}
                    employees={employees}
                />



                {/* Create Order Dialog - shown when lead is moved to 'chot_don' */}
                <CreateOrderDialog
                    open={showOrderDialog}
                    onClose={() => {
                        setShowOrderDialog(false);
                        setLeadForOrder(null);
                    }}
                    onSubmit={async (data) => {
                        const result = await createOrder(data);
                        setShowOrderDialog(false);
                        setLeadForOrder(null);
                        // Show confirmation dialog with created order
                        if (result) {
                            setCreatedOrder(result);
                            setShowOrderConfirmation(true);
                        } else {
                            toast.success('Đã tạo đơn hàng thành công!');
                        }
                    }}
                    customers={customers.map(c => ({ id: c.id, name: c.name, phone: c.phone, status: c.status }))}
                    products={products.map(p => ({ id: p.id, name: p.name, price: p.price }))}
                    services={services.map(s => ({ id: s.id, name: s.name, price: s.price, department: s.department }))}
                    packages={packages}
                    vouchers={vouchers}
                    technicians={technicians}
                    initialCustomer={leadForOrder ? { name: leadForOrder.name, phone: leadForOrder.phone } : undefined}
                />

                {/* Order Confirmation Dialog - shown after order is created */}
                <OrderConfirmationDialog
                    open={showOrderConfirmation}
                    onClose={() => {
                        setShowOrderConfirmation(false);
                        setCreatedOrder(null);
                    }}
                    order={createdOrder}
                    onConfirm={async () => {
                        // After confirming, fetch full order details and show detail dialog
                        if (createdOrder?.id) {
                            try {
                                const fullOrder = await getOrder(createdOrder.id);
                                setConfirmedOrder(fullOrder);
                                setShowOrderDetail(true);
                            } catch {
                                // Fallback to basic order data
                                setConfirmedOrder(createdOrder);
                                setShowOrderDetail(true);
                            }
                        }
                        setShowOrderConfirmation(false);
                        setCreatedOrder(null);
                        fetchLeads(); // Refresh leads data
                    }}
                />

                {/* Order Detail Dialog - shown after confirming order */}
                <OrderDetailDialog
                    open={showOrderDetail}
                    onClose={() => {
                        setShowOrderDetail(false);
                        setConfirmedOrder(null);
                    }}
                    order={confirmedOrder}
                />
            </div>
        </>
    );
}
