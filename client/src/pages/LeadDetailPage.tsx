import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Phone, MessageCircle, Copy, Check, ArrowRightLeft,
    Loader2, User, Building, Calendar, Tag, UserCheck, Mail,
    Clock, MessageSquare, TrendingUp, Timer, Facebook, ExternalLink, CalendarClock,
    ShoppingBag, Globe, Zap, AlertTriangle, Flame,
    Image as ImageIcon,
    Smile,
    Paperclip,
    X,
    Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { leadsApi } from '@/lib/api';
import { uploadFile } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils';
import type { Lead } from '@/hooks/useLeads';
import { useLeads } from '@/hooks/useLeads';
import { kanbanColumns, sourceLabels, getStatusLabel } from '@/components/leads/constants';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

export function LeadDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { updateLead, convertLead, deleteLead, fetchLeads } = useLeads();
    const { user } = useAuth();

    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [newNote, setNewNote] = useState('');
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [showMediaPicker, setShowMediaPicker] = useState(false);
    const [pickerTab, setPickerTab] = useState<'emoji' | 'sticker'>('emoji');
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    useEffect(() => {
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

    const handleDelete = async () => {
        if (confirm(`Bạn có chắc chắn muốn xóa lead "${lead.name}"? Hành động này không thể hoàn tác.`)) {
            setIsSaving(true);
            try {
                await deleteLead(lead.id);
                toast.success('Đã xóa lead thành công');
                navigate('/leads');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Lỗi khi xóa lead';
                toast.error(message);
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Vui lòng chọn file hình ảnh');
            return;
        }

        setUploadingImage(true);
        try {
            const { url, error } = await uploadFile('products', `leads/notes/${lead!.id}`, file);
            if (error) {
                toast.error('Lỗi khi tải lên hình ảnh');
                return;
            }
            setSelectedImageUrl(url);
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleAddNote = async () => {
        if (!id || (!newNote.trim() && !selectedImageUrl)) return;

        setIsSaving(true);
        try {
            const metadata: any = {};
            if (selectedImageUrl) {
                metadata.image_url = selectedImageUrl;
            }

            await leadsApi.addActivity(id, {
                activity_type: 'note',
                content: newNote.trim() || (selectedImageUrl ? 'Đã gửi một ảnh' : 'Ghi chú'),
                metadata
            });

            setNewNote('');
            setSelectedImageUrl(null);
            fetchActivities();
            toast.success('Đã thêm ghi chú');
        } catch (err) {
            toast.error('Lỗi khi thêm ghi chú');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddSticker = async (sticker: string) => {
        if (!id) return;

        setIsSaving(true);
        try {
            await leadsApi.addActivity(id, {
                activity_type: 'note',
                content: 'Đã gửi một sticker',
                metadata: { sticker_id: sticker }
            });

            setShowMediaPicker(false);
            fetchActivities();
            toast.success('Đã gửi sticker');
        } catch (err) {
            toast.error('Lỗi khi gửi sticker');
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
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-start gap-3 flex-1">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/leads')} className="-ml-2 shrink-0">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3 sm:gap-4 flex-1">
                        <Avatar className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 border-2 border-slate-100">
                            {lead.fb_profile_pic ? (
                                <AvatarImage src={lead.fb_profile_pic} alt={lead.name} className="object-cover" />
                            ) : null}
                            <AvatarFallback className={`${column.color} text-white text-lg sm:text-xl font-semibold`}>
                                {lead.name.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h1 className="text-xl sm:text-2xl font-bold truncate pr-2">{lead.name}</h1>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <p className="text-muted-foreground text-sm sm:text-base">{lead.phone}</p>
                                {elapsedTime && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 sm:py-1 bg-orange-100 text-orange-700 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap">
                                        <Timer className="h-3.5 w-3.5" />
                                        <span>{elapsedTime}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                    <Select value={selectedStatus} onValueChange={handleStatusChange} disabled={isSaving}>
                        <SelectTrigger className="h-9 w-auto min-w-[150px] bg-white border-slate-200 shadow-sm transition-all hover:border-slate-300">
                            <div className="flex items-center gap-2 pr-1">
                                <div className={`w-2 h-2 rounded-full ${column.color} shadow-sm`} />
                                <span className="text-xs font-semibold uppercase tracking-wider">{column.label}</span>
                            </div>
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
                    <Button variant="outline" size="sm" onClick={handleCallPhone} className="flex-1 sm:flex-none">
                        <Phone className="h-4 w-4 mr-2" />
                        Gọi điện
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleZaloClick} className="flex-1 sm:flex-none">
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
                        className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none whitespace-nowrap"
                    >
                        <ShoppingBag className="h-4 w-4 mr-2" />
                        Tạo đơn
                    </Button>
                    {(user?.role === 'admin' || user?.role === 'manager') && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDelete}
                            className="flex-1 sm:flex-none"
                            disabled={isSaving}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Xóa Lead
                        </Button>
                    )}
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
                                <div className="flex-1">
                                    <p className="text-xs text-muted-foreground">Ngày tạo</p>
                                    <p className="font-medium">{formatDateTime(lead.created_at)}</p>
                                </div>
                            </div>

                            {/* Date of Birth */}
                            {lead.dob && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-red-50 text-red-600">
                                        <Calendar className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs text-muted-foreground">Ngày sinh</p>
                                        <p className="font-medium">{new Date(lead.dob).toLocaleDateString('vi-VN')}</p>
                                    </div>
                                </div>
                            )}

                            {/* Address */}
                            {lead.address && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-slate-100">
                                        <Globe className="h-4 w-4 text-slate-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-muted-foreground">Địa chỉ</p>
                                        <p className="font-medium text-sm leading-snug">{lead.address}</p>
                                    </div>
                                </div>
                            )}

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
 
                    {/* AI Analysis Card */}
                    {(lead.lead_score !== undefined || lead.loss_risk || lead.next_action || lead.customer_insight) && (
                        <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white overflow-hidden shadow-sm">
                            <CardHeader className="pb-3 border-b border-indigo-50 bg-indigo-50/30">
                                <CardTitle className="text-xs font-extrabold flex items-center justify-between text-indigo-800 uppercase tracking-wider">
                                    <div className="flex items-center gap-2">
                                        <Zap className="h-4 w-4 fill-indigo-500 text-indigo-500" />
                                        Phân tích AI từ n8n
                                    </div>
                                    {lead.lead_score !== undefined && lead.lead_score >= 80 && (
                                        <Badge className="bg-red-500 hover:bg-red-600 animate-pulse border-none text-[10px]">🔥 HOT LEAD</Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Lead Heat Score */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                            <TrendingUp className="h-3 w-3" />
                                            Lead Heat Score
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex items-center justify-center">
                                                <Flame className={`h-8 w-8 ${
                                                    (lead.lead_score || 0) >= 80 ? 'text-red-500 fill-red-500 animate-bounce' :
                                                    (lead.lead_score || 0) >= 60 ? 'text-orange-500 fill-orange-500' :
                                                    'text-blue-400 fill-blue-500/20'
                                                }`} />
                                                <span className="absolute text-[10px] font-black text-white p-1">
                                                    {lead.lead_score || 0}
                                                </span>
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full transition-all duration-1000 ${
                                                            (lead.lead_score || 0) >= 80 ? 'bg-red-500' :
                                                            (lead.lead_score || 0) >= 60 ? 'bg-orange-500' :
                                                            'bg-blue-400'
                                                        }`}
                                                        style={{ width: `${lead.lead_score || 0}%` }}
                                                    />
                                                </div>
                                                <p className={`text-[10px] font-bold ${
                                                    (lead.lead_score || 0) >= 80 ? 'text-red-600' :
                                                    (lead.lead_score || 0) >= 60 ? 'text-orange-600' :
                                                    'text-blue-600'
                                                }`}>
                                                    {(lead.lead_score || 0) >= 80 ? 'Rất tiềm năng' :
                                                     (lead.lead_score || 0) >= 60 ? 'Tiềm năng trung bình' :
                                                     'Cần nuôi dưỡng thêm'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Loss Risk */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            Nguy cơ rớt khách
                                        </p>
                                        <div className="pt-1">
                                            {lead.loss_risk?.toLowerCase() === 'high' ? (
                                                <div className="bg-red-600 text-white text-[10px] font-black px-2 py-1.5 rounded shadow-lg animate-pulse flex items-center gap-1 w-fit rotate-[-2deg]">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    NGUY CƠ RỚT KHÁCH
                                                </div>
                                            ) : lead.loss_risk?.toLowerCase() === 'medium' ? (
                                                <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">Trung bình</Badge>
                                            ) : (
                                                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 text-[10px]">Rủi ro thấp</Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Next Best Action */}
                                {lead.next_action && (
                                    <div className="p-3 bg-white border-2 border-dashed border-indigo-200 rounded-xl relative overflow-hidden group hover:border-indigo-400 transition-colors shadow-sm">
                                        <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Zap className="h-10 w-10 text-indigo-400" />
                                        </div>
                                        <p className="text-[11px] font-black text-indigo-700 mb-1.5 flex items-center gap-1 uppercase tracking-tighter">
                                            <ArrowRightLeft className="h-3 w-3" />
                                            Gợi ý hành động:
                                        </p>
                                        <p className="text-sm font-bold text-slate-800 leading-relaxed pl-1">
                                            {lead.next_action}
                                        </p>
                                    </div>
                                )}

                                {/* AI Memory (Customer Insight) */}
                                {lead.customer_insight && (
                                    <div className="space-y-2 pt-1 border-t border-indigo-50">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                            <Globe className="h-3 w-3 text-indigo-500" />
                                            Trí nhớ AI (Customer Insight)
                                        </p>
                                        <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100/50">
                                            <p className="text-xs text-amber-900 leading-relaxed whitespace-pre-wrap font-medium">
                                                {lead.customer_insight}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
 
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
                            <div className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                                <Label className="text-xs text-muted-foreground font-normal shrink-0">Link Facebook</Label>
                                {isEditingInfo ? (
                                    <Input
                                        value={editFbLink}
                                        onChange={(e) => setEditFbLink(e.target.value)}
                                        placeholder="https://facebook.com/..."
                                        className="h-7 text-xs max-w-[200px]"
                                    />
                                ) : (
                                    <p className="text-xs font-medium truncate ml-4 max-w-[200px] text-blue-600">
                                        {lead.fb_link || lead.link_message || '-'}
                                    </p>
                                )}
                            </div>

                            {/* FB Profile Name */}
                            <div className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                                <Label className="text-xs text-muted-foreground font-normal shrink-0">Tên Facebook</Label>
                                {isEditingInfo ? (
                                    <Input
                                        value={editFbName}
                                        onChange={(e) => setEditFbName(e.target.value)}
                                        placeholder="Tên profile"
                                        className="h-7 text-xs max-w-[200px]"
                                    />
                                ) : (
                                    <p className="text-xs font-medium truncate ml-4 max-w-[200px]">{lead.fb_profile_name || '-'}</p>
                                )}
                            </div>

                            {/* FB Thread ID */}
                            <div className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                                <Label className="text-xs text-muted-foreground font-normal shrink-0">Mã hội thoại (Thread ID)</Label>
                                <p className="text-xs font-mono text-slate-500 ml-4 truncate max-w-[200px]">{lead.fb_thread_id || '-'}</p>
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

                    {/* Main Notes Card */}
                    {lead.notes && (
                        <Card className="bg-amber-50/30 border-amber-100">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-900">
                                    <MessageSquare className="h-4 w-4" />
                                    Ghi chú hệ thống
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed italic">
                                    "{lead.notes}"
                                </p>
                            </CardContent>
                        </Card>
                    )}

                </div>

                {/* Right Column - Activity Timeline (60%) */}
                <div className="lg:col-span-3 space-y-4">
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
                                {selectedImageUrl && (
                                    <div className="relative w-24 h-24 rounded-lg overflow-hidden border">
                                        <img src={selectedImageUrl} alt="Selected" className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => setSelectedImageUrl(null)}
                                            className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                )}
                                <div className="relative">
                                    <textarea
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                        placeholder="Nhập ghi chú mới..."
                                        className="w-full min-h-24 px-3 py-2 pb-10 text-sm rounded-lg border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                                    />
                                    <div className="absolute bottom-2 left-2 flex items-center gap-1">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleImageUpload}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploadingImage}
                                        >
                                            {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground"
                                            onClick={() => setShowMediaPicker(!showMediaPicker)}
                                        >
                                            <Smile className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {showMediaPicker && (
                                        <Card className="absolute bottom-full left-0 mb-2 p-0 w-64 shadow-xl z-50 overflow-hidden border-slate-200">
                                            <div className="flex border-b bg-muted/50">
                                                <button
                                                    onClick={() => setPickerTab('emoji')}
                                                    className={`flex-1 py-2 text-xs font-medium transition-colors ${pickerTab === 'emoji' ? 'bg-white text-primary border-b-2 border-primary' : 'text-muted-foreground hover:bg-muted'}`}
                                                >
                                                    Emoji
                                                </button>
                                                <button
                                                    onClick={() => setPickerTab('sticker')}
                                                    className={`flex-1 py-2 text-xs font-medium transition-colors ${pickerTab === 'sticker' ? 'bg-white text-primary border-b-2 border-primary' : 'text-muted-foreground hover:bg-muted'}`}
                                                >
                                                    Stickers
                                                </button>
                                            </div>
                                            <div className="p-2 max-h-48 overflow-y-auto">
                                                {pickerTab === 'emoji' ? (
                                                    <div className="grid grid-cols-6 gap-1">
                                                        {['😊', '👍', '❤️', '🔥', '👏', '🙌', '⭐', '📍', '📞', '💬', '💼', '💰', '✅', '❌', '⏰', '🚀', '🎁', '🎉'].map(emoji => (
                                                            <button
                                                                key={emoji}
                                                                onClick={() => {
                                                                    setNewNote(prev => prev + emoji);
                                                                    setShowMediaPicker(false);
                                                                }}
                                                                className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded text-lg"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-3 gap-2 p-1">
                                                        {['⭐', '🏆', '🚀', '💎', '🎯', '📢', '✅', '🆘', '🎉'].map(sticker => (
                                                            <button
                                                                key={sticker}
                                                                onClick={() => handleAddSticker(sticker)}
                                                                className="w-16 h-16 flex items-center justify-center hover:bg-primary/5 rounded-xl border border-transparent hover:border-primary/20 transition-all text-4xl"
                                                            >
                                                                {sticker}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    )}
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                        className="w-full sm:w-auto min-w-[140px]"
                                        disabled={(!newNote.trim() && !selectedImageUrl) || isSaving || uploadingImage}
                                        onClick={handleAddNote}
                                    >
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                        Thêm ghi chú
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
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
                            <div>
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
                                                        <div className={`w-3 h-3 rounded-full shrink-0 ${activity.activity_type === 'status_change' ? 'bg-blue-500' :
                                                            activity.activity_type === 'lead_created' ? 'bg-orange-500' :
                                                                activity.activity_type === 'owner_assigned' ? 'bg-indigo-500' :
                                                                    activity.activity_type === 'customer_message' ? 'bg-cyan-500' :
                                                                        activity.activity_type === 'sale_reply' ? 'bg-emerald-500' :
                                                                            activity.activity_type === 'ai_suggestion' ? 'bg-purple-500' :
                                                                                'bg-green-500'
                                                            }`} />
                                                        {index < activities.length - 1 && (
                                                            <div className="w-0.5 h-full bg-border absolute top-4" />
                                                        )}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0 pb-2">
                                                        {(activity.activity_type === 'status_change' ||
                                                            activity.activity_type === 'lead_created' ||
                                                            activity.activity_type === 'owner_assigned' ||
                                                            activity.activity_type === 'customer_message' ||
                                                            activity.activity_type === 'sale_reply' ||
                                                            activity.activity_type === 'ai_suggestion') ? (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-xs font-medium text-primary">
                                                                        {formatDateTime(activity.created_at)}
                                                                    </span>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={`text-[10px] h-4 leading-none uppercase ${activity.activity_type === 'lead_created' ? 'border-orange-200 text-orange-700 bg-orange-50' :
                                                                            activity.activity_type === 'owner_assigned' ? 'border-indigo-200 text-indigo-700 bg-indigo-50' :
                                                                                activity.activity_type === 'customer_message' ? 'border-cyan-200 text-cyan-700 bg-cyan-50' :
                                                                                    activity.activity_type === 'sale_reply' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                                                                                        activity.activity_type === 'ai_suggestion' ? 'border-purple-200 text-purple-700 bg-purple-50 font-bold' :
                                                                                            'border-blue-200 text-blue-700 bg-blue-50'
                                                                            }`}
                                                                    >
                                                                        {activity.activity_type === 'lead_created' ? 'Tạo Lead' :
                                                                            activity.activity_type === 'owner_assigned' ? 'Gán Sale' :
                                                                                activity.activity_type === 'customer_message' ? 'Khách nhắn' :
                                                                                    activity.activity_type === 'sale_reply' ? 'Sale trả lời' :
                                                                                        activity.activity_type === 'ai_suggestion' ? '✨ Gợi ý AI' :
                                                                                            'Đổi trạng thái'
                                                                        }
                                                                    </Badge>
                                                                </div>

                                                                {activity.activity_type === 'status_change' ? (
                                                                    <>
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
                                                                    </>
                                                                ) : (
                                                                    <div className={`rounded-lg py-2 px-3 border ${activity.activity_type === 'ai_suggestion' ? 'bg-purple-50/50 border-purple-100 italic shadow-sm' : 'bg-muted/30 border-muted/50'}`}>
                                                                        {activity.activity_type === 'ai_suggestion' && lead.next_action && (
                                                                            <div className="mb-2 pb-2 border-b border-purple-100 flex items-center gap-2 not-italic">
                                                                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100">
                                                                                    <Zap className="h-3 w-3 text-purple-600 fill-purple-600" />
                                                                                </div>
                                                                                <p className="text-xs font-bold text-slate-800">
                                                                                    <span className="text-purple-700 uppercase tracking-tighter mr-1">Gợi ý hành động:</span> 
                                                                                    {lead.next_action}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                        <p className="text-sm font-medium mb-1">
                                                                            {activity.created_by_name || (activity.activity_type === 'customer_message' ? 'Khách hàng' : (activity.activity_type === 'ai_suggestion' ? 'AI Assistant' : 'Hệ thống'))}
                                                                        </p>
                                                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                                                            {activity.content}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-semibold text-sm">
                                                                        {activity.created_by_name || 'Ẩn danh'}
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {format(new Date(activity.created_at), 'HH:mm dd/MM/yyyy')}
                                                                    </span>
                                                                </div>
                                                                <div className="text-sm bg-muted/30 rounded-lg py-2 px-3 border border-muted/50">
                                                                    <p className={`text-sm whitespace-pre-wrap ${activity.metadata?.sticker_id ? 'text-4xl py-2' : 'text-muted-foreground'}`}>
                                                                        {activity.metadata?.sticker_id || activity.content}
                                                                    </p>
                                                                    {activity.metadata?.image_url && (
                                                                        <div className="mt-2 group relative w-fit max-w-full">
                                                                            <img
                                                                                src={activity.metadata.image_url}
                                                                                alt="Activity"
                                                                                className="max-h-48 w-auto min-w-[120px] rounded-lg border shadow-sm cursor-zoom-in hover:opacity-95 transition-all object-cover"
                                                                                onClick={() => setImagePreviewUrl(activity.metadata.image_url)}
                                                                            />
                                                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                <Button
                                                                                    size="icon"
                                                                                    variant="secondary"
                                                                                    className="h-8 w-8 rounded-full shadow-lg bg-white/80 backdrop-blur-sm hover:bg-white"
                                                                                    onClick={() => setImagePreviewUrl(activity.metadata.image_url)}
                                                                                >
                                                                                    <ExternalLink className="h-4 w-4" />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
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

            {/* Image Preview Dialog */}
            <Dialog open={!!imagePreviewUrl} onOpenChange={(open: boolean) => !open && setImagePreviewUrl(null)}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/90 border-none">
                    <div className="relative w-full h-full min-h-[50vh] flex items-center justify-center p-4">
                        <img
                            src={imagePreviewUrl || ''}
                            alt="Full Screen Preview"
                            className="max-w-full max-h-[85vh] object-contain rounded-sm"
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full"
                            onClick={() => setImagePreviewUrl(null)}
                        >
                            <X className="h-6 w-6" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
