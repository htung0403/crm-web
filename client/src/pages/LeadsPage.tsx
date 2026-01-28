import { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { Search, Plus, Eye, Phone, Loader2, Mail, Copy, Check, ArrowRightLeft, Users, TrendingUp, UserPlus } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useLeads } from '@/hooks/useLeads';
import type { Lead } from '@/hooks/useLeads';
import { useEmployees } from '@/hooks/useEmployees';
import { leadsApi } from '@/lib/api';
import { formatDateTime, formatTimeAgo } from '@/lib/utils';
import { CreateOrderDialog } from '@/components/orders/CreateOrderDialog';
import { useCustomers } from '@/hooks/useCustomers';
import { useProducts } from '@/hooks/useProducts';
import { usePackages } from '@/hooks/usePackages';
import { useVouchers } from '@/hooks/useVouchers';
import { useOrders } from '@/hooks/useOrders';

// Kanban column configuration with colors based on pipeline_stage
const kanbanColumns = [
    {
        id: 'xac_dinh_nhu_cau',
        label: 'Xác định nhu cầu',
        color: 'bg-orange-500',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        textColor: 'text-orange-700',
        icon: UserPlus
    },
    {
        id: 'hen_gui_anh',
        label: 'Hẹn gửi ảnh',
        color: 'bg-slate-500',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-200',
        textColor: 'text-slate-700',
        icon: Phone
    },
    {
        id: 'dam_phan_gia',
        label: 'Đàm phán giá',
        color: 'bg-purple-500',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        textColor: 'text-purple-700',
        icon: Users
    },
    {
        id: 'hen_qua_ship',
        label: 'Hẹn qua hoặc ship',
        color: 'bg-slate-500',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-200',
        textColor: 'text-slate-700',
        icon: TrendingUp
    },
    {
        id: 'chot_don',
        label: 'Chốt đơn',
        color: 'bg-green-500',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-700',
        icon: Check
    },
    {
        id: 'fail',
        label: 'Fail (khách rời)',
        color: 'bg-red-500',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-700',
        icon: ArrowRightLeft
    }
];

const sourceLabels: Record<string, { label: string; color: string }> = {
    facebook: { label: 'Facebook', color: 'bg-blue-100 text-blue-700' },
    google: { label: 'Google', color: 'bg-red-100 text-red-700' },
    zalo: { label: 'Zalo', color: 'bg-sky-100 text-sky-700' },
    website: { label: 'Website', color: 'bg-purple-100 text-purple-700' },
    referral: { label: 'Giới thiệu', color: 'bg-green-100 text-green-700' },
    'walk-in': { label: 'Walk-in', color: 'bg-amber-100 text-amber-700' },
    other: { label: 'Khác', color: 'bg-gray-100 text-gray-700' }
};

interface CreateLeadFormData {
    name: string;
    phone: string;
    email: string;
    company: string;
    address: string;
    channel: string;
    lead_type: string;
    assigned_to: string;
    notes: string;
    fb_thread_id: string;
    link_message: string;
    appointment_time: string;
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
        address: '',
        channel: 'website',
        lead_type: 'individual',
        assigned_to: '',
        notes: '',
        fb_thread_id: '',
        link_message: '',
        appointment_time: ''
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
                address: '',
                channel: 'website',
                lead_type: 'individual',
                assigned_to: '',
                notes: '',
                fb_thread_id: '',
                link_message: '',
                appointment_time: ''
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
                    <DialogTitle className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Plus className="h-5 w-5 text-primary" />
                        </div>
                        Thêm Lead mới
                    </DialogTitle>
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
                            <Label htmlFor="channel">Kênh</Label>
                            <Select value={formData.channel} onValueChange={(value) => setFormData(prev => ({ ...prev, channel: value }))}>
                                <SelectTrigger id="channel">
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
                            <Label htmlFor="lead_type">Loại lead</Label>
                            <Select value={formData.lead_type} onValueChange={(value) => setFormData(prev => ({ ...prev, lead_type: value }))}>
                                <SelectTrigger id="lead_type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="individual">Cá nhân</SelectItem>
                                    <SelectItem value="company">Doanh nghiệp</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                        <div className="space-y-2">
                            <Label htmlFor="appointment_time">Thời gian hẹn</Label>
                            <Input
                                id="appointment_time"
                                type="datetime-local"
                                value={formData.appointment_time || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, appointment_time: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* FB Integration Fields - Show only for Facebook channel */}
                    {formData.channel === 'facebook' && (
                        <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="space-y-2">
                                <Label htmlFor="fb_thread_id" className="text-blue-700">FB Thread ID</Label>
                                <Input
                                    id="fb_thread_id"
                                    value={formData.fb_thread_id || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, fb_thread_id: e.target.value }))}
                                    placeholder="t_xxx"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="link_message" className="text-blue-700">Link conversation</Label>
                                <Input
                                    id="link_message"
                                    value={formData.link_message || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, link_message: e.target.value }))}
                                    placeholder="https://..."
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="address">Địa chỉ</Label>
                        <Input
                            id="address"
                            value={formData.address || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                            placeholder="Số nhà, đường, quận/huyện..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Ghi chú</Label>
                        <textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Thông tin bổ sung về khách hàng..."
                            className="w-full min-h-20 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
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
    const [newNote, setNewNote] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [phoneCopied, setPhoneCopied] = useState(false);
    const [emailCopied, setEmailCopied] = useState(false);
    const [activities, setActivities] = useState<any[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);

    // Fetch activities when dialog opens
    useEffect(() => {
        if (lead && open) {
            setNotes(lead.notes || '');
            setSelectedStatus(lead.status);
            setIsEditingNotes(false);
            setPhoneCopied(false);
            setEmailCopied(false);
            setNewNote('');

            // Fetch activities
            setLoadingActivities(true);
            leadsApi.getActivities(lead.id)
                .then(res => {
                    setActivities(res.data.data?.activities || []);
                })
                .catch(() => {
                    setActivities([]);
                })
                .finally(() => {
                    setLoadingActivities(false);
                });
        }
    }, [lead, open]);

    if (!lead) return null;

    const column = kanbanColumns.find(c => c.id === lead.status) || kanbanColumns[0];

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
                        <Avatar className="h-12 w-12">
                            <AvatarFallback className={`${column.color} text-white font-semibold`}>
                                {lead.name.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <span className="text-lg">{lead.name}</span>
                            <div className={`inline-flex items-center ml-3 px-2.5 py-0.5 rounded-full text-xs font-medium ${column.bgColor} ${column.textColor}`}>
                                {column.label}
                            </div>
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
                        <p className="text-sm text-muted-foreground">Kênh/Nguồn</p>
                        <p className="font-medium">{sourceLabels[lead.channel || lead.source || '']?.label || lead.channel || lead.source || '-'}</p>
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
                            {kanbanColumns.map(col => (
                                <SelectItem key={col.id} value={col.id}>{col.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Add New Note */}
                <div className="py-4 border-b">
                    <p className="text-sm text-muted-foreground mb-2">Thêm ghi chú mới</p>
                    <div className="flex gap-2">
                        <textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Nhập ghi chú..."
                            className="flex-1 min-h-16 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <Button
                            size="sm"
                            disabled={!newNote.trim() || isSaving}
                            onClick={async () => {
                                if (!newNote.trim()) return;
                                setIsSaving(true);
                                try {
                                    const res = await leadsApi.addActivity(lead.id, {
                                        activity_type: 'note',
                                        content: newNote.trim()
                                    });
                                    setActivities(prev => [res.data.data?.activity, ...prev]);
                                    setNewNote('');
                                    toast.success('Đã thêm ghi chú');
                                } catch {
                                    toast.error('Lỗi khi thêm ghi chú');
                                } finally {
                                    setIsSaving(false);
                                }
                            }}
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gửi'}
                        </Button>
                    </div>
                </div>

                {/* Activities Timeline */}
                <div className="py-4 border-b flex-1 overflow-auto max-h-72">
                    <p className="text-sm font-medium mb-3">Lịch sử hoạt động</p>
                    {loadingActivities ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : activities.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Chưa có hoạt động nào</p>
                    ) : (
                        <div className="space-y-2">
                            {activities.map((activity) => (
                                <div key={activity.id} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                                    {/* Time Header */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-2 h-2 rounded-full ${activity.activity_type === 'status_change' ? 'bg-blue-500' : 'bg-green-500'}`} />
                                        <span className="text-xs font-semibold text-primary">{formatDateTime(activity.created_at)}</span>
                                    </div>

                                    {/* Content */}
                                    {activity.activity_type === 'status_change' ? (
                                        <div className="ml-4">
                                            <p className="text-sm">
                                                <span className="font-medium">{activity.created_by_name || 'Hệ thống'}</span>
                                                <span className="text-muted-foreground"> đã chuyển trạng thái</span>
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-xs">{kanbanColumns.find(c => c.id === activity.old_status)?.label || activity.old_status}</Badge>
                                                <span className="text-muted-foreground">→</span>
                                                <Badge className="text-xs">{kanbanColumns.find(c => c.id === activity.new_status)?.label || activity.new_status}</Badge>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="ml-4">
                                            <p className="text-sm font-medium">{activity.created_by_name || 'Ẩn danh'}</p>
                                            <p className="text-sm text-muted-foreground mt-0.5">{activity.content}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
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

// Kanban Card Component
function LeadCard({
    lead,
    index,
    onClick
}: {
    lead: Lead;
    index: number;
    onClick: () => void;
}) {
    // Use channel first, fallback to source for legacy data
    const channelKey = lead.channel || lead.source || '';
    const source = sourceLabels[channelKey] || { label: channelKey || 'Khác', color: 'bg-gray-100 text-gray-700' };

    // SLA state colors
    const slaColors: Record<string, string> = {
        ok: 'bg-green-100 text-green-700',
        warning: 'bg-amber-100 text-amber-700',
        overdue: 'bg-red-100 text-red-700'
    };

    return (
        <Draggable draggableId={lead.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`kanban-card bg-white rounded-lg border p-3 cursor-pointer group ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/20' : 'shadow-sm hover:shadow-md'
                        }`}
                    onClick={onClick}
                >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-8 w-8 shrink-0">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                                    {lead.name.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">
                                    {lead.name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {lead.phone}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClick();
                            }}
                        >
                            <Eye className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    {/* Tags */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${source.color}`}>
                            {source.label}
                        </span>
                        {lead.company && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 truncate max-w-[120px]">
                                {lead.company}
                            </span>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <div className="flex items-center gap-1.5">
                            {lead.assigned_user ? (
                                <>
                                    <Avatar className="h-5 w-5">
                                        <AvatarFallback className="text-[10px] bg-secondary/20">
                                            {lead.assigned_user.name.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="truncate max-w-[80px]">{lead.assigned_user.name}</span>
                                </>
                            ) : (
                                <span className="text-muted-foreground/60">Chưa gán</span>
                            )}
                        </div>
                        <span>{formatTimeAgo(lead.created_at)}</span>
                    </div>
                </div>
            )}
        </Draggable>
    );
}

// Kanban Column Component
function KanbanColumn({
    column,
    leads,
    onCardClick
}: {
    column: typeof kanbanColumns[0];
    leads: Lead[];
    onCardClick: (lead: Lead) => void;
}) {
    const Icon = column.icon;

    return (
        <div className="flex flex-col flex-1 min-w-[200px]">
            {/* Column Header */}
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-lg ${column.bgColor} ${column.borderColor} border border-b-0`}>
                <div className={`p-1.5 rounded-md ${column.color}`}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                </div>
                <h3 className={`font-semibold text-sm ${column.textColor}`}>{column.label}</h3>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${column.color} text-white`}>
                    {leads.length}
                </span>
            </div>

            {/* Column Body */}
            <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`kanban-column flex-1 p-2 space-y-2 rounded-b-lg border ${column.borderColor} ${snapshot.isDraggingOver ? `${column.bgColor}` : 'bg-slate-50/50'
                            } transition-colors`}
                    >
                        {leads.map((lead, index) => (
                            <LeadCard
                                key={lead.id}
                                lead={lead}
                                index={index}
                                onClick={() => onCardClick(lead)}
                            />
                        ))}
                        {provided.placeholder}
                        {leads.length === 0 && !snapshot.isDraggingOver && (
                            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground/60 border-2 border-dashed border-slate-200 rounded-lg">
                                Không có lead
                            </div>
                        )}
                    </div>
                )}
            </Droppable>
        </div>
    );
}

export function LeadsPage() {
    const { leads, loading, error, fetchLeads, createLead, updateLead, convertLead } = useLeads();
    const { employees, fetchEmployees } = useEmployees();

    // Hooks for CreateOrderDialog
    const { customers, fetchCustomers } = useCustomers();
    const { products, services, fetchProducts, fetchServices } = useProducts();
    const { packages, fetchPackages } = usePackages();
    const { vouchers, fetchVouchers } = useVouchers();
    const { createOrder } = useOrders();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSource, setSelectedSource] = useState<string>('all');
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [detailLead, setDetailLead] = useState<Lead | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    // State for CreateOrderDialog
    const [showOrderDialog, setShowOrderDialog] = useState(false);
    const [leadForOrder, setLeadForOrder] = useState<Lead | null>(null);

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
    }, [fetchLeads, fetchEmployees, fetchCustomers, fetchProducts, fetchServices, fetchPackages, fetchVouchers]);

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
                                    onCardClick={setDetailLead}
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

                {/* Create Order Dialog - shown when lead is moved to 'closed' */}
                <CreateOrderDialog
                    open={showOrderDialog}
                    onClose={() => {
                        setShowOrderDialog(false);
                        setLeadForOrder(null);
                    }}
                    onSubmit={async (data) => {
                        await createOrder(data);
                        toast.success('Đã tạo đơn hàng thành công!');
                        setShowOrderDialog(false);
                        setLeadForOrder(null);
                    }}
                    customers={customers.map(c => ({ id: c.id, name: c.name, phone: c.phone, status: c.status }))}
                    products={products.map(p => ({ id: p.id, name: p.name, price: p.price }))}
                    services={services.map(s => ({ id: s.id, name: s.name, price: s.price, department: s.department }))}
                    packages={packages}
                    vouchers={vouchers}
                />
            </div>
        </>
    );
}
