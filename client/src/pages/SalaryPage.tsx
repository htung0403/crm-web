import { useState } from 'react';
import {
    DollarSign, Clock, Award, TrendingUp, Users, Send, Bot,
    Download, Eye, CheckCircle, AlertCircle, Calculator,
    FileText, Lock, Unlock, MessageCircle, Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { users, roleLabels } from '@/data/mockData';
import { formatCurrency } from '@/lib/utils';

// Salary data structure
interface SalaryRecord {
    employeeId: string;
    employeeName: string;
    avatar?: string;
    role: string;
    period: string;

    // Base salary
    baseSalary: number;
    hourlyRate: number;
    hoursWorked: number;
    hourlyTotal: number;

    // Commission
    serviceCommission: number; // Hoa hồng dịch vụ
    productCommission: number; // Hoa hồng sản phẩm
    referralCommission: number; // Hoa hồng giới thiệu
    totalCommission: number;

    // KPI Bonus
    kpiAchievement: number; // percentage
    kpiBonus: number;

    // Deductions
    socialInsurance: number;
    healthInsurance: number;
    personalTax: number;
    advances: number; // Tạm ứng
    otherDeductions: number;
    totalDeductions: number;

    // Final
    grossSalary: number;
    netSalary: number;

    // Status
    status: 'draft' | 'pending' | 'approved' | 'paid' | 'locked';
    telegramSent: boolean;
    approvedBy?: string;
    approvedAt?: string;
}

// Mock salary data
const mockSalaryData: SalaryRecord[] = users.map((user, index) => {
    const baseSalary = 15000000 + (index * 2000000);
    const hourlyRate = Math.floor(baseSalary / 176); // 22 days * 8 hours
    const hoursWorked = 176 + Math.floor(Math.random() * 20) - 10;
    const hourlyTotal = hourlyRate * hoursWorked;

    const serviceCommission = Math.floor(2000000 + Math.random() * 5000000);
    const productCommission = Math.floor(500000 + Math.random() * 1500000);
    const referralCommission = Math.floor(Math.random() * 1000000);
    const totalCommission = serviceCommission + productCommission + referralCommission;

    const kpiAchievement = Math.floor(80 + Math.random() * 30);
    const kpiBonus = kpiAchievement >= 100 ? 2000000 : kpiAchievement >= 90 ? 1000000 : kpiAchievement >= 80 ? 500000 : 0;

    const grossSalary = hourlyTotal + totalCommission + kpiBonus;

    const socialInsurance = Math.floor(grossSalary * 0.08);
    const healthInsurance = Math.floor(grossSalary * 0.015);
    const personalTax = grossSalary > 11000000 ? Math.floor((grossSalary - 11000000) * 0.05) : 0;
    const advances = index % 3 === 0 ? 2000000 : 0;
    const totalDeductions = socialInsurance + healthInsurance + personalTax + advances;

    const netSalary = grossSalary - totalDeductions;

    return {
        employeeId: user.id,
        employeeName: user.name,
        avatar: user.avatar,
        role: user.role,
        period: '01/2026',
        baseSalary,
        hourlyRate,
        hoursWorked,
        hourlyTotal,
        serviceCommission,
        productCommission,
        referralCommission,
        totalCommission,
        kpiAchievement,
        kpiBonus,
        socialInsurance,
        healthInsurance,
        personalTax,
        advances,
        otherDeductions: 0,
        totalDeductions,
        grossSalary,
        netSalary,
        status: index === 0 ? 'paid' : index === 1 ? 'approved' : index === 2 ? 'pending' : 'draft' as const,
        telegramSent: index <= 1,
        approvedBy: index <= 1 ? 'Nguyễn Thị Hương' : undefined,
        approvedAt: index <= 1 ? '2026-01-25' : undefined,
    };
});

const statusLabels = {
    draft: { label: 'Nháp', variant: 'secondary' as const, icon: FileText },
    pending: { label: 'Chờ duyệt', variant: 'warning' as const, icon: Clock },
    approved: { label: 'Đã duyệt', variant: 'info' as const, icon: CheckCircle },
    paid: { label: 'Đã trả', variant: 'success' as const, icon: DollarSign },
    locked: { label: 'Đã khóa', variant: 'danger' as const, icon: Lock },
};

// AI Summary Dialog
function AISummaryDialog({ open, onClose, data }: { open: boolean; onClose: () => void; data: SalaryRecord[] }) {
    const totalGross = data.reduce((sum, d) => sum + d.grossSalary, 0);
    const totalNet = data.reduce((sum, d) => sum + d.netSalary, 0);
    const totalCommission = data.reduce((sum, d) => sum + d.totalCommission, 0);
    const totalKPIBonus = data.reduce((sum, d) => sum + d.kpiBonus, 0);
    const avgKPI = data.reduce((sum, d) => sum + d.kpiAchievement, 0) / data.length;
    const topPerformer = data.reduce((max, d) => d.netSalary > max.netSalary ? d : max, data[0]);

    const aiSummary = `
📊 **BÁO CÁO LƯƠNG THÁNG 01/2026**

👥 Tổng số nhân viên: ${data.length}
💰 Tổng lương gross: ${formatCurrency(totalGross)}
💵 Tổng lương net: ${formatCurrency(totalNet)}

📈 **PHÂN TÍCH:**
• Tổng hoa hồng: ${formatCurrency(totalCommission)} (${((totalCommission / totalGross) * 100).toFixed(1)}% tổng lương)
• Tổng thưởng KPI: ${formatCurrency(totalKPIBonus)}
• KPI trung bình: ${avgKPI.toFixed(1)}%

🏆 **TOP PERFORMER:**
${topPerformer.employeeName} - ${formatCurrency(topPerformer.netSalary)}

📌 **NHẬN XÉT:**
${avgKPI >= 90 ? '✅ Hiệu suất team xuất sắc, đa số đạt/vượt KPI' :
            avgKPI >= 80 ? '👍 Hiệu suất team tốt, cần cải thiện một số vị trí' :
                '⚠️ Cần review lại KPI và hỗ trợ nhân viên cải thiện'}

${data.filter(d => d.kpiAchievement < 80).length > 0 ?
            `⚠️ ${data.filter(d => d.kpiAchievement < 80).length} nhân viên chưa đạt KPI 80%` : ''}
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
                                <p className="font-bold text-emerald-600">{formatCurrency(Math.max(...data.map(d => d.netSalary)))}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-amber-50 border-0">
                            <CardContent className="p-3">
                                <p className="text-xs text-muted-foreground">Lương thấp nhất</p>
                                <p className="font-bold text-amber-600">{formatCurrency(Math.min(...data.map(d => d.netSalary)))}</p>
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

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Chi tiết bảng lương
                    </DialogTitle>
                    <DialogDescription>Kỳ lương: {record.period}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Employee Info */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Avatar className="h-12 w-12">
                            <AvatarImage src={record.avatar} />
                            <AvatarFallback>{record.employeeName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold">{record.employeeName}</p>
                            <Badge variant="outline">{roleLabels[record.role as keyof typeof roleLabels]}</Badge>
                        </div>
                        <div className="ml-auto">
                            <Badge variant={statusLabels[record.status].variant}>
                                {statusLabels[record.status].label}
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
                                <p className="font-medium">{formatCurrency(record.hourlyRate)}/h × {record.hoursWorked}h</p>
                                <p className="font-bold text-emerald-600">{formatCurrency(record.hourlyTotal)}</p>
                            </div>
                            <div className="p-2 rounded bg-muted/30">
                                <p className="text-muted-foreground">HH Dịch vụ</p>
                                <p className="font-bold text-emerald-600">{formatCurrency(record.serviceCommission)}</p>
                            </div>
                            <div className="p-2 rounded bg-muted/30">
                                <p className="text-muted-foreground">HH Sản phẩm</p>
                                <p className="font-bold">{formatCurrency(record.productCommission)}</p>
                            </div>
                            <div className="p-2 rounded bg-muted/30">
                                <p className="text-muted-foreground">HH Giới thiệu</p>
                                <p className="font-bold">{formatCurrency(record.referralCommission)}</p>
                            </div>
                            <div className="p-2 rounded bg-purple-50 col-span-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Thưởng KPI ({record.kpiAchievement}%)</span>
                                    <span className="font-bold text-purple-600">{formatCurrency(record.kpiBonus)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between p-2 rounded bg-emerald-100">
                            <span className="font-semibold">Tổng thu nhập (Gross)</span>
                            <span className="font-bold text-emerald-700">{formatCurrency(record.grossSalary)}</span>
                        </div>
                    </div>

                    {/* Deductions */}
                    <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2 text-red-500">
                            <AlertCircle className="h-4 w-4" />
                            KHẤU TRỪ
                        </h4>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between p-2 rounded bg-muted/30">
                                <span>BHXH (8%)</span>
                                <span className="text-red-500">-{formatCurrency(record.socialInsurance)}</span>
                            </div>
                            <div className="flex justify-between p-2 rounded bg-muted/30">
                                <span>BHYT (1.5%)</span>
                                <span className="text-red-500">-{formatCurrency(record.healthInsurance)}</span>
                            </div>
                            <div className="flex justify-between p-2 rounded bg-muted/30">
                                <span>Thuế TNCN</span>
                                <span className="text-red-500">-{formatCurrency(record.personalTax)}</span>
                            </div>
                            {record.advances > 0 && (
                                <div className="flex justify-between p-2 rounded bg-muted/30">
                                    <span>Tạm ứng</span>
                                    <span className="text-red-500">-{formatCurrency(record.advances)}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-between p-2 rounded bg-red-100">
                            <span className="font-semibold">Tổng khấu trừ</span>
                            <span className="font-bold text-red-600">-{formatCurrency(record.totalDeductions)}</span>
                        </div>
                    </div>

                    {/* Net Salary */}
                    <div className="p-4 rounded-lg bg-gradient-to-r from-primary to-blue-600 text-white">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-semibold">THỰC LĨNH</span>
                            <span className="text-2xl font-bold">{formatCurrency(record.netSalary)}</span>
                        </div>
                    </div>

                    {/* Approval Info */}
                    {record.approvedBy && (
                        <div className="text-xs text-muted-foreground text-center">
                            Duyệt bởi: {record.approvedBy} • {record.approvedAt}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>Đóng</Button>
                    {!record.telegramSent && (
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

    const selectedRecords = data.filter(d => selectedIds.includes(d.employeeId));

    const handleSend = () => {
        setIsSending(true);
        // Simulate API call
        setTimeout(() => {
            setIsSending(false);
            alert(`Đã gửi bảng lương qua Telegram cho ${selectedRecords.length} nhân viên${sendToCEO ? ' và tổng hợp cho CEO' : ''}`);
            onClose();
        }, 1500);
    };

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
                            {formatCurrency(selectedRecords.reduce((sum, r) => sum + r.netSalary, 0))}
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
                            <p>💰 <strong>BẢNG LƯƠNG THÁNG 01/2026</strong></p>
                            <p>Họ tên: {selectedRecords[0]?.employeeName || 'Nhân viên'}</p>
                            <p>Lương gross: {formatCurrency(selectedRecords[0]?.grossSalary || 0)}</p>
                            <p>Khấu trừ: -{formatCurrency(selectedRecords[0]?.totalDeductions || 0)}</p>
                            <p className="font-bold text-emerald-600">Thực lĩnh: {formatCurrency(selectedRecords[0]?.netSalary || 0)}</p>
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
    const [period, setPeriod] = useState('01/2026');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showDetail, setShowDetail] = useState(false);
    const [showAISummary, setShowAISummary] = useState(false);
    const [showTelegramDialog, setShowTelegramDialog] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<SalaryRecord | null>(null);

    const filteredData = mockSalaryData.filter(d =>
        statusFilter === 'all' || d.status === statusFilter
    );

    // Summary stats
    const totalGross = filteredData.reduce((sum, d) => sum + d.grossSalary, 0);
    const totalNet = filteredData.reduce((sum, d) => sum + d.netSalary, 0);
    const totalCommission = filteredData.reduce((sum, d) => sum + d.totalCommission, 0);
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
            setSelectedIds(filteredData.map(d => d.employeeId));
        }
    };

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
                            <SelectItem value="01/2026">01/2026</SelectItem>
                            <SelectItem value="12/2025">12/2025</SelectItem>
                            <SelectItem value="11/2025">11/2025</SelectItem>
                        </SelectContent>
                    </Select>
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
                                {selectedIds.length === filteredData.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                            </Button>
                            {selectedIds.length > 0 && (
                                <>
                                    <Button variant="outline" size="sm" className="gap-1">
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
                                {filteredData.map((record) => (
                                    <tr key={record.employeeId} className="border-b hover:bg-muted/30 transition-colors">
                                        <td className="p-3">
                                            <Checkbox
                                                checked={selectedIds.includes(record.employeeId)}
                                                onCheckedChange={() => toggleSelect(record.employeeId)}
                                            />
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={record.avatar} />
                                                    <AvatarFallback>{record.employeeName.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{record.employeeName}</p>
                                                    <Badge variant="outline" className="text-xs">
                                                        {roleLabels[record.role as keyof typeof roleLabels]}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">{record.hoursWorked}h</td>
                                        <td className="p-3 text-right">{formatCurrency(record.hourlyTotal)}</td>
                                        <td className="p-3 text-right text-emerald-600 font-medium">
                                            {formatCurrency(record.totalCommission)}
                                        </td>
                                        <td className="p-3 text-right">
                                            <Badge variant={record.kpiAchievement >= 100 ? 'success' : record.kpiAchievement >= 80 ? 'warning' : 'danger'}>
                                                {record.kpiAchievement}%
                                            </Badge>
                                        </td>
                                        <td className="p-3 text-right font-medium">{formatCurrency(record.grossSalary)}</td>
                                        <td className="p-3 text-right font-bold text-primary">{formatCurrency(record.netSalary)}</td>
                                        <td className="p-3 text-center">
                                            <Badge variant={statusLabels[record.status].variant}>
                                                {statusLabels[record.status].label}
                                            </Badge>
                                        </td>
                                        <td className="p-3 text-center">
                                            {record.telegramSent ? (
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
                                ))}
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
