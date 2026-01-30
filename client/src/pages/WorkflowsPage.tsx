import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Edit, Trash2, GitBranch, Building2,
    Loader2, MoreVertical, Clock, Search
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useWorkflows, type Workflow } from '@/hooks/useWorkflows';

export function WorkflowsPage() {
    const navigate = useNavigate();
    const { workflows, loading, deleteWorkflow } = useWorkflows();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const filteredWorkflows = workflows.filter(w => {
        const matchesSearch = w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            w.code.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleOpenDelete = (workflow: Workflow) => {
        setSelectedWorkflow(workflow);
        setIsDeleteDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!selectedWorkflow) return;

        setIsSubmitting(true);
        try {
            await deleteWorkflow(selectedWorkflow.id);
            toast.success('Đã xóa quy trình');
            setIsDeleteDialogOpen(false);
        } catch {
            toast.error('Không thể xóa quy trình đang được sử dụng');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <Toaster richColors position="top-right" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Quản lý Quy trình</h1>
                    <p className="text-gray-500 mt-1">Thiết lập quy trình làm việc cho các dịch vụ</p>
                </div>
                <Button onClick={() => navigate('/workflows/new')} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Tạo quy trình
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Tìm kiếm quy trình..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Trạng thái" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả</SelectItem>
                        <SelectItem value="active">Đang dùng</SelectItem>
                        <SelectItem value="inactive">Tạm dừng</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Workflows Grid */}
            {filteredWorkflows.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
                    <GitBranch className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-4 text-lg font-medium text-gray-900">Chưa có quy trình nào</h3>
                    <p className="mt-2 text-gray-500">Bắt đầu tạo quy trình làm việc đầu tiên</p>
                    <Button onClick={() => navigate('/workflows/new')} className="mt-4 gap-2">
                        <Plus className="h-4 w-4" />
                        Tạo quy trình
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredWorkflows.map((workflow) => (
                        <div
                            key={workflow.id}
                            className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow p-5 cursor-pointer"
                            onClick={() => navigate(`/workflows/${workflow.id}/edit`)}
                        >
                            {/* Card Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <GitBranch className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{workflow.name}</h3>
                                        <p className="text-sm text-gray-500">{workflow.code}</p>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/workflows/${workflow.id}/edit`);
                                        }}>
                                            <Edit className="h-4 w-4 mr-2" />
                                            Chỉnh sửa
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenDelete(workflow);
                                            }}
                                            className="text-red-600"
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Xóa
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Description */}
                            {workflow.description && (
                                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                    {workflow.description}
                                </p>
                            )}

                            {/* Steps Preview */}
                            <div className="space-y-2 mb-4">
                                <p className="text-xs font-medium text-gray-500 uppercase">
                                    {workflow.steps.length} bước
                                </p>
                                <div className="space-y-1.5">
                                    {workflow.steps.slice(0, 3).map((step, index) => (
                                        <div key={step.id} className="flex items-start gap-2">
                                            <span className="flex items-center justify-center w-5 h-5 bg-primary/10 text-primary text-xs font-semibold rounded-full shrink-0 mt-0.5">
                                                {index + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <Building2 className="h-3 w-3 text-gray-400 shrink-0" />
                                                    <span className="text-xs font-medium text-gray-700 truncate">
                                                        {step.name || step.department.name}
                                                    </span>
                                                </div>
                                                {step.description && (
                                                    <p className="text-xs text-gray-500 truncate mt-0.5">
                                                        {step.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {workflow.steps.length > 3 && (
                                        <p className="text-xs text-gray-500 pl-7">
                                            +{workflow.steps.length - 3} bước khác...
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-3 border-t">
                                <Badge variant={workflow.status === 'active' ? 'default' : 'secondary'}>
                                    {workflow.status === 'active' ? 'Đang dùng' : 'Tạm dừng'}
                                </Badge>
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <Clock className="h-3 w-3" />
                                    {workflow.steps.reduce((sum, s) => sum + s.estimated_duration, 0)} phút
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Xác nhận xóa</DialogTitle>
                        <DialogDescription>
                            Bạn có chắc muốn xóa quy trình "{selectedWorkflow?.name}"?
                            Hành động này không thể hoàn tác.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                            Hủy
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Xóa
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
