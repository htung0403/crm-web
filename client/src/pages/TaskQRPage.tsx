import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Wrench,
    Clock,
    CheckCircle2,
    PlayCircle,
    User,
    Phone,
    MapPin,
    Package,
    Calendar,
    Timer,
    ArrowLeft,
    Loader2,
    AlertCircle,
    QrCode,
    Pause,
    StopCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { orderItemsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface WorkflowStep {
    id: string;
    step_name: string;
    step_order: number;
    status: string;
    started_at?: string;
    completed_at?: string;
}

interface TaskData {
    id: string;
    type?: 'task' | 'order_item' | 'v2_service' | 'workflow_step';
    item_code: string;
    task_code?: string;
    service_name: string;
    quantity: number;
    unit_price?: number;
    total_price?: number;
    item_type?: string;
    status: string;
    priority?: string;
    scheduled_date?: string;
    scheduled_time?: string;
    started_at?: string;
    completed_at?: string;
    duration_minutes?: number;
    notes?: string;
    order?: {
        id?: string;
        order_code: string;
        status?: string;
        customer?: {
            name: string;
            phone: string;
            address: string;
        };
    };
    service?: {
        name: string;
        price: number;
        duration?: number;
    };
    technician?: {
        id: string;
        name: string;
        phone: string;
        avatar?: string;
    };
    technicians?: Array<{
        technician_id: string;
        technician?: {
            id: string;
            name: string;
            avatar?: string;
            phone?: string;
        };
        commission?: number;
    }>;
    customer?: {
        name: string;
        phone: string;
        address: string;
    };
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    not_assigned: { label: 'Chưa phân công', color: 'bg-gray-100 text-gray-800', icon: <Clock className="h-4 w-4" /> },
    pending: { label: 'Chờ phân công', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-4 w-4" /> },
    assigned: { label: 'Đã phân công', color: 'bg-blue-100 text-blue-800', icon: <User className="h-4 w-4" /> },
    in_progress: { label: 'Đang thực hiện', color: 'bg-purple-100 text-purple-800', icon: <PlayCircle className="h-4 w-4" /> },
    completed: { label: 'Hoàn thành', color: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="h-4 w-4" /> },
    cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-800', icon: <AlertCircle className="h-4 w-4" /> },
};

// Timer Component
function TaskTimer({ startTime, isRunning }: { startTime: Date | null; isRunning: boolean }) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!startTime || !isRunning) return;

        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime, isRunning]);

    useEffect(() => {
        if (startTime) {
            setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
        }
    }, [startTime]);

    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;

    const formatNumber = (n: number) => n.toString().padStart(2, '0');

    return (
        <div className="text-center">
            <div className="flex items-center justify-center gap-1 font-mono text-5xl font-bold text-white">
                <span className="bg-black/30 rounded-lg px-3 py-2">{formatNumber(hours)}</span>
                <span className="animate-pulse">:</span>
                <span className="bg-black/30 rounded-lg px-3 py-2">{formatNumber(minutes)}</span>
                <span className="animate-pulse">:</span>
                <span className="bg-black/30 rounded-lg px-3 py-2">{formatNumber(seconds)}</span>
            </div>
            {isRunning && (
                <div className="flex items-center justify-center gap-2 mt-3 text-white/80">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-sm">Đang thực hiện...</span>
                </div>
            )}
        </div>
    );
}

// Complete Task Dialog
function CompleteTaskDialog({
    open,
    onClose,
    onSubmit,
    loading,
    elapsedMinutes
}: {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: { notes?: string; duration_minutes?: number }) => void;
    loading: boolean;
    elapsedMinutes: number;
}) {
    const [notes, setNotes] = useState('');
    const [duration, setDuration] = useState(elapsedMinutes.toString());

    useEffect(() => {
        if (open) {
            setDuration(elapsedMinutes.toString());
        }
    }, [open, elapsedMinutes]);

    const handleSubmit = () => {
        onSubmit({
            notes: notes || undefined,
            duration_minutes: duration ? parseInt(duration) : elapsedMinutes
        });
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        Hoàn thành công việc
                    </DialogTitle>
                    <DialogDescription>
                        Xác nhận hoàn thành và ghi chú (nếu có)
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Thời gian thực hiện (phút)</Label>
                        <Input
                            type="number"
                            placeholder="Nhập thời gian..."
                            value={duration}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDuration(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Thời gian đã đo: {elapsedMinutes} phút
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label>Ghi chú</Label>
                        <Textarea
                            placeholder="Nhập ghi chú về công việc..."
                            value={notes}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Hủy</Button>
                    <Button onClick={handleSubmit} disabled={loading} className="gap-2 bg-green-600 hover:bg-green-700">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Xác nhận hoàn thành
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function TaskQRPage() {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [task, setTask] = useState<TaskData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [showCompleteDialog, setShowCompleteDialog] = useState(false);
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [steps, setSteps] = useState<WorkflowStep[]>([]);

    useEffect(() => {
        if (code) {
            fetchTask();
        }
    }, [code]);

    // Set start time when task or current step is in progress
    useEffect(() => {
        const stepInProgress = steps.find(s => s.status === 'in_progress');
        if (stepInProgress?.started_at) {
            setStartTime(new Date(stepInProgress.started_at));
        } else if (task?.started_at && task.status === 'in_progress') {
            setStartTime(new Date(task.started_at));
        }
    }, [task?.started_at, task?.status, steps]);

    const fetchTask = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/technician-tasks/by-code/${code}`);
            setTask(response.data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Không tìm thấy mã QR này');
        } finally {
            setLoading(false);
        }
    };

    // Load workflow steps when task is a service (order_item or v2_service) - Option A: by-code returns service, we load steps
    useEffect(() => {
        const loadSteps = async () => {
            if (!task?.id) return;
            const type = task.type || 'order_item';
            if (type !== 'order_item' && type !== 'v2_service') return;
            try {
                const res = await orderItemsApi.getSteps(task.id);
                const data = (res.data?.data as WorkflowStep[]) || [];
                setSteps(Array.isArray(data) ? data : []);
            } catch {
                setSteps([]);
            }
        };
        loadSteps();
    }, [task?.id, task?.type]);

    const handleStartTask = async () => {
        if (!task) return;

        setActionLoading(true);
        try {
            const response = await api.put(`/technician-tasks/${task.id}/start`);
            setTask(prev => prev ? {
                ...prev,
                ...response.data,
                status: 'in_progress',
                started_at: response.data.started_at || new Date().toISOString()
            } : null);
            setStartTime(new Date());
            toast.success('Đã bắt đầu thực hiện công việc');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCompleteTask = async (data: { notes?: string; duration_minutes?: number }) => {
        if (!task) return;

        setActionLoading(true);
        try {
            const response = await api.put(`/technician-tasks/${task.id}/complete`, data);
            setTask(prev => prev ? {
                ...prev,
                ...response.data,
                status: 'completed',
                completed_at: response.data.completed_at || new Date().toISOString()
            } : null);
            setShowCompleteDialog(false);
            toast.success('Đã hoàn thành công việc');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
        } finally {
            setActionLoading(false);
        }
    };

    // Check if current user is the assigned technician (check both single and multiple technicians) – declare before use in canStartStep/canCompleteStep
    const isAssignedTechnician = task?.technician?.id === user?.id ||
        (task?.technicians?.some(t => t.technician?.id === user?.id || t.technician_id === user?.id) ?? false);

    // Workflow step mode: current step (first pending/assigned or in_progress)
    const currentStep = steps.length > 0
        ? steps.find(s => s.status === 'in_progress') || steps.find(s => s.status === 'pending' || s.status === 'assigned')
        : null;
    const hasSteps = steps.length > 0;
    const allStepsCompleted = hasSteps && steps.every(s => s.status === 'completed' || s.status === 'skipped');
    const canStartStep = currentStep && (currentStep.status === 'pending' || currentStep.status === 'assigned') && isAssignedTechnician;
    const canCompleteStep = currentStep && currentStep.status === 'in_progress' && isAssignedTechnician;

    const handleStartStep = async () => {
        if (!currentStep) return;
        setActionLoading(true);
        try {
            await orderItemsApi.startStep(currentStep.id);
            const res = await orderItemsApi.getSteps(task!.id);
            const data = (res.data?.data as WorkflowStep[]) || [];
            setSteps(Array.isArray(data) ? data : []);
            setStartTime(new Date());
            toast.success('Đã bắt đầu bước');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Không thể bắt đầu bước');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCompleteStep = async (payload: { notes?: string; duration_minutes?: number }) => {
        if (!currentStep) return;
        setActionLoading(true);
        try {
            await orderItemsApi.completeStep(currentStep.id, payload.notes);
            const res = await orderItemsApi.getSteps(task!.id);
            const nextSteps = (res.data?.data as WorkflowStep[]) || [];
            setSteps(Array.isArray(nextSteps) ? nextSteps : []);
            setShowCompleteDialog(false);
            if (nextSteps.length > 0 && nextSteps.every((s: WorkflowStep) => s.status === 'completed' || s.status === 'skipped')) {
                toast.success('Đã hoàn thành tất cả bước');
            } else {
                toast.success('Đã hoàn thành bước. Chuyển sang bước tiếp theo.');
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Không thể hoàn thành bước');
        } finally {
            setActionLoading(false);
        }
    };

    // Calculate elapsed minutes
    const getElapsedMinutes = useCallback(() => {
        if (!startTime) return 0;
        return Math.floor((Date.now() - startTime.getTime()) / 60000);
    }, [startTime]);

    const canStartTask = !hasSteps && task?.status === 'assigned' && isAssignedTechnician;
    const canCompleteTask = !hasSteps && task?.status === 'in_progress' && isAssignedTechnician;
    const isInProgress = hasSteps ? (currentStep?.status === 'in_progress') : (task?.status === 'in_progress');

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Đang tải thông tin...</p>
                </div>
            </div>
        );
    }

    if (error || !task) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="p-6 text-center">
                        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Không tìm thấy</h2>
                        <p className="text-muted-foreground mb-4">{error || 'Mã QR không hợp lệ hoặc đã hết hạn'}</p>
                        <div className="flex gap-2">
                            <Button onClick={() => navigate('/scan')} className="flex-1 gap-2">
                                <QrCode className="h-4 w-4" />
                                Quét lại
                            </Button>
                            <Button variant="outline" onClick={() => navigate(-1)} className="flex-1 gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                Quay lại
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const status = statusConfig[task.status] || statusConfig.pending;
    const customerInfo = task.customer || task.order?.customer;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
            {/* Timer Section - Show when in progress */}
            {isInProgress && (
                <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 p-6 pb-8">
                    <div className="max-w-lg mx-auto">
                        <div className="flex items-center justify-between mb-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(-1)}
                                className="text-white hover:bg-white/20"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <Badge className="bg-white/20 text-white border-0">
                                <Timer className="h-3 w-3 mr-1" />
                                Đang thực hiện
                            </Badge>
                        </div>

                        <TaskTimer startTime={startTime} isRunning={isInProgress} />

                        <div className="mt-6 text-center text-white">
                            <p className="font-semibold text-lg">{task.service_name}</p>
                            <p className="text-white/70 text-sm">
                                {task.order?.order_code} • SL: {task.quantity}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className={`p-4 ${isInProgress ? '-mt-4' : ''}`}>
                <div className="max-w-lg mx-auto space-y-4">
                    {/* Header - Only show when NOT in progress */}
                    {!isInProgress && (
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <QrCode className="h-5 w-5 text-primary" />
                                    <span className="font-mono text-sm text-muted-foreground">{task.item_code}</span>
                                </div>
                                {task.task_code && (
                                    <p className="text-xs text-muted-foreground">Mã công việc: {task.task_code}</p>
                                )}
                            </div>
                            <Badge className={`${status.color} gap-1`}>
                                {status.icon}
                                {status.label}
                            </Badge>
                        </div>
                    )}

                    {/* Service Info Card */}
                    <Card className="overflow-hidden">
                        {!isInProgress && (
                            <div className="bg-gradient-to-r from-primary to-blue-600 p-4 text-white">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-white/20 rounded-lg">
                                        <Wrench className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-lg font-bold">{task.service_name}</h2>
                                        <p className="text-white/80 text-sm">
                                            Số lượng: {task.quantity} {task.service?.duration && `• ${task.service.duration} phút/lần`}
                                        </p>
                                    </div>
                                </div>
                                {task.order && (
                                    <div className="mt-3 pt-3 border-t border-white/20 flex items-center gap-2">
                                        <Package className="h-4 w-4" />
                                        <span className="text-sm">Đơn hàng: {task.order.order_code}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <CardContent className="p-4 space-y-4">
                            {/* Basic Info - Always visible */}
                            {isInProgress && (
                                <div className="space-y-3">
                                    {/* Order Info */}
                                    {task.order && (
                                        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50">
                                            <Package className="h-5 w-5 text-blue-600" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">Đơn hàng</p>
                                                <p className="font-semibold">{task.order.order_code}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Price Info - Also show when in progress */}
                                    {task.total_price && (
                                        <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-50">
                                            <span className="font-medium">Giá trị dịch vụ</span>
                                            <span className="text-lg font-bold text-emerald-600">
                                                {formatCurrency(task.total_price)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Customer Info */}
                            {customerInfo && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-sm text-muted-foreground uppercase">Thông tin khách hàng</h4>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            <span>{customerInfo.name}</span>
                                        </div>
                                        {customerInfo.phone && (
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                <a href={`tel:${customerInfo.phone}`} className="text-primary hover:underline">
                                                    {customerInfo.phone}
                                                </a>
                                            </div>
                                        )}
                                        {customerInfo.address && (
                                            <div className="flex items-start gap-2">
                                                <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                                                <span className="text-sm">{customerInfo.address}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Technician Info - Support multiple technicians */}
                            {(task.technicians && task.technicians.length > 0 || task.technician) && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-sm text-muted-foreground uppercase">Kỹ thuật viên phụ trách</h4>
                                    <div className="space-y-2">
                                        {/* Display multiple technicians from junction table */}
                                        {task.technicians && task.technicians.length > 0 ? (
                                            task.technicians.map((t, idx) => {
                                                const tech = t.technician;
                                                if (!tech) return null;
                                                const isCurrentUser = tech.id === user?.id;
                                                return (
                                                    <div key={t.technician_id || idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                                        <Avatar className="h-10 w-10">
                                                            <AvatarImage src={tech.avatar} />
                                                            <AvatarFallback>{tech.name?.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">{tech.name}</p>
                                                            {tech.phone && (
                                                                <a href={`tel:${tech.phone}`} className="text-sm text-primary hover:underline">
                                                                    {tech.phone}
                                                                </a>
                                                            )}
                                                        </div>
                                                        {isCurrentUser && (
                                                            <Badge className="ml-auto bg-green-100 text-green-700">Bạn</Badge>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : task.technician ? (
                                            // Fallback to single technician
                                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                                <Avatar className="h-10 w-10">
                                                    <AvatarImage src={task.technician.avatar} />
                                                    <AvatarFallback>{task.technician.name?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{task.technician.name}</p>
                                                    {task.technician.phone && (
                                                        <a href={`tel:${task.technician.phone}`} className="text-sm text-primary hover:underline">
                                                            {task.technician.phone}
                                                        </a>
                                                    )}
                                                </div>
                                                {isAssignedTechnician && (
                                                    <Badge className="ml-auto bg-green-100 text-green-700">Bạn</Badge>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            )}

                            {/* Schedule Info */}
                            {(task.scheduled_date || task.scheduled_time) && (
                                <div className="flex items-center gap-4 p-3 rounded-lg bg-blue-50">
                                    <Calendar className="h-5 w-5 text-blue-600" />
                                    <div>
                                        <p className="font-medium">Lịch hẹn</p>
                                        <p className="text-sm text-muted-foreground">
                                            {task.scheduled_date && new Date(task.scheduled_date).toLocaleDateString('vi-VN')}
                                            {task.scheduled_time && ` lúc ${task.scheduled_time}`}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Time Info - Show when completed */}
                            {task.completed_at && (
                                <div className="flex items-center gap-4 p-3 rounded-lg bg-green-50">
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    <div>
                                        <p className="font-medium">Đã hoàn thành</p>
                                        <p className="text-sm text-muted-foreground">
                                            {new Date(task.completed_at).toLocaleString('vi-VN')}
                                            {task.duration_minutes && ` • ${task.duration_minutes} phút`}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            {task.notes && (
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <p className="text-sm font-medium mb-1">Ghi chú:</p>
                                    <p className="text-sm text-muted-foreground">{task.notes}</p>
                                </div>
                            )}

                            {/* Price Info */}
                            {task.total_price && (
                                <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-50">
                                    <span className="font-medium">Giá trị dịch vụ</span>
                                    <span className="text-lg font-bold text-emerald-600">
                                        {formatCurrency(task.total_price)}
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Workflow steps: Bước hiện tại + Start/Complete theo step */}
                    {hasSteps && isAssignedTechnician && (
                        <Card>
                            <CardContent className="p-4">
                                <h4 className="font-semibold text-sm text-muted-foreground uppercase mb-3">Quy trình theo bước</h4>
                                {currentStep ? (
                                    <div className="space-y-3">
                                        <div className="p-3 rounded-lg bg-muted/50">
                                            <p className="font-medium">Bước hiện tại: {currentStep.step_name}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {currentStep.status === 'in_progress' ? 'Đang thực hiện' : currentStep.status === 'assigned' ? 'Đã phân công' : currentStep.status}
                                            </p>
                                        </div>
                                        <div className="flex gap-3">
                                            {canStartStep && (
                                                <Button
                                                    className="flex-1 h-12 gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                                                    onClick={handleStartStep}
                                                    disabled={actionLoading}
                                                >
                                                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                                                    Bắt đầu bước
                                                </Button>
                                            )}
                                            {canCompleteStep && (
                                                <Button
                                                    className="flex-1 h-12 gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                                    onClick={() => setShowCompleteDialog(true)}
                                                    disabled={actionLoading}
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    Hoàn thành bước
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ) : allStepsCompleted ? (
                                    <div className="flex items-center justify-center gap-2 text-green-600 py-4">
                                        <CheckCircle2 className="h-6 w-6" />
                                        <span className="font-semibold">Đã hoàn thành tất cả bước</span>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Chờ bước tiếp theo.</p>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Action Buttons - when no workflow steps (single task) */}
                    {isAssignedTechnician && !hasSteps && (
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex gap-3">
                                    {canStartTask && (
                                        <Button
                                            className="flex-1 h-14 text-lg gap-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                                            onClick={handleStartTask}
                                            disabled={actionLoading}
                                        >
                                            {actionLoading ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <PlayCircle className="h-5 w-5" />
                                            )}
                                            Check-in & Bắt đầu
                                        </Button>
                                    )}

                                    {canCompleteTask && (
                                        <Button
                                            className="flex-1 h-14 text-lg gap-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                            onClick={() => setShowCompleteDialog(true)}
                                            disabled={actionLoading}
                                        >
                                            <CheckCircle2 className="h-5 w-5" />
                                            Hoàn thành
                                        </Button>
                                    )}

                                    {task.status === 'completed' && (
                                        <div className="flex-1 text-center py-4">
                                            <div className="flex items-center justify-center gap-2 text-green-600">
                                                <CheckCircle2 className="h-6 w-6" />
                                                <span className="text-lg font-semibold">Đã hoàn thành</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Not assigned message - Show only when not assigned */}
                    {(task.status === 'not_assigned' || task.status === 'pending') && !task.technician && (
                        <Card className="border-yellow-200 bg-yellow-50">
                            <CardContent className="p-4 text-center">
                                <Clock className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                                <p className="font-medium text-yellow-800">Công việc này chưa được phân công</p>
                                <p className="text-sm text-yellow-600">Vui lòng liên hệ quản lý để được phân công</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Not the assigned technician */}
                    {!isAssignedTechnician && task.technician && task.status !== 'completed' && (
                        <Card className="border-blue-200 bg-blue-50">
                            <CardContent className="p-4 text-center">
                                <User className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                                <p className="font-medium text-blue-800">
                                    Công việc này được phân công cho {task.technician.name}
                                </p>
                                <p className="text-sm text-blue-600">
                                    Bạn không có quyền thực hiện công việc này
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Scan another QR button */}
                    <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => navigate('/scan')}
                    >
                        <QrCode className="h-4 w-4" />
                        Quét mã QR khác
                    </Button>
                </div>
            </div>

            {/* Complete Dialog - step mode uses handleCompleteStep, else handleCompleteTask */}
            <CompleteTaskDialog
                open={showCompleteDialog}
                onClose={() => setShowCompleteDialog(false)}
                onSubmit={hasSteps ? handleCompleteStep : handleCompleteTask}
                loading={actionLoading}
                elapsedMinutes={getElapsedMinutes()}
            />
        </div>
    );
}
