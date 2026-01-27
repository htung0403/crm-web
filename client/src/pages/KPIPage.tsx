import { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, Award, Users, DollarSign, ShoppingCart, Clock, BarChart3, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useKPI, type KPIData } from '@/hooks/useKPI';
import { formatCurrency } from '@/lib/utils';

// KPI targets by role
const kpiTargetsByRole: Record<string, { key: string; label: string; icon: any; unit: string }[]> = {
    sale: [
        { key: 'revenue', label: 'Doanh thu', icon: DollarSign, unit: 'đ' },
        { key: 'orders', label: 'Đơn hàng', icon: ShoppingCart, unit: '' },
        { key: 'leads', label: 'Leads mới', icon: Users, unit: '' },
        { key: 'conversion', label: 'Tỷ lệ chuyển đổi', icon: TrendingUp, unit: '%' },
    ],
    technician: [
        { key: 'orders', label: 'Đơn xử lý', icon: ShoppingCart, unit: '' },
        { key: 'customerSatisfaction', label: 'Hài lòng KH', icon: Award, unit: '%' },
        { key: 'avgResponseTime', label: 'Thời gian phản hồi', icon: Clock, unit: 'h' },
    ],
    manager: [
        { key: 'revenue', label: 'Doanh thu team', icon: DollarSign, unit: 'đ' },
        { key: 'orders', label: 'Tổng đơn hàng', icon: ShoppingCart, unit: '' },
        { key: 'conversion', label: 'Tỷ lệ chuyển đổi', icon: TrendingUp, unit: '%' },
    ],
    accountant: [
        { key: 'orders', label: 'Hóa đơn xử lý', icon: ShoppingCart, unit: '' },
    ],
    admin: [
        { key: 'revenue', label: 'Tổng doanh thu', icon: DollarSign, unit: 'đ' },
        { key: 'orders', label: 'Tổng đơn hàng', icon: ShoppingCart, unit: '' },
    ]
};

function ProgressBar({ value, target, color = 'primary' }: { value: number; target: number; color?: string }) {
    const percentage = target > 0 ? Math.min((value / target) * 100, 100) : 0;
    const isAchieved = target > 0 && value >= target;

    const colorClasses = {
        primary: isAchieved ? 'bg-emerald-500' : 'bg-primary',
        danger: 'bg-red-500',
        warning: 'bg-amber-500',
        success: 'bg-emerald-500'
    };

    return (
        <div className="w-full">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${colorClasses[color as keyof typeof colorClasses] || colorClasses.primary}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>{percentage.toFixed(0)}%</span>
                {isAchieved && <Badge variant="success" className="text-xs py-0">Đạt</Badge>}
            </div>
        </div>
    );
}

function KPICard({ data, roleLabels }: { data: KPIData; roleLabels: Record<string, string> }) {
    const role = data.role as keyof typeof kpiTargetsByRole;
    const metrics = kpiTargetsByRole[role] || kpiTargetsByRole.sale;

    // Calculate overall achievement
    const achievements = metrics.map(m => {
        const metric = data.metrics[m.key as keyof typeof data.metrics];
        return metric && metric.target > 0 ? metric.actual / metric.target : 0;
    });
    const overallAchievement = achievements.length > 0
        ? (achievements.reduce((a, b) => a + b, 0) / achievements.length) * 100
        : 0;

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                            <AvatarImage src={data.avatar} />
                            <AvatarFallback>{data.employeeName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="text-base">{data.employeeName}</CardTitle>
                            <Badge variant={role === 'manager' ? 'purple' : role === 'sale' ? 'info' : 'secondary'} className="mt-1">
                                {roleLabels[data.role] || data.role}
                            </Badge>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={`text-2xl font-bold ${overallAchievement >= 100 ? 'text-emerald-600' : overallAchievement >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                            {overallAchievement.toFixed(0)}%
                        </div>
                        <p className="text-xs text-muted-foreground">Tổng KPI</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {metrics.map((metric) => {
                    const m = data.metrics[metric.key as keyof typeof data.metrics];
                    if (!m) return null;
                    const Icon = metric.icon;
                    return (
                        <div key={metric.key} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <Icon className="h-4 w-4" />
                                    {metric.label}
                                </span>
                                <span className="font-medium">
                                    {metric.unit === 'đ' ? formatCurrency(m.actual) : `${m.actual}${metric.unit}`}
                                    <span className="text-muted-foreground font-normal"> / {metric.unit === 'đ' ? formatCurrency(m.target) : `${m.target}${metric.unit}`}</span>
                                </span>
                            </div>
                            <ProgressBar value={m.actual} target={m.target} />
                        </div>
                    );
                })}

                {/* Commission & Bonus */}
                <div className="pt-3 border-t grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground">Hoa hồng</p>
                        <p className="font-bold text-emerald-600">{formatCurrency(data.commission)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Thưởng</p>
                        <p className="font-bold text-purple-600">{formatCurrency(data.bonus)}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function LeaderboardTable({ data, roleLabels }: { data: KPIData[]; roleLabels: Record<string, string> }) {
    // Sort by total revenue
    const sortedData = [...data].sort((a, b) => {
        const aTotal = a.metrics.revenue.actual + a.commission + a.bonus;
        const bTotal = b.metrics.revenue.actual + b.commission + b.bonus;
        return bTotal - aTotal;
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-500" />
                    Bảng xếp hạng
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50 border-y">
                            <tr>
                                <th className="p-3 text-left text-sm font-medium text-muted-foreground w-12">#</th>
                                <th className="p-3 text-left text-sm font-medium text-muted-foreground">Nhân viên</th>
                                <th className="p-3 text-right text-sm font-medium text-muted-foreground">Doanh thu</th>
                                <th className="p-3 text-right text-sm font-medium text-muted-foreground">Đơn hàng</th>
                                <th className="p-3 text-right text-sm font-medium text-muted-foreground">Hoa hồng</th>
                                <th className="p-3 text-center text-sm font-medium text-muted-foreground">Thành tích</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                                        Chưa có dữ liệu KPI
                                    </td>
                                </tr>
                            ) : (
                                sortedData.map((emp, index) => {
                                    const achievement = emp.metrics.revenue.target > 0
                                        ? (emp.metrics.revenue.actual / emp.metrics.revenue.target) * 100
                                        : 0;
                                    return (
                                        <tr key={emp.employeeId} className="border-b hover:bg-muted/30 transition-colors">
                                            <td className="p-3">
                                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={emp.avatar} />
                                                        <AvatarFallback>{emp.employeeName.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium">{emp.employeeName}</p>
                                                        <Badge variant="outline" className="text-xs">{roleLabels[emp.role] || emp.role}</Badge>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 text-right font-semibold">{formatCurrency(emp.metrics.revenue.actual)}</td>
                                            <td className="p-3 text-right">{emp.metrics.orders.actual}</td>
                                            <td className="p-3 text-right text-emerald-600 font-medium">{formatCurrency(emp.commission)}</td>
                                            <td className="p-3 text-center">
                                                <Badge variant={achievement >= 100 ? 'success' : achievement >= 80 ? 'warning' : 'danger'}>
                                                    {achievement.toFixed(0)}%
                                                </Badge>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

export function KPIPage() {
    const [period, setPeriod] = useState('month');
    const [roleFilter, setRoleFilter] = useState('all');

    const { kpiData, summary, roleLabels, loading, error, fetchSummary } = useKPI();

    useEffect(() => {
        fetchSummary({ period, role: roleFilter });
    }, [fetchSummary, period, roleFilter]);

    // Summary stats from API or calculate from data
    const totalRevenue = summary?.totalRevenue || 0;
    const totalTarget = summary?.totalTarget || 0;
    const totalCommission = summary?.totalCommission || 0;
    const avgAchievement = summary?.avgAchievement || 0;
    const topPerformers = summary?.topPerformers || 0;

    if (loading && kpiData.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">KPI & Hiệu suất</h1>
                    <p className="text-muted-foreground">Theo dõi và đánh giá hiệu suất nhân viên</p>
                </div>
                <div className="flex gap-2">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-36">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="week">Tuần này</SelectItem>
                            <SelectItem value="month">Tháng này</SelectItem>
                            <SelectItem value="quarter">Quý này</SelectItem>
                            <SelectItem value="year">Năm nay</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-36">
                            <SelectValue placeholder="Vai trò" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tất cả</SelectItem>
                            <SelectItem value="sale">Sale</SelectItem>
                            <SelectItem value="technician">Kỹ thuật</SelectItem>
                            <SelectItem value="manager">Quản lý</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                    {error}
                </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-0">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Tổng doanh thu</p>
                                <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalRevenue)}</p>
                                <p className="text-xs text-muted-foreground">Mục tiêu: {formatCurrency(totalTarget)}</p>
                            </div>
                            <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <DollarSign className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-0">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Tiến độ KPI</p>
                                <p className="text-2xl font-bold text-emerald-600">{avgAchievement.toFixed(1)}%</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    {avgAchievement >= 100 ? (
                                        <>
                                            <TrendingUp className="h-3 w-3" />
                                            Vượt mục tiêu
                                        </>
                                    ) : (
                                        <>
                                            <TrendingDown className="h-3 w-3" />
                                            Còn {(100 - avgAchievement).toFixed(1)}%
                                        </>
                                    )}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                <Target className="h-6 w-6 text-emerald-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-0">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Tổng hoa hồng</p>
                                <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalCommission)}</p>
                                <p className="text-xs text-muted-foreground">{kpiData.length} nhân viên</p>
                            </div>
                            <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                <Award className="h-6 w-6 text-purple-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-0">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Đạt mục tiêu</p>
                                <p className="text-2xl font-bold text-amber-600">{topPerformers}/{kpiData.length}</p>
                                <p className="text-xs text-muted-foreground">
                                    {kpiData.length > 0 ? ((topPerformers / kpiData.length) * 100).toFixed(0) : 0}% nhân viên
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                <Users className="h-6 w-6 text-amber-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Leaderboard */}
            <LeaderboardTable data={kpiData} roleLabels={roleLabels} />

            {/* Individual KPI Cards */}
            <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Chi tiết KPI từng nhân viên
                </h2>
                {kpiData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Chưa có dữ liệu KPI cho nhân viên
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {kpiData.map((data) => (
                            <KPICard key={data.employeeId} data={data} roleLabels={roleLabels} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
