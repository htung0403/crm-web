import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, ChevronRight, Edit, Eye, Mail, MoreHorizontal, Phone, Trash2 } from 'lucide-react';

export interface MobileEmployee {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    employee_code?: string;
    status?: string;
    avatar?: string;
    job_titles?: { name: string };
    departments?: { name: string };
}

interface MobileEmployeesListProps {
    employees: MobileEmployee[];
    loading: boolean;
    onView?: (employee: MobileEmployee) => void;
    onEdit?: (employee: MobileEmployee) => void;
    onDelete?: (employee: MobileEmployee) => void;
}

const statusConfig: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    onleave: 'bg-yellow-100 text-yellow-800',
};

const statusLabel: Record<string, string> = {
    active: 'Đang làm',
    inactive: 'Nghỉ việc',
    onleave: 'Nghỉ phép',
};

export function MobileEmployeesList({
    employees,
    loading,
    onView,
    onEdit,
    onDelete,
}: MobileEmployeesListProps) {
    if (loading) {
        return (
            <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                        <CardContent className="p-3 h-20 bg-muted rounded" />
                    </Card>
                ))}
            </div>
        );
    }

    if (employees.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Không có nhân viên</p>
            </div>
        );
    }

    const hasActions = onView || onEdit || onDelete;

    return (
        <div className="space-y-2">
            {employees.map((employee) => {
                const statusKey = (employee.status || 'active') as keyof typeof statusConfig;

                return (
                    <Card
                        key={employee.id}
                        className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => onView?.(employee)}
                    >
                        <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12 shrink-0">
                                    {employee.avatar && <AvatarImage src={employee.avatar} alt={employee.name} />}
                                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                        {employee.name.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-semibold text-sm truncate">{employee.name}</p>
                                        <Badge className={statusConfig[statusKey] || statusConfig.active} variant="outline">
                                            {statusLabel[statusKey] || statusKey}
                                        </Badge>
                                    </div>

                                    {employee.job_titles?.name && (
                                        <p className="text-xs text-muted-foreground truncate">{employee.job_titles.name}</p>
                                    )}

                                    {employee.departments?.name && (
                                        <div className="flex items-center gap-1 mt-1">
                                            <Building2 className="h-3 w-3 text-muted-foreground" />
                                            <p className="text-xs text-muted-foreground truncate">{employee.departments.name}</p>
                                        </div>
                                    )}

                                    <div className="flex gap-2 mt-2 flex-wrap">
                                        {employee.phone && (
                                            <a
                                                href={`tel:${employee.phone}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                                            >
                                                <Phone className="h-3 w-3" />
                                                {employee.phone}
                                            </a>
                                        )}
                                        {employee.email && (
                                            <a
                                                href={`mailto:${employee.email}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                                            >
                                                <Mail className="h-3 w-3" />
                                                {employee.email.split('@')[0]}
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {hasActions ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                            {onView && (
                                                <DropdownMenuItem onClick={() => onView(employee)}>
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    Xem
                                                </DropdownMenuItem>
                                            )}
                                            {onEdit && (
                                                <DropdownMenuItem onClick={() => onEdit(employee)}>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Sửa
                                                </DropdownMenuItem>
                                            )}
                                            {onDelete && (
                                                <DropdownMenuItem
                                                    className="text-red-600 focus:text-red-600"
                                                    onClick={() => onDelete(employee)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Xóa
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : (
                                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                                )}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
