import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Eye, Phone, Mail, Shield, Calendar, UserPlus, Loader2, ShoppingCart, FileText, ExternalLink, LayoutGrid } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

import { EmployeeFormDialog } from '@/components/employees/EmployeeFormDialog';

import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { useUsers } from '@/hooks/useUsers';
import { useDepartments } from '@/hooks/useDepartments';
import { useJobTitles } from '@/hooks/useJobTitles';
import api from '@/lib/api';
import type { User, UserRole } from '@/types';
import { OrderDetailDialog } from '@/components/orders/OrderDetailDialog';
import type { Order } from '@/hooks/useOrders';

// Extended employee interface for HR management
interface Employee extends User {
    department?: string;
    joinDate?: string;
    status: 'active' | 'inactive' | 'onleave';
    salary?: number;
    commission?: number;
    bankAccount?: string;
    bankName?: string;
    telegramChatId?: string;
}

const roleLabels: Record<UserRole, string> = {
    admin: 'Admin',
    manager: 'Quản lý',
    accountant: 'Kế toán',
    sale: 'Nhân viên bán hàng',
    technician: 'Nhân viên làm phục vụ',
    cashier: 'Thu ngân',
};

const statusLabels = {
    active: { label: 'Đang làm', variant: 'success' as const },
    inactive: { label: 'Nghỉ việc', variant: 'danger' as const },
    onleave: { label: 'Nghỉ phép', variant: 'warning' as const }
};

const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'accountant', label: 'Kế toán' },
    { value: 'sale', label: 'Nhân viên bán hàng' },
    { value: 'technician', label: 'Nhân viên làm phục vụ' },
    { value: 'manager', label: 'Quản lý' },
    { value: 'cashier', label: 'Thu ngân' },
];


// Order interface for employee orders
interface EmployeeOrder {
    id: string;
    order_code: string;
    status: string;
    total_amount: number;
    created_at: string;
    customer?: {
        name: string;
        phone?: string;
    };
}

const orderStatusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline' }> = {
    pending: { label: 'Chờ xử lý', variant: 'secondary' },
    confirmed: { label: 'Đã xác nhận', variant: 'default' },
    processing: { label: 'Đang thực hiện', variant: 'warning' },
    completed: { label: 'Hoàn thành', variant: 'success' },
    cancelled: { label: 'Đã hủy', variant: 'destructive' },
};

// Employee Detail Dialog
function EmployeeDetailDialog({
    open,
    onClose,
    employee,
    departments
}: {
    open: boolean;
    onClose: () => void;
    employee: Employee | null;
    departments: { id: string; name: string }[];
}) {
    const [activeTab, setActiveTab] = useState('info');
    const [orders, setOrders] = useState<EmployeeOrder[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showOrderDetail, setShowOrderDetail] = useState(false);

    // Fetch orders when employee changes or tab switches to orders
    useEffect(() => {
        if (open && employee && activeTab === 'orders') {
            fetchEmployeeOrders();
        }
    }, [open, employee, activeTab]);

    // Reset tab when dialog closes
    useEffect(() => {
        if (!open) {
            setActiveTab('info');
            setOrders([]);
        }
    }, [open]);

    const fetchEmployeeOrders = async () => {
        if (!employee) return;

        setLoadingOrders(true);
        try {
            // Use different query param based on employee role
            const queryParam = employee.role === 'technician'
                ? `technician_id=${employee.id}`
                : `sale_id=${employee.id}`;

            const response = await api.get(`/orders?${queryParam}`);
            // Handle various response formats
            let ordersData = [];
            if (Array.isArray(response.data)) {
                ordersData = response.data;
            } else if (response.data?.data?.orders && Array.isArray(response.data.data.orders)) {
                ordersData = response.data.data.orders;
            } else if (response.data?.orders && Array.isArray(response.data.orders)) {
                ordersData = response.data.orders;
            } else if (response.data?.data && Array.isArray(response.data.data)) {
                ordersData = response.data.data;
            }
            setOrders(ordersData);
        } catch (error) {
            console.error('Error fetching employee orders:', error);
            setOrders([]);
        } finally {
            setLoadingOrders(false);
        }
    };

    if (!employee) return null;

    const getDepartmentName = (deptId?: string) => {
        if (!deptId) return 'Chưa phân bổ';
        const dept = departments.find(d => d.id === deptId);
        return dept?.name || deptId;
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Chi tiết nhân viên</DialogTitle>
                    </DialogHeader>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="info" className="gap-2">
                                <FileText className="h-4 w-4" />
                                Thông tin
                            </TabsTrigger>
                            <TabsTrigger value="orders" className="gap-2">
                                <ShoppingCart className="h-4 w-4" />
                                Đơn hàng ({orders.length})
                            </TabsTrigger>
                        </TabsList>

                        {/* Info Tab */}
                        <TabsContent value="info" className="flex-1 overflow-y-auto mt-4">
                            <div className="space-y-6">
                                {/* Header */}
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage src={employee.avatar} />
                                        <AvatarFallback className="text-xl">{employee.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="text-xl font-bold">{employee.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant={employee.role === 'manager' ? 'purple' : employee.role === 'sale' ? 'info' : 'secondary'}>
                                                {roleLabels[employee.role]}
                                            </Badge>
                                            <Badge variant={statusLabels[employee.status]?.variant || 'secondary'}>
                                                {statusLabels[employee.status]?.label || employee.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                {/* Info Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">Email</p>
                                        <p className="text-sm font-medium flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                            {employee.email}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">Điện thoại</p>
                                        <p className="text-sm font-medium flex items-center gap-2">
                                            <Phone className="h-4 w-4 text-muted-foreground" />
                                            {employee.phone}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">Phòng ban</p>
                                        <p className="text-sm font-medium">{getDepartmentName(employee.department)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">Ngày vào làm</p>
                                        <p className="text-sm font-medium flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            {employee.joinDate || 'Chưa cập nhật'}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">Telegram Chat ID</p>
                                        <p className="text-sm font-medium">{employee.telegramChatId || 'Chưa cập nhật'}</p>
                                    </div>
                                </div>

                                {/* Salary Info */}
                                <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                                    <h4 className="font-semibold flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-primary" />
                                        Thông tin lương
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Lương cơ bản</p>
                                            <p className="text-lg font-bold text-primary">{formatCurrency(employee.salary || 0)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">% Hoa hồng</p>
                                            <p className="text-lg font-bold">{employee.commission || 0}%</p>
                                        </div>
                                    </div>
                                    {(employee.bankName || employee.bankAccount) && (
                                        <div className="pt-2 border-t">
                                            <p className="text-xs text-muted-foreground">Tài khoản ngân hàng</p>
                                            <p className="text-sm font-medium">{employee.bankName || 'N/A'} - {employee.bankAccount || 'N/A'}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        {/* Orders Tab */}
                        <TabsContent value="orders" className="flex-1 overflow-y-auto mt-4">
                            {loadingOrders ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : orders.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>Nhân viên chưa có đơn hàng nào</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {orders.map((order) => {
                                        const statusInfo = orderStatusLabels[order.status] || { label: order.status, variant: 'secondary' as const };
                                        return (
                                            <div
                                                key={order.id}
                                                className="p-4 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                                                onClick={() => {
                                                    setSelectedOrder(order as unknown as Order);
                                                    setShowOrderDetail(true);
                                                }}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold font-mono">{order.order_code}</span>
                                                            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                                                        </div>
                                                        {order.customer && (
                                                            <p className="text-sm text-muted-foreground mt-1">
                                                                KH: {order.customer.name}
                                                                {order.customer.phone && ` - ${order.customer.phone}`}
                                                            </p>
                                                        )}
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {new Date(order.created_at).toLocaleDateString('vi-VN')}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-primary">{formatCurrency(order.total_amount)}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">Click để xem chi tiết</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>

                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={onClose}>Đóng</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Order Detail Dialog */}
            <OrderDetailDialog
                order={selectedOrder}
                open={showOrderDetail}
                onClose={() => {
                    setShowOrderDetail(false);
                    setSelectedOrder(null);
                }}
            />
        </>
    );
}

export function EmployeesPage() {
    const navigate = useNavigate();
    const { users, loading, fetchUsers, createUser, updateUser, deleteUser } = useUsers();
    const { departments, fetchDepartments, createDepartment } = useDepartments();
    const { jobTitles, fetchJobTitles, createJobTitle } = useJobTitles();
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('active');
    const [showForm, setShowForm] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [showDeptDialog, setShowDeptDialog] = useState(false);
    const [showTitleDialog, setShowTitleDialog] = useState(false);
    const [deptForm, setDeptForm] = useState({ name: '', description: '', status: 'active' as 'active' | 'inactive' });
    const [titleForm, setTitleForm] = useState({ name: '', description: '', status: 'active' as 'active' | 'inactive' });
    const [savingDept, setSavingDept] = useState(false);
    const [savingTitle, setSavingTitle] = useState(false);
    const [columnVisibility, setColumnVisibility] = useState({
        avatar: true,
        code: true,
        timekeepingCode: true,
        name: true,
        phone: true,
        idCard: true,
        debt: true,
        notes: true,
        mobile: false,
        birthday: false,
        gender: false,
        email: false,
        facebook: false,
        address: false,
        department: false,
        role: false,
        joinDate: false,
        account: false,
    });


    // Fetch data on mount
    useEffect(() => {
        fetchUsers();
        fetchDepartments();
        fetchJobTitles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Department dialog handlers
    const handleSaveDepartment = async () => {
        if (!deptForm.name.trim()) {
            toast.error('Vui lòng nhập tên phòng ban');
            return;
        }
        setSavingDept(true);
        try {
            await createDepartment({ name: deptForm.name, description: deptForm.description, status: deptForm.status });
            toast.success('Đã tạo phòng ban mới!');
            setShowDeptDialog(false);
            setDeptForm({ name: '', description: '', status: 'active' });
            fetchDepartments();
        } catch (error) {
            toast.error('Lỗi khi tạo phòng ban');
        } finally {
            setSavingDept(false);
        }
    };

    // Job title dialog handlers
    const handleSaveJobTitle = async () => {
        if (!titleForm.name.trim()) {
            toast.error('Vui lòng nhập tên chức danh');
            return;
        }
        setSavingTitle(true);
        try {
            await createJobTitle({ name: titleForm.name, description: titleForm.description, status: titleForm.status });
            toast.success('Đã tạo chức danh mới!');
            setShowTitleDialog(false);
            setTitleForm({ name: '', description: '', status: 'active' });
            fetchJobTitles();
        } catch (error) {
            toast.error('Lỗi khi tạo chức danh');
        } finally {
            setSavingTitle(false);
        }
    };

    // Map users to employees
    const employees: Employee[] = users.map(user => ({
        ...user,
        status: (user.status as 'active' | 'inactive' | 'onleave') || 'active',
        department: user.department,
        joinDate: user.created_at?.split('T')[0],
        salary: user.salary || 0,
        commission: user.commission || 0,
        bankAccount: user.bankAccount,
        bankName: user.bankName,
        telegramChatId: (user as any).telegramChatId,
    }));

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (emp.phone || '').includes(searchTerm);
        const matchesRole = roleFilter === 'all' || emp.role === roleFilter;
        const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
        return matchesSearch && matchesRole && matchesStatus;
    });

    // Stats
    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.status === 'active').length;
    const onLeaveEmployees = employees.filter(e => e.status === 'onleave').length;
    const totalSalary = employees.filter(e => e.status === 'active').reduce((sum, e) => sum + (e.salary || 0), 0);

    const handleCreateEmployee = async (data: Partial<Employee>) => {
        try {
            await createUser(data as any);
            toast.success('Đã thêm nhân viên mới!');
        } catch (error) {
            toast.error('Lỗi khi thêm nhân viên');
            throw error;
        }
    };

    const handleUpdateEmployee = async (data: Partial<Employee>) => {
        if (!selectedEmployee) return;
        try {
            await updateUser(selectedEmployee.id, data as any);
            toast.success('Đã cập nhật nhân viên!');
        } catch (error) {
            toast.error('Lỗi khi cập nhật');
            throw error;
        }
    };

    const handleDeleteEmployee = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xoá nhân viên này?')) return;
        try {
            await deleteUser(id);
            toast.success('Đã xoá nhân viên!');
        } catch (error) {
            toast.error('Lỗi khi xoá');
        }
    };

    const getDepartmentName = (deptId?: string) => {
        if (!deptId) return 'Chưa phân bổ';
        const dept = departments.find(d => d.id === deptId);
        return dept?.name || deptId;
    };

    if (loading && employees.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-6rem)] bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* Sidebar / Filters (Left Panel) */}
            <div className="w-[280px] border-r border-gray-200 bg-[#fbfcfd] flex flex-col p-5 flex-shrink-0">
                <h1 className="text-[17px] font-bold mb-7 text-gray-900 tracking-tight">Danh sách nhân viên</h1>

                <div className="space-y-8">
                    <div className="space-y-4">
                        <h3 className="text-[13px] font-bold text-gray-700">Trạng thái nhân viên</h3>
                        <div className="space-y-3.5 mt-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                    type="radio" 
                                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer" 
                                    name="status" 
                                    value="active" 
                                    checked={statusFilter === 'active'} 
                                    onChange={() => setStatusFilter('active')} 
                                />
                                <span className={statusFilter === 'active' ? "text-sm text-blue-600 font-medium" : "text-sm text-gray-700"}>Đang làm việc</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                    type="radio" 
                                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer" 
                                    name="status" 
                                    value="inactive" 
                                    checked={statusFilter === 'inactive'}
                                    onChange={() => setStatusFilter('inactive')} 
                                />
                                <span className={statusFilter === 'inactive' ? "text-sm text-blue-600 font-medium" : "text-sm text-gray-700"}>Đã nghỉ</span>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[13px] font-bold text-gray-700">Phòng ban</h3>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-gray-200" onClick={() => { setDeptForm({ name: '', description: '', status: 'active' }); setShowDeptDialog(true); }}>
                                <Plus className="h-3.5 w-3.5 text-gray-600" />
                            </Button>
                        </div>
                        <Select>
                            <SelectTrigger className="w-full h-[38px] bg-white border-gray-200 text-[13px] shadow-sm rounded-lg text-gray-500">
                                <SelectValue placeholder="Chọn phòng ban" />
                            </SelectTrigger>
                            <SelectContent>
                                {departments.map(d => (
                                    <SelectItem key={d.id} value={d.id} className="text-[13px]">{d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[13px] font-bold text-gray-700">Chức danh</h3>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-gray-200" onClick={() => { setTitleForm({ name: '', description: '', status: 'active' }); setShowTitleDialog(true); }}>
                                <Plus className="h-3.5 w-3.5 text-gray-600" />
                            </Button>
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-full h-[38px] bg-white border-gray-200 text-[13px] shadow-sm rounded-lg text-gray-500">
                                <SelectValue placeholder="Chọn chức danh" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-[13px]">Chọn chức danh</SelectItem>
                                {jobTitles.map(jt => (
                                    <SelectItem key={jt.id} value={jt.id} className="text-[13px]">{jt.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Main Content (Right Panel) */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                {/* Search Bar & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border-b border-gray-100 gap-3 bg-[#fbfcfd]">
                    <div className="flex-1 relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-[45%] h-[15px] w-[15px] text-gray-400" />
                        <Input 
                            className="w-full pl-[34px] h-[36px] border-gray-200 text-[13px] placeholder:text-gray-400 bg-white shadow-sm rounded-lg focus-visible:ring-1 focus-visible:ring-blue-500" 
                            placeholder="Tìm theo mã, tên nhân viên" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            className="h-[36px] px-3.5 text-blue-600 border border-blue-200 bg-white hover:bg-blue-50 text-[13px] font-semibold rounded-lg shadow-sm"
                            onClick={() => { setSelectedEmployee(null); setShowForm(true); }}
                        >
                            <Plus className="h-4 w-4 mr-1.5" />
                            Nhân viên
                        </Button>
                        <Button variant="outline" className="h-[36px] px-3.5 border-gray-200 bg-white text-gray-700 text-[13px] font-semibold rounded-lg shadow-sm hover:bg-gray-50 flex items-center">
                            <FileText className="h-[15px] w-[15px] mr-2 text-gray-500" />
                            Duyệt yêu cầu
                        </Button>
                        <Button variant="outline" size="icon" className="h-[36px] w-[36px] border-gray-200 bg-white text-gray-600 rounded-lg shadow-sm hover:bg-gray-50">
                            <span className="leading-none pb-2 text-[18px] font-bold">...</span>
                        </Button>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="icon" className="h-[36px] w-[36px] border-gray-200 bg-white text-gray-600 rounded-lg shadow-sm hover:bg-gray-50">
                                    <LayoutGrid className="h-[15px] w-[15px]" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[500px] p-4" align="end">
                                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                    {[
                                        { id: 'avatar', label: 'Ảnh' },
                                        { id: 'code', label: 'Mã nhân viên' },
                                        { id: 'timekeepingCode', label: 'Mã chấm công' },
                                        { id: 'name', label: 'Tên nhân viên' },
                                        { id: 'phone', label: 'Số điện thoại' },
                                        { id: 'idCard', label: 'Số CMND/CCCD' },
                                        { id: 'debt', label: 'Nợ và tạm ứng' },
                                        { id: 'notes', label: 'Ghi chú' },
                                        { id: 'mobile', label: 'Thiết bị di động' },
                                    ].map((col) => (
                                        <div key={col.id} className="flex items-center gap-3">
                                            <Checkbox 
                                                id={`col-${col.id}`} 
                                                checked={columnVisibility[col.id as keyof typeof columnVisibility]} 
                                                onCheckedChange={(checked) => 
                                                    setColumnVisibility(prev => ({ ...prev, [col.id]: !!checked }))
                                                }
                                            />
                                            <Label htmlFor={`col-${col.id}`} className="text-[13px] font-medium text-gray-700 cursor-pointer">
                                                {col.label}
                                            </Label>
                                        </div>
                                    ))}
                                    {[
                                        { id: 'birthday', label: 'Ngày sinh' },
                                        { id: 'gender', label: 'Giới tính' },
                                        { id: 'email', label: 'Email' },
                                        { id: 'facebook', label: 'Facebook' },
                                        { id: 'address', label: 'Địa chỉ' },
                                        { id: 'department', label: 'Phòng ban' },
                                        { id: 'role', label: 'Chức danh' },
                                        { id: 'joinDate', label: 'Ngày bắt đầu làm việc' },
                                        { id: 'account', label: 'Tài khoản đăng nhập' },
                                    ].map((col) => (
                                        <div key={col.id} className="flex items-center gap-3">
                                            <Checkbox 
                                                id={`col-${col.id}`} 
                                                checked={columnVisibility[col.id as keyof typeof columnVisibility]} 
                                                onCheckedChange={(checked) => 
                                                    setColumnVisibility(prev => ({ ...prev, [col.id]: !!checked }))
                                                }
                                            />
                                            <Label htmlFor={`col-${col.id}`} className="text-[13px] font-medium text-gray-700 cursor-pointer">
                                                {col.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>

                    </div>
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead className="bg-[#f2f6ff] sticky top-0 z-10 box-border">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-gray-700 w-10 border-b border-gray-100">
                                    <input type="checkbox" className="w-[14px] h-[14px] rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                                </th>
                                {columnVisibility.avatar && <th className="px-2 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 uppercase tracking-widest text-center">Ảnh</th>}
                                {columnVisibility.code && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">MÃ NHÂN VIÊN</th>}
                                {columnVisibility.timekeepingCode && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">MÃ CHẤM CÔNG</th>}
                                {columnVisibility.name && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">TÊN NHÂN VIÊN</th>}
                                {columnVisibility.phone && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">SỐ ĐIỆN THOẠI</th>}
                                {columnVisibility.idCard && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">SỐ CMND/CCCD</th>}
                                {columnVisibility.debt && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide text-right">NỢ VÀ TẠM ỨNG</th>}
                                {columnVisibility.notes && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">GHI CHÚ</th>}
                                {columnVisibility.mobile && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">THIẾT BỊ DI ĐỘNG</th>}
                                {columnVisibility.birthday && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">NGÀY SINH</th>}
                                {columnVisibility.gender && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">GIỚI TÍNH</th>}
                                {columnVisibility.email && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">EMAIL</th>}
                                {columnVisibility.facebook && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">FACEBOOK</th>}
                                {columnVisibility.address && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">ĐỊA CHỈ</th>}
                                {columnVisibility.department && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">PHÒNG BAN</th>}
                                {columnVisibility.role && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">CHỨC DANH</th>}
                                {columnVisibility.joinDate && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">NGÀY VÀO LÀM</th>}
                                {columnVisibility.account && <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">TÀI KHOẢN</th>}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                            {filteredEmployees.map((emp, index) => (
                                <tr key={emp.id} className="hover:bg-blue-50/30 cursor-pointer transition-colors" onClick={(e) => {
                                    if ((e.target as HTMLElement).tagName !== 'INPUT') {
                                        setSelectedEmployee(emp); 
                                        setShowDetail(true);
                                    }
                                }}>
                                    <td className="px-4 py-[13px]">
                                        <input type="checkbox" className="w-[14px] h-[14px] rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" onClick={(e) => e.stopPropagation()} />
                                    </td>
                                    {columnVisibility.avatar && (
                                        <td className="px-2 py-[13px] text-center">
                                            <Avatar className="h-[26px] w-[26px] rounded bg-gray-200 inline-block overflow-hidden">
                                                {emp.avatar ? (
                                                    <img src={emp.avatar} alt="avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 shadow-inner">
                                                        {emp.name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </Avatar>
                                        </td>
                                    )}
                                    {columnVisibility.code && (
                                        <td className="px-4 py-[13px] text-gray-800 font-medium text-[13px]">
                                            {(emp as any).employee_code || `NV${String(index + 1).padStart(3, '0')}`}
                                        </td>
                                    )}
                                    {columnVisibility.timekeepingCode && (
                                        <td className="px-4 py-[13px] text-gray-800 font-medium text-[13px]">
                                            {Math.floor(Math.random() * 30 + 1)}
                                        </td>
                                    )}
                                    {columnVisibility.name && (
                                        <td className="px-4 py-[13px] font-medium text-gray-800 text-[13px] uppercase">
                                            {emp.name}
                                        </td>
                                    )}
                                    {columnVisibility.phone && (
                                        <td className="px-4 py-[13px] text-gray-600 text-[13px] font-medium">
                                            {emp.phone || ''}
                                        </td>
                                    )}
                                    {columnVisibility.idCard && (
                                        <td className="px-4 py-[13px] text-gray-600 text-[13px]">
                                            {/* Mock CCCD */}
                                        </td>
                                    )}
                                    {columnVisibility.debt && (
                                        <td className="px-4 py-[13px] text-gray-800 text-[13px] font-medium text-right">
                                            0
                                        </td>
                                    )}
                                    {columnVisibility.notes && (
                                        <td className="px-4 py-[13px] text-gray-600 text-[13px]">
                                        </td>
                                    )}
                                    {columnVisibility.mobile && <td className="px-4 py-[13px] text-gray-600 text-[13px]"></td>}
                                    {columnVisibility.birthday && <td className="px-4 py-[13px] text-gray-600 text-[13px]"></td>}
                                    {columnVisibility.gender && <td className="px-4 py-[13px] text-gray-600 text-[13px]"></td>}
                                    {columnVisibility.email && <td className="px-4 py-[13px] text-gray-600 text-[13px]">{emp.email}</td>}
                                    {columnVisibility.facebook && <td className="px-4 py-[13px] text-gray-600 text-[13px]"></td>}
                                    {columnVisibility.address && <td className="px-4 py-[13px] text-gray-600 text-[13px]"></td>}
                                    {columnVisibility.department && (
                                        <td className="px-4 py-[13px] text-gray-600 text-[13px]">
                                            {getDepartmentName(emp.department)}
                                        </td>
                                    )}
                                    {columnVisibility.role && (
                                        <td className="px-4 py-[13px] text-gray-600 text-[13px]">
                                            {roleLabels[emp.role]}
                                        </td>
                                    )}
                                    {columnVisibility.joinDate && (
                                        <td className="px-4 py-[13px] text-gray-600 text-[13px]">
                                            {emp.joinDate}
                                        </td>
                                    )}
                                    {columnVisibility.account && (
                                        <td className="px-4 py-[13px] text-gray-600 text-[13px]">
                                            {emp.email}
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {filteredEmployees.length === 0 && (
                                <tr>
                                    <td colSpan={Object.values(columnVisibility).filter(v => v).length + 1} className="px-4 py-8 text-center text-[13px] text-gray-500">
                                        Không tìm thấy nhân viên nào
                                    </td>
                                </tr>
                            )}

                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Dialogs */}
            <EmployeeFormDialog
                open={showForm}
                onClose={() => { setShowForm(false); setSelectedEmployee(null); }}
                employee={selectedEmployee}
                departments={departments}
                onSubmit={selectedEmployee ? handleUpdateEmployee : handleCreateEmployee}
            />
            <EmployeeDetailDialog
                open={showDetail}
                onClose={() => { setShowDetail(false); setSelectedEmployee(null); }}
                employee={selectedEmployee}
                departments={departments}
            />

            {/* Dialog Thêm mới phòng ban */}
            <Dialog open={showDeptDialog} onOpenChange={setShowDeptDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-[17px] font-bold">Thêm mới phòng ban</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 py-2">
                        <div className="flex items-center gap-4">
                            <Label className="w-[100px] text-[13px] font-medium text-gray-700 shrink-0">Tên phòng ban</Label>
                            <Input
                                className="flex-1 h-[38px] text-[13px] border-gray-200"
                                value={deptForm.name}
                                onChange={(e) => setDeptForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder=""
                            />
                        </div>
                        <div className="flex items-start gap-4">
                            <Label className="w-[100px] text-[13px] font-medium text-gray-700 shrink-0 pt-2">Mô tả</Label>
                            <textarea
                                className="flex-1 min-h-[72px] px-3 py-2 text-[13px] border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={deptForm.description}
                                onChange={(e) => setDeptForm(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <Label className="w-[100px] text-[13px] font-medium text-gray-700 shrink-0">Trạng thái</Label>
                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="dept-status"
                                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        checked={deptForm.status === 'active'}
                                        onChange={() => setDeptForm(prev => ({ ...prev, status: 'active' }))}
                                    />
                                    <span className="text-[13px] text-gray-700">Hoạt động</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="dept-status"
                                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        checked={deptForm.status === 'inactive'}
                                        onChange={() => setDeptForm(prev => ({ ...prev, status: 'inactive' }))}
                                    />
                                    <span className="text-[13px] text-gray-700">Ngừng hoạt động</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="mt-2">
                        <Button variant="outline" onClick={() => setShowDeptDialog(false)} className="text-[13px]">Bỏ qua</Button>
                        <Button onClick={handleSaveDepartment} disabled={savingDept} className="bg-blue-600 hover:bg-blue-700 text-[13px]">
                            {savingDept ? 'Đang lưu...' : 'Lưu'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog Thêm mới chức danh */}
            <Dialog open={showTitleDialog} onOpenChange={setShowTitleDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-[17px] font-bold">Thêm mới chức danh</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 py-2">
                        <div className="flex items-center gap-4">
                            <Label className="w-[100px] text-[13px] font-medium text-gray-700 shrink-0">Tên chức danh</Label>
                            <Input
                                className="flex-1 h-[38px] text-[13px] border-gray-200"
                                value={titleForm.name}
                                onChange={(e) => setTitleForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder=""
                            />
                        </div>
                        <div className="flex items-start gap-4">
                            <Label className="w-[100px] text-[13px] font-medium text-gray-700 shrink-0 pt-2">Mô tả</Label>
                            <textarea
                                className="flex-1 min-h-[72px] px-3 py-2 text-[13px] border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={titleForm.description}
                                onChange={(e) => setTitleForm(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <Label className="w-[100px] text-[13px] font-medium text-gray-700 shrink-0">Trạng thái</Label>
                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="title-status"
                                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        checked={titleForm.status === 'active'}
                                        onChange={() => setTitleForm(prev => ({ ...prev, status: 'active' }))}
                                    />
                                    <span className="text-[13px] text-gray-700">Hoạt động</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="title-status"
                                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        checked={titleForm.status === 'inactive'}
                                        onChange={() => setTitleForm(prev => ({ ...prev, status: 'inactive' }))}
                                    />
                                    <span className="text-[13px] text-gray-700">Ngừng hoạt động</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="mt-2">
                        <Button variant="outline" onClick={() => setShowTitleDialog(false)} className="text-[13px]">Bỏ qua</Button>
                        <Button onClick={handleSaveJobTitle} disabled={savingTitle} className="bg-blue-600 hover:bg-blue-700 text-[13px]">
                            {savingTitle ? 'Đang lưu...' : 'Lưu'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
