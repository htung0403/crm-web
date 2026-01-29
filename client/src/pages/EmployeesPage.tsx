import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Eye, Phone, Mail, Shield, Calendar, UserPlus, Loader2, ShoppingCart, FileText, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { useUsers } from '@/hooks/useUsers';
import { useDepartments } from '@/hooks/useDepartments';
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
}

const roleLabels: Record<UserRole, string> = {
    admin: 'Admin',
    manager: 'Quản lý',
    accountant: 'Kế toán',
    sale: 'Sale',
    technician: 'Kỹ thuật',
};

const statusLabels = {
    active: { label: 'Đang làm', variant: 'success' as const },
    inactive: { label: 'Nghỉ việc', variant: 'danger' as const },
    onleave: { label: 'Nghỉ phép', variant: 'warning' as const }
};

const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Quản lý' },
    { value: 'accountant', label: 'Kế toán' },
    { value: 'sale', label: 'Sale' },
    { value: 'technician', label: 'Kỹ thuật' },
];

// Employee Form Dialog
function EmployeeFormDialog({
    open,
    onClose,
    employee,
    departments,
    onSubmit
}: {
    open: boolean;
    onClose: () => void;
    employee?: Employee | null;
    departments: { id: string; name: string }[];
    onSubmit: (data: any) => Promise<void>;
}) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState<UserRole>('sale');
    const [department, setDepartment] = useState('');
    const [salary, setSalary] = useState(0);
    const [commission, setCommission] = useState(0);
    const [bankAccount, setBankAccount] = useState('');
    const [bankName, setBankName] = useState('');
    const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);
    const [submitting, setSubmitting] = useState(false);

    const isEditing = !!employee;

    // Reset form when employee changes
    useEffect(() => {
        if (employee) {
            setName(employee.name || '');
            setEmail(employee.email || '');
            setPhone(employee.phone || '');
            setRole(employee.role || 'sale');
            // Keep existing department for technicians, auto-set for others
            if (employee.role === 'technician') {
                setDepartment(employee.department || '');
            } else {
                // Auto-set department based on role for non-technicians
                const roleDepartmentMap: Record<string, string> = {
                    admin: 'Admin',
                    manager: 'Quản lý',
                    accountant: 'Kế toán',
                    sale: 'Sale',
                };
                setDepartment(roleDepartmentMap[employee.role] || employee.department || '');
            }
            setSalary(employee.salary || 0);
            setCommission(employee.commission || 0);
            setBankAccount(employee.bankAccount || '');
            setBankName(employee.bankName || '');
            setJoinDate(employee.joinDate || new Date().toISOString().split('T')[0]);
            setPassword(''); // Don't show password for editing
        } else {
            setName('');
            setEmail('');
            setPassword('');
            setPhone('');
            setRole('sale');
            setDepartment('Sale'); // Default department for sale role
            setSalary(0);
            setCommission(0);
            setBankAccount('');
            setBankName('');
            setJoinDate(new Date().toISOString().split('T')[0]);
        }
    }, [employee, open]);

    const handleSubmit = async () => {
        if (!name || !email || !phone) {
            toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
            return;
        }

        // Password required for new employees
        if (!isEditing && (!password || password.length < 6)) {
            toast.error('Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }

        setSubmitting(true);
        try {
            const submitData: any = {
                name,
                email,
                phone,
                role,
                department: department || undefined,
                salary,
                commission,
                bankAccount,
                bankName,
                joinDate,
                status: employee?.status || 'active'
            };

            // Only include password for new employees
            if (!isEditing && password) {
                submitData.password = password;
            }

            await onSubmit(submitData);
            onClose();
        } catch (error) {
            console.error('Error saving employee:', error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        {employee ? 'Sửa thông tin nhân viên' : 'Thêm nhân viên mới'}
                    </DialogTitle>
                    <DialogDescription>Nhập thông tin nhân viên</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-2">
                            <Label>Họ và tên *</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập họ và tên" />
                        </div>
                        <div className="space-y-2">
                            <Label>Email *</Label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="email@company.com"
                                disabled={isEditing} // Can't change email for existing users
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Số điện thoại *</Label>
                            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912345678" />
                        </div>
                        {!isEditing && (
                            <div className="col-span-2 space-y-2">
                                <Label>Mật khẩu * (tối thiểu 6 ký tự)</Label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Nhập mật khẩu cho tài khoản"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Nhân viên sẽ dùng email và mật khẩu này để đăng nhập
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Role & Department */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Vai trò *</Label>
                            <Select value={role} onValueChange={(v: UserRole) => {
                                setRole(v);
                                // Auto-set department based on role
                                if (v === 'admin') {
                                    setDepartment('Admin');
                                } else if (v === 'manager') {
                                    setDepartment('Quản lý');
                                } else if (v === 'accountant') {
                                    setDepartment('Kế toán');
                                } else if (v === 'sale') {
                                    setDepartment('Sale');
                                } else if (v === 'technician') {
                                    setDepartment(''); // Technician can choose department
                                }
                            }}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {roleOptions.map(r => (
                                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {role === 'technician' ? (
                            <div className="space-y-2">
                                <Label>Phòng ban kỹ thuật *</Label>
                                <Select value={department || 'none'} onValueChange={(v) => setDepartment(v === 'none' ? '' : v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Chọn phòng ban" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Chọn phòng ban</SelectItem>
                                        {departments.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Phòng ban</Label>
                                <Input value={department} disabled className="bg-muted" />
                                <p className="text-xs text-muted-foreground">Tự động theo vai trò</p>
                            </div>
                        )}
                    </div>

                    {/* Salary & Commission */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Lương cơ bản</Label>
                            <Input type="number" value={salary} onChange={(e) => setSalary(Number(e.target.value))} />
                            {salary > 0 && <p className="text-xs text-muted-foreground">{formatCurrency(salary)}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>% Hoa hồng mặc định</Label>
                            <Input type="number" min="0" max="100" value={commission} onChange={(e) => setCommission(Number(e.target.value))} />
                        </div>
                    </div>

                    {/* Bank Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Ngân hàng</Label>
                            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Tên ngân hàng" />
                        </div>
                        <div className="space-y-2">
                            <Label>Số tài khoản</Label>
                            <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="Số tài khoản" />
                        </div>
                    </div>

                    {/* Join Date */}
                    <div className="space-y-2">
                        <Label>Ngày vào làm</Label>
                        <Input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Huỷ</Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Đang lưu...' : 'Lưu'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

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
    const { departments, fetchDepartments } = useDepartments();
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [showForm, setShowForm] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

    // Fetch data on mount
    useEffect(() => {
        fetchUsers();
        fetchDepartments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Danh sách nhân viên</h1>
                    <p className="text-muted-foreground">Quản lý thông tin nhân viên trong công ty</p>
                </div>
                <Button onClick={() => { setSelectedEmployee(null); setShowForm(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm nhân viên
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50 border-0">
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Tổng nhân viên</p>
                        <p className="text-2xl font-bold text-blue-600">{totalEmployees}</p>
                    </CardContent>
                </Card>
                <Card className="bg-emerald-50 border-0">
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Đang làm việc</p>
                        <p className="text-2xl font-bold text-emerald-600">{activeEmployees}</p>
                    </CardContent>
                </Card>
                <Card className="bg-amber-50 border-0">
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Đang nghỉ phép</p>
                        <p className="text-2xl font-bold text-amber-600">{onLeaveEmployees}</p>
                    </CardContent>
                </Card>
                <Card className="bg-purple-50 border-0">
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Tổng lương/tháng</p>
                        <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalSalary)}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Tìm theo tên, email, SĐT..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="Vai trò" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả vai trò</SelectItem>
                                {roleOptions.map(r => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder="Trạng thái" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả</SelectItem>
                                <SelectItem value="active">Đang làm</SelectItem>
                                <SelectItem value="onleave">Nghỉ phép</SelectItem>
                                <SelectItem value="inactive">Nghỉ việc</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Employee List */}
            <Card>
                <CardHeader>
                    <CardTitle>Danh sách ({filteredEmployees.length} nhân viên)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-y">
                                <tr>
                                    <th className="p-3 text-left text-sm font-medium text-muted-foreground">Nhân viên</th>
                                    <th className="p-3 text-left text-sm font-medium text-muted-foreground">Liên hệ</th>
                                    <th className="p-3 text-left text-sm font-medium text-muted-foreground">Vai trò</th>
                                    <th className="p-3 text-left text-sm font-medium text-muted-foreground">Phòng ban</th>
                                    <th className="p-3 text-right text-sm font-medium text-muted-foreground">Lương</th>
                                    <th className="p-3 text-center text-sm font-medium text-muted-foreground">Trạng thái</th>
                                    <th className="p-3 text-right text-sm font-medium text-muted-foreground">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.map((emp) => (
                                    <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors">
                                        <td className="p-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10">
                                                    <AvatarImage src={emp.avatar} />
                                                    <AvatarFallback>{emp.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{emp.name}</p>
                                                    <p className="text-xs text-muted-foreground">Từ {emp.joinDate}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <p className="text-sm">{emp.email}</p>
                                            <p className="text-xs text-muted-foreground">{emp.phone}</p>
                                        </td>
                                        <td className="p-3">
                                            <Badge variant={
                                                emp.role === 'admin' ? 'danger' :
                                                    emp.role === 'manager' ? 'purple' :
                                                        emp.role === 'sale' ? 'info' :
                                                            emp.role === 'accountant' ? 'warning' : 'secondary'
                                            }>
                                                {roleLabels[emp.role]}
                                            </Badge>
                                        </td>
                                        <td className="p-3 text-sm">{getDepartmentName(emp.department)}</td>
                                        <td className="p-3 text-right">
                                            <p className="font-semibold">{formatCurrency(emp.salary || 0)}</p>
                                            {(emp.commission || 0) > 0 && (
                                                <p className="text-xs text-muted-foreground">+{emp.commission}% HH</p>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            <Badge variant={statusLabels[emp.status]?.variant || 'secondary'}>
                                                {statusLabels[emp.status]?.label || emp.status}
                                            </Badge>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => navigate(`/employees/${emp.id}`)}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => { setSelectedEmployee(emp); setShowForm(true); }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:bg-red-50"
                                                    onClick={() => handleDeleteEmployee(emp.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden p-4 space-y-4">
                        {filteredEmployees.map((emp) => (
                            <div key={emp.id} className="p-4 rounded-lg border bg-card">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-12 w-12">
                                            <AvatarImage src={emp.avatar} />
                                            <AvatarFallback>{emp.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{emp.name}</p>
                                            <Badge variant={
                                                emp.role === 'manager' ? 'purple' :
                                                    emp.role === 'sale' ? 'info' : 'secondary'
                                            } className="mt-1">
                                                {roleLabels[emp.role]}
                                            </Badge>
                                        </div>
                                    </div>
                                    <Badge variant={statusLabels[emp.status]?.variant || 'secondary'}>
                                        {statusLabels[emp.status]?.label || emp.status}
                                    </Badge>
                                </div>

                                <div className="space-y-2 text-sm mb-3">
                                    <p className="flex items-center gap-2 text-muted-foreground">
                                        <Mail className="h-4 w-4" />
                                        {emp.email}
                                    </p>
                                    <p className="flex items-center gap-2 text-muted-foreground">
                                        <Phone className="h-4 w-4" />
                                        {emp.phone}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Lương</p>
                                        <p className="font-bold text-primary">{formatCurrency(emp.salary || 0)}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => navigate(`/employees/${emp.id}`)}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => { setSelectedEmployee(emp); setShowForm(true); }}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredEmployees.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground">
                            Không tìm thấy nhân viên nào
                        </div>
                    )}
                </CardContent>
            </Card>

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
        </div>
    );
}
