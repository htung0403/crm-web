import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Wrench,
    Clock,
    CheckCircle2,
    PlayCircle,
    PauseCircle,
    XCircle,
    Calendar,
    Phone,
    MapPin,
    User,
    Filter,
    MoreVertical,
    Star,
    Timer
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTechnicianTasks, type TechnicianTask } from '@/hooks/useTechnicianTasks';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Status configuration
const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { label: 'Chờ phân công', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-4 w-4" /> },
    assigned: { label: 'Đã phân công', color: 'bg-blue-100 text-blue-800', icon: <User className="h-4 w-4" /> },
    in_progress: { label: 'Đang thực hiện', color: 'bg-purple-100 text-purple-800', icon: <PlayCircle className="h-4 w-4" /> },
    completed: { label: 'Hoàn thành', color: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="h-4 w-4" /> },
    cancelled: { label: 'Đã huỷ', color: 'bg-gray-100 text-gray-800', icon: <XCircle className="h-4 w-4" /> },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
    low: { label: 'Thấp', color: 'bg-gray-100 text-gray-600' },
    normal: { label: 'Bình thường', color: 'bg-blue-100 text-blue-600' },
    high: { label: 'Cao', color: 'bg-orange-100 text-orange-600' },
    urgent: { label: 'Khẩn cấp', color: 'bg-red-100 text-red-600' },
};

// Task Card Component
function TaskCard({
    task,
    onStart,
    onComplete,
    onCancel,
    onViewDetail,
    isTechnician
}: {
    task: TechnicianTask;
    onStart: () => void;
    onComplete: () => void;
    onCancel: () => void;
    onViewDetail: () => void;
    isTechnician: boolean;
}) {
    const status = statusConfig[task.status] || statusConfig.pending;
    const priority = priorityConfig[task.priority] || priorityConfig.normal;

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-mono text-sm text-muted-foreground">{task.task_code}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${priority.color}`}>
                                {priority.label}
                            </span>
                        </div>
                        <h3 className="font-semibold text-lg line-clamp-2">{task.service_name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                            {status.icon}
                            {status.label}
                        </span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={onViewDetail}>
                                    Xem chi tiết
                                </DropdownMenuItem>
                                {isTechnician && task.status === 'assigned' && (
                                    <DropdownMenuItem onClick={onStart}>
                                        <PlayCircle className="h-4 w-4 mr-2" />
                                        Bắt đầu
                                    </DropdownMenuItem>
                                )}
                                {isTechnician && task.status === 'in_progress' && (
                                    <DropdownMenuItem onClick={onComplete}>
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Hoàn thành
                                    </DropdownMenuItem>
                                )}
                                {(task.status === 'pending' || task.status === 'assigned') && (
                                    <DropdownMenuItem onClick={onCancel} className="text-red-600">
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Huỷ công việc
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Customer Info */}
                {task.customer && (
                    <div className="space-y-1 mb-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{task.customer.name}</span>
                        </div>
                        {task.customer.phone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="h-4 w-4" />
                                <a href={`tel:${task.customer.phone}`} className="hover:text-primary">
                                    {task.customer.phone}
                                </a>
                            </div>
                        )}
                        {task.customer.address && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                <span>{task.customer.address}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Schedule Info */}
                <div className="flex flex-wrap items-center gap-4 text-sm">
                    {task.scheduled_date && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>{new Date(task.scheduled_date).toLocaleDateString('vi-VN')}</span>
                            {task.scheduled_time && <span>lúc {task.scheduled_time}</span>}
                        </div>
                    )}
                    {task.duration_minutes && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                            <Timer className="h-4 w-4" />
                            <span>{task.duration_minutes} phút</span>
                        </div>
                    )}
                    {task.rating && (
                        <div className="flex items-center gap-1 text-yellow-500">
                            <Star className="h-4 w-4 fill-current" />
                            <span>{task.rating}/5</span>
                        </div>
                    )}
                </div>

                {/* Order Reference */}
                {task.order && (
                    <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                        Đơn hàng: <span className="font-mono">{task.order.order_code}</span>
                    </div>
                )}

                {/* Action Buttons for Technician */}
                {isTechnician && (
                    <div className="mt-4 flex gap-2">
                        {task.status === 'assigned' && (
                            <Button onClick={onStart} className="flex-1">
                                <PlayCircle className="h-4 w-4 mr-2" />
                                Bắt đầu làm
                            </Button>
                        )}
                        {task.status === 'in_progress' && (
                            <Button onClick={onComplete} className="flex-1 bg-green-600 hover:bg-green-700">
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Hoàn thành
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Complete Task Dialog
function CompleteTaskDialog({
    open,
    onClose,
    onSubmit,
}: {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: { notes?: string; duration_minutes?: number }) => void;
}) {
    const [notes, setNotes] = useState('');
    const [duration, setDuration] = useState('');

    const handleSubmit = () => {
        onSubmit({
            notes: notes || undefined,
            duration_minutes: duration ? parseInt(duration) : undefined,
        });
        setNotes('');
        setDuration('');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        Hoàn thành công việc
                    </DialogTitle>
                    <DialogDescription>Ghi chú kết quả thực hiện</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Thời gian thực hiện (phút)</Label>
                        <Input
                            type="number"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            placeholder="Nhập thời gian thực hiện"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Ghi chú</Label>
                        <textarea
                            className="w-full min-h-[100px] px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ghi chú kết quả thực hiện..."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Huỷ</Button>
                    <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
                        Xác nhận hoàn thành
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Main Page Component
export function TechnicianPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isTechnician = user?.role === 'technician';
    const isManager = user?.role === 'manager' || user?.role === 'admin';

    const {
        tasks,
        loading,
        stats,
        fetchTasks,
        fetchMyTasks,
        fetchStats,
        startTask,
        completeTask,
        cancelTask,
    } = useTechnicianTasks();

    const [activeTab, setActiveTab] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState<string>('');
    const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<TechnicianTask | null>(null);

    // Fetch data based on role
    useEffect(() => {
        if (isTechnician) {
            fetchMyTasks();
        } else {
            fetchTasks();
        }
        fetchStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Filter tasks by status
    const filteredTasks = tasks.filter(task => {
        if (statusFilter !== 'all' && task.status !== statusFilter) return false;
        if (dateFilter && task.scheduled_date !== dateFilter) return false;

        if (activeTab === 'today') {
            const today = new Date().toISOString().split('T')[0];
            return task.scheduled_date === today;
        }
        if (activeTab === 'pending') {
            return task.status === 'pending' || task.status === 'assigned';
        }
        if (activeTab === 'in_progress') {
            return task.status === 'in_progress';
        }
        if (activeTab === 'completed') {
            return task.status === 'completed';
        }

        return true;
    });

    // Handle start task - navigate to TaskQRPage
    const handleStartTask = (task: TechnicianTask) => {
        // Navigate to TaskQRPage with the item_code
        if (task.item_code) {
            navigate(`/task/${task.item_code}`);
        } else {
            toast.error('Không tìm thấy mã QR cho công việc này');
        }
    };

    // Handle complete task
    const handleCompleteTask = async (data: { notes?: string; duration_minutes?: number }) => {
        if (!selectedTask) return;
        try {
            await completeTask(selectedTask.id, data);
            toast.success('Đã hoàn thành công việc');
            setSelectedTask(null);
        } catch {
            toast.error('Lỗi khi hoàn thành công việc');
        }
    };

    // Handle cancel task
    const handleCancelTask = async (task: TechnicianTask) => {
        if (!confirm('Bạn có chắc muốn huỷ công việc này?')) return;
        try {
            await cancelTask(task.id);
            toast.success('Đã huỷ công việc');
        } catch {
            toast.error('Lỗi khi huỷ công việc');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Wrench className="h-6 w-6 text-primary" />
                        {isTechnician ? 'Công việc của tôi' : 'Quản lý công việc kỹ thuật'}
                    </h1>
                    <p className="text-muted-foreground">
                        {isTechnician
                            ? 'Danh sách công việc được phân công cho bạn'
                            : 'Quản lý và phân công công việc kỹ thuật'
                        }
                    </p>
                </div>
            </div>

            {/* Stats Cards - Scrollable on mobile */}
            {stats && (
                <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
                    <div className="flex md:grid md:grid-cols-5 gap-4 min-w-max md:min-w-0">
                        <Card className="min-w-[150px] md:min-w-0">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Chờ phân công</p>
                                        <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                                    </div>
                                    <Clock className="h-8 w-8 text-yellow-600/20" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="min-w-[150px] md:min-w-0">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Đã phân công</p>
                                        <p className="text-2xl font-bold text-blue-600">{stats.assigned}</p>
                                    </div>
                                    <User className="h-8 w-8 text-blue-600/20" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="min-w-[150px] md:min-w-0">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Đang làm</p>
                                        <p className="text-2xl font-bold text-purple-600">{stats.in_progress}</p>
                                    </div>
                                    <PlayCircle className="h-8 w-8 text-purple-600/20" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="min-w-[150px] md:min-w-0">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Hoàn thành</p>
                                        <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                                    </div>
                                    <CheckCircle2 className="h-8 w-8 text-green-600/20" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="min-w-[150px] md:min-w-0">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Tổng thời gian</p>
                                        <p className="text-2xl font-bold text-primary">{Math.round(stats.total_duration / 60)}h</p>
                                    </div>
                                    <Timer className="h-8 w-8 text-primary/20" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* Filters & Tabs */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="space-y-4">
                        {/* Tabs - Scrollable on mobile */}
                        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                            <Tabs value={activeTab} onValueChange={setActiveTab}>
                                <TabsList className="inline-flex w-max">
                                    <TabsTrigger value="all">Tất cả</TabsTrigger>
                                    <TabsTrigger value="today">Hôm nay</TabsTrigger>
                                    <TabsTrigger value="pending">Chờ xử lý</TabsTrigger>
                                    <TabsTrigger value="in_progress">Đang làm</TabsTrigger>
                                    <TabsTrigger value="completed">Hoàn thành</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                        {/* Filters */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <SelectValue placeholder="Trạng thái" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả</SelectItem>
                                    <SelectItem value="pending">Chờ phân công</SelectItem>
                                    <SelectItem value="assigned">Đã phân công</SelectItem>
                                    <SelectItem value="in_progress">Đang làm</SelectItem>
                                    <SelectItem value="completed">Hoàn thành</SelectItem>
                                    <SelectItem value="cancelled">Đã huỷ</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="w-full sm:w-[180px]"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Đang tải danh sách công việc...
                        </div>
                    ) : filteredTasks.length === 0 ? (
                        <div className="text-center py-12">
                            <PauseCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                            <p className="text-muted-foreground">Không có công việc nào</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredTasks.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    isTechnician={isTechnician}
                                    onStart={() => handleStartTask(task)}
                                    onComplete={() => {
                                        setSelectedTask(task);
                                        setCompleteDialogOpen(true);
                                    }}
                                    onCancel={() => handleCancelTask(task)}
                                    onViewDetail={() => {
                                        // TODO: Show detail dialog
                                        toast.info('Chi tiết công việc: ' + task.task_code);
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Complete Dialog */}
            <CompleteTaskDialog
                open={completeDialogOpen}
                onClose={() => {
                    setCompleteDialogOpen(false);
                    setSelectedTask(null);
                }}
                onSubmit={handleCompleteTask}
            />
        </div>
    );
}
