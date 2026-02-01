import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Phone, MessageCircle, Copy, Check, ArrowRightLeft,
    Loader2, User, Building, Calendar, Tag, UserCheck, Mail,
    Clock, MessageSquare, TrendingUp, Timer, Facebook, ExternalLink, CalendarClock,
    ShoppingBag
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { leadsApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import type { Lead } from '@/hooks/useLeads';
import { useLeads } from '@/hooks/useLeads';
import { kanbanColumns, sourceLabels, getStatusLabel } from '@/components/leads/constants';

export function LeadDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { updateLead, convertLead, fetchLeads } = useLeads();

    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [newNote, setNewNote] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [phoneCopied, setPhoneCopied] = useState(false);
    const [emailCopied, setEmailCopied] = useState(false);
    const [activities, setActivities] = useState<any[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [elapsedTime, setElapsedTime] = useState('');

    // Edit lead fields state
    const [editFbLink, setEditFbLink] = useState('');
    const [editFbName, setEditFbName] = useState('');
    const [editNextFollowup, setEditNextFollowup] = useState('');
    const [editAppointment, setEditAppointment] = useState('');
    const [isEditingInfo, setIsEditingInfo] = useState(false);

    // Fetch lead data
    useEffect(() => {
        const fetchLead = async () => {
            if (!id) return;

            setLoading(true);
            setError(null);

            try {
                const response = await leadsApi.getById(id);
                const leadData = response.data?.data?.lead || response.data?.data;
                if (leadData && leadData.id) {
                    setLead(leadData as Lead);
                    setSelectedStatus(leadData.pipeline_stage || leadData.status);
                } else {
                    setError('Không tìm thấy thông tin lead');
                }
            } catch (err: any) {
                console.error('Error fetching lead:', err);
                setError(err.response?.data?.message || 'Lỗi khi tải thông tin lead');
            } finally {
                setLoading(false);
            }
        };

        fetchLead();
    }, [id]);

    // Initialize edit fields when lead data loads
    useEffect(() => {
        if (lead) {
            setEditFbLink(lead.fb_link || lead.link_message || '');
            setEditFbName(lead.fb_profile_name || '');
            setEditNextFollowup(lead.next_followup_time ? new Date(lead.next_followup_time).toISOString().slice(0, 16) : '');
            setEditAppointment(lead.appointment_time ? new Date(lead.appointment_time).toISOString().slice(0, 16) : '');
        }
    }, [lead]);

    // Fetch activities
    useEffect(() => {
        const fetchActivities = async () => {
            if (!id) return;

            setLoadingActivities(true);
            try {
                const res = await leadsApi.getActivities(id);
                setActivities(res.data.data?.activities || []);
            } catch {
                setActivities([]);
            } finally {
                setLoadingActivities(false);
            }
        };

        fetchActivities();
    }, [id]);

    // Timer for elapsed time since lead creation
    useEffect(() => {
        if (!lead?.created_at) return;

        const calculateElapsedTime = () => {
            const createdDate = new Date(lead.created_at);
            const now = new Date();
            const diff = now.getTime() - createdDate.getTime();

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            let timeStr = '';
            if (days > 0) timeStr += `${days} ngày `;
            if (hours > 0 || days > 0) timeStr += `${hours.toString().padStart(2, '0')}:`;
            timeStr += `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            setElapsedTime(timeStr);
        };

        calculateElapsedTime();
        const interval = setInterval(calculateElapsedTime, 1000);

        return () => clearInterval(interval);
    }, [lead?.created_at]);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                    <p className="mt-4 text-muted-foreground">Đang tải thông tin lead...</p>
                </div>
            </div>
        );
    }

    if (error || !lead) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Card className="max-w-md w-full text-center">
                    <CardContent className="pt-6">
                        <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                            <User className="h-8 w-8 text-red-600" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Không tìm thấy Lead</h2>
                        <p className="text-muted-foreground mb-4">{error || 'Lead không tồn tại hoặc đã bị xóa'}</p>
                        <Button onClick={() => navigate('/leads')}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Quay lại
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const column = kanbanColumns.find(c => c.id === (lead.pipeline_stage || lead.status)) || kanbanColumns[0];

    const handleCallPhone = () => {
        window.location.href = `tel:${lead.phone}`;
    };

    const handleCopyPhone = async () => {
        try {
            await navigator.clipboard.writeText(lead.phone);
            setPhoneCopied(true);
            setTimeout(() => setPhoneCopied(false), 2000);
            toast.success('Đã copy số điện thoại');
        } catch {
            toast.error('Không thể copy số điện thoại');
        }
    };

    const handleZaloClick = () => {
        const phone = lead.phone.replace(/^0/, '84');
        window.open(`https://zalo.me/${phone}`, '_blank');
    };

    const handleCopyEmail = async () => {
        if (lead.email) {
            try {
                await navigator.clipboard.writeText(lead.email);
                setEmailCopied(true);
                setTimeout(() => setEmailCopied(false), 2000);
                toast.success('Đã copy email');
            } catch {
                toast.error('Không thể copy email');
            }
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        setIsSaving(true);
        try {
            await updateLead(lead.id, { status: newStatus, pipeline_stage: newStatus });
            setSelectedStatus(newStatus);
            setLead(prev => prev ? { ...prev, status: newStatus, pipeline_stage: newStatus } : null);
            toast.success('Đã cập nhật trạng thái');

            // Refresh activities to show status change
            const res = await leadsApi.getActivities(lead.id);
            setActivities(res.data.data?.activities || []);
        } catch {
            toast.error('Lỗi khi cập nhật trạng thái');
        } finally {
            setIsSaving(false);
        }
    };

    const handleConvert = async () => {
        if (confirm(`Xác nhận chuyển đổi ${lead.name} thành khách hàng?`)) {
            try {
                await convertLead(lead.id);
                toast.success(`Đã chuyển đổi ${lead.name} thành khách hàng!`);
                await fetchLeads();
                navigate('/leads');
            } catch {
                toast.error('Lỗi khi chuyển đổi lead');
            }
        }
    };

    const handleAddNote = async () => {
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
    };

    const handleSaveInfo = async () => {
        setIsSaving(true);
        try {
            const updateData: Partial<Lead> = {
                fb_link: editFbLink || undefined,
                fb_profile_name: editFbName || undefined,
                next_followup_time: editNextFollowup ? new Date(editNextFollowup).toISOString() : undefined,
                appointment_time: editAppointment ? new Date(editAppointment).toISOString() : undefined,
            };

            await updateLead(lead.id, updateData);

            // Update local state
            setLead(prev => prev ? { ...prev, ...updateData } : null);
            setIsEditingInfo(false);
            toast.success('Đã cập nhật thông tin');
        } catch {
            toast.error('Lỗi khi cập nhật thông tin');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/leads')} className="self-start">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-4">
                    <Avatar className="h-14 w-14 shrink-0">
                        <AvatarFallback className={`${column.color} text-white text-xl font-semibold`}>
                            {lead.name.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h1 className="text-2xl font-bold">{lead.name}</h1>
                            <Badge className={`${column.bgColor} ${column.textColor}`}>
                                {column.label}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <p className="text-muted-foreground">{lead.phone}</p>
                            {elapsedTime && (
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                                    <Timer className="h-4 w-4" />
                                    <span>{elapsedTime}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {/* Quick Actions */}
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={handleCallPhone}>
                        <Phone className="h-4 w-4 mr-2" />
                        Gọi điện
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleZaloClick}>
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Zalo
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => {
                            // Navigate to create order with lead info
                            const params = new URLSearchParams({
                                lead_id: lead.id,
                                lead_name: lead.name,
                                lead_phone: lead.phone,
                                lead_email: lead.email || '',
                            });
                            navigate(`/orders/new?${params.toString()}`);
                        }}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        <ShoppingBag className="h-4 w-4 mr-2" />
                        Tạo đơn hàng
                    </Button>
                </div>
            </div>

            {/* Main Content - 2 Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left Column - Lead Info (40%) */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Contact Info Card */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" />
                                Thông tin liên hệ
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Phone */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-100">
                                        <Phone className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Số điện thoại</p>
                                        <p className="font-medium">{lead.phone}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyPhone}>
                                    {phoneCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>

                            {/* Email */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-purple-100">
                                        <Mail className="h-4 w-4 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Email</p>
                                        <p className="font-medium">{lead.email || '-'}</p>
                                    </div>
                                </div>
                                {lead.email && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyEmail}>
                                        {emailCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                )}
                            </div>

                            {/* Company */}
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-100">
                                    <Building className="h-4 w-4 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Công ty</p>
                                    <p className="font-medium">{lead.company || '-'}</p>
                                </div>
                            </div>

                            {/* Source */}
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-green-100">
                                    <Tag className="h-4 w-4 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Nguồn/Kênh</p>
                                    <p className="font-medium">
                                        {sourceLabels[lead.channel || lead.source || '']?.label || lead.channel || lead.source || '-'}
                                    </p>
                                </div>
                            </div>

                            {/* Assigned User */}
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-indigo-100">
                                    <UserCheck className="h-4 w-4 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Nhân viên phụ trách</p>
                                    <p className="font-medium">{lead.assigned_user?.name || '-'}</p>
                                </div>
                            </div>

                            {/* Created Date */}
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-100">
                                    <Calendar className="h-4 w-4 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Ngày tạo</p>
                                    <p className="font-medium">{formatDateTime(lead.created_at)}</p>
                                </div>
                            </div>

                            {/* Facebook Link */}
                            {(lead.fb_link || lead.link_message) && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-blue-100">
                                            <Facebook className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Link Facebook</p>
                                            <p className="font-medium text-sm truncate max-w-[180px]">
                                                {lead.fb_profile_name || 'Xem profile'}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => window.open(lead.fb_link || lead.link_message, '_blank')}
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {/* Last Message Time */}
                            {lead.last_message_time && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-cyan-100">
                                        <MessageCircle className="h-4 w-4 text-cyan-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Tin nhắn cuối</p>
                                        <p className="font-medium">{formatDateTime(lead.last_message_time)}</p>
                                        {lead.last_actor && (
                                            <p className="text-xs text-muted-foreground">
                                                {lead.last_actor === 'lead' ? 'Từ khách' : 'Từ sale'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Next Follow-up Time */}
                            {lead.next_followup_time && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-orange-100">
                                        <CalendarClock className="h-4 w-4 text-orange-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Hẹn liên hệ tiếp</p>
                                        <p className="font-medium">{formatDateTime(lead.next_followup_time)}</p>
                                    </div>
                                </div>
                            )}

                            {/* Appointment Time */}
                            {lead.appointment_time && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-pink-100">
                                        <CalendarClock className="h-4 w-4 text-pink-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Hẹn lịch chăm sóc</p>
                                        <p className="font-medium">{formatDateTime(lead.appointment_time)}</p>
                                    </div>
                                </div>
                            )}

                            {/* Owner Sale */}
                            {lead.owner_sale && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-violet-100">
                                        <UserCheck className="h-4 w-4 text-violet-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Sale chăm sóc</p>
                                        <p className="font-medium">{lead.owner_sale}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Status Update Card */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                Cập nhật trạng thái
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Select value={selectedStatus} onValueChange={handleStatusChange} disabled={isSaving}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {kanbanColumns.map(col => (
                                        <SelectItem key={col.id} value={col.id}>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${col.color}`} />
                                                {col.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    {/* Edit Info Card */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Facebook className="h-4 w-4 text-blue-600" />
                                    Chăm sóc & Theo dõi
                                </CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsEditingInfo(!isEditingInfo)}
                                    className="text-xs"
                                >
                                    {isEditingInfo ? 'Hủy' : 'Chỉnh sửa'}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {/* Facebook Link */}
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Link Facebook</Label>
                                {isEditingInfo ? (
                                    <Input
                                        value={editFbLink}
                                        onChange={(e) => setEditFbLink(e.target.value)}
                                        placeholder="https://facebook.com/..."
                                        className="h-9"
                                    />
                                ) : (
                                    <p className="text-sm font-medium truncate">
                                        {lead.fb_link || lead.link_message || '-'}
                                    </p>
                                )}
                            </div>

                            {/* FB Profile Name */}
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Tên Facebook</Label>
                                {isEditingInfo ? (
                                    <Input
                                        value={editFbName}
                                        onChange={(e) => setEditFbName(e.target.value)}
                                        placeholder="Tên profile"
                                        className="h-9"
                                    />
                                ) : (
                                    <p className="text-sm font-medium">{lead.fb_profile_name || '-'}</p>
                                )}
                            </div>

                            {/* Next Follow-up */}
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Hẹn liên hệ tiếp</Label>
                                {isEditingInfo ? (
                                    <Input
                                        type="datetime-local"
                                        value={editNextFollowup}
                                        onChange={(e) => setEditNextFollowup(e.target.value)}
                                        className="h-9"
                                    />
                                ) : (
                                    <p className="text-sm font-medium">
                                        {lead.next_followup_time ? formatDateTime(lead.next_followup_time) : '-'}
                                    </p>
                                )}
                            </div>

                            {/* Appointment Time */}
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Hẹn lịch chăm sóc</Label>
                                {isEditingInfo ? (
                                    <Input
                                        type="datetime-local"
                                        value={editAppointment}
                                        onChange={(e) => setEditAppointment(e.target.value)}
                                        className="h-9"
                                    />
                                ) : (
                                    <p className="text-sm font-medium">
                                        {lead.appointment_time ? formatDateTime(lead.appointment_time) : '-'}
                                    </p>
                                )}
                            </div>

                            {/* Save Button */}
                            {isEditingInfo && (
                                <Button
                                    className="w-full mt-2"
                                    onClick={handleSaveInfo}
                                    disabled={isSaving}
                                >
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Lưu thông tin
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    {/* Add Note Card */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-primary" />
                                Thêm ghi chú
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <textarea
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    placeholder="Nhập ghi chú mới..."
                                    className="w-full min-h-24 px-3 py-2 text-sm rounded-lg border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                                />
                                <Button
                                    className="w-full"
                                    disabled={!newNote.trim() || isSaving}
                                    onClick={handleAddNote}
                                >
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Thêm ghi chú
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Activity Timeline (60%) */}
                <div className="lg:col-span-3">
                    <Card className="h-full">
                        <CardHeader className="pb-3 border-b sticky top-0 bg-card z-10">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Clock className="h-4 w-4 text-primary" />
                                Lịch sử hoạt động
                                {activities.length > 0 && (
                                    <Badge variant="secondary" className="ml-2">
                                        {activities.length}
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
                                {loadingActivities ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : activities.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                            <Clock className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <h3 className="font-medium mb-1">Chưa có hoạt động</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Các hoạt động sẽ được ghi lại khi bạn tương tác với lead này
                                        </p>
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {activities.map((activity, index) => (
                                            <div
                                                key={activity.id}
                                                className="p-4 hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="flex gap-4">
                                                    {/* Timeline indicator */}
                                                    <div className="relative flex flex-col items-center">
                                                        <div className={`w-3 h-3 rounded-full shrink-0 ${activity.activity_type === 'status_change'
                                                            ? 'bg-blue-500'
                                                            : 'bg-green-500'
                                                            }`} />
                                                        {index < activities.length - 1 && (
                                                            <div className="w-0.5 h-full bg-border absolute top-4" />
                                                        )}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0 pb-2">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-medium text-primary">
                                                                {formatDateTime(activity.created_at)}
                                                            </span>
                                                            <Badge variant="outline" className="text-xs">
                                                                {activity.activity_type === 'status_change' ? 'Đổi trạng thái' : 'Ghi chú'}
                                                            </Badge>
                                                        </div>

                                                        {activity.activity_type === 'status_change' ? (
                                                            <div className="space-y-2">
                                                                <p className="text-sm">
                                                                    <span className="font-medium">{activity.created_by_name || 'Hệ thống'}</span>
                                                                    <span className="text-muted-foreground"> đã chuyển trạng thái</span>
                                                                </p>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {getStatusLabel(activity.old_status)}
                                                                    </Badge>
                                                                    <span className="text-muted-foreground">→</span>
                                                                    <Badge className="text-xs">
                                                                        {getStatusLabel(activity.new_status)}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <p className="text-sm font-medium">
                                                                    {activity.created_by_name || 'Ẩn danh'}
                                                                </p>
                                                                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                                                                    {activity.content}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
