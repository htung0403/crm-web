import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Download, Calculator, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    RefreshCw, Eye, Trash2, CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { payrollBatchesApi } from '@/lib/api';
import { useSalary, type SalaryRecord } from '@/hooks/useSalary';
import { formatCurrency } from '@/lib/utils';

// ========== STATUS CONFIG ==========
const salaryStatusConfig = {
    draft: { label: 'Đang tạo', color: '#2563eb' },
    pending: { label: 'Tạm tính', color: '#2563eb' },
    approved: { label: 'Đã chốt lương', color: '#16a34a' },
    paid: { label: 'Đã trả', color: '#16a34a' },
    locked: { label: 'Đã hủy', color: '#dc2626' },
} as const;

type SalaryStatus = keyof typeof salaryStatusConfig;

// ========== HELPERS ==========
function formatPeriod(month: number, year: number): string {
    return `${String(month).padStart(2, '0')}/${year}`;
}

function formatWorkPeriodFull(month: number, year: number): string {
    const lastDay = new Date(year, month, 0).getDate();
    return `01/${String(month).padStart(2, '0')}/${year} - ${lastDay}/${String(month).padStart(2, '0')}/${year}`;
}

function formatDateTime(dateStr?: string): string {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

// ========== PAYROLL BATCH TYPE ==========
interface PayrollBatch {
    id: string;
    code: string;
    name: string;
    month: number;
    year: number;
    pay_period: string;
    work_period_start: string;
    work_period_end: string;
    total_salary: number;
    total_paid: number;
    total_remaining: number;
    employee_count: number;
    status: SalaryStatus;
    scope: string;
    notes: string | null;
    created_at: string;
    created_by: string | null;
    approved_by: string | null;
    approved_at: string | null;
}

// ========== EXPANDED ROW TABS ==========
type ExpandedTab = 'info' | 'payslips' | 'history';

// ========== PAYSLIP SUB-TABLE ==========
function PayslipTable({ batchId }: { batchId: string }) {
    const [records, setRecords] = useState<SalaryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [selectedPayslipIds, setSelectedPayslipIds] = useState<string[]>([]);
    const pageSize = 10;

    useEffect(() => {
        const fetchRecords = async () => {
            setLoading(true);
            try {
                const res = await payrollBatchesApi.getById(batchId);
                setRecords(res.data.data?.records || []);
            } catch (e) {
                console.error('Error fetching payslip records:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchRecords();
    }, [batchId]);

    const totalItems = records.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const paginated = records.slice((page - 1) * pageSize, page * pageSize);

    const totalSalary = records.reduce((s, r) => s + (r.gross_salary || r.net_salary + r.deduction), 0);
    const totalPaidEmp = records.reduce((s, r) => s + (r.status === 'paid' ? r.net_salary : 0), 0);
    const totalRemaining = totalSalary - totalPaidEmp;

    const togglePayslip = (id: string) => {
        setSelectedPayslipIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };
    const selectAllPayslips = () => {
        if (selectedPayslipIds.length === paginated.length) setSelectedPayslipIds([]);
        else setSelectedPayslipIds(paginated.map(r => r.id));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div>
            <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-white border-b border-gray-200">
                    <tr>
                        <th className="px-4 py-2.5 w-10">
                            <input
                                type="checkbox"
                                className="w-[14px] h-[14px] rounded border-gray-300 text-blue-600 cursor-pointer"
                                checked={selectedPayslipIds.length === paginated.length && paginated.length > 0}
                                onChange={selectAllPayslips}
                            />
                        </th>
                        <th className="px-4 py-2.5 font-bold text-[11px] text-gray-900 tracking-wide">MÃ PHIẾU</th>
                        <th className="px-4 py-2.5 font-bold text-[11px] text-gray-900 tracking-wide">TÊN NHÂN VIÊN</th>
                        <th className="px-4 py-2.5 font-bold text-[11px] text-gray-900 tracking-wide text-right">TỔNG LƯƠNG</th>
                        <th className="px-4 py-2.5 font-bold text-[11px] text-gray-900 tracking-wide text-right">ĐÃ TRẢ NV</th>
                        <th className="px-4 py-2.5 font-bold text-[11px] text-gray-900 tracking-wide text-right">CÒN CẦN TRẢ</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {/* Summary */}
                    {records.length > 0 && (
                        <tr className="bg-white border-b border-gray-200">
                            <td className="px-4 py-2.5" colSpan={3}></td>
                            <td className="px-4 py-2.5 text-right font-bold text-[13px] text-gray-900">{formatCurrency(totalSalary)}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-[13px] text-gray-900">{formatCurrency(totalPaidEmp)}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-[13px] text-gray-900">{formatCurrency(totalRemaining)}</td>
                        </tr>
                    )}
                    {paginated.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-gray-400">
                                Không có phiếu lương
                            </td>
                        </tr>
                    ) : (
                        paginated.map((record, idx) => {
                            const gross = record.gross_salary || (record.hourly_wage + record.commission + record.bonus);
                            const paid = record.status === 'paid' ? record.net_salary : 0;
                            const remaining = gross - paid;
                            const plCode = `PL${String(totalItems - ((page - 1) * pageSize + idx) + 140).padStart(6, '0')}`;

                            return (
                                <tr key={record.id} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="px-4 py-2.5">
                                        <input
                                            type="checkbox"
                                            className="w-[14px] h-[14px] rounded border-gray-300 text-blue-600 cursor-pointer"
                                            checked={selectedPayslipIds.includes(record.id)}
                                            onChange={() => togglePayslip(record.id)}
                                        />
                                    </td>
                                    <td className="px-4 py-2.5 text-blue-600 font-medium text-[13px]">{plCode}</td>
                                    <td className="px-4 py-2.5 text-gray-800 font-medium text-[13px] uppercase">
                                        {record.user?.name || 'N/A'}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-gray-800 text-[13px] font-medium">{formatCurrency(gross)}</td>
                                    <td className="px-4 py-2.5 text-right text-gray-800 text-[13px] font-medium">{formatCurrency(paid)}</td>
                                    <td className="px-4 py-2.5 text-right text-gray-800 text-[13px] font-medium">{formatCurrency(remaining)}</td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>

            {/* Pagination */}
            {totalItems > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 text-[12px] text-gray-500">
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page === 1} onClick={() => setPage(1)}>
                        <ChevronsLeft className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                        <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                        <ChevronRight className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page === totalPages} onClick={() => setPage(totalPages)}>
                        <ChevronsRight className="h-3 w-3" />
                    </Button>
                    <span className="ml-1">Hiển thị {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalItems)} Tổng {totalItems} Phiếu lương</span>
                </div>
            )}

            {/* Bottom action */}
            <div className="flex justify-end px-4 py-3 border-t border-gray-100">
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white text-[13px] h-[34px] px-4 rounded-lg shadow-sm">
                    <CreditCard className="h-4 w-4" />
                    Thanh toán
                </Button>
            </div>
        </div>
    );
}

// ========== PAYMENT HISTORY TABLE ==========
function PaymentHistoryTable() {
    return (
        <div>
            <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-white border-b border-gray-200">
                    <tr>
                        <th className="px-4 py-2.5 font-bold text-[11px] text-gray-900 tracking-wide">MÃ PHIẾU</th>
                        <th className="px-4 py-2.5 font-bold text-[11px] text-gray-900 tracking-wide">TÊN NHÂN VIÊN</th>
                        <th className="px-4 py-2.5 font-bold text-[11px] text-gray-900 tracking-wide">THỜI GIAN</th>
                        <th className="px-4 py-2.5 font-bold text-[11px] text-gray-900 tracking-wide">NGƯỜI TẠO</th>
                        <th className="px-4 py-2.5 font-bold text-[11px] text-gray-900 tracking-wide">PHƯƠNG THỨC</th>
                        <th className="px-4 py-2.5 font-bold text-[11px] text-gray-900 tracking-wide">TRẠNG THÁI</th>
                        <th className="px-4 py-2.5 font-bold text-[11px] text-gray-900 tracking-wide text-right">TIỀN CHI</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-[13px] text-gray-400">
                            Không có dữ liệu
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

// ========== EXPANDED ROW DETAIL ==========
function ExpandedRowDetail({ batch, onReload, onViewDetail }: { batch: PayrollBatch; onReload: () => void; onViewDetail: () => void }) {
    const [activeTab, setActiveTab] = useState<ExpandedTab>('info');

    const tabs: { key: ExpandedTab; label: string }[] = [
        { key: 'info', label: 'Thông tin' },
        { key: 'payslips', label: 'Phiếu lương' },
        { key: 'history', label: 'Lịch sử thanh toán' },
    ];

    const statusLabel = salaryStatusConfig[batch.status]?.label || batch.status;

    return (
        <div className="bg-[#fafbfc] border-b-2 border-gray-200">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-4">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-px ${
                            activeTab === tab.key
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'info' && (
                <div className="p-5 space-y-6">
                    {/* Row 1 */}
                    <div className="grid grid-cols-4 gap-6">
                        <div>
                            <p className="text-[11px] text-gray-400 mb-1">Mã:</p>
                            <p className="text-[13px] font-semibold text-gray-800">{batch.code}</p>
                        </div>
                        <div>
                            <p className="text-[11px] text-gray-400 mb-1">Tên:</p>
                            <p className="text-[13px] font-semibold text-blue-600">{batch.name}</p>
                        </div>
                        <div>
                            <p className="text-[11px] text-gray-400 mb-1">Kỳ hạn trả:</p>
                            <p className="text-[13px] text-gray-800">{batch.pay_period}</p>
                        </div>
                        <div>
                            <p className="text-[11px] text-gray-400 mb-1">Kỳ làm việc:</p>
                            <p className="text-[13px] text-gray-800">{formatWorkPeriodFull(batch.month, batch.year)}</p>
                        </div>
                    </div>

                    {/* Row 2 */}
                    <div className="grid grid-cols-4 gap-6">
                        <div>
                            <p className="text-[11px] text-gray-400 mb-1">Ngày tạo:</p>
                            <p className="text-[13px] text-gray-800">{formatDateTime(batch.created_at)}</p>
                        </div>
                        <div>
                            <p className="text-[11px] text-gray-400 mb-1">Người tạo:</p>
                            <p className="text-[13px] text-gray-800">{batch.created_by ? batch.created_by : 'Auto'}</p>
                        </div>
                        <div>
                            <p className="text-[11px] text-gray-400 mb-1">Người lập bảng:</p>
                            <p className="text-[13px] text-gray-800">Auto</p>
                        </div>
                        <div>
                            <p className="text-[11px] text-gray-400 mb-1">Trạng thái:</p>
                            <p className="text-[13px] font-medium text-blue-600">{statusLabel}</p>
                        </div>
                    </div>

                    {/* Row 3 */}
                    <div className="grid grid-cols-4 gap-6">
                        <div>
                            <p className="text-[11px] text-gray-400 mb-1">Tổng số nhân viên:</p>
                            <p className="text-[13px] font-semibold text-gray-800">{batch.employee_count}</p>
                        </div>
                        <div>
                            <p className="text-[11px] text-gray-400 mb-1">Tổng lương:</p>
                            <p className="text-[13px] font-semibold text-gray-800">{formatCurrency(batch.total_salary)}</p>
                        </div>
                        <div>
                            <p className="text-[11px] text-gray-400 mb-1">Đã trả nhân viên:</p>
                            <p className="text-[13px] font-semibold text-gray-800">{formatCurrency(batch.total_paid)}</p>
                        </div>
                        <div>
                            <p className="text-[11px] text-gray-400 mb-1">Còn cần trả:</p>
                            <p className="text-[13px] font-semibold text-gray-800">{formatCurrency(batch.total_remaining)}</p>
                        </div>
                    </div>

                    {/* Row 4 */}
                    <div className="grid grid-cols-4 gap-6">
                        <div>
                            <p className="text-[11px] text-gray-400 mb-1">Phạm vi áp dụng:</p>
                            <p className="text-[13px] text-gray-800">{batch.scope || 'Tất cả nhân viên'}</p>
                        </div>
                        <div>
                            <p className="text-[11px] text-gray-400 mb-1">Người chốt lương:</p>
                            <p className="text-[13px] text-gray-800">{batch.approved_by || '--'}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[11px] text-gray-400 mb-1">Ghi chú...</p>
                            <div className="border border-gray-200 rounded-lg bg-white px-3 py-2 min-h-[60px] text-[13px] text-gray-500">
                                {batch.notes || ''}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" className="text-[13px] text-gray-500 hover:text-red-500 gap-1.5 h-[34px] px-3">
                                <Trash2 className="h-3.5 w-3.5" />
                                Huỷ bỏ
                            </Button>
                            <span className="text-[12px] text-gray-400">
                                Dữ liệu được cập nhật vào: {formatDateTime(batch.created_at)} ⓘ
                            </span>
                            <Button
                                variant="outline"
                                className="text-[13px] text-gray-600 gap-1.5 h-[34px] px-3 border-gray-200"
                                onClick={onReload}
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Tải lại dữ liệu
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                className="gap-1.5 bg-green-600 hover:bg-green-700 text-white text-[13px] h-[34px] px-4 rounded-lg shadow-sm"
                                onClick={onViewDetail}
                            >
                                <Eye className="h-3.5 w-3.5" />
                                Xem bảng lương
                            </Button>
                            <Button variant="outline" className="gap-1.5 text-[13px] text-gray-600 h-[34px] px-4 border-gray-200">
                                <Download className="h-3.5 w-3.5" />
                                Xuất file
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'payslips' && (
                <PayslipTable batchId={batch.id} />
            )}

            {activeTab === 'history' && (
                <PaymentHistoryTable />
            )}
        </div>
    );
}

// ========== MAIN PAGE ==========
export function SalaryPage() {
    const currentDate = new Date();
    const navigate = useNavigate();

    const [batches, setBatches] = useState<PayrollBatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilters, setStatusFilters] = useState<SalaryStatus[]>(['draft', 'pending', 'approved', 'locked']);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
    const [periodFilter, setPeriodFilter] = useState('all');
    const [generating, setGenerating] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    // Fetch payroll batches
    const fetchBatches = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: Record<string, any> = {};
            if (periodFilter !== 'all') {
                const [monthStr, yearStr] = periodFilter.split('/');
                params.month = parseInt(monthStr, 10);
                params.year = parseInt(yearStr, 10);
            }
            const res = await payrollBatchesApi.getAll(params);
            setBatches(res.data.data?.batches || []);
        } catch (err: any) {
            // If table doesn't exist, show empty
            if (err.response?.status === 500 && err.response?.data?.message?.includes('does not exist')) {
                setBatches([]);
            } else {
                setError(err.response?.data?.message || 'Lỗi khi tải bảng lương');
            }
        } finally {
            setLoading(false);
        }
    }, [periodFilter]);

    useEffect(() => {
        fetchBatches();
    }, [fetchBatches]);

    // Filter batches client-side
    const filteredBatches = useMemo(() => {
        let result = batches;

        // Status filter
        if (statusFilters.length > 0 && statusFilters.length < Object.keys(salaryStatusConfig).length) {
            result = result.filter(b => statusFilters.includes(b.status));
        }

        // Search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(b =>
                b.code.toLowerCase().includes(term) ||
                b.name.toLowerCase().includes(term)
            );
        }

        return result;
    }, [batches, statusFilters, searchTerm]);

    // Pagination
    const totalItems = filteredBatches.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const paginatedBatches = filteredBatches.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    useEffect(() => { setCurrentPage(1); }, [statusFilters, searchTerm, periodFilter]);

    // Summary
    const totalSalary = filteredBatches.reduce((s, b) => s + (b.total_salary || 0), 0);
    const totalPaid = filteredBatches.reduce((s, b) => s + (b.total_paid || 0), 0);
    const totalRemaining = filteredBatches.reduce((s, b) => s + (b.total_remaining || 0), 0);

    // Selection
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };
    const selectAll = () => {
        if (selectedIds.length === paginatedBatches.length && paginatedBatches.length > 0) setSelectedIds([]);
        else setSelectedIds(paginatedBatches.map(b => b.id));
    };

    const toggleStatusFilter = (status: SalaryStatus) => {
        setStatusFilters(prev =>
            prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
        );
    };

    const handleGenerate = async () => {
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();
        setGenerating(true);
        try {
            await payrollBatchesApi.generate({ month, year });
            await fetchBatches();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Lỗi khi tạo bảng lương');
        } finally {
            setGenerating(false);
        }
    };

    // Period options
    const periodOptions = Array.from({ length: 24 }, (_, i) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        return formatPeriod(date.getMonth() + 1, date.getFullYear());
    });

    if (loading && batches.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-6rem)] bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* ===== LEFT SIDEBAR ===== */}
            <div className="w-[220px] border-r border-gray-200 bg-[#fbfcfd] flex flex-col p-5 flex-shrink-0">
                <h1 className="text-[17px] font-bold mb-7 text-gray-900 tracking-tight">Bảng lương</h1>

                <div className="space-y-7">
                    {/* Payment Period Filter */}
                    <div className="space-y-3">
                        <h3 className="text-[13px] font-bold text-gray-700">Kỳ hạn trả lương</h3>
                        <Select value={periodFilter} onValueChange={setPeriodFilter}>
                            <SelectTrigger className="w-full h-[38px] bg-white border-gray-200 text-[13px] shadow-sm rounded-lg text-gray-600">
                                <SelectValue placeholder="Chọn kỳ hạn trả lương" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-[13px]">Tất cả kỳ</SelectItem>
                                {periodOptions.map(p => (
                                    <SelectItem key={p} value={p} className="text-[13px]">
                                        Tháng {p}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-3">
                        <h3 className="text-[13px] font-bold text-gray-700">Trạng thái</h3>
                        <div className="space-y-2.5">
                            {(Object.entries(salaryStatusConfig) as [SalaryStatus, typeof salaryStatusConfig[SalaryStatus]][]).map(([key, config]) => (
                                <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                                    <Checkbox
                                        checked={statusFilters.includes(key)}
                                        onCheckedChange={() => toggleStatusFilter(key)}
                                        className="h-4 w-4 rounded border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                    />
                                    <span className={`text-[13px] ${statusFilters.includes(key) ? 'text-blue-600 font-medium' : 'text-gray-700'} group-hover:text-blue-600 transition-colors`}>
                                        {config.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== MAIN CONTENT ===== */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                {/* Search Bar & Actions */}
                <div className="flex items-center justify-between p-3 border-b border-gray-100 gap-3 bg-[#fbfcfd]">
                    <div className="flex-1 relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-[45%] h-[15px] w-[15px] text-gray-400" />
                        <Input
                            className="w-full pl-[34px] h-[36px] border-gray-200 text-[13px] placeholder:text-gray-400 bg-white shadow-sm rounded-lg focus-visible:ring-1 focus-visible:ring-blue-500"
                            placeholder="Theo mã, tên bảng lương"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            className="h-[36px] px-3.5 text-blue-600 border border-blue-200 bg-white hover:bg-blue-50 text-[13px] font-semibold rounded-lg shadow-sm"
                            onClick={handleGenerate}
                            disabled={generating}
                        >
                            {generating ? (
                                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            ) : (
                                <Calculator className="h-4 w-4 mr-1.5" />
                            )}
                            Bảng tính lương
                        </Button>
                        <Button
                            variant="outline"
                            className="h-[36px] px-3.5 border-gray-200 bg-white text-gray-700 text-[13px] font-semibold rounded-lg shadow-sm hover:bg-gray-50"
                        >
                            <Download className="h-[15px] w-[15px] mr-1.5 text-gray-500" />
                            Xuất file
                        </Button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="mx-3 mt-2 bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead className="bg-[#f2f6ff] sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 w-10 border-b border-gray-100">
                                    <input
                                        type="checkbox"
                                        className="w-[14px] h-[14px] rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        checked={selectedIds.length === paginatedBatches.length && paginatedBatches.length > 0}
                                        onChange={selectAll}
                                    />
                                </th>
                                <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">MÃ</th>
                                <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">TÊN</th>
                                <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">KỲ HẠN TRẢ</th>
                                <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">KỲ LÀM VIỆC</th>
                                <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide text-right">TỔNG LƯƠNG</th>
                                <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide text-right">ĐÃ TRẢ NHÂN VIÊN</th>
                                <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide text-right">CÒN CẦN TRẢ</th>
                                <th className="px-4 py-3 font-bold text-[11px] text-gray-900 border-b border-gray-100 tracking-wide">TRẠNG THÁI</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {/* Summary row */}
                            {filteredBatches.length > 0 && (
                                <tr className="bg-white border-b-2 border-gray-200">
                                    <td className="px-4 py-3" colSpan={5}></td>
                                    <td className="px-4 py-3 text-right font-bold text-[13px] text-gray-900">{formatCurrency(totalSalary)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-[13px] text-gray-900">{formatCurrency(totalPaid)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-[13px] text-gray-900">{formatCurrency(totalRemaining)}</td>
                                    <td className="px-4 py-3"></td>
                                </tr>
                            )}

                            {paginatedBatches.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-[13px] text-gray-500">
                                        {loading ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                Đang tải...
                                            </div>
                                        ) : (
                                            <div>
                                                <p>Chưa có bảng lương.</p>
                                                <p className="text-[12px] text-gray-400 mt-1">
                                                    Bảng lương sẽ tự động tạo vào chủ nhật cuối cùng của tháng, hoặc nhấn "Bảng tính lương" để tạo thủ công.
                                                </p>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                paginatedBatches.map((batch) => {
                                    const isExpanded = expandedBatchId === batch.id;
                                    const statusInfo = salaryStatusConfig[batch.status] || { label: batch.status, color: '#6b7280' };

                                    return (
                                        <Fragment key={batch.id}>
                                            <tr
                                                className={`cursor-pointer transition-colors ${
                                                    isExpanded ? 'bg-blue-50/50' : 'hover:bg-blue-50/30'
                                                }`}
                                                onClick={(e) => {
                                                    if ((e.target as HTMLElement).tagName !== 'INPUT') {
                                                        setExpandedBatchId(isExpanded ? null : batch.id);
                                                    }
                                                }}
                                            >
                                                <td className="px-4 py-[13px]">
                                                    <input
                                                        type="checkbox"
                                                        className="w-[14px] h-[14px] rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        checked={selectedIds.includes(batch.id)}
                                                        onChange={() => toggleSelect(batch.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </td>
                                                <td className="px-4 py-[13px] text-blue-600 font-medium text-[13px]">{batch.code}</td>
                                                <td className="px-4 py-[13px] text-[13px]">
                                                    <p className="font-semibold text-blue-600">{batch.name}</p>
                                                </td>
                                                <td className="px-4 py-[13px] text-gray-700 text-[13px]">{batch.pay_period}</td>
                                                <td className="px-4 py-[13px] text-gray-700 text-[13px]">
                                                    {formatWorkPeriodFull(batch.month, batch.year)}
                                                </td>
                                                <td className="px-4 py-[13px] text-right text-gray-800 text-[13px] font-medium">
                                                    {formatCurrency(batch.total_salary)}
                                                </td>
                                                <td className="px-4 py-[13px] text-right text-gray-800 text-[13px] font-medium">
                                                    {formatCurrency(batch.total_paid)}
                                                </td>
                                                <td className="px-4 py-[13px] text-right text-gray-800 text-[13px] font-medium">
                                                    {formatCurrency(batch.total_remaining)}
                                                </td>
                                                <td className="px-4 py-[13px] text-[13px]">
                                                    <span className="text-blue-600">{statusInfo.label}</span>
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={9} className="p-0">
                                                        <ExpandedRowDetail batch={batch} onReload={fetchBatches} onViewDetail={() => navigate(`/salary/${batch.id}`)} />
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalItems > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 bg-[#fbfcfd]">
                        <div className="flex items-center gap-2 text-[13px] text-gray-600">
                            <span>Hiển thị</span>
                            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                                <SelectTrigger className="w-[80px] h-[30px] text-[13px] border-gray-200 bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="15" className="text-[13px]">15 bản ghi</SelectItem>
                                    <SelectItem value="25" className="text-[13px]">25 bản ghi</SelectItem>
                                    <SelectItem value="50" className="text-[13px]">50 bản ghi</SelectItem>
                                    <SelectItem value="100" className="text-[13px]">100 bản ghi</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="icon" className="h-[30px] w-[30px] border-gray-200" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
                                <ChevronsLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-[30px] w-[30px] border-gray-200" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <div className="flex items-center gap-1 mx-1">
                                <Input
                                    type="number"
                                    min={1}
                                    max={totalPages}
                                    value={currentPage}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        if (val >= 1 && val <= totalPages) setCurrentPage(val);
                                    }}
                                    className="w-[40px] h-[30px] text-center text-[13px] border-gray-200 bg-white px-1"
                                />
                            </div>
                            <Button variant="outline" size="icon" className="h-[30px] w-[30px] border-gray-200" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-[30px] w-[30px] border-gray-200" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>
                                <ChevronsRight className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-[13px] text-gray-500 ml-2">
                                {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalItems)} trong {totalItems} bảng lương
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
