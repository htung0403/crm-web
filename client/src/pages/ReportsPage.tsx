import { useState } from 'react';
import {
    BarChart3, TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart,
    FileText, Download, Calendar, Filter, PieChart, LineChart,
    ArrowUpRight, ArrowDownRight, Building2, Target, Award
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';

// Mock report data
const revenueData = {
    total: 1250000000,
    previousPeriod: 1100000000,
    growth: 13.6,
    byMonth: [
        { month: 'T1', value: 85000000 },
        { month: 'T2', value: 92000000 },
        { month: 'T3', value: 78000000 },
        { month: 'T4', value: 105000000 },
        { month: 'T5', value: 98000000 },
        { month: 'T6', value: 115000000 },
        { month: 'T7', value: 88000000 },
        { month: 'T8', value: 125000000 },
        { month: 'T9', value: 110000000 },
        { month: 'T10', value: 135000000 },
        { month: 'T11', value: 108000000 },
        { month: 'T12', value: 111000000 },
    ],
    bySource: [
        { source: 'Sản phẩm', value: 650000000, percent: 52 },
        { source: 'Dịch vụ', value: 380000000, percent: 30 },
        { source: 'Gói combo', value: 150000000, percent: 12 },
        { source: 'Voucher', value: 70000000, percent: 6 },
    ],
};

const salesData = {
    totalOrders: 245,
    totalCustomers: 89,
    avgOrderValue: 5102040,
    conversionRate: 28.5,
    topProducts: [
        { name: 'License User Premium', quantity: 125, revenue: 125000000 },
        { name: 'Gói Enterprise', quantity: 15, revenue: 225000000 },
        { name: 'Training onsite', quantity: 45, revenue: 360000000 },
        { name: 'Customize module', quantity: 8, revenue: 160000000 },
        { name: 'Module API Integration', quantity: 12, revenue: 180000000 },
    ],
    bySalesperson: [
        { name: 'Trần Văn Minh', orders: 85, revenue: 420000000, commission: 21000000 },
        { name: 'Lê Thị Lan', orders: 72, revenue: 380000000, commission: 19000000 },
        { name: 'Nguyễn Văn Hùng', orders: 58, revenue: 280000000, commission: 14000000 },
        { name: 'Phạm Thị Mai', orders: 30, revenue: 170000000, commission: 8500000 },
    ],
};

const financialData = {
    income: 1250000000,
    expense: 820000000,
    profit: 430000000,
    profitMargin: 34.4,
    expenseBreakdown: [
        { category: 'Lương nhân viên', value: 450000000, percent: 55 },
        { category: 'Hoa hồng', value: 125000000, percent: 15 },
        { category: 'Vận hành', value: 120000000, percent: 15 },
        { category: 'Marketing', value: 80000000, percent: 10 },
        { category: 'Khác', value: 45000000, percent: 5 },
    ],
};

const hrData = {
    totalEmployees: 25,
    avgKPI: 87.5,
    totalSalary: 450000000,
    totalCommission: 125000000,
    byDepartment: [
        { dept: 'Kinh doanh', count: 10, salary: 180000000 },
        { dept: 'Kỹ thuật', count: 8, salary: 150000000 },
        { dept: 'Kế toán', count: 3, salary: 60000000 },
        { dept: 'Quản lý', count: 4, salary: 60000000 },
    ],
};

// Simple Bar Chart Component
function SimpleBarChart({ data, maxValue }: { data: { label: string; value: number }[]; maxValue: number }) {
    return (
        <div className="space-y-2">
            {data.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-8 shrink-0">{item.label}</span>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all duration-500"
                            style={{ width: `${(item.value / maxValue) * 100}%` }}
                        />
                    </div>
                    <span className="text-sm font-medium w-20 text-right">{formatCurrency(item.value)}</span>
                </div>
            ))}
        </div>
    );
}

// Progress Ring Component
function ProgressRing({ percent, size = 120, strokeWidth = 12, color = 'primary' }: { percent: number; size?: number; strokeWidth?: number; color?: string }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percent / 100) * circumference;

    const colorClasses: Record<string, string> = {
        primary: 'text-primary',
        success: 'text-emerald-500',
        warning: 'text-amber-500',
        danger: 'text-red-500',
    };

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg className="transform -rotate-90" width={size} height={size}>
                <circle
                    className="text-muted"
                    strokeWidth={strokeWidth}
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <circle
                    className={colorClasses[color]}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{percent}%</span>
            </div>
        </div>
    );
}

// Donut Chart Component for multiple segments
function DonutChart({
    data,
    size = 160,
    strokeWidth = 24
}: {
    data: { label: string; value: number; percent: number; color: string }[];
    size?: number;
    strokeWidth?: number;
}) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;

    // Calculate cumulative offsets for each segment
    let cumulativePercent = 0;
    const segments = data.map((item) => {
        const startOffset = circumference - (cumulativePercent / 100) * circumference;
        const segmentLength = (item.percent / 100) * circumference;
        cumulativePercent += item.percent;
        return {
            ...item,
            dasharray: `${segmentLength} ${circumference - segmentLength}`,
            dashoffset: startOffset,
        };
    });

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg className="transform -rotate-90" width={size} height={size}>
                {/* Background circle */}
                <circle
                    className="text-muted"
                    strokeWidth={strokeWidth}
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                {/* Segments */}
                {segments.map((segment, index) => (
                    <circle
                        key={index}
                        stroke={segment.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={segment.dasharray}
                        strokeDashoffset={segment.dashoffset}
                        fill="transparent"
                        r={radius}
                        cx={size / 2}
                        cy={size / 2}
                        className="transition-all duration-500"
                    />
                ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold">{formatCurrency(revenueData.total)}</span>
                <span className="text-xs text-muted-foreground">Tổng</span>
            </div>
        </div>
    );
}

// Stat Card with trend
function StatCard({
    title,
    value,
    change,
    icon: Icon,
    color = 'blue'
}: {
    title: string;
    value: string | number;
    change?: number;
    icon: React.ElementType;
    color?: string;
}) {
    const colorClasses: Record<string, string> = {
        blue: 'from-blue-50 to-blue-100',
        green: 'from-emerald-50 to-emerald-100',
        purple: 'from-purple-50 to-purple-100',
        amber: 'from-amber-50 to-amber-100',
    };

    const iconColors: Record<string, string> = {
        blue: 'text-blue-600',
        green: 'text-emerald-600',
        purple: 'text-purple-600',
        amber: 'text-amber-600',
    };

    return (
        <Card className={`bg-gradient-to-br ${colorClasses[color]} border-0`}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">{title}</p>
                        <p className={`text-2xl font-bold ${iconColors[color]}`}>
                            {typeof value === 'number' ? formatCurrency(value) : value}
                        </p>
                        {change !== undefined && (
                            <div className={`flex items-center gap-1 text-sm mt-1 ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {change >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                {Math.abs(change)}% so với kỳ trước
                            </div>
                        )}
                    </div>
                    <Icon className={`h-8 w-8 ${iconColors[color]} opacity-50`} />
                </div>
            </CardContent>
        </Card>
    );
}

export function ReportsPage() {
    const [period, setPeriod] = useState('month');
    const [reportType, setReportType] = useState('revenue');

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Báo cáo</h1>
                    <p className="text-muted-foreground">Phân tích và thống kê hoạt động kinh doanh</p>
                </div>
                <div className="flex gap-2">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-36">
                            <Calendar className="h-4 w-4 mr-2" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="week">Tuần này</SelectItem>
                            <SelectItem value="month">Tháng này</SelectItem>
                            <SelectItem value="quarter">Quý này</SelectItem>
                            <SelectItem value="year">Năm nay</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" className="gap-2">
                        <Download className="h-4 w-4" />
                        Xuất báo cáo
                    </Button>
                </div>
            </div>

            {/* Report Tabs */}
            <Tabs value={reportType} onValueChange={setReportType}>
                <TabsList className="mb-4 flex-wrap h-auto gap-2">
                    <TabsTrigger value="revenue" className="gap-2">
                        <DollarSign className="h-4 w-4" />
                        Doanh thu
                    </TabsTrigger>
                    <TabsTrigger value="sales" className="gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        Bán hàng
                    </TabsTrigger>
                    <TabsTrigger value="financial" className="gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Tài chính
                    </TabsTrigger>
                    <TabsTrigger value="hr" className="gap-2">
                        <Users className="h-4 w-4" />
                        Nhân sự
                    </TabsTrigger>
                </TabsList>

                {/* Revenue Report */}
                <TabsContent value="revenue" className="space-y-6">
                    {/* Overview Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard
                            title="Tổng doanh thu"
                            value={revenueData.total}
                            change={revenueData.growth}
                            icon={DollarSign}
                            color="green"
                        />
                        <StatCard
                            title="Kỳ trước"
                            value={revenueData.previousPeriod}
                            icon={TrendingUp}
                            color="blue"
                        />
                        <StatCard
                            title="Tăng trưởng"
                            value={`${revenueData.growth}%`}
                            icon={TrendingUp}
                            color="purple"
                        />
                        <StatCard
                            title="Trung bình/tháng"
                            value={Math.round(revenueData.total / 12)}
                            icon={BarChart3}
                            color="amber"
                        />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Revenue by Month */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <LineChart className="h-5 w-5 text-primary" />
                                    Doanh thu theo tháng
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <SimpleBarChart
                                    data={revenueData.byMonth.map(m => ({ label: m.month, value: m.value }))}
                                    maxValue={Math.max(...revenueData.byMonth.map(m => m.value))}
                                />
                            </CardContent>
                        </Card>

                        {/* Revenue by Source */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <PieChart className="h-5 w-5 text-primary" />
                                    Doanh thu theo nguồn
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-center mb-6">
                                    <DonutChart
                                        data={revenueData.bySource.map((item, index) => {
                                            const colors = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b'];
                                            return {
                                                label: item.source,
                                                value: item.value,
                                                percent: item.percent,
                                                color: colors[index]
                                            };
                                        })}
                                        size={160}
                                        strokeWidth={28}
                                    />
                                </div>
                                <div className="space-y-3">
                                    {revenueData.bySource.map((item, index) => {
                                        const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500'];
                                        return (
                                            <div key={index} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={`h-3 w-3 rounded-full ${colors[index]}`} />
                                                    <span className="text-sm">{item.source}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-medium">{formatCurrency(item.value)}</span>
                                                    <span className="text-muted-foreground text-sm ml-2">({item.percent}%)</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Sales Report */}
                <TabsContent value="sales" className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard title="Tổng đơn hàng" value={salesData.totalOrders.toString()} icon={ShoppingCart} color="blue" />
                        <StatCard title="Khách hàng" value={salesData.totalCustomers.toString()} icon={Users} color="green" />
                        <StatCard title="Giá trị TB/đơn" value={salesData.avgOrderValue} icon={DollarSign} color="purple" />
                        <StatCard title="Tỷ lệ chuyển đổi" value={`${salesData.conversionRate}%`} icon={Target} color="amber" />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Top Products */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Award className="h-5 w-5 text-primary" />
                                    Top sản phẩm/dịch vụ
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {salesData.topProducts.map((product, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <span className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-white ${index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-muted-foreground'
                                                    }`}>
                                                    {index + 1}
                                                </span>
                                                <div>
                                                    <p className="font-medium">{product.name}</p>
                                                    <p className="text-xs text-muted-foreground">{product.quantity} đơn</p>
                                                </div>
                                            </div>
                                            <span className="font-bold text-emerald-600">{formatCurrency(product.revenue)}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Sales by Person */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="h-5 w-5 text-primary" />
                                    Doanh thu theo nhân viên
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {salesData.bySalesperson.map((person, index) => (
                                        <div key={index} className="p-3 bg-muted/50 rounded-lg">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-medium">{person.name}</span>
                                                <Badge variant="outline">{person.orders} đơn</Badge>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Doanh thu: <span className="text-foreground font-medium">{formatCurrency(person.revenue)}</span></span>
                                                <span className="text-emerald-600">HH: {formatCurrency(person.commission)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Financial Report */}
                <TabsContent value="financial" className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard title="Tổng thu" value={financialData.income} icon={TrendingUp} color="green" />
                        <StatCard title="Tổng chi" value={financialData.expense} icon={TrendingDown} color="amber" />
                        <StatCard title="Lợi nhuận" value={financialData.profit} icon={DollarSign} color="blue" />
                        <StatCard title="Biên lợi nhuận" value={`${financialData.profitMargin}%`} icon={PieChart} color="purple" />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Profit Overview */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Tổng quan lợi nhuận</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-center mb-6">
                                    <ProgressRing percent={financialData.profitMargin} size={160} strokeWidth={16} color="success" />
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div className="p-4 bg-emerald-50 rounded-lg">
                                        <p className="text-sm text-muted-foreground">Thu</p>
                                        <p className="text-xl font-bold text-emerald-600">{formatCurrency(financialData.income)}</p>
                                    </div>
                                    <div className="p-4 bg-red-50 rounded-lg">
                                        <p className="text-sm text-muted-foreground">Chi</p>
                                        <p className="text-xl font-bold text-red-600">{formatCurrency(financialData.expense)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Expense Breakdown */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Chi phí theo danh mục</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {financialData.expenseBreakdown.map((item, index) => {
                                        const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-gray-500'];
                                        return (
                                            <div key={index}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span>{item.category}</span>
                                                    <span className="font-medium">{formatCurrency(item.value)} ({item.percent}%)</span>
                                                </div>
                                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${colors[index]} rounded-full transition-all duration-500`}
                                                        style={{ width: `${item.percent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* HR Report */}
                <TabsContent value="hr" className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard title="Tổng nhân viên" value={hrData.totalEmployees.toString()} icon={Users} color="blue" />
                        <StatCard title="KPI trung bình" value={`${hrData.avgKPI}%`} icon={Target} color="green" />
                        <StatCard title="Tổng lương" value={hrData.totalSalary} icon={DollarSign} color="purple" />
                        <StatCard title="Tổng hoa hồng" value={hrData.totalCommission} icon={Award} color="amber" />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* By Department */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-primary" />
                                    Nhân sự theo phòng ban
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {hrData.byDepartment.map((dept, index) => (
                                        <div key={index} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                            <div>
                                                <p className="font-medium">{dept.dept}</p>
                                                <p className="text-sm text-muted-foreground">{dept.count} nhân viên</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold">{formatCurrency(dept.salary)}</p>
                                                <p className="text-xs text-muted-foreground">Tổng lương</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* KPI Overview */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Target className="h-5 w-5 text-primary" />
                                    Hiệu suất KPI
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-center mb-6">
                                    <ProgressRing
                                        percent={hrData.avgKPI}
                                        size={160}
                                        strokeWidth={16}
                                        color={hrData.avgKPI >= 90 ? 'success' : hrData.avgKPI >= 70 ? 'warning' : 'danger'}
                                    />
                                </div>
                                <div className="text-center">
                                    <p className="text-muted-foreground">KPI trung bình toàn công ty</p>
                                    <p className={`text-lg font-bold ${hrData.avgKPI >= 90 ? 'text-emerald-600' : hrData.avgKPI >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                                        {hrData.avgKPI >= 90 ? '🎉 Xuất sắc!' : hrData.avgKPI >= 70 ? '👍 Tốt' : '⚠️ Cần cải thiện'}
                                    </p>
                                </div>
                                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                                    <div className="flex justify-between text-sm">
                                        <span>Chi phí nhân sự</span>
                                        <span className="font-bold">{formatCurrency(hrData.totalSalary + hrData.totalCommission)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
