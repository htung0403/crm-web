import { useState, useEffect } from 'react';
import {
    DollarSign, Clock, Award, TrendingUp, Users, Send, Bot,
    Download, Eye, CheckCircle, AlertCircle, Calculator,
    FileText, Lock, MessageCircle, Sparkles, Loader2, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useSalary, type SalaryRecord, roleLabels } from '@/hooks/useSalary';
import { formatCurrency } from '@/lib/utils';

const statusLabels = {
    draft: { label: 'Nháp', variant: 'secondary' as const, icon: FileText },
    pending: { label: 'Chờ duyệt', variant: 'warning' as const, icon: Clock },
    approved: { label: 'Đã duyệt', variant: 'info' as const, icon: CheckCircle },
    paid: { label: 'Đã trả', variant: 'success' as const, icon: DollarSign },
    locked: { label: 'Đã khóa', variant: 'danger' as const, icon: Lock },
};

// Helper function to extract month/year from period string
function parsePeriod(period: string): { month: number; year: number } {
    const [monthStr, yearStr] = period.split('/');
    return {
        month: parseInt(monthStr, 10),
        year: parseInt(yearStr, 10)
    };
}

// Helper to format period
function formatPeriod(month: number, year: number): string {
    return `${String(month).padStart(2, '0')}/${year}`;
}

// AI Summary Dialog
function AISummaryDialog({ open, onClose, data }: { open: boolean; onClose: () => void; data: SalaryRecord[] }) {
    const totalGross = data.reduce((sum, d) => sum + (d.gross_salary || d.net_salary + d.deduction), 0);
    const totalNet = data.reduce((sum, d) => sum + d.net_salary, 0);
    const totalCommission = data.reduce((sum, d) => sum + d.commission, 0);
    const totalBonus = data.reduce((sum, d) => sum + d.bonus, 0);
    const avgKPI = data.length > 0
        ? data.reduce((sum, d) => sum + (d.kpi_achievement || 0), 0) / data.length
        : 0;
    const topPerformer = data.length > 0
        ? data.reduce((max, d) => d.net_salary > max.net_salary ? d : max, data[0])
        : null;

    const period = data.length > 0 ? formatPeriod(data[0].month, data[0].year) : '--/----';

    const aiSummary = `
📊 **BÁO CÁO LƯƠNG THÁNG ${period}**

👥 Tổng số nhân viên: ${data.length}
💰 Tổng lương gross: ${formatCurrency(totalGross)}
💵 Tổng lương net: ${formatCurrency(totalNet)}

📈 **PHÂN TÍCH:**
• Tổng hoa hồng: ${formatCurrency(totalCommission)} (${totalGross > 0 ? ((totalCommission / totalGross) * 100).toFixed(1) : 0}% tổng lương)
• Tổng thưởng: ${formatCurrency(totalBonus)}
• KPI trung bình: ${avgKPI.toFixed(1)}%

🏆 **TOP PERFORMER:**
${topPerformer ? `${topPerformer.user?.name || 'N/A'} - ${formatCurrency(topPerformer.net_salary)}` : 'Chưa có dữ liệu'}

📌 **NHẬN XÉT:**
${avgKPI >= 90 ? '✅ Hiệu suất team xuất sắc, đa số đạt/vượt KPI' :
            avgKPI >= 80 ? '👍 Hiệu suất team tốt, cần cải thiện một số vị trí' :
                '⚠️ Cần review lại KPI và hỗ trợ nhân viên cải thiện'}

${data.filter(d => (d.kpi_achievement || 0) < 80).length > 0 ?
            `⚠️ ${data.filter(d => (d.kpi_achievement || 0) < 80).length} nhân viên chưa đạt KPI 80%` : ''}
  `.trim();

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                        AI Tổng hợp Bảng lương
                    </DialogTitle>
                    <DialogDescription>Phân tích tự động từ AI Agent</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 border">
                        <pre className="whitespace-pre-wrap text-sm font-mono">{aiSummary}</pre>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Card className="bg-emerald-50 border-0">
                            <CardContent className="p-3">
                                <p className="text-xs text-muted-foreground">Lương cao nhất</p>
                                <p className="font-bold text-emerald-600">
                                    {data.length > 0 ? formatCurrency(Math.max(...data.map(d => d.net_salary))) : '--'}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="bg-amber-50 border-0">
                            <CardContent className="p-3">
                                <p className="text-xs text-muted-foreground">Lương thấp nhất</p>
                                <p className="font-bold text-amber-600">
                                    {data.length > 0 ? formatCurrency(Math.min(...data.map(d => d.net_salary))) : '--'}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Đóng</Button>
                    <Button className="gap-2">
                        <Download className="h-4 w-4" />
                        Xuất báo cáo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Salary Detail Dialog
function SalaryDetailDialog({
    open,
    onClose,
    record
}: {
    open: boolean;
    onClose: () => void;
    record: SalaryRecord | null;
}) {
    if (!record) return null;

    const grossSalary = record.gross_salary || (record.hourly_wage + record.overtime_pay + record.commission + record.bonus);
    const employeeName = record.user?.name || 'N/A';
    const employeeRole = record.user?.role || 'sale';

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Chi tiết bảng lương
                    </DialogTitle>
                    <DialogDescription>Kỳ lương: {formatPeriod(record.month, record.year)}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Employee Info */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Avatar className="h-12 w-12">
                            <AvatarImage src={record.user?.avatar} />
                            <AvatarFallback>{employeeName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold">{employeeName}</p>
                            <Badge variant="outline">{roleLabels[employeeRole] || employeeRole}</Badge>
                        </div>
                        <div className="ml-auto">
                            <Badge variant={statusLabels[record.status]?.variant || 'secondary'}>
                                {statusLabels[record.status]?.label || record.status}
                            </Badge>
                        </div>
                    </div>

                    {/* Earnings */}
                    <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2 text-emerald-600">
                            <TrendingUp className="h-4 w-4" />
                            THU NHẬP
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="p-2 rounded bg-muted/30">
                                <p className="text-muted-foreground">Lương theo giờ</p>
                                <p className="font-medium">{record.total_hours}h làm việc</p>
                                <p className="font-bold text-emerald-600">{formatCurrency(record.hourly_wage)}</p>
                            </div>
                            <div className="p-2 rounded bg-muted/30">
                                <p className="text-muted-foreground">Làm thêm giờ</p>
                                <p className="font-medium">{record.overtime_hours}h OT</p>
                                <p className="font-bold text-emerald-600">{formatCurrency(record.overtime_pay)}</p>
                            </div>
                            <div className="p-2 rounded bg-muted/30">
                                <p className="text-muted-foreground">Hoa hồng</p>
                                <p className="font-bold text-emerald-600">{formatCurrency(record.commission)}</p>
                            </div>
                            <div className="p-2 rounded bg-purple-50">
                                <p className="text-muted-foreground">Thưởng KPI ({record.kpi_achievement || 0}%)</p>
                                <p className="font-bold text-purple-600">{formatCurrency(record.bonus)}</p>
                            </div>
                        </div>
                        <div className="flex justify-between p-2 rounded bg-emerald-100">
                            <span className="font-semibold">Tổng thu nhập (Gross)</span>
                            <span className="font-bold text-emerald-700">{formatCurrency(grossSalary)}</span>
                        </div>
                    </div>

                    {/* Deductions */}
                    <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2 text-red-500">
                            <AlertCircle className="h-4 w-4" />
                            KHẤU TRỪ
                        </h4>
                        <div className="space-y-1 text-sm">
                            {record.social_insurance && record.social_insurance > 0 && (
                                <div className="flex justify-between p-2 rounded bg-muted/30">
                                    <span>BHXH</span>
                                    <span className="text-red-500">-{formatCurrency(record.social_insurance)}</span>
                                </div>
                            )}
                            {record.health_insurance && record.health_insurance > 0 && (
                                <div className="flex justify-between p-2 rounded bg-muted/30">
                                    <span>BHYT</span>
                                    <span className="text-red-500">-{formatCurrency(record.health_insurance)}</span>
                                </div>
                            )}
                            {record.personal_tax && record.personal_tax > 0 && (
                                <div className="flex justify-between p-2 rounded bg-muted/30">
                                    <span>Thuế TNCN</span>
                                    <span className="text-red-500">-{formatCurrency(record.personal_tax)}</span>
                                </div>
                            )}
                            {record.advances && record.advances > 0 && (
                                <div className="flex justify-between p-2 rounded bg-muted/30">
                                    <span>Tạm ứng</span>
                                    <span className="text-red-500">-{formatCurrency(record.advances)}</span>
                                </div>
                            )}
                            {record.deduction > 0 && (
                                <div className="flex justify-between p-2 rounded bg-red-100">
                                    <span className="font-semibold">Tổng khấu trừ</span>
                                    <span className="font-bold text-red-600">-{formatCurrency(record.deduction)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Net Salary */}
                    <div className="p-4 rounded-lg bg-gradient-to-r from-primary to-blue-600 text-white">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-semibold">THỰC LĨNH</span>
                            <span className="text-2xl font-bold">{formatCurrency(record.net_salary)}</span>
                        </div>
                    </div>

                    {/* Approval Info */}
                    {record.approved_by && (
                        <div className="text-xs text-muted-foreground text-center">
                            Duyệt bởi: {record.approved_by} • {record.approved_at}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>Đóng</Button>
                    {!record.telegram_sent && (
                        <Button className="gap-2 bg-blue-500 hover:bg-blue-600">
                            <MessageCircle className="h-4 w-4" />
                            Gửi Telegram
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Telegram Send Dialog
function TelegramDialog({
    open,
    onClose,
    data,
    selectedIds
}: {
    open: boolean;
    onClose: () => void;
    data: SalaryRecord[];
    selectedIds: string[];
}) {
    const [sendToCEO, setSendToCEO] = useState(true);
    const [sendToEmployees, setSendToEmployees] = useState(true);
    const [isSending, setIsSending] = useState(false);

    const selectedRecords = data.filter(d => selectedIds.includes(d.id));

    const handleSend = () => {
        setIsSending(true);
        // Simulate API call
        setTimeout(() => {
            setIsSending(false);
            alert(`Đã gửi bảng lương qua Telegram cho ${selectedRecords.length} nhân viên${sendToCEO ? ' và tổng hợp cho CEO' : ''}`);
            onClose();
        }, 1500);
    };

    const firstRecord = selectedRecords[0];

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5 text-blue-500" />
                        Gửi bảng lương qua Telegram
                    </DialogTitle>
                    <DialogDescription>
                        Gửi thông báo lương cho nhân viên và CEO
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                        <p className="text-sm font-medium text-blue-800">
                            Đã chọn {selectedRecords.length} nhân viên
                        </p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">
                            {formatCurrency(selectedRecords.reduce((sum, r) => sum + r.net_salary, 0))}
                        </p>
                        <p className="text-xs text-blue-600">Tổng lương thực lĩnh</p>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="sendToEmployees"
                                checked={sendToEmployees}
                                onCheckedChange={(c) => setSendToEmployees(!!c)}
                            />
                            <Label htmlFor="sendToEmployees" className="cursor-pointer">
                                Gửi bảng lương chi tiết cho từng nhân viên
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="sendToCEO"
                                checked={sendToCEO}
                                onCheckedChange={(c) => setSendToCEO(!!c)}
                            />
                            <Label htmlFor="sendToCEO" className="cursor-pointer">
                                Gửi báo cáo tổng hợp cho CEO
                            </Label>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="p-3 rounded-lg bg-muted/50 text-sm">
                        <p className="font-medium mb-2">📱 Preview tin nhắn:</p>
                        <div className="p-2 rounded bg-white border text-xs">
                            <p>💰 <strong>BẢNG LƯƠNG THÁNG {firstRecord ? formatPeriod(firstRecord.month, firstRecord.year) : '--/----'}</strong></p>
                            <p>Họ tên: {firstRecord?.user?.name || 'Nhân viên'}</p>
                            <p>Lương gross: {formatCurrency(firstRecord?.gross_salary || (firstRecord?.hourly_wage || 0) + (firstRecord?.commission || 0) + (firstRecord?.bonus || 0))}</p>
                            <p>Khấu trừ: -{formatCurrency(firstRecord?.deduction || 0)}</p>
                            <p className="font-bold text-emerald-600">Thực lĩnh: {formatCurrency(firstRecord?.net_salary || 0)}</p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Huỷ</Button>
                    <Button
                        onClick={handleSend}
                        disabled={isSending || (!sendToEmployees && !sendToCEO)}
                        className="gap-2 bg-blue-500 hover:bg-blue-600"
                    >
                        {isSending ? (
                            <>Đang gửi...</>
                        ) : (
                            <>
                                <Send className="h-4 w-4" />
                                Gửi Telegram
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function SalaryPage() {
    const currentDate = new Date();
    const defaultPeriod = formatPeriod(currentDate.getMonth() + 1, currentDate.getFullYear());

    const [period, setPeriod] = useState(defaultPeriod);
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showDetail, setShowDetail] = useState(false);
    const [showAISummary, setShowAISummary] = useState(false);
    const [showTelegramDialog, setShowTelegramDialog] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<SalaryRecord | null>(null);

    const {
        salaries,
        summary,
        loading,
        error,
        fetchSalaries,
        calculateAllSalaries,
        approveBulk
    } = useSalary();

    // Generate period options for last 12 months
    const periodOptions = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        return formatPeriod(date.getMonth() + 1, date.getFullYear());
    });

    // Fetch data when period changes
    useEffect(() => {
        const { month, year } = parsePeriod(period);
        fetchSalaries({ month, year, status: statusFilter !== 'all' ? statusFilter : undefined });
    }, [period, statusFilter, fetchSalaries]);

    // Filter data based on status
    const filteredData = statusFilter === 'all'
        ? salaries
        : salaries.filter(d => d.status === statusFilter);

    // Summary stats
    const totalGross = summary?.totalBaseSalary
        ? summary.totalBaseSalary + summary.totalCommission + summary.totalBonus
        : filteredData.reduce((sum, d) => sum + (d.gross_salary || d.hourly_wage + d.commission + d.bonus), 0);
    const totalNet = summary?.totalNet || filteredData.reduce((sum, d) => sum + d.net_salary, 0);
    const totalCommission = summary?.totalCommission || filteredData.reduce((sum, d) => sum + d.commission, 0);
    const pendingCount = filteredData.filter(d => d.status === 'pending').length;

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const selectAll = () => {
        if (selectedIds.length === filteredData.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredData.map(d => d.id));
        }
    };

    const handleCalculateAll = async () => {
        const { month, year } = parsePeriod(period);
        await calculateAllSalaries(month, year);
    };

    const handleApproveBulk = async () => {
        await approveBulk(selectedIds);
        setSelectedIds([]);
    };

    if (loading && salaries.length === 0) {
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
                    <h1 className="text-2xl font-bold text-foreground">Quản lý Lương</h1>
                    <p className="text-muted-foreground">Tính lương theo giờ + hoa hồng + KPI</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {periodOptions.map(p => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        className="gap-2"
                        onClick={handleCalculateAll}
                        disabled={loading}
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Tính lương
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => setShowAISummary(true)}>
                        <Bot className="h-4 w-4" />
                        AI Tổng hợp
                    </Button>
                    <Button
                        className="gap-2 bg-blue-500 hover:bg-blue-600"
                        disabled={selectedIds.length === 0}
                        onClick={() => setShowTelegramDialog(true)}
                    >
                        <MessageCircle className="h-4 w-4" />
                        Gửi Telegram
                    </Button>
                </div>
            </div>

            {/* Error message */}
            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                    {error}
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-0">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Tổng lương Gross</p>
                                <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalGross)}</p>
                            </div>
                            <DollarSign className="h-8 w-8 text-emerald-500/50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-0">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Tổng thực lĩnh</p>
                                <p className="text-xl font-bold text-blue-600">{formatCurrency(totalNet)}</p>
                            </div>
                            <Calculator className="h-8 w-8 text-blue-500/50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-0">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Tổng hoa hồng</p>
                                <p className="text-xl font-bold text-purple-600">{formatCurrency(totalCommission)}</p>
                            </div>
                            <Award className="h-8 w-8 text-purple-500/50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-0">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Chờ duyệt</p>
                                <p className="text-xl font-bold text-amber-600">{pendingCount} phiếu</p>
                            </div>
                            <Clock className="h-8 w-8 text-amber-500/50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters & Actions */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                        <div className="flex gap-2">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Trạng thái" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả</SelectItem>
                                    <SelectItem value="draft">Nháp</SelectItem>
                                    <SelectItem value="pending">Chờ duyệt</SelectItem>
                                    <SelectItem value="approved">Đã duyệt</SelectItem>
                                    <SelectItem value="paid">Đã trả</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={selectAll}>
                                {selectedIds.length === filteredData.length && filteredData.length > 0 ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                            </Button>
                            {selectedIds.length > 0 && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1"
                                        onClick={handleApproveBulk}
                                        disabled={loading}
                                    >
                                        <CheckCircle className="h-4 w-4" />
                                        Duyệt ({selectedIds.length})
                                    </Button>
                                    <Button variant="outline" size="sm" className="gap-1">
                                        <Lock className="h-4 w-4" />
                                        Khóa kỳ
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Salary Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Bảng lương tháng {period}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-y">
                                <tr>
                                    <th className="p-3 text-left w-10">
                                        <Checkbox
                                            checked={selectedIds.length === filteredData.length && filteredData.length > 0}
                                            onCheckedChange={selectAll}
                                        />
                                    </th>
                                    <th className="p-3 text-left text-sm font-medium text-muted-foreground">Nhân viên</th>
                                    <th className="p-3 text-right text-sm font-medium text-muted-foreground">Giờ công</th>
                                    <th className="p-3 text-right text-sm font-medium text-muted-foreground">Lương giờ</th>
                                    <th className="p-3 text-right text-sm font-medium text-muted-foreground">Hoa hồng</th>
                                    <th className="p-3 text-right text-sm font-medium text-muted-foreground">KPI</th>
                                    <th className="p-3 text-right text-sm font-medium text-muted-foreground">Gross</th>
                                    <th className="p-3 text-right text-sm font-medium text-muted-foreground">Thực lĩnh</th>
                                    <th className="p-3 text-center text-sm font-medium text-muted-foreground">TT</th>
                                    <th className="p-3 text-center text-sm font-medium text-muted-foreground">TG</th>
                                    <th className="p-3 text-right text-sm font-medium text-muted-foreground">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="p-8 text-center text-muted-foreground">
                                            {loading ? 'Đang tải...' : 'Chưa có dữ liệu lương cho kỳ này. Nhấn "Tính lương" để bắt đầu.'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map((record) => {
                                        const grossSalary = record.gross_salary || (record.hourly_wage + record.commission + record.bonus);
                                        const kpiAchievement = record.kpi_achievement || 0;
                                        const employeeName = record.user?.name || 'N/A';
                                        const employeeRole = record.user?.role || 'sale';

                                        return (
                                            <tr key={record.id} className="border-b hover:bg-muted/30 transition-colors">
                                                <td className="p-3">
                                                    <Checkbox
                                                        checked={selectedIds.includes(record.id)}
                                                        onCheckedChange={() => toggleSelect(record.id)}
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={record.user?.avatar} />
                                                            <AvatarFallback>{employeeName.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">{employeeName}</p>
                                                            <Badge variant="outline" className="text-xs">
                                                                {roleLabels[employeeRole] || employeeRole}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right">{record.total_hours}h</td>
                                                <td className="p-3 text-right">{formatCurrency(record.hourly_wage)}</td>
                                                <td className="p-3 text-right text-emerald-600 font-medium">
                                                    {formatCurrency(record.commission)}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <Badge variant={kpiAchievement >= 100 ? 'success' : kpiAchievement >= 80 ? 'warning' : 'danger'}>
                                                        {kpiAchievement}%
                                                    </Badge>
                                                </td>
                                                <td className="p-3 text-right font-medium">{formatCurrency(grossSalary)}</td>
                                                <td className="p-3 text-right font-bold text-primary">{formatCurrency(record.net_salary)}</td>
                                                <td className="p-3 text-center">
                                                    <Badge variant={statusLabels[record.status]?.variant || 'secondary'}>
                                                        {statusLabels[record.status]?.label || record.status}
                                                    </Badge>
                                                </td>
                                                <td className="p-3 text-center">
                                                    {record.telegram_sent ? (
                                                        <Badge variant="success" className="gap-1">
                                                            <CheckCircle className="h-3 w-3" />
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => { setSelectedRecord(record); setShowDetail(true); }}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
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

            {/* Dialogs */}
            <SalaryDetailDialog
                open={showDetail}
                onClose={() => { setShowDetail(false); setSelectedRecord(null); }}
                record={selectedRecord}
            />
            <AISummaryDialog
                open={showAISummary}
                onClose={() => setShowAISummary(false)}
                data={filteredData}
            />
            <TelegramDialog
                open={showTelegramDialog}
                onClose={() => setShowTelegramDialog(false)}
                data={filteredData}
                selectedIds={selectedIds}
            />
        </div>
    );
}
