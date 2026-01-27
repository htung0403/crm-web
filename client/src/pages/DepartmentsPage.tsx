import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Building2, Users, Wrench, Search, Loader2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDepartments, type Department } from '@/hooks/useDepartments';
import { useUsers } from '@/hooks/useUsers';

export function DepartmentsPage() {
    const { departments, loading, fetchDepartments, createDepartment, updateDepartment, deleteDepartment } = useDepartments();
    const { users, fetchUsers } = useUsers();
    const [search, setSearch] = useState('');
    const [showDialog, setShowDialog] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [managerId, setManagerId] = useState('');
    const [status, setStatus] = useState<'active' | 'inactive'>('active');

    useEffect(() => {
        fetchDepartments();
        fetchUsers();
    }, [fetchDepartments, fetchUsers]);

    // Reset form when dialog opens/closes
    useEffect(() => {
        if (editingDepartment) {
            setName(editingDepartment.name || '');
            setDescription(editingDepartment.description || '');
            setManagerId(editingDepartment.manager_id || '');
            setStatus(editingDepartment.status || 'active');
        } else {
            setName('');
            setDescription('');
            setManagerId('');
            setStatus('active');
        }
    }, [editingDepartment, showDialog]);

    const filteredDepartments = departments.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.code.toLowerCase().includes(search.toLowerCase())
    );

    const handleSubmit = async () => {
        if (!name.trim()) {
            toast.error('Vui lòng nhập tên phòng ban');
            return;
        }

        setSubmitting(true);
        try {
            const data = {
                name,
                description: description || undefined,
                manager_id: managerId || undefined,
                status
            };

            if (editingDepartment) {
                await updateDepartment(editingDepartment.id, data);
                toast.success('Đã cập nhật phòng ban!');
            } else {
                await createDepartment(data);
                toast.success('Đã tạo phòng ban mới!');
            }

            setShowDialog(false);
            setEditingDepartment(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Có lỗi xảy ra';
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa phòng ban này?')) return;

        try {
            await deleteDepartment(id);
            toast.success('Đã xóa phòng ban!');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể xóa phòng ban';
            toast.error(message);
        }
    };

    const managers = users.filter(u => u.role === 'manager' || u.role === 'admin');

    if (loading && departments.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <Toaster position="top-right" richColors />
            <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <Building2 className="h-6 w-6 text-primary" />
                            Quản lý Phòng ban
                        </h1>
                        <p className="text-muted-foreground">Quản lý các phòng ban kỹ thuật</p>
                    </div>
                    <Button onClick={() => { setEditingDepartment(null); setShowDialog(true); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Thêm phòng ban
                    </Button>
                </div>

                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Tìm kiếm phòng ban..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <Building2 className="h-8 w-8 text-blue-600" />
                                <div>
                                    <p className="text-sm text-blue-600">Tổng số</p>
                                    <p className="text-2xl font-bold text-blue-700">{departments.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <Users className="h-8 w-8 text-green-600" />
                                <div>
                                    <p className="text-sm text-green-600">Đang hoạt động</p>
                                    <p className="text-2xl font-bold text-green-700">
                                        {departments.filter(d => d.status === 'active').length}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Departments Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDepartments.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            Không tìm thấy phòng ban nào
                        </div>
                    ) : (
                        filteredDepartments.map((dept) => (
                            <Card key={dept.id} className="hover:shadow-md transition-shadow">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 rounded-lg bg-primary/10">
                                                <Wrench className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">{dept.name}</CardTitle>
                                                <p className="text-xs text-muted-foreground font-mono">{dept.code}</p>
                                            </div>
                                        </div>
                                        <Badge variant={dept.status === 'active' ? 'success' : 'secondary'}>
                                            {dept.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {dept.description && (
                                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                            {dept.description}
                                        </p>
                                    )}

                                    {dept.manager && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                                            <Users className="h-4 w-4" />
                                            <span>Quản lý: <strong>{dept.manager.name}</strong></span>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 pt-3 border-t">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => { setEditingDepartment(dept); setShowDialog(true); }}
                                        >
                                            <Edit className="h-4 w-4 mr-1" />
                                            Sửa
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-500 hover:bg-red-50"
                                            onClick={() => handleDelete(dept.id)}
                                        >
                                            <Trash2 className="h-4 w-4 mr-1" />
                                            Xóa
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* Create/Edit Dialog */}
                <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setEditingDepartment(null); }}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-primary" />
                                {editingDepartment ? 'Sửa phòng ban' : 'Thêm phòng ban mới'}
                            </DialogTitle>
                            <DialogDescription>Nhập thông tin phòng ban</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            {editingDepartment && (
                                <div className="space-y-2">
                                    <Label>Mã phòng ban</Label>
                                    <Input value={editingDepartment.code} disabled className="bg-muted" />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Tên phòng ban *</Label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Nhập tên phòng ban"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Mô tả</Label>
                                <textarea
                                    className="w-full min-h-20 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Mô tả về phòng ban..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Quản lý</Label>
                                    <Select value={managerId || 'none'} onValueChange={(v) => setManagerId(v === 'none' ? '' : v)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Chọn quản lý" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Chưa chọn</SelectItem>
                                            {managers.map(m => (
                                                <SelectItem key={m.id} value={m.id}>
                                                    {m.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Trạng thái</Label>
                                    <Select value={status} onValueChange={(v: 'active' | 'inactive') => setStatus(v)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Hoạt động</SelectItem>
                                            <SelectItem value="inactive">Tạm dừng</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowDialog(false)}>Huỷ</Button>
                            <Button onClick={handleSubmit} disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Đang lưu...
                                    </>
                                ) : (
                                    'Lưu'
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
