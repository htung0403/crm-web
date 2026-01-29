import { useState, useEffect } from 'react';
import {
    BarChart3, TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart,
    Download, Calendar, PieChart, LineChart, Printer,
    ArrowUpRight, ArrowDownRight, Building2, Target, Award, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';

// Types for report data
interface RevenueData {
    total: number;
    previousPeriod: number;
    growth: number;
    byMonth: { month: string; value: number }[];
    bySource: { source: string; value: number; percent: number }[];
}

interface SalesData {
    totalOrders: number;
    totalCustomers: number;
    avgOrderValue: number;
    topProducts: { name: string; quantity: number; revenue: number }[];
    bySalesperson: { id: string; name: string; orders: number; revenue: number; commission: number }[];
}

interface HRData {
    totalEmployees: number;
    totalSalary: number;
    byDepartment: { id: string; dept: string; count: number; salary: number }[];
}

interface ReportSummary {
    revenue: RevenueData;
    sales: SalesData;
    hr: HRData;
}

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
                            style={{ width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
                        />
                    </div>
                    <span className="text-sm font-medium w-24 text-right">{formatCurrency(item.value)}</span>
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
    total,
    size = 160,
    strokeWidth = 24
}: {
    data: { label: string; value: number; percent: number; color: string }[];
    total: number;
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
                <span className="text-lg font-bold">{formatCurrency(total)}</span>
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
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<ReportSummary | null>(null);

    // Custom date range
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    useEffect(() => {
        // Only fetch if not custom, or if custom has both dates
        if (period !== 'custom' || (fromDate && toDate)) {
            fetchReportData();
        }
    }, [period, fromDate, toDate]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            let url = `/reports/summary?period=${period}`;
            if (period === 'custom' && fromDate && toDate) {
                url = `/reports/summary?period=custom&from_date=${fromDate}&to_date=${toDate}`;
            }
            const response = await api.get(url);
            setReportData(response.data?.data || null);
        } catch (error) {
            console.error('Error fetching report data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Default empty data
    const emptyRevenue: RevenueData = { total: 0, previousPeriod: 0, growth: 0, byMonth: [], bySource: [] };
    const emptySales: SalesData = { totalOrders: 0, totalCustomers: 0, avgOrderValue: 0, topProducts: [], bySalesperson: [] };
    const emptyHR: HRData = { totalEmployees: 0, totalSalary: 0, byDepartment: [] };

    const revenueData = reportData?.revenue || emptyRevenue;
    const salesData = reportData?.sales || emptySales;
    const hrData = reportData?.hr || emptyHR;

    // Get period label
    const periodLabels: Record<string, string> = {
        week: 'Tuần này',
        month: 'Tháng này',
        quarter: 'Quý này',
        year: 'Năm nay',
        custom: fromDate && toDate ? `Từ ${fromDate} đến ${toDate}` : 'Tùy chọn',
    };

    // Print report function
    const handlePrintReport = () => {
        const periodLabel = period === 'custom' && fromDate && toDate
            ? `Từ ${new Date(fromDate).toLocaleDateString('vi-VN')} đến ${new Date(toDate).toLocaleDateString('vi-VN')}`
            : periodLabels[period] || period;
        const reportTypeLabels: Record<string, string> = {
            revenue: 'Báo cáo Doanh thu',
            sales: 'Báo cáo Bán hàng',
            hr: 'Báo cáo Nhân sự',
        };
        const reportTitle = reportTypeLabels[reportType] || 'Báo cáo';

        let reportContent = '';

        if (reportType === 'revenue') {
            reportContent = `
                <div class="summary-cards">
                    <div class="card">
                        <h3>Tổng doanh thu</h3>
                        <p class="value">${formatCurrency(revenueData.total)}</p>
                        <p class="change ${revenueData.growth >= 0 ? 'positive' : 'negative'}">
                            ${revenueData.growth >= 0 ? '+' : ''}${revenueData.growth.toFixed(1)}% so với kỳ trước
                        </p>
                    </div>
                    <div class="card">
                        <h3>Kỳ trước</h3>
                        <p class="value">${formatCurrency(revenueData.previousPeriod)}</p>
                    </div>
                </div>
                ${revenueData.byMonth?.length > 0 ? `
                <div class="section">
                    <h3>Doanh thu theo tháng</h3>
                    <table>
                        <thead><tr><th>Tháng</th><th>Doanh thu</th></tr></thead>
                        <tbody>
                            ${revenueData.byMonth.map(m => `<tr><td>${m.month}</td><td>${formatCurrency(m.value)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>` : ''}
                ${revenueData.bySource?.length > 0 ? `
                <div class="section">
                    <h3>Doanh thu theo nguồn</h3>
                    <table>
                        <thead><tr><th>Nguồn</th><th>Doanh thu</th><th>Tỷ lệ</th></tr></thead>
                        <tbody>
                            ${revenueData.bySource.map(s => `<tr><td>${s.source}</td><td>${formatCurrency(s.value)}</td><td>${s.percent.toFixed(1)}%</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>` : ''}
            `;
        } else if (reportType === 'sales') {
            reportContent = `
                <div class="summary-cards">
                    <div class="card">
                        <h3>Tổng đơn hàng</h3>
                        <p class="value">${salesData.totalOrders}</p>
                    </div>
                    <div class="card">
                        <h3>Tổng khách hàng</h3>
                        <p class="value">${salesData.totalCustomers}</p>
                    </div>
                    <div class="card">
                        <h3>Giá trị TB/đơn</h3>
                        <p class="value">${formatCurrency(salesData.avgOrderValue)}</p>
                    </div>
                </div>
                ${salesData.topProducts?.length > 0 ? `
                <div class="section">
                    <h3>Top sản phẩm/dịch vụ</h3>
                    <table>
                        <thead><tr><th>Tên</th><th>Số lượng</th><th>Doanh thu</th></tr></thead>
                        <tbody>
                            ${salesData.topProducts.map(p => `<tr><td>${p.name}</td><td>${p.quantity}</td><td>${formatCurrency(p.revenue)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>` : ''}
                ${salesData.bySalesperson?.length > 0 ? `
                <div class="section">
                    <h3>Doanh số theo nhân viên</h3>
                    <table>
                        <thead><tr><th>Nhân viên</th><th>Đơn hàng</th><th>Doanh thu</th><th>Hoa hồng</th></tr></thead>
                        <tbody>
                            ${salesData.bySalesperson.map(s => `<tr><td>${s.name}</td><td>${s.orders}</td><td>${formatCurrency(s.revenue)}</td><td>${formatCurrency(s.commission)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>` : ''}
            `;
        } else if (reportType === 'hr') {
            reportContent = `
                <div class="summary-cards">
                    <div class="card">
                        <h3>Tổng nhân viên</h3>
                        <p class="value">${hrData.totalEmployees}</p>
                    </div>
                    <div class="card">
                        <h3>Tổng lương</h3>
                        <p class="value">${formatCurrency(hrData.totalSalary)}</p>
                    </div>
                </div>
                ${hrData.byDepartment?.length > 0 ? `
                <div class="section">
                    <h3>Phân bổ theo phòng ban</h3>
                    <table>
                        <thead><tr><th>Phòng ban</th><th>Nhân viên</th><th>Tổng lương</th></tr></thead>
                        <tbody>
                            ${hrData.byDepartment.map(d => `<tr><td>${d.dept}</td><td>${d.count}</td><td>${formatCurrency(d.salary)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>` : ''}
            `;
        }

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${reportTitle} - ${periodLabel}</title>
                    <style>
                        body {
                            font-family: 'Segoe UI', Arial, sans-serif;
                            padding: 40px;
                            max-width: 800px;
                            margin: 0 auto;
                            color: #333;
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 30px;
                            border-bottom: 2px solid #2563eb;
                            padding-bottom: 20px;
                        }
                        .header h1 {
                            margin: 0 0 10px 0;
                            color: #1e40af;
                        }
                        .header p {
                            margin: 0;
                            color: #666;
                        }
                        .summary-cards {
                            display: flex;
                            gap: 20px;
                            margin-bottom: 30px;
                            flex-wrap: wrap;
                        }
                        .card {
                            flex: 1;
                            min-width: 150px;
                            background: #f8fafc;
                            border: 1px solid #e2e8f0;
                            border-radius: 8px;
                            padding: 16px;
                        }
                        .card h3 {
                            margin: 0 0 8px 0;
                            font-size: 14px;
                            color: #64748b;
                        }
                        .card .value {
                            margin: 0;
                            font-size: 24px;
                            font-weight: bold;
                            color: #1e40af;
                        }
                        .card .change {
                            margin: 5px 0 0 0;
                            font-size: 12px;
                        }
                        .card .change.positive { color: #16a34a; }
                        .card .change.negative { color: #dc2626; }
                        .section {
                            margin-bottom: 30px;
                        }
                        .section h3 {
                            margin: 0 0 15px 0;
                            color: #1e40af;
                            border-bottom: 1px solid #e2e8f0;
                            padding-bottom: 8px;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                        }
                        th, td {
                            padding: 10px;
                            text-align: left;
                            border-bottom: 1px solid #e2e8f0;
                        }
                        th {
                            background: #f1f5f9;
                            font-weight: 600;
                        }
                        tr:hover { background: #f8fafc; }
                        .footer {
                            margin-top: 40px;
                            text-align: center;
                            font-size: 12px;
                            color: #94a3b8;
                            border-top: 1px solid #e2e8f0;
                            padding-top: 20px;
                        }
                        @media print {
                            body { padding: 20px; }
                            .card { break-inside: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${reportTitle}</h1>
                        <p>Kỳ báo cáo: ${periodLabel} | Ngày in: ${new Date().toLocaleDateString('vi-VN')}</p>
                    </div>
                    ${reportContent}
                    <div class="footer">
                        <p>Báo cáo được tạo tự động từ hệ thống CRM</p>
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 250);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Báo cáo</h1>
                    <p className="text-muted-foreground">Phân tích và thống kê hoạt động kinh doanh</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <Select value={period} onValueChange={(v) => {
                        setPeriod(v);
                        if (v !== 'custom') {
                            setFromDate('');
                            setToDate('');
                        }
                    }}>
                        <SelectTrigger className="w-36">
                            <Calendar className="h-4 w-4 mr-2" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="week">Tuần này</SelectItem>
                            <SelectItem value="month">Tháng này</SelectItem>
                            <SelectItem value="quarter">Quý này</SelectItem>
                            <SelectItem value="year">Năm nay</SelectItem>
                            <SelectItem value="custom">Tùy chọn...</SelectItem>
                        </SelectContent>
                    </Select>
                    {period === 'custom' && (
                        <>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Từ:</span>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Đến:</span>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                                />
                            </div>
                        </>
                    )}
                    <Button variant="outline" className="gap-2" onClick={handlePrintReport}>
                        <Printer className="h-4 w-4" />
                        In báo cáo
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
                            value={revenueData.byMonth.length > 0 ? Math.round(revenueData.total / revenueData.byMonth.length) : 0}
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
                                {revenueData.byMonth.length > 0 ? (
                                    <SimpleBarChart
                                        data={revenueData.byMonth.map(m => ({ label: m.month, value: m.value }))}
                                        maxValue={Math.max(...revenueData.byMonth.map(m => m.value), 1)}
                                    />
                                ) : (
                                    <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu</p>
                                )}
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
                                {revenueData.bySource.length > 0 ? (
                                    <>
                                        <div className="flex items-center justify-center mb-6">
                                            <DonutChart
                                                data={revenueData.bySource.map((item, index) => {
                                                    const colors = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b'];
                                                    return {
                                                        label: item.source,
                                                        value: item.value,
                                                        percent: item.percent,
                                                        color: colors[index % colors.length]
                                                    };
                                                })}
                                                total={revenueData.total}
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
                                                            <div className={`h-3 w-3 rounded-full ${colors[index % colors.length]}`} />
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
                                    </>
                                ) : (
                                    <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu</p>
                                )}
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
                        <StatCard title="Tổng doanh thu" value={revenueData.total} icon={Target} color="amber" />
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
                                {salesData.topProducts.length > 0 ? (
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
                                ) : (
                                    <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu</p>
                                )}
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
                                {salesData.bySalesperson.length > 0 ? (
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
                                ) : (
                                    <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* HR Report */}
                <TabsContent value="hr" className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard title="Tổng nhân viên" value={hrData.totalEmployees.toString()} icon={Users} color="blue" />
                        <StatCard title="KPI trung bình" value="85%" icon={Target} color="green" />
                        <StatCard title="Tổng lương" value={hrData.totalSalary} icon={DollarSign} color="purple" />
                        <StatCard title="Tổng hoa hồng" value={salesData.bySalesperson.reduce((sum, p) => sum + p.commission, 0)} icon={Award} color="amber" />
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
                                {hrData.byDepartment.length > 0 ? (
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
                                ) : (
                                    <p className="text-center text-muted-foreground py-8">Chưa có dữ liệu</p>
                                )}
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
                                        percent={85}
                                        size={160}
                                        strokeWidth={16}
                                        color="success"
                                    />
                                </div>
                                <div className="text-center">
                                    <p className="text-muted-foreground">KPI trung bình toàn công ty</p>
                                    <p className="text-lg font-bold text-emerald-600">🎉 Xuất sắc!</p>
                                </div>
                                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                                    <div className="flex justify-between text-sm">
                                        <span>Chi phí nhân sự</span>
                                        <span className="font-bold">{formatCurrency(hrData.totalSalary + salesData.bySalesperson.reduce((sum, p) => sum + p.commission, 0))}</span>
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
