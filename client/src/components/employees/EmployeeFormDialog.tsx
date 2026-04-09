import { useState, useEffect, useRef } from 'react';
import { UserPlus, Loader2, Trash2, ExternalLink, Camera, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { formatCurrency } from '@/lib/utils';
import { uploadFile } from '@/lib/supabase';
import { toast } from 'sonner';
import type { UserRole } from '@/types';

interface Employee {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: UserRole;
    department?: string;
    avatar?: string;
    status?: string;
    salary?: number;
    commission?: number;
    bankAccount?: string;
    bankName?: string;
    telegramChatId?: string;
    joinDate?: string;
}

const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Quản lý' },
    { value: 'accountant', label: 'Kế toán' },
    { value: 'sale', label: 'Nhân viên bán hàng' },
    { value: 'technician', label: 'Kỹ thuật viên' },
    { value: 'cashier', label: 'Thu ngân' },
];

interface EmployeeFormDialogProps {
    open: boolean;
    onClose: () => void;
    employee?: Employee | null;
    departments: { id: string; name: string }[];
    onSubmit: (data: any) => Promise<void>;
}

export function EmployeeFormDialog({
    open,
    onClose,
    employee,
    departments,
    onSubmit
}: EmployeeFormDialogProps) {
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
    const [telegramChatId, setTelegramChatId] = useState('');
    const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);
    const [submitting, setSubmitting] = useState(false);
    const [avatar, setAvatar] = useState('');
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [salaryType, setSalaryType] = useState('');
    const [salaryTemplate, setSalaryTemplate] = useState('');
    const [bonusEnabled, setBonusEnabled] = useState(false);
    const [commissionEnabled, setCommissionEnabled] = useState(true);
    const [allowanceEnabled, setAllowanceEnabled] = useState(false);
    const [deductionEnabled, setDeductionEnabled] = useState(false);
    const [commissionRows, setCommissionRows] = useState([
        { type: 'service', revenueFrom: 0, commissionTable: 'default' },
        { type: 'sales', revenueFrom: 0, commissionTable: 'default' },
    ]);
    const [activeTab, setActiveTab] = useState('basic');

    const isEditing = !!employee;

    // Reset form when employee changes
    useEffect(() => {
        if (employee) {
            setName(employee.name || '');
            setEmail(employee.email || '');
            setAvatar(employee.avatar || '');
            setPhone(employee.phone || '');
            setRole(employee.role || 'sale');
            const roleDepartmentMap: Record<string, string> = {
                admin: 'Quản lý',
                manager: 'Quản lý',
                accountant: 'Kế toán',
                sale: 'Kinh doanh',
                technician: 'Kĩ thuật',
                cashier: 'Thu ngân',
            };
            setDepartment(roleDepartmentMap[employee.role] || employee.department || '');
            setSalary(employee.salary || 0);
            setCommission(employee.commission || 0);
            setBankAccount(employee.bankAccount || '');
            setBankName(employee.bankName || '');
            setTelegramChatId(employee.telegramChatId || '');
            setJoinDate(employee.joinDate || new Date().toISOString().split('T')[0]);
            setPassword('');
        } else {
            setName('');
            setEmail('');
            setPassword('');
            setAvatar('');
            setPhone('');
            setRole('sale');
            setDepartment('Sale');
            setSalary(0);
            setCommission(0);
            setBankAccount('');
            setBankName('');
            setTelegramChatId('');
            setJoinDate(new Date().toISOString().split('T')[0]);
        }
        setActiveTab('basic');
    }, [employee, open]);

    const handleSubmit = async () => {
        if (!name || !email || !phone) {
            toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
            return;
        }

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
                telegramChatId,
                joinDate,
                avatar: avatar || undefined,
                status: employee?.status || 'active'
            };

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
            <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden">
                <div className="flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="px-6 pt-6 pb-4">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <UserPlus className="h-5 w-5 text-primary" />
                                {employee ? 'Sửa thông tin nhân viên' : 'Thêm nhân viên mới'}
                            </DialogTitle>
                            <DialogDescription>Nhập thông tin nhân viên</DialogDescription>
                        </DialogHeader>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto px-6 pb-4 min-h-0">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-4">
                                <TabsTrigger value="basic">Thông tin cơ bản</TabsTrigger>
                                <TabsTrigger value="salary">Thiết lập lương</TabsTrigger>
                            </TabsList>

                            <TabsContent value="basic" className="space-y-4 py-4 min-h-[400px] mt-0">
                                {/* Avatar Upload */}
                                <div className="flex justify-center mb-2">
                                    <div className="relative group">
                                        <div 
                                            className="w-[88px] h-[88px] rounded-full border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                                            onClick={() => avatarInputRef.current?.click()}
                                        >
                                            {uploadingAvatar ? (
                                                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                            ) : avatar ? (
                                                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-1">
                                                    <Camera className="w-6 h-6 text-gray-400" />
                                                    <span className="text-[10px] text-gray-400">Tải ảnh</span>
                                                </div>
                                            )}
                                        </div>
                                        {avatar && (
                                            <div 
                                                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                onClick={() => avatarInputRef.current?.click()}
                                            >
                                                <Camera className="w-5 h-5 text-white" />
                                            </div>
                                        )}
                                        <input
                                            ref={avatarInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                if (file.size > 5 * 1024 * 1024) {
                                                    toast.error('Ảnh không được lớn hơn 5MB');
                                                    return;
                                                }
                                                setUploadingAvatar(true);
                                                try {
                                                    const { url, error } = await uploadFile('avatars', 'employees', file);
                                                    if (error) throw error;
                                                    if (url) setAvatar(url);
                                                    toast.success('Đã tải ảnh lên!');
                                                } catch (err) {
                                                    console.error('Upload avatar error:', err);
                                                    toast.error('Lỗi khi tải ảnh lên');
                                                } finally {
                                                    setUploadingAvatar(false);
                                                    e.target.value = '';
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

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
                                            disabled={isEditing}
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
                                            if (v === 'admin') setDepartment('Quản lý');
                                            else if (v === 'manager') setDepartment('Quản lý');
                                            else if (v === 'accountant') setDepartment('Kế toán');
                                            else if (v === 'sale') setDepartment('Kinh doanh');
                                            else if (v === 'technician') setDepartment('Kĩ thuật');
                                            else if (v === 'cashier') setDepartment('Thu ngân');
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
                                    <div className="space-y-2">
                                        <Label>Phòng ban</Label>
                                        <Input value={department} disabled className="bg-muted" />
                                    </div>
                                </div>

                                {/* Join Date & Telegram */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Ngày vào làm</Label>
                                        <Input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Telegram Chat ID</Label>
                                        <Input value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} placeholder="VD: 123456789" />
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="salary" className="space-y-4 py-4 min-h-[400px] mt-0">
                                {/* Lương chính */}
                                <div className="rounded-lg border border-gray-200 bg-gray-50/50">
                                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-100/80 rounded-t-lg">
                                        <h4 className="text-[13px] font-bold text-gray-800">Lương chính</h4>
                                    </div>
                                    <div className="p-4">
                                        <div className="flex items-center gap-4">
                                            <Label className="w-[90px] text-[13px] text-gray-600 shrink-0">Loại lương</Label>
                                            <Select value={salaryType} onValueChange={setSalaryType}>
                                                <SelectTrigger className="w-[280px] h-[36px] bg-white text-[13px]">
                                                    <SelectValue placeholder="Chọn Loại lương" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="fixed" className="text-[13px]">Lương cố định</SelectItem>
                                                    <SelectItem value="hourly" className="text-[13px]">Lương theo giờ</SelectItem>
                                                    <SelectItem value="shift" className="text-[13px]">Lương theo ca</SelectItem>
                                                    <SelectItem value="product" className="text-[13px]">Lương theo sản phẩm</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {salaryType && (
                                            <div className="flex items-center gap-4 mt-3">
                                                <Label className="w-[90px] text-[13px] text-gray-600 shrink-0">Mức lương</Label>
                                                <Input type="number" value={salary} onChange={(e) => setSalary(Number(e.target.value))} className="w-[280px] h-[36px] text-[13px]" placeholder="0" />
                                                {salary > 0 && <span className="text-[12px] text-blue-600 font-medium">{formatCurrency(salary)}</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Mẫu lương */}
                                <div className="rounded-lg border border-gray-200 bg-gray-50/50">
                                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-100/80 rounded-t-lg">
                                        <div className="flex items-center gap-1.5">
                                            <h4 className="text-[13px] font-bold text-gray-800">Mẫu lương</h4>
                                            <Info className="h-3.5 w-3.5 text-gray-400" />
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <Select value={salaryTemplate} onValueChange={setSalaryTemplate}>
                                            <SelectTrigger className="w-[280px] h-[36px] bg-white text-[13px]">
                                                <SelectValue placeholder="Chọn mẫu lương có sẵn" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="default" className="text-[13px]">Mẫu lương mặc định</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Thưởng */}
                                <div className="rounded-lg border border-gray-200 bg-gray-50/50">
                                    <div className="px-4 py-3 bg-gray-100/80 rounded-lg flex items-center justify-between">
                                        <div>
                                            <h4 className="text-[13px] font-bold text-gray-800">Thưởng</h4>
                                            <p className="text-[11px] text-gray-500 mt-0.5">Thiết lập thưởng theo doanh thu cho nhân viên</p>
                                        </div>
                                        <Switch checked={bonusEnabled} onCheckedChange={setBonusEnabled} />
                                    </div>
                                </div>

                                {/* Hoa hồng */}
                                <div className="rounded-lg border border-gray-200 bg-gray-50/50">
                                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-100/80 rounded-t-lg flex items-center justify-between">
                                        <div>
                                            <h4 className="text-[13px] font-bold text-gray-800">Hoa hồng</h4>
                                            <p className="text-[11px] text-gray-500 mt-0.5">Thiết lập mức hoa hồng theo sản phẩm hoặc dịch vụ</p>
                                        </div>
                                        <Switch checked={commissionEnabled} onCheckedChange={setCommissionEnabled} />
                                    </div>
                                    {commissionEnabled && (
                                        <div className="p-4">
                                            <table className="w-full text-[13px]">
                                                <thead>
                                                    <tr className="border-b border-gray-200">
                                                        <th className="text-left py-2 px-2 font-semibold text-gray-600 text-[11px] uppercase">Loại hình</th>
                                                        <th className="text-left py-2 px-2 font-semibold text-gray-600 text-[11px] uppercase">
                                                            <div className="flex items-center gap-1">Doanh thu <Info className="h-3 w-3 text-gray-400" /></div>
                                                        </th>
                                                        <th className="text-left py-2 px-2 font-semibold text-gray-600 text-[11px] uppercase">Hoa hồng thụ hưởng</th>
                                                        <th className="w-[60px]"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {commissionRows.map((row, idx) => (
                                                        <tr key={idx} className="border-b border-gray-100">
                                                            <td className="py-2 px-2">
                                                                <Select value={row.type} onValueChange={(v) => {
                                                                    const newRows = [...commissionRows];
                                                                    newRows[idx].type = v;
                                                                    setCommissionRows(newRows);
                                                                }}>
                                                                    <SelectTrigger className="h-[34px] bg-white text-[13px] w-[160px]">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="service" className="text-[13px]">Thực hiện dịch vụ</SelectItem>
                                                                        <SelectItem value="sales" className="text-[13px]">Tư vấn bán hàng</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </td>
                                                            <td className="py-2 px-2">
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-[12px] text-gray-500">Từ</span>
                                                                    <Input
                                                                        type="number"
                                                                        value={row.revenueFrom}
                                                                        onChange={(e) => {
                                                                            const newRows = [...commissionRows];
                                                                            newRows[idx].revenueFrom = Number(e.target.value);
                                                                            setCommissionRows(newRows);
                                                                        }}
                                                                        className="h-[34px] w-[80px] text-[13px]"
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td className="py-2 px-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Select value={row.commissionTable} onValueChange={(v) => {
                                                                        const newRows = [...commissionRows];
                                                                        newRows[idx].commissionTable = v;
                                                                        setCommissionRows(newRows);
                                                                    }}>
                                                                        <SelectTrigger className="h-[34px] bg-white text-[13px] w-[240px]">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="default" className="text-[13px]">Bảng hoa hồng chung</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-blue-600">
                                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                            <td className="py-2 px-2 text-center">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-gray-400 hover:text-red-500"
                                                                    onClick={() => {
                                                                        setCommissionRows(commissionRows.filter((_, i) => i !== idx));
                                                                    }}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <button
                                                className="text-[13px] text-blue-600 font-medium mt-2 hover:underline"
                                                onClick={() => setCommissionRows([...commissionRows, { type: 'service', revenueFrom: 0, commissionTable: 'default' }])}
                                            >
                                                Thêm hoa hồng
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Phụ cấp */}
                                <div className="rounded-lg border border-gray-200 bg-gray-50/50">
                                    <div className="px-4 py-3 bg-gray-100/80 rounded-lg flex items-center justify-between">
                                        <div>
                                            <h4 className="text-[13px] font-bold text-gray-800">Phụ cấp</h4>
                                            <p className="text-[11px] text-gray-500 mt-0.5">Thiết lập khoản hỗ trợ làm việc như ăn trưa, đi lại, điện thoại, ...</p>
                                        </div>
                                        <Switch checked={allowanceEnabled} onCheckedChange={setAllowanceEnabled} />
                                    </div>
                                </div>

                                {/* Giảm trừ */}
                                <div className="rounded-lg border border-gray-200 bg-gray-50/50">
                                    <div className="px-4 py-3 bg-gray-100/80 rounded-lg flex items-center justify-between">
                                        <div>
                                            <h4 className="text-[13px] font-bold text-gray-800">Giảm trừ</h4>
                                            <p className="text-[11px] text-gray-500 mt-0.5">Thiết lập khoản giảm trừ như đi muộn, về sớm, vi phạm nội quy, ...</p>
                                        </div>
                                        <Switch checked={deductionEnabled} onCheckedChange={setDeductionEnabled} />
                                    </div>
                                </div>

                                {/* Thông tin ngân hàng */}
                                <div className="rounded-lg border border-gray-200 bg-gray-50/50">
                                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-100/80 rounded-t-lg">
                                        <h4 className="text-[13px] font-bold text-gray-800">Thông tin ngân hàng</h4>
                                    </div>
                                    <div className="p-4 grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-[13px] text-gray-600">Ngân hàng</Label>
                                            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Tên ngân hàng" className="h-[36px] text-[13px]" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[13px] text-gray-600">Số tài khoản</Label>
                                            <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="Số tài khoản" className="h-[36px] text-[13px]" />
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Sticky Footer */}
                    <div className="shrink-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-2">
                        <Button variant="outline" onClick={onClose} className="text-[13px]">Bỏ qua</Button>
                        {activeTab === 'salary' && (
                            <Button variant="outline" className="text-[13px]">Lưu và tạo mẫu lương mới</Button>
                        )}
                        <Button onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-[13px]">
                            {submitting ? 'Đang lưu...' : 'Lưu'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
