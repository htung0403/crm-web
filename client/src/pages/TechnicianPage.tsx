import { useState, useEffect, useCallback } from 'react';
import {
    Clock, CheckCircle2, Play, User, Phone, MapPin,
    Calendar, Star, Wrench, Package, AlertCircle, Loader2, QrCode
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useTechnicianTasks, type TechnicianTask } from '@/hooks/useTechnicianTasks';
import { formatCurrency, cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline' }> = {
    pending: { label: 'Chờ phân công', variant: 'secondary' },
    assigned: { label: 'Đã phân công', variant: 'warning' },
    in_progress: { label: 'Đang thực hiện', variant: 'default' },
    completed: { label: 'Hoàn thành', variant: 'success' },
    cancelled: { label: 'Đã hủy', variant: 'destructive' },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
    low: { label: 'Thấp', color: 'text-gray-500' },
    normal: { label: 'Bình thường', color: 'text-blue-500' },
    high: { label: 'Cao', color: 'text-orange-500' },
    urgent: { label: 'Khẩn cấp', color: 'text-red-500' },
};

export function TechnicianPage() {
    const {
        tasks,
        loading,
        stats,
        fetchMyTasks,
        startTask,
        completeTask,
        fetchStats,
    } = useTechnicianTasks();

    const [activeTab, setActiveTab] = useState('today');
    const [selectedTask, setSelectedTask] = useState<TechnicianTask | null>(null);
    const [showCompleteDialog, setShowCompleteDialog] = useState(false);
    const [completionNotes, setCompletionNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Fetch tasks
    const loadTasks = useCallback(async () => {
        const filters: { status?: string; date?: string } = {};

        if (activeTab === 'today') {
            filters.date = today;
        } else if (activeTab === 'in_progress') {
            filters.status = 'in_progress';
        } else if (activeTab === 'completed') {
            filters.status = 'completed';
        }

        await fetchMyTasks(filters);
    }, [activeTab, today, fetchMyTasks]);

    useEffect(() => {
        loadTasks();
        fetchStats();
    }, [loadTasks, fetchStats]);

    // Handle start task
    const handleStartTask = async (task: TechnicianTask) => {
        try {
            await startTask(task.id);
            toast.success('Đã bắt đầu công việc!');
            loadTasks();
        } catch (error) {
            toast.error('Không thể bắt đầu công việc');
        }
    };

    // Handle complete task
    const handleCompleteTask = async () => {
        if (!selectedTask) return;

        setSubmitting(true);
        try {
            await completeTask(selectedTask.id, {
                notes: completionNotes || undefined,
            });
            toast.success('Đã hoàn thành công việc!');
            setShowCompleteDialog(false);
            setSelectedTask(null);
            setCompletionNotes('');
            loadTasks();
            fetchStats();
        } catch (error) {
            toast.error('Không thể hoàn thành công việc');
        } finally {
            setSubmitting(false);
        }
    };

    // Stats cards
    const statsCards = [
        { label: 'Tổng công việc', value: stats?.total || 0, icon: Package, color: 'text-blue-500' },
        { label: 'Đang thực hiện', value: stats?.in_progress || 0, icon: Play, color: 'text-yellow-500' },
        { label: 'Hoàn thành', value: stats?.completed || 0, icon: CheckCircle2, color: 'text-green-500' },
        { label: 'Đánh giá TB', value: (stats?.avg_rating || 0).toFixed(1), icon: Star, color: 'text-amber-500' },
    ];

    // Filter tasks based on active tab
    const filteredTasks = tasks.filter(task => {
        if (activeTab === 'today') {
            return true; // Already filtered by API
        }
        if (activeTab === 'in_progress') {
            return task.status === 'in_progress';
        }
        if (activeTab === 'completed') {
            return task.status === 'completed';
        }
        if (activeTab === 'all') {
            return true;
        }
        return true;
    });

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Công việc của tôi</h1>
                    <p className="text-muted-foreground">Quản lý và theo dõi công việc được giao</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statsCards.map((stat, index) => (
                    <Card key={index}>
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                                    <p className="text-2xl font-bold">{stat.value}</p>
                                </div>
                                <stat.icon className={cn("h-8 w-8", stat.color)} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Tasks Tabs */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5" />
                        Danh sách công việc
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="mb-4">
                            <TabsTrigger value="today">
                                <Calendar className="h-4 w-4 mr-1" />
                                Hôm nay
                            </TabsTrigger>
                            <TabsTrigger value="in_progress">
                                <Play className="h-4 w-4 mr-1" />
                                Đang làm
                            </TabsTrigger>
                            <TabsTrigger value="completed">
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Hoàn thành
                            </TabsTrigger>
                            <TabsTrigger value="all">Tất cả</TabsTrigger>
                        </TabsList>

                        <TabsContent value={activeTab} className="mt-0">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : filteredTasks.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>Không có công việc nào</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {filteredTasks.map((task) => (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            onStart={() => handleStartTask(task)}
                                            onComplete={() => {
                                                setSelectedTask(task);
                                                setShowCompleteDialog(true);
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Complete Dialog */}
            <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            Hoàn thành công việc
                        </DialogTitle>
                        <DialogDescription>
                            Xác nhận hoàn thành công việc: {selectedTask?.service_name}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Ghi chú (không bắt buộc)</Label>
                            <Textarea
                                value={completionNotes}
                                onChange={(e) => setCompletionNotes(e.target.value)}
                                placeholder="Ghi chú về công việc đã thực hiện..."
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
                            Hủy
                        </Button>
                        <Button onClick={handleCompleteTask} disabled={submitting}>
                            {submitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Đang xử lý...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Hoàn thành
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Task Card Component
interface TaskCardProps {
    task: TechnicianTask;
    onStart: () => void;
    onComplete: () => void;
}

function TaskCard({ task, onStart, onComplete }: TaskCardProps) {
    const status = statusConfig[task.status] || statusConfig.pending;
    const priority = priorityConfig[task.priority] || priorityConfig.normal;

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Task Info */}
                    <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-semibold">{task.service_name}</h3>
                                    <Badge variant={status.variant}>{status.label}</Badge>
                                    <span className={cn("text-xs font-medium", priority.color)}>
                                        {priority.label}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                    <span className="font-mono">{task.task_code || task.item_code}</span>
                                    {task.order?.order_code && (
                                        <>
                                            <span>•</span>
                                            <span>Đơn: {task.order.order_code}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Customer Info */}
                        {(task.customer || task.order?.customer) && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {task.customer?.name || task.order?.customer?.name}
                                </span>
                                {(task.customer?.phone || task.order?.customer?.phone) && (
                                    <span className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {task.customer?.phone || task.order?.customer?.phone}
                                    </span>
                                )}
                                {(task.customer?.address || task.order?.customer?.address) && (
                                    <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {task.customer?.address || task.order?.customer?.address}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Schedule Info */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {task.scheduled_date && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(task.scheduled_date).toLocaleDateString('vi-VN')}
                                    {task.scheduled_time && ` - ${task.scheduled_time}`}
                                </span>
                            )}
                            {task.duration_minutes && (
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {task.duration_minutes} phút
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 lg:flex-col">
                        {task.status === 'assigned' && (
                            <Button size="sm" onClick={onStart} className="flex-1 lg:flex-none">
                                <Play className="h-4 w-4 mr-1" />
                                Bắt đầu
                            </Button>
                        )}
                        {task.status === 'in_progress' && (
                            <Button size="sm" onClick={onComplete} variant="success" className="flex-1 lg:flex-none">
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Hoàn thành
                            </Button>
                        )}
                        {task.status === 'completed' && task.rating && (
                            <div className="flex items-center gap-1 text-amber-500">
                                <Star className="h-4 w-4 fill-current" />
                                <span className="font-medium">{task.rating}</span>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
