import { useMemo } from 'react';
import { Building2, Crown, Edit, Eye, Phone, Shield, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    getEmployeeDepartmentKey,
    isManagerPosition,
    roleLabels,
    sortEmployeesForKanban,
    UNASSIGNED_DEPARTMENT_ID,
    type KanbanEmployee,
} from './employeeKanbanUtils';

const COLUMN_PALETTES = [
    { header: 'bg-blue-600', ring: 'ring-blue-100' },
    { header: 'bg-violet-600', ring: 'ring-violet-100' },
    { header: 'bg-emerald-600', ring: 'ring-emerald-100' },
    { header: 'bg-rose-600', ring: 'ring-rose-100' },
    { header: 'bg-cyan-600', ring: 'ring-cyan-100' },
    { header: 'bg-orange-600', ring: 'ring-orange-100' },
];

interface DepartmentColumn {
    id: string;
    name: string;
    employees: KanbanEmployee[];
}

interface EmployeeDepartmentKanbanProps {
    employees: KanbanEmployee[];
    departments: { id: string; name: string }[];
    getJobTitleName: (jobTitleId?: string) => string;
    onView: (emp: KanbanEmployee) => void;
    onEdit: (emp: KanbanEmployee) => void;
    onDelete: (emp: KanbanEmployee) => void;
}

function EmployeeKanbanCard({
    emp,
    jobTitleName,
    onView,
    onEdit,
    onDelete,
}: {
    emp: KanbanEmployee;
    jobTitleName: string;
    onView: (emp: KanbanEmployee) => void;
    onEdit: (emp: KanbanEmployee) => void;
    onDelete: (emp: KanbanEmployee) => void;
}) {
    const isManager = isManagerPosition(emp, jobTitleName);

    return (
        <div
            className={`group rounded-xl border p-3 transition-all hover:shadow-md ${
                isManager
                    ? 'border-amber-400 bg-gradient-to-br from-amber-50 via-orange-50/90 to-amber-100/80 shadow-sm ring-2 ring-amber-300/60'
                    : 'border-gray-200 bg-white hover:border-blue-200'
            }`}
        >
            <div className="flex items-start gap-2.5">
                <div className="relative shrink-0">
                    <Avatar className={`h-10 w-10 ${isManager ? 'ring-2 ring-amber-400' : ''}`}>
                        {emp.avatar && <AvatarImage src={emp.avatar} alt={emp.name} />}
                        <AvatarFallback
                            className={
                                isManager
                                    ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold text-sm'
                                    : 'bg-slate-100 text-slate-600 font-semibold text-sm'
                            }
                        >
                            {emp.name.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                    {isManager && (
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white shadow ring-2 ring-white">
                            <Crown className="h-3 w-3" />
                        </span>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <p className={`truncate text-[13px] ${isManager ? 'font-bold text-amber-950' : 'font-semibold text-gray-900'}`}>
                        {emp.name}
                    </p>
                    <p className="truncate text-[11px] text-gray-500 mt-0.5">{jobTitleName}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {isManager ? (
                            <Badge className="text-[10px] px-1.5 py-0 h-5 bg-amber-500 hover:bg-amber-500 text-white border-0 gap-0.5">
                                <Shield className="h-3 w-3" />
                                Quản lý
                            </Badge>
                        ) : (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                                <Users className="h-3 w-3 mr-0.5" />
                                Nhân viên
                            </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal text-gray-600">
                            {roleLabels[emp.role]}
                        </Badge>
                    </div>
                    {emp.phone && (
                        <p className="flex items-center gap-1 mt-1.5 text-[11px] text-gray-500">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span className="truncate">{emp.phone}</span>
                        </p>
                    )}
                </div>
            </div>

            <div className="mt-2.5 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" className="h-7 flex-1 text-[11px] px-2" onClick={() => onView(emp)}>
                    <Eye className="h-3 w-3 mr-1" />
                    Xem
                </Button>
                <Button variant="ghost" size="sm" className="h-7 flex-1 text-[11px] px-2" onClick={() => onEdit(emp)}>
                    <Edit className="h-3 w-3 mr-1" />
                    Sửa
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-8 px-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onDelete(emp)}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}

export function EmployeeDepartmentKanban({
    employees,
    departments,
    getJobTitleName,
    onView,
    onEdit,
    onDelete,
}: EmployeeDepartmentKanbanProps) {
    const columns = useMemo((): DepartmentColumn[] => {
        const byDept = new Map<string, KanbanEmployee[]>();

        for (const emp of employees) {
            const deptKey = getEmployeeDepartmentKey(emp, departments);
            if (!byDept.has(deptKey)) byDept.set(deptKey, []);
            byDept.get(deptKey)!.push(emp);
        }

        const deptColumns: DepartmentColumn[] = departments.map((d) => ({
            id: d.id,
            name: d.name,
            employees: sortEmployeesForKanban(byDept.get(d.id) || [], getJobTitleName),
        }));

        deptColumns.push({
            id: UNASSIGNED_DEPARTMENT_ID,
            name: 'Chưa phân bổ',
            employees: sortEmployeesForKanban(byDept.get(UNASSIGNED_DEPARTMENT_ID) || [], getJobTitleName),
        });

        return deptColumns;
    }, [employees, departments, getJobTitleName]);

    const managerCount = employees.filter((e) => isManagerPosition(e, getJobTitleName(e.job_title_id))).length;
    const staffCount = employees.length - managerCount;

    if (departments.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center p-12 text-center text-gray-500">
                <Building2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Chưa có phòng ban. Thêm phòng ban để hiển thị Kanban.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 min-h-0">
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-[#fbfcfd] text-[12px]">
                <span className="text-gray-500 font-medium">Chú thích:</span>
                <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 px-2 py-1 font-medium text-amber-900">
                    <Crown className="h-3.5 w-3.5 text-amber-600" />
                    Quản lý ({managerCount})
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-gray-700">
                    <Users className="h-3.5 w-3.5 text-gray-400" />
                    Nhân viên ({staffCount})
                </span>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
                <div className="flex gap-4 min-h-full pb-2 h-full items-stretch">
                    {columns.map((col, index) => {
                        const palette = COLUMN_PALETTES[index % COLUMN_PALETTES.length];
                        const managersInCol = col.employees.filter((e) =>
                            isManagerPosition(e, getJobTitleName(e.job_title_id))
                        ).length;

                        return (
                            <div
                                key={col.id}
                                className={`flex w-[min(100%,300px)] sm:w-[280px] shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-50/80 shadow-sm ring-1 ${palette.ring}`}
                            >
                                <div className={`rounded-t-xl px-3 py-2.5 text-white ${palette.header}`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Building2 className="h-4 w-4 shrink-0 opacity-90" />
                                            <h3 className="font-bold text-[13px] truncate" title={col.name}>
                                                {col.name}
                                            </h3>
                                        </div>
                                        <Badge className="bg-white/20 text-white border-0 text-[10px] shrink-0">
                                            {col.employees.length}
                                        </Badge>
                                    </div>
                                    {managersInCol > 0 && (
                                        <p className="text-[10px] text-white/85 mt-1 pl-6">
                                            {managersInCol} quản lý · {col.employees.length - managersInCol} nhân viên
                                        </p>
                                    )}
                                </div>

                                <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-16rem)] min-h-[120px]">
                                    {col.employees.length === 0 ? (
                                        <p className="py-6 text-center text-[12px] text-gray-400">Chưa có nhân viên</p>
                                    ) : (
                                        col.employees.map((emp) => (
                                            <EmployeeKanbanCard
                                                key={emp.id}
                                                emp={emp}
                                                jobTitleName={getJobTitleName(emp.job_title_id)}
                                                onView={onView}
                                                onEdit={onEdit}
                                                onDelete={onDelete}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

