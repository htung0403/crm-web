import { useState, useEffect } from 'react';
import { Save, Search, UserCheck, Loader2, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useKPI } from '@/hooks/useKPI';

export function KPIAssignmentsTab() {
    const { 
        employeeAssignments, 
        availablePolicies, 
        fetchEmployeeAssignments, 
        batchAssignPolicies, 
        loading 
    } = useKPI();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [pendingAssignments, setPendingAssignments] = useState<Record<string, string | null>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchEmployeeAssignments();
    }, [fetchEmployeeAssignments]);

    const handlePolicyChange = (employeeId: string, policyId: string) => {
        setPendingAssignments(prev => ({
            ...prev,
            [employeeId]: policyId === 'none' ? null : policyId
        }));
    };

    const handleSave = async () => {
        const assignments = Object.entries(pendingAssignments).map(([employee_id, policy_id]) => ({
            employee_id,
            policy_id
        }));

        if (assignments.length === 0) return;

        setSaving(true);
        try {
            await batchAssignPolicies(assignments);
            setPendingAssignments({});
            await fetchEmployeeAssignments();
        } finally {
            setSaving(false);
        }
    };

    const filteredEmployees = employeeAssignments.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             emp.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || emp.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const hasChanges = Object.keys(pendingAssignments).length > 0;

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <UserCheck className="h-5 w-4" />
                                Gán chính sách KPI
                            </CardTitle>
                            <CardDescription>
                                Thiết lập chính sách KPI cho từng nhân viên để hệ thống tự động tính điểm hàng tháng
                            </CardDescription>
                        </div>
                        <Button 
                            disabled={!hasChanges || saving} 
                            onClick={handleSave}
                            className="w-full md:w-auto"
                        >
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Lưu {hasChanges ? `(${Object.keys(pendingAssignments).length})` : ''} thay đổi
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Tìm theo tên hoặc email..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-full md:w-[200px]">
                                <Users className="mr-2 h-4 w-4 opacity-50" />
                                <SelectValue placeholder="Lọc theo Role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả Role</SelectItem>
                                <SelectItem value="sale">Sale</SelectItem>
                                <SelectItem value="technician">Kỹ thuật</SelectItem>
                                <SelectItem value="manager">Quản lý</SelectItem>
                                <SelectItem value="accountant">Kế toán</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="border rounded-md">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="text-left p-3 font-medium">Nhân viên</th>
                                    <th className="text-left p-3 font-medium">Phòng ban / Role</th>
                                    <th className="text-left p-3 font-medium">Chính sách hiện tại</th>
                                    <th className="text-left p-3 font-medium w-[300px]">Gán chính sách mới</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loading && filteredEmployees.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                            Đang tải danh sách...
                                        </td>
                                    </tr>
                                ) : filteredEmployees.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                                            Không tìm thấy nhân viên nào
                                        </td>
                                    </tr>
                                ) : (
                                    filteredEmployees.map((emp) => (
                                        <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="p-3">
                                                <div className="font-medium text-foreground">{emp.name}</div>
                                                <div className="text-xs text-muted-foreground">{emp.email}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant="outline" className="w-fit text-[10px] uppercase">
                                                        {emp.role}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">{emp.department || 'Chưa rõ'}</span>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                {emp.kpi_policy ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                                            {emp.kpi_policy.name}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            Code: {emp.kpi_policy.code}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground italic">Chưa gán</span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <Select 
                                                    value={pendingAssignments[emp.id] === null ? 'none' : (pendingAssignments[emp.id] || emp.kpi_policy_id || 'none')} 
                                                    onValueChange={(val) => handlePolicyChange(emp.id, val)}
                                                >
                                                    <SelectTrigger className={pendingAssignments[emp.id] !== undefined ? "border-amber-500 ring-amber-500" : ""}>
                                                        <SelectValue placeholder="Chọn chính sách..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">-- Không gán --</SelectItem>
                                                        {availablePolicies
                                                            .filter(p => p.role === 'all' || p.role === emp.role)
                                                            .map(policy => (
                                                                <SelectItem key={policy.id} value={policy.id}>
                                                                    {policy.name} ({policy.code})
                                                                </SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
