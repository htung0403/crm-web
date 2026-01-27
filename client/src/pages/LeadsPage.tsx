import { useState, useEffect } from 'react';
import { Search, Plus, Eye, ArrowRightLeft, Phone, Loader2, Mail, Copy, Check } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useLeads } from '@/hooks/useLeads';
import type { Lead } from '@/hooks/useLeads';
import { useEmployees } from '@/hooks/useEmployees';
import { formatDateTime, formatTimeAgo } from '@/lib/utils';

const statusLabels: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'danger' }> = {
    new: { label: 'Mới', variant: 'info' },
    contacted: { label: 'Đã liên hệ', variant: 'warning' },
    nurturing: { label: 'Đang chăm', variant: 'warning' },
    qualified: { label: 'Đủ điều kiện', variant: 'success' },
    converted: { label: 'Đã chuyển đổi', variant: 'success' },
    closed: { label: 'Chốt', variant: 'success' },
    cancelled: { label: 'Huỷ', variant: 'danger' },
    lost: { label: 'Mất', variant: 'danger' }
};

const sourceLabels: Record<string, string> = {
    facebook: 'Facebook',
    google: 'Google',
    zalo: 'Zalo',
    website: 'Website',
    referral: 'Giới thiệu',
    'walk-in': 'Walk-in',
    other: 'Khác'
};

interface CreateLeadFormData {
    name: string;
    phone: string;
    email: string;
    company: string;
    source: string;
    assigned_to: string;
    notes: string;
}

function CreateLeadDialog({ 
    open, 
    onClose, 
    onSubmit,
    employees 
}: { 
    open: boolean; 
    onClose: () => void; 
    onSubmit: (data: CreateLeadFormData) => Promise<void>;
    employees: { id: string; name: string }[];
}) {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        company: '',
        source: 'website',
        assigned_to: '',
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) {
            toast.error('Vui lòng nhập tên và số điện thoại');
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit(formData);
            setFormData({
                name: '',
                phone: '',
                email: '',
                company: '',
                source: 'website',
                assigned_to: '',
                notes: ''
            });
            onClose();
        } catch {
            // Error handled in parent
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Thêm Lead mới</DialogTitle>
                    <DialogDescription>Nhập thông tin khách hàng tiềm năng</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Tên khách hàng <span className="text-red-500">*</span></Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Nguyễn Văn A"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Số điện thoại <span className="text-red-500">*</span></Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder="0912345678"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="email@example.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="company">Công ty</Label>
                            <Input
                                id="company"
                                value={formData.company}
                                onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                                placeholder="Công ty ABC"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="source">Nguồn</Label>
                            <Select value={formData.source} onValueChange={(value) => setFormData(prev => ({ ...prev, source: value }))}>
                                <SelectTrigger id="source">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="facebook">Facebook</SelectItem>
                                    <SelectItem value="google">Google</SelectItem>
                                    <SelectItem value="zalo">Zalo</SelectItem>
                                    <SelectItem value="website">Website</SelectItem>
                                    <SelectItem value="referral">Giới thiệu</SelectItem>
                                    <SelectItem value="walk-in">Walk-in</SelectItem>
                                    <SelectItem value="other">Khác</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="assigned_to">Nhân viên phụ trách</Label>
                            <Select value={formData.assigned_to} onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value }))}>
                                <SelectTrigger id="assigned_to">
                                    <SelectValue placeholder="Chọn nhân viên" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Ghi chú</Label>
                        <textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Thông tin bổ sung về khách hàng..."
                            className="w-full min-h-25 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>

                    <div className="flex gap-3 justify-end pt-4">
                        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                            Hủy
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Đang tạo...
                                </>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Tạo Lead
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function LeadDetailDialog({ 
    lead, 
    open, 
    onClose, 
    onUpdate,
    onConvert 
}: { 
    lead: Lead | null; 
    open: boolean; 
    onClose: () => void; 
    onUpdate: (id: string, data: Partial<Lead>) => Promise<void>;
    onConvert: (lead: Lead) => Promise<void>;
}) {
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notes, setNotes] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [phoneCopied, setPhoneCopied] = useState(false);
    const [emailCopied, setEmailCopied] = useState(false);

    useEffect(() => {
        if (lead) {
            setNotes(lead.notes || '');
            setSelectedStatus(lead.status);
            setIsEditingNotes(false);
            setPhoneCopied(false);
            setEmailCopied(false);
        }
    }, [lead]);

    if (!lead) return null;

    const status = statusLabels[lead.status] || { label: lead.status, variant: 'info' as const };

    const handleCallPhone = () => {
        window.location.href = `tel:${lead.phone}`;
    };

    const handleCopyPhone = async () => {
        try {
            await navigator.clipboard.writeText(lead.phone);
            setPhoneCopied(true);
            setTimeout(() => setPhoneCopied(false), 2000);
        } catch {
            toast.error('Không thể copy số điện thoại');
        }
    };

    const handleEmailClick = () => {
        if (lead.email) {
            window.location.href = `mailto:${lead.email}`;
        }
    };

    const handleCopyEmail = async () => {
        if (lead.email) {
            try {
                await navigator.clipboard.writeText(lead.email);
                setEmailCopied(true);
                setTimeout(() => setEmailCopied(false), 2000);
            } catch {
                toast.error('Không thể copy email');
            }
        }
    };

    const handleSaveNotes = async () => {
        setIsSaving(true);
        try {
            await onUpdate(lead.id, { notes });
            setIsEditingNotes(false);
            toast.success('Đã cập nhật ghi chú');
        } catch {
            toast.error('Lỗi khi cập nhật ghi chú');
        } finally {
            setIsSaving(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        setIsSaving(true);
        try {
            await onUpdate(lead.id, { status: newStatus });
            setSelectedStatus(newStatus);
            toast.success('Đã cập nhật trạng thái');
        } catch {
            toast.error('Lỗi khi cập nhật trạng thái');
        } finally {
            setIsSaving(false);
        }
    };

    const handleConvert = async () => {
        if (confirm(`Xác nhận chuyển đổi ${lead.name} thành khách hàng?`)) {
            try {
                await onConvert(lead);
                onClose();
            } catch {
                // Error handled in parent
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary text-white">{lead.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <span>{lead.name}</span>
                            <Badge variant={status.variant} className="ml-2">
                                {status.label}
                            </Badge>
                        </div>
                    </DialogTitle>
                    <DialogDescription>Chi tiết thông tin lead</DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 py-4 border-b">
                    <div>
                        <p className="text-sm text-muted-foreground">Số điện thoại</p>
                        <div className="flex items-center gap-2">
                            <p className="font-medium">{lead.phone}</p>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={handleCopyPhone}
                            >
                                {phoneCopied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                            </Button>
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <div className="flex items-center gap-2">
                            <p className="font-medium">{lead.email || '-'}</p>
                            {lead.email && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={handleCopyEmail}
                                >
                                    {emailCopied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                                </Button>
                            )}
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Nguồn</p>
                        <p className="font-medium">{sourceLabels[lead.source] || lead.source}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Nhân viên phụ trách</p>
                        <p className="font-medium">{lead.assigned_user?.name || '-'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Công ty</p>
                        <p className="font-medium">{lead.company || '-'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Ngày tạo</p>
                        <p className="font-medium">{formatDateTime(lead.created_at)}</p>
                    </div>
                </div>

                {/* Status Update */}
                <div className="py-4 border-b">
                    <p className="text-sm text-muted-foreground mb-2">Cập nhật trạng thái</p>
                    <Select value={selectedStatus} onValueChange={handleStatusChange} disabled={isSaving}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="new">Mới</SelectItem>
                            <SelectItem value="contacted">Đã liên hệ</SelectItem>
                            <SelectItem value="nurturing">Đang chăm</SelectItem>
                            <SelectItem value="qualified">Đủ điều kiện</SelectItem>
                            <SelectItem value="converted">Đã chuyển đổi</SelectItem>
                            <SelectItem value="closed">Chốt</SelectItem>
                            <SelectItem value="cancelled">Huỷ</SelectItem>
                            <SelectItem value="lost">Mất</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Notes Section */}
                <div className="py-4 border-b">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-muted-foreground">Ghi chú</p>
                        {!isEditingNotes && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsEditingNotes(true)}
                            >
                                {notes ? 'Sửa' : 'Thêm ghi chú'}
                            </Button>
                        )}
                    </div>
                    {isEditingNotes ? (
                        <div className="space-y-2">
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Nhập ghi chú..."
                                className="w-full min-h-25 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setNotes(lead.notes || '');
                                        setIsEditingNotes(false);
                                    }}
                                    disabled={isSaving}
                                >
                                    Hủy
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleSaveNotes}
                                    disabled={isSaving}
                                >
                                    {isSaving ? 'Đang lưu...' : 'Lưu'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm">{notes || 'Chưa có ghi chú'}</p>
                    )}
                </div>

                <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" className="flex-1" onClick={handleCallPhone}>
                        <Phone className="h-4 w-4 mr-2" />
                        Gọi điện
                    </Button>
                    {lead.email && (
                        <Button variant="outline" className="flex-1" onClick={handleEmailClick}>
                            <Mail className="h-4 w-4 mr-2" />
                            Email
                        </Button>
                    )}
                    <Button className="flex-1" onClick={handleConvert}>
                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                        Chuyển đổi
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function LeadsPage() {
    const { leads, loading, error, fetchLeads, createLead, updateLead, convertLead } = useLeads();
    const { employees, fetchEmployees } = useEmployees();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSource, setSelectedSource] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [detailLead, setDetailLead] = useState<Lead | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    // Fetch data on mount
    useEffect(() => {
        fetchLeads();
        fetchEmployees({ role: 'sale' });
    }, [fetchLeads, fetchEmployees]);

    // Filter leads client-side for now
    const filteredLeads = leads.filter(lead => {
        const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.phone.includes(searchTerm);
        const matchesSource = selectedSource === 'all' || lead.source === selectedSource;
        const matchesStatus = selectedStatus === 'all' || lead.status === selectedStatus;
        const matchesEmployee = selectedEmployee === 'all' || lead.assigned_to === selectedEmployee;

        return matchesSearch && matchesSource && matchesStatus && matchesEmployee;
    });

    const toggleSelectAll = () => {
        if (selectedLeads.length === filteredLeads.length) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(filteredLeads.map(l => l.id));
        }
    };

    const toggleSelectLead = (id: string) => {
        setSelectedLeads(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
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
            <div className="flex items-center justify-center min-h-100">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <Toaster position="top-right" richColors />
            <div className="space-y-6 animate-fade-in">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Quản lý Leads</h1>
                        <p className="text-muted-foreground">Theo dõi và chăm sóc khách hàng tiềm năng</p>
                    </div>
                    <Button onClick={() => setShowCreateDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Thêm Lead
                    </Button>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

                        {/* Status Filter */}
                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                            <SelectTrigger>
                                <SelectValue placeholder="Trạng thái" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                                <SelectItem value="new">Mới</SelectItem>
                                <SelectItem value="contacted">Đã liên hệ</SelectItem>
                                <SelectItem value="nurturing">Đang chăm</SelectItem>
                                <SelectItem value="qualified">Đủ điều kiện</SelectItem>
                                <SelectItem value="converted">Đã chuyển đổi</SelectItem>
                                <SelectItem value="lost">Mất</SelectItem>
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

            {/* Leads Table */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                            {filteredLeads.length} Leads
                            {selectedLeads.length > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                    Đã chọn {selectedLeads.length}
                                </Badge>
                            )}
                        </CardTitle>
                        {selectedLeads.length > 0 && (
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm">
                                    <ArrowRightLeft className="h-4 w-4 mr-1" />
                                    Chuyển NV
                                </Button>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-y">
                                <tr>
                                    <th className="p-3 text-left w-12">
                                        <Checkbox
                                            checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="p-3 text-left text-sm font-medium text-muted-foreground">Khách hàng</th>
                                    <th className="p-3 text-left text-sm font-medium text-muted-foreground">Số điện thoại</th>
                                    <th className="p-3 text-left text-sm font-medium text-muted-foreground">Nguồn</th>
                                    <th className="p-3 text-left text-sm font-medium text-muted-foreground">Nhân viên</th>
                                    <th className="p-3 text-left text-sm font-medium text-muted-foreground">Trạng thái</th>
                                    <th className="p-3 text-left text-sm font-medium text-muted-foreground">Ngày tạo</th>
                                    <th className="p-3 text-right text-sm font-medium text-muted-foreground">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLeads.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                                            Không có leads nào
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLeads.map((lead) => {
                                        const status = statusLabels[lead.status] || { label: lead.status, variant: 'info' as const };
                                        return (
                                            <tr key={lead.id} className="border-b hover:bg-muted/30 transition-colors">
                                                <td className="p-3">
                                                    <Checkbox
                                                        checked={selectedLeads.includes(lead.id)}
                                                        onCheckedChange={() => toggleSelectLead(lead.id)}
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <button
                                                        onClick={() => setDetailLead(lead)}
                                                        className="text-primary hover:underline font-medium cursor-pointer"
                                                    >
                                                        {lead.name}
                                                    </button>
                                                </td>
                                                <td className="p-3 text-sm">{lead.phone}</td>
                                                <td className="p-3">
                                                    <Badge variant="outline">{sourceLabels[lead.source] || lead.source}</Badge>
                                                </td>
                                                <td className="p-3">
                                                    {lead.assigned_user ? (
                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="h-7 w-7">
                                                                <AvatarFallback className="text-xs">{lead.assigned_user.name.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <span className="text-sm">{lead.assigned_user.name}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <Badge variant={status.variant}>
                                                        {status.label}
                                                    </Badge>
                                                </td>
                                                <td className="p-3 text-sm text-muted-foreground">
                                                    {formatTimeAgo(lead.created_at)}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button variant="ghost" size="icon" onClick={() => setDetailLead(lead)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleConvert(lead)}>
                                                            <ArrowRightLeft className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3 p-4">
                        {filteredLeads.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                Không có leads nào
                            </div>
                        ) : (
                            filteredLeads.map((lead) => {
                                const status = statusLabels[lead.status] || { label: lead.status, variant: 'info' as const };
                                return (
                                    <div
                                        key={lead.id}
                                        className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer"
                                        onClick={() => setDetailLead(lead)}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <Checkbox
                                                    checked={selectedLeads.includes(lead.id)}
                                                    onCheckedChange={() => toggleSelectLead(lead.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <div>
                                                    <p className="font-medium text-primary">{lead.name}</p>
                                                    <p className="text-sm text-muted-foreground">{lead.phone}</p>
                                                </div>
                                            </div>
                                            <Badge variant={status.variant}>
                                                {status.label}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">
                                                {lead.assigned_user?.name || 'Chưa gán'}
                                            </span>
                                            <Badge variant="outline">{sourceLabels[lead.source] || lead.source}</Badge>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Create Lead Dialog */}
            <CreateLeadDialog
                open={showCreateDialog}
                onClose={() => setShowCreateDialog(false)}
                onSubmit={handleCreateLead}
                employees={employees}
            />

            {/* Lead Detail Dialog */}
            <LeadDetailDialog
                lead={detailLead}
                open={!!detailLead}
                onClose={() => setDetailLead(null)}
                onUpdate={async (id, data) => {
                    await updateLead(id, data);
                    await fetchLeads();
                }}
                onConvert={handleConvert}
            />
            </div>
        </>
    );
}
