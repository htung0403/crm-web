import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Search, ChevronLeft, ChevronRight, ChevronDown, Plus, Loader2,
    MoreHorizontal, CheckSquare, Clock, X, Trash2, RefreshCw, Info, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { TimePicker24 } from '@/components/ui/time-picker-24';
import { cn } from '@/lib/utils';
import { useWorkSchedules, type Shift, type WorkSchedule } from '@/hooks/useWorkSchedules';
import { useTimesheets, type Timesheet, type TimesheetStatus } from '@/hooks/useTimesheets';
import { useUsers } from '@/hooks/useUsers';
import { toast } from 'sonner';

// ── Constants ──────────────────────────────────────────────────
const DAY_LABELS = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];
const VN_DAY_SHORT = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

const STATUS_CONFIG: Record<TimesheetStatus, { label: string; color: string; dotClass: string }> = {
    on_time: { label: 'Đúng giờ', color: '#22c55e', dotClass: 'bg-green-500' },
    late_early: { label: 'Đi muộn / Về sớm', color: '#f59e0b', dotClass: 'bg-amber-500' },
    incomplete: { label: 'Chấm công thiếu', color: '#ef4444', dotClass: 'bg-red-500' },
    not_checked: { label: 'Chưa chấm công', color: '#d1d5db', dotClass: 'bg-gray-300' },
    day_off: { label: 'Nghỉ làm', color: '#6b7280', dotClass: 'bg-gray-500' },
};

const VIOLATION_TYPES = [
    'QUÊN CHẤM CÔNG',
    'ĐI MUỘN',
    'VỀ SỚM',
    'NGHỈ KHÔNG PHÉP',
    'VI PHẠM NỘI QUY',
];

const REWARD_TYPES = [
    'CHẤM CÔNG ĐẦY ĐỦ',
    'LÀM THÊM GIỜ',
    'THÀNH TÍCH TỐT',
    'HỖ TRỢ ĐỒNG NGHIỆP',
];

// ── Date helpers ───────────────────────────────────────────────
function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getMondayOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getWeekDates(monday: Date): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        return d;
    });
}

function toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatVNDateShort(d: Date): string {
    return `${VN_DAY_SHORT[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ── Shift group data ───────────────────────────────────────────
interface ShiftGroup {
    shiftId: string;
    shiftName: string;
    shiftTime: string;
    shiftColor: string;
    byDate: Record<string, EmployeeCell[]>;
}

interface EmployeeCell {
    userId: string;
    name: string;
    employeeCode?: string;
    status: TimesheetStatus;
    timesheetId?: string;
    checkIn?: string | null;
    checkOut?: string | null;
}

// ── Dialog data ────────────────────────────────────────────────
interface DialogData {
    employeeName: string;
    employeeCode: string;
    userId: string;
    date: Date;
    shiftId: string;
    shiftName: string;
    shiftTime: string;
    status: TimesheetStatus;
    timesheetId?: string;
    checkIn?: string | null;
    checkOut?: string | null;
}

interface ViolationRow {
    id: string;
    type: string;
    count: number;
    amount: number;
    total: number;
}

interface RewardRow {
    id: string;
    type: string;
    count: number;
    amount: number;
    total: number;
}

// ══════════════════════════════════════════════════════════════
// ── Attendance Dialog Component ──────────────────────────────
// ══════════════════════════════════════════════════════════════
function AttendanceDialog({
    open,
    onClose,
    data,
    shifts,
    onSave,
    onDelete,
}: {
    open: boolean;
    onClose: () => void;
    data: DialogData | null;
    shifts: Shift[];
    onSave: (payload: {
        user_id: string;
        shift_id: string;
        schedule_date: string;
        check_in?: string;
        check_out?: string;
        status?: TimesheetStatus;
        notes?: string;
    }) => Promise<void>;
    onDelete?: (timesheetId: string) => Promise<void>;
}) {
    const [activeTab, setActiveTab] = useState<'attendance' | 'history' | 'violations' | 'rewards'>('attendance');
    const [attendanceType, setAttendanceType] = useState<'working' | 'paid_leave' | 'unpaid_leave'>('working');
    const [checkInEnabled, setCheckInEnabled] = useState(false);
    const [checkOutEnabled, setCheckOutEnabled] = useState(false);
    const [checkInTime, setCheckInTime] = useState('');
    const [checkOutTime, setCheckOutTime] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedShiftId, setSelectedShiftId] = useState('');
    const [saving, setSaving] = useState(false);

    // Violations & Rewards
    const [violations, setViolations] = useState<ViolationRow[]>([]);
    const [rewards, setRewards] = useState<RewardRow[]>([]);

    // Reset form when data changes
    useEffect(() => {
        if (data && open) {
            setActiveTab('attendance');
            setAttendanceType(
                data.status === 'day_off' ? 'unpaid_leave' : 'working'
            );
            setCheckInEnabled(!!data.checkIn);
            setCheckOutEnabled(!!data.checkOut);
            setCheckInTime(data.checkIn ? new Date(data.checkIn).toTimeString().slice(0, 5) : '');
            setCheckOutTime(data.checkOut ? new Date(data.checkOut).toTimeString().slice(0, 5) : '');
            setNotes('');
            setSelectedShiftId(data.shiftId);
            setViolations([]);
            setRewards([]);
        }
    }, [data, open]);

    if (!data) return null;

    const statusLabel = STATUS_CONFIG[data.status]?.label || 'Chưa chấm công';
    const statusColor = STATUS_CONFIG[data.status]?.color || '#f59e0b';

    const tabs = [
        { key: 'attendance' as const, label: 'Chấm công' },
        { key: 'history' as const, label: 'Lịch sử chấm công' },
        { key: 'violations' as const, label: 'Phạt vi phạm' },
        { key: 'rewards' as const, label: 'Thưởng' },
    ];

    const handleSave = async () => {
        setSaving(true);
        try {
            let status: TimesheetStatus = 'not_checked';
            if (attendanceType === 'paid_leave' || attendanceType === 'unpaid_leave') {
                status = 'day_off';
            } else if (checkInEnabled && checkOutEnabled && checkInTime && checkOutTime) {
                status = 'on_time'; // simplified logic
            } else if (checkInEnabled || checkOutEnabled) {
                status = 'incomplete';
            }

            await onSave({
                user_id: data.userId,
                shift_id: selectedShiftId,
                schedule_date: toDateStr(data.date),
                check_in: checkInEnabled && checkInTime ? `${toDateStr(data.date)}T${checkInTime}:00+07:00` : undefined,
                check_out: checkOutEnabled && checkOutTime ? `${toDateStr(data.date)}T${checkOutTime}:00+07:00` : undefined,
                status,
                notes: notes || undefined,
            });
            toast.success('Đã lưu chấm công!');
            onClose();
        } catch {
            toast.error('Lỗi khi lưu chấm công');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!data.timesheetId || !onDelete) return;
        try {
            await onDelete(data.timesheetId);
            toast.success('Đã hủy chấm công');
            onClose();
        } catch {
            toast.error('Lỗi khi hủy chấm công');
        }
    };

    const addViolation = () => {
        setViolations(prev => [...prev, {
            id: crypto.randomUUID(),
            type: '',
            count: 1,
            amount: 0,
            total: 0,
        }]);
    };

    const removeViolation = (id: string) => {
        setViolations(prev => prev.filter(v => v.id !== id));
    };

    const updateViolation = (id: string, field: keyof ViolationRow, value: string | number) => {
        setViolations(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
    };

    const addReward = () => {
        setRewards(prev => [...prev, {
            id: crypto.randomUUID(),
            type: '',
            count: 1,
            amount: 0,
            total: 0,
        }]);
    };

    const removeReward = (id: string) => {
        setRewards(prev => prev.filter(r => r.id !== id));
    };

    const updateReward = (id: string, field: keyof RewardRow, value: string | number) => {
        setRewards(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const currentShift = shifts.find(s => s.id === selectedShiftId);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-[680px] p-0 gap-0 overflow-hidden [&>button]:hidden">
                {/* ── Header ─────────────────────────────── */}
                <div className="px-6 pt-5 pb-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-[17px] font-bold text-gray-900">Chấm công</h2>
                        <button onClick={onClose} className="h-7 w-7 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                            <X className="h-4 w-4 text-gray-500" />
                        </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[13px] font-semibold text-gray-700">{data.employeeName}</span>
                        {data.employeeCode && (
                            <span className="text-[12px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">{data.employeeCode}</span>
                        )}
                        <span
                            className="text-[12px] font-medium px-2 py-0.5 rounded-full"
                            style={{ color: statusColor, backgroundColor: `${statusColor}15` }}
                        >
                            {statusLabel}
                        </span>
                    </div>
                </div>

                {/* ── Info fields ─────────────────────────── */}
                <div className="px-6 pb-4 space-y-3">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <span className="text-[13px] text-gray-500 w-[65px]">Thời gian</span>
                            <span className="text-[13px] font-semibold text-gray-800">
                                {formatVNDateShort(data.date)}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 flex-1">
                            <span className="text-[13px] text-gray-500 flex items-center gap-1">
                                Ca làm việc
                                <Info className="h-3 w-3 text-gray-400" />
                            </span>
                            <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                                <SelectTrigger className="h-[34px] flex-1 text-[13px] border-gray-200 bg-white rounded-lg">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {shifts.map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name} ({s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <span className="text-[13px] text-gray-500 w-[65px] pt-2">Ghi chú</span>
                        <Textarea
                            className="flex-1 min-h-[60px] text-[13px] border-gray-200 rounded-lg resize-none"
                            placeholder="Nhập ghi chú..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                {/* ── Tabs ────────────────────────────────── */}
                <div className="border-t border-gray-100">
                    <div className="flex px-6">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={cn(
                                    "px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap",
                                    activeTab === tab.key
                                        ? "border-blue-600 text-blue-600"
                                        : "border-transparent text-gray-500 hover:text-gray-700"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Tab Content ─────────────────────────── */}
                <div className="px-6 py-4 min-h-[180px] max-h-[320px] overflow-y-auto">
                    {/* ─── Tab: Chấm công ─── */}
                    {activeTab === 'attendance' && (
                        <div className="space-y-4">
                            {/* Attendance type radio */}
                            <div className="flex items-center gap-3">
                                <span className="text-[13px] text-gray-600 font-medium w-[80px]">Chấm công</span>
                                <div className="flex items-center gap-5">
                                    <label className="flex items-center gap-2 cursor-pointer" onClick={() => setAttendanceType('working')}>
                                        <div className={cn(
                                            "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors",
                                            attendanceType === 'working' ? "border-blue-600" : "border-gray-300"
                                        )}>
                                            {attendanceType === 'working' && <div className="w-[10px] h-[10px] rounded-full bg-blue-600" />}
                                        </div>
                                        <span className="text-[13px] text-gray-700">Đi làm</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer" onClick={() => setAttendanceType('paid_leave')}>
                                        <div className={cn(
                                            "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors",
                                            attendanceType === 'paid_leave' ? "border-blue-600" : "border-gray-300"
                                        )}>
                                            {attendanceType === 'paid_leave' && <div className="w-[10px] h-[10px] rounded-full bg-blue-600" />}
                                        </div>
                                        <span className="text-[13px] text-gray-700 flex items-center gap-1">
                                            Nghỉ có phép
                                            <Info className="h-3 w-3 text-gray-400" />
                                        </span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer" onClick={() => setAttendanceType('unpaid_leave')}>
                                        <div className={cn(
                                            "w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors",
                                            attendanceType === 'unpaid_leave' ? "border-blue-600" : "border-gray-300"
                                        )}>
                                            {attendanceType === 'unpaid_leave' && <div className="w-[10px] h-[10px] rounded-full bg-blue-600" />}
                                        </div>
                                        <span className="text-[13px] text-gray-700 flex items-center gap-1">
                                            Nghỉ không phép
                                            <Info className="h-3 w-3 text-gray-400" />
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Check-in */}
                            {attendanceType === 'working' && (
                                <div className="space-y-3 pt-1">
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-2 cursor-pointer w-[80px]" onClick={() => setCheckInEnabled(!checkInEnabled)}>
                                            <div className={cn(
                                                "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
                                                checkInEnabled ? "bg-blue-600 border-blue-600" : "border-gray-300"
                                            )}>
                                                {checkInEnabled && (
                                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span className="text-[13px] text-gray-600">Vào</span>
                                        </label>
                                        <TimePicker24
                                            value={checkInTime}
                                            onChange={setCheckInTime}
                                            disabled={!checkInEnabled}
                                        />
                                    </div>

                                    {/* Check-out */}
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-2 cursor-pointer w-[80px]" onClick={() => setCheckOutEnabled(!checkOutEnabled)}>
                                            <div className={cn(
                                                "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
                                                checkOutEnabled ? "bg-blue-600 border-blue-600" : "border-gray-300"
                                            )}>
                                                {checkOutEnabled && (
                                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span className="text-[13px] text-gray-600">Ra</span>
                                        </label>
                                        <TimePicker24
                                            value={checkOutTime}
                                            onChange={setCheckOutTime}
                                            disabled={!checkOutEnabled}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── Tab: Lịch sử chấm công ─── */}
                    {activeTab === 'history' && (
                        <div>
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="py-2 text-[12px] font-bold text-gray-600 w-[25%]">Thời gian</th>
                                        <th className="py-2 text-[12px] font-bold text-gray-600 w-[25%]">Trạng thái</th>
                                        <th className="py-2 text-[12px] font-bold text-gray-600 w-[25%]">Hình thức</th>
                                        <th className="py-2 text-[12px] font-bold text-gray-600 w-[25%]">Nội dung</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-[13px] text-gray-400">
                                            Không có kết quả phù hợp
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ─── Tab: Phạt vi phạm ─── */}
                    {activeTab === 'violations' && (
                        <div>
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="py-2 text-[12px] font-bold text-gray-600 w-[35%]">Loại vi phạm</th>
                                        <th className="py-2 text-[12px] font-bold text-gray-600 w-[15%] text-center">Số lần</th>
                                        <th className="py-2 text-[12px] font-bold text-gray-600 w-[20%] text-center">Mức áp dụng</th>
                                        <th className="py-2 text-[12px] font-bold text-gray-600 w-[20%] text-right">Thành tiền</th>
                                        <th className="py-2 w-[10%]" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {violations.map(v => (
                                        <tr key={v.id} className="border-b border-gray-50">
                                            <td className="py-2 pr-2">
                                                <Select value={v.type} onValueChange={(val) => updateViolation(v.id, 'type', val)}>
                                                    <SelectTrigger className="h-[32px] text-[12px] border-gray-200 rounded-lg">
                                                        <SelectValue placeholder="Chọn vi phạm" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {VIOLATION_TYPES.map(vt => (
                                                            <SelectItem key={vt} value={vt}>{vt}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                            <td className="py-2 text-center">
                                                <Input
                                                    type="number"
                                                    className="h-[32px] w-16 text-[12px] text-center border-gray-200 rounded-lg mx-auto"
                                                    value={v.count}
                                                    onChange={e => updateViolation(v.id, 'count', parseInt(e.target.value) || 0)}
                                                    min={1}
                                                />
                                            </td>
                                            <td className="py-2 text-center">
                                                <Input
                                                    type="number"
                                                    className="h-[32px] w-20 text-[12px] text-center border-gray-200 rounded-lg mx-auto"
                                                    value={v.amount}
                                                    onChange={e => updateViolation(v.id, 'amount', parseInt(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="py-2 text-right text-[12px] text-gray-700 font-medium">
                                                {(v.count * v.amount).toLocaleString()}
                                            </td>
                                            <td className="py-2 text-center">
                                                <button
                                                    onClick={() => removeViolation(v.id)}
                                                    className="h-6 w-6 rounded hover:bg-red-50 flex items-center justify-center transition-colors"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button
                                onClick={addViolation}
                                className="text-[13px] text-blue-600 hover:text-blue-700 font-medium mt-2 transition-colors"
                            >
                                Thêm vi phạm
                            </button>
                        </div>
                    )}

                    {/* ─── Tab: Thưởng ─── */}
                    {activeTab === 'rewards' && (
                        <div>
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="py-2 text-[12px] font-bold text-gray-600 w-[35%]">Loại thưởng</th>
                                        <th className="py-2 text-[12px] font-bold text-gray-600 w-[15%] text-center">Số lần</th>
                                        <th className="py-2 text-[12px] font-bold text-gray-600 w-[20%] text-center">Mức áp dụng</th>
                                        <th className="py-2 text-[12px] font-bold text-gray-600 w-[20%] text-right">Thành tiền</th>
                                        <th className="py-2 w-[10%]" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {rewards.map(r => (
                                        <tr key={r.id} className="border-b border-gray-50">
                                            <td className="py-2 pr-2">
                                                <Select value={r.type} onValueChange={(val) => updateReward(r.id, 'type', val)}>
                                                    <SelectTrigger className="h-[32px] text-[12px] border-gray-200 rounded-lg">
                                                        <SelectValue placeholder="Chọn loại thưởng" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {REWARD_TYPES.map(rt => (
                                                            <SelectItem key={rt} value={rt}>{rt}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                            <td className="py-2 text-center">
                                                <Input
                                                    type="number"
                                                    className="h-[32px] w-16 text-[12px] text-center border-gray-200 rounded-lg mx-auto"
                                                    value={r.count}
                                                    onChange={e => updateReward(r.id, 'count', parseInt(e.target.value) || 0)}
                                                    min={1}
                                                />
                                            </td>
                                            <td className="py-2 text-center">
                                                <Input
                                                    type="number"
                                                    className="h-[32px] w-20 text-[12px] text-center border-gray-200 rounded-lg mx-auto"
                                                    value={r.amount}
                                                    onChange={e => updateReward(r.id, 'amount', parseInt(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="py-2 text-right text-[12px] text-gray-700 font-medium">
                                                {(r.count * r.amount).toLocaleString()}
                                            </td>
                                            <td className="py-2 text-center">
                                                <button
                                                    onClick={() => removeReward(r.id)}
                                                    className="h-6 w-6 rounded hover:bg-red-50 flex items-center justify-center transition-colors"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button
                                onClick={addReward}
                                className="text-[13px] text-blue-600 hover:text-blue-700 font-medium mt-2 transition-colors"
                            >
                                Thêm thưởng
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Footer ─────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleDelete}
                            disabled={!data.timesheetId}
                            className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Hủy
                        </button>
                        <button className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-blue-600 transition-colors">
                            <RefreshCw className="h-3.5 w-3.5" />
                            Đổi ca
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={saving}
                            className="h-[36px] px-5 text-[13px] border-gray-200"
                        >
                            Bỏ qua
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="h-[36px] px-6 text-[13px] bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Lưu
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ══════════════════════════════════════════════════════════════
// ── Main Component ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
export function TimesheetsPage() {
    const { users, fetchUsers } = useUsers();
    const { shifts, schedules, fetchShifts, fetchSchedules } = useWorkSchedules();
    const { timesheets, loading: timesheetsLoading, fetchTimesheets, generateTimesheets, approveTimesheets, createTimesheet, deleteTimesheet } = useTimesheets();

    const [currentMonday, setCurrentMonday] = useState(() => getMondayOfWeek(new Date()));
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'shift' | 'employee'>('shift');
    const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('all');
    const today = useMemo(() => new Date(), []);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<DialogData | null>(null);

    // Initial data load
    useEffect(() => { fetchUsers(); fetchShifts(); }, []);

    const weekDates = useMemo(() => getWeekDates(currentMonday), [currentMonday]);
    const weekNum = getWeekNumber(currentMonday);
    const monthNum = currentMonday.getMonth() + 1;
    const yearNum = currentMonday.getFullYear();

    // Fetch schedules + timesheets when week changes
    useEffect(() => {
        const start = toDateStr(weekDates[0]);
        const end = toDateStr(weekDates[6]);
        fetchSchedules(start, end);
        fetchTimesheets(start, end);
    }, [currentMonday]);

    // ── Build shift-grouped data ─────────────────────────────
    const shiftGroups: ShiftGroup[] = useMemo(() => {
        const shiftMap: Record<string, {
            shift: Shift | null;
            scheduleEntries: WorkSchedule[];
        }> = {};

        for (const ws of schedules) {
            const sid = ws.shift_id;
            if (!shiftMap[sid]) {
                shiftMap[sid] = { shift: ws.shift || null, scheduleEntries: [] };
            }
            shiftMap[sid].scheduleEntries.push(ws);
        }

        const timesheetIndex: Record<string, Timesheet> = {};
        for (const t of timesheets) {
            const key = `${t.user_id}_${t.shift_id}_${t.schedule_date}`;
            timesheetIndex[key] = t;
        }

        return Object.entries(shiftMap).map(([shiftId, { shift, scheduleEntries }]) => {
            const byDate: ShiftGroup['byDate'] = {};

            for (const ws of scheduleEntries) {
                const dateStr = ws.schedule_date;
                if (!byDate[dateStr]) byDate[dateStr] = [];

                const tsKey = `${ws.user_id}_${ws.shift_id}_${dateStr}`;
                const ts = timesheetIndex[tsKey];

                byDate[dateStr].push({
                    userId: ws.user_id,
                    name: ws.user?.name || '',
                    employeeCode: ws.user?.employee_code || '',
                    status: ts?.status || 'not_checked',
                    timesheetId: ts?.id,
                    checkIn: ts?.check_in,
                    checkOut: ts?.check_out,
                });
            }

            return {
                shiftId,
                shiftName: shift?.name || 'CA',
                shiftTime: `${shift?.start_time?.slice(0, 5) || '00:00'} - ${shift?.end_time?.slice(0, 5) || '00:00'}`,
                shiftColor: shift?.color || 'blue',
                byDate,
            };
        });
    }, [schedules, timesheets]);

    // ── Build employee stats for employee view ──────────────
    interface EmployeeStats {
        userId: string;
        name: string;
        employeeCode: string;
        salaryType: string;
        onTime: number;
        dayOff: number;
        late: number;
        earlyLeave: number;
        overtime: number;
        hasData: boolean;
    }

    const employeeStats: EmployeeStats[] = useMemo(() => {
        // Get unique employees from schedules
        const empMap: Record<string, EmployeeStats> = {};

        for (const ws of schedules) {
            if (!empMap[ws.user_id]) {
                empMap[ws.user_id] = {
                    userId: ws.user_id,
                    name: ws.user?.name || '',
                    employeeCode: (ws.user as any)?.employee_code || '',
                    salaryType: 'Theo giờ làm việc',
                    onTime: 0,
                    dayOff: 0,
                    late: 0,
                    earlyLeave: 0,
                    overtime: 0,
                    hasData: false,
                };
            }
        }

        // Also add users not in schedules
        for (const u of users) {
            if (!empMap[u.id]) {
                empMap[u.id] = {
                    userId: u.id,
                    name: u.name || '',
                    employeeCode: (u as any)?.employee_code || '',
                    salaryType: 'Theo giờ làm việc',
                    onTime: 0,
                    dayOff: 0,
                    late: 0,
                    earlyLeave: 0,
                    overtime: 0,
                    hasData: false,
                };
            }
        }

        // Count statuses from timesheets
        for (const t of timesheets) {
            if (!empMap[t.user_id]) continue;
            empMap[t.user_id].hasData = true;
            switch (t.status) {
                case 'on_time': empMap[t.user_id].onTime++; break;
                case 'late_early': empMap[t.user_id].late++; break;
                case 'day_off': empMap[t.user_id].dayOff++; break;
                case 'incomplete': empMap[t.user_id].late++; break;
            }
        }

        let list = Object.values(empMap).sort((a, b) => a.name.localeCompare(b.name));

        // filter by search
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            list = list.filter(e => e.name.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q));
        }

        return list;
    }, [schedules, timesheets, users, searchTerm]);

    // Filter by search and shift
    const filteredGroups = useMemo(() => {
        let groups = shiftGroups;
        if (selectedShiftFilter !== 'all') {
            groups = groups.filter(g => g.shiftId === selectedShiftFilter);
        }
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            groups = groups.map(group => {
                const filteredByDate: ShiftGroup['byDate'] = {};
                for (const [dateStr, employees] of Object.entries(group.byDate)) {
                    const filtered = employees.filter(e => e.name.toLowerCase().includes(q));
                    if (filtered.length > 0) filteredByDate[dateStr] = filtered;
                }
                return { ...group, byDate: filteredByDate };
            }).filter(group => Object.keys(group.byDate).length > 0);
        }
        return groups;
    }, [shiftGroups, searchTerm, selectedShiftFilter]);

    // ── Navigation ─────────────────────────────────────────────
    const goToPrevWeek = () => { const prev = new Date(currentMonday); prev.setDate(prev.getDate() - 7); setCurrentMonday(prev); };
    const goToNextWeek = () => { const next = new Date(currentMonday); next.setDate(next.getDate() + 7); setCurrentMonday(next); };
    const goToCurrentWeek = () => setCurrentMonday(getMondayOfWeek(new Date()));

    // ── Cell click → open dialog ──────────────────────────────
    const handleCellClick = (emp: EmployeeCell, date: Date, group: ShiftGroup) => {
        setDialogData({
            employeeName: emp.name,
            employeeCode: emp.employeeCode || '',
            userId: emp.userId,
            date,
            shiftId: group.shiftId,
            shiftName: group.shiftName,
            shiftTime: group.shiftTime,
            status: emp.status,
            timesheetId: emp.timesheetId,
            checkIn: emp.checkIn,
            checkOut: emp.checkOut,
        });
        setDialogOpen(true);
    };

    // ── Save handler ──────────────────────────────────────────
    const handleSaveTimesheet = async (payload: {
        user_id: string;
        shift_id: string;
        schedule_date: string;
        check_in?: string;
        check_out?: string;
        status?: TimesheetStatus;
        notes?: string;
    }) => {
        await createTimesheet(payload);
        const start = toDateStr(weekDates[0]);
        const end = toDateStr(weekDates[6]);
        await fetchTimesheets(start, end);
    };

    // ── Delete handler ────────────────────────────────────────
    const handleDeleteTimesheet = async (id: string) => {
        await deleteTimesheet(id);
    };

    // ── Generate timesheets from schedules ─────────────────────
    const handleGenerate = async () => {
        try {
            const start = toDateStr(weekDates[0]);
            const end = toDateStr(weekDates[6]);
            await generateTimesheets(start, end);
            await fetchTimesheets(start, end);
            toast.success('Đã tạo bảng chấm công từ lịch làm việc!');
        } catch {
            toast.error('Lỗi khi tạo bảng chấm công');
        }
    };

    // ── Approve all ────────────────────────────────────────────
    const handleApproveAll = async () => {
        const ids = timesheets.filter(t => !t.approved_at).map(t => t.id);
        if (ids.length === 0) {
            toast.info('Không có dữ liệu chấm công cần duyệt');
            return;
        }
        try {
            await approveTimesheets(ids);
            const start = toDateStr(weekDates[0]);
            const end = toDateStr(weekDates[6]);
            await fetchTimesheets(start, end);
            toast.success(`Đã duyệt ${ids.length} bản ghi chấm công`);
        } catch {
            toast.error('Lỗi khi duyệt chấm công');
        }
    };

    // ── Get all unique employees across all days in a group ────
    const getGroupEmployees = useCallback((group: ShiftGroup): string[] => {
        const nameSet = new Set<string>();
        for (const employees of Object.values(group.byDate)) {
            for (const emp of employees) {
                nameSet.add(emp.name);
            }
        }
        return Array.from(nameSet).sort();
    }, []);

    if (timesheetsLoading && timesheets.length === 0 && schedules.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* ── Top bar ─────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3 border-b border-gray-100 bg-[#fbfcfd] gap-3 flex-shrink-0">
                <div className="flex items-center gap-4 flex-wrap">
                    <h1 className="text-[15px] font-bold text-gray-900 whitespace-nowrap">Bảng chấm công</h1>

                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-gray-400" />
                        <Input
                            className="pl-8 h-[34px] w-[200px] border-gray-200 text-[13px] placeholder:text-gray-400 bg-white rounded-lg shadow-sm focus-visible:ring-1 focus-visible:ring-orange-500"
                            placeholder="Tìm kiếm nhân viên"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                    </div>

                    <Select defaultValue="weekly">
                        <SelectTrigger className="h-[34px] w-[130px] text-[13px] border-gray-200 bg-white shadow-sm rounded-lg">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="weekly">Theo tuần</SelectItem>
                            <SelectItem value="monthly">Theo tháng</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex items-center gap-1.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:bg-gray-100" onClick={goToPrevWeek}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-[13px] font-medium text-gray-700 whitespace-nowrap select-none">
                            Tuần {weekNum} - Th. {monthNum} {yearNum}
                        </span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:bg-gray-100" onClick={goToNextWeek}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-[30px] px-3 text-[12px] font-medium border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 ml-1"
                            onClick={goToCurrentWeek}
                        >
                            Chọn
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* View mode toggle */}
                    <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'shift' | 'employee')}>
                        <SelectTrigger className="h-[34px] w-[185px] text-[13px] border-gray-200 bg-white shadow-sm rounded-lg">
                            <div className="flex items-center gap-1.5">
                                {viewMode === 'shift' ? <Clock className="h-3.5 w-3.5 text-gray-500" /> : <Users className="h-3.5 w-3.5 text-gray-500" />}
                                <SelectValue />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="shift">Xem theo ca</SelectItem>
                            <SelectItem value="employee">Xem theo nhân viên</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        onClick={handleApproveAll}
                        className="h-[34px] px-4 text-[12px] font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-sm gap-1.5"
                    >
                        <CheckSquare className="h-3.5 w-3.5" />
                        Duyệt chấm công
                    </Button>

                    <Button variant="outline" size="icon" className="h-[34px] w-[34px] border-gray-200 rounded-lg shadow-sm">
                        <MoreHorizontal className="h-4 w-4 text-gray-500" />
                    </Button>
                </div>
            </div>

            {/* ── Table ────────────────────────────────────────── */}
            {viewMode === 'shift' ? (
                /* ── SHIFT VIEW ─── */
                <div className="flex-1 overflow-auto">
                    <table className="w-full border-collapse text-left min-w-[1100px]">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#f7f8fa]">
                                <th className="px-4 py-3 text-[12px] font-bold text-gray-700 border-b border-gray-200 w-[180px] sticky left-0 bg-[#f7f8fa] z-20">
                                    <div className="flex items-center gap-2">
                                        <span>Ca làm việc</span>
                                        <button
                                            onClick={handleGenerate}
                                            className="h-5 w-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-300 transition-colors"
                                            title="Tạo chấm công từ lịch làm việc"
                                        >
                                            <Plus className="h-3 w-3" />
                                        </button>
                                    </div>
                                </th>
                                {weekDates.map((d, i) => {
                                    const isToday = isSameDay(d, today);
                                    return (
                                        <th key={i} className={cn("px-2 py-3 text-center border-b border-gray-200 min-w-[120px]", isToday && "bg-orange-50/80")}>
                                            <div className="flex items-center justify-center gap-1.5">
                                                <span className={cn("text-[12px] font-semibold", isToday ? "text-orange-600" : "text-gray-500")}>
                                                    {DAY_LABELS[i]}
                                                </span>
                                                <span className={cn(
                                                    "inline-flex items-center justify-center font-bold text-[12px] min-w-[24px] h-[24px] rounded-full",
                                                    isToday ? "bg-orange-500 text-white" : "text-gray-500"
                                                )}>
                                                    {String(d.getDate()).padStart(2, '0')}
                                                </span>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>

                        <tbody>
                            {filteredGroups.map((group) => {
                                const allEmployeeNames = getGroupEmployees(group);
                                if (allEmployeeNames.length === 0) return null;

                                return (
                                    <ShiftGroupRows
                                        key={group.shiftId}
                                        group={group}
                                        allEmployeeNames={allEmployeeNames}
                                        weekDates={weekDates}
                                        today={today}
                                        onCellClick={handleCellClick}
                                    />
                                );
                            })}

                            {filteredGroups.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                                                <Clock className="h-6 w-6 text-gray-400" />
                                            </div>
                                            <p className="text-[13px] text-gray-400">Chưa có dữ liệu chấm công trong tuần này</p>
                                            <Button variant="outline" className="h-[32px] px-4 text-[12px] border-gray-200" onClick={handleGenerate}>
                                                <Plus className="h-3.5 w-3.5 mr-1.5" />
                                                Tạo từ lịch làm việc
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                /* ── EMPLOYEE VIEW ─── */
                <div className="flex-1 overflow-auto">
                    <table className="w-full border-collapse text-left">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#f7f8fa]">
                                <th className="px-4 py-3 text-[12px] font-bold text-gray-600 border-b border-gray-200 w-[220px]">Nhân viên</th>
                                <th className="px-4 py-3 text-[12px] font-bold text-gray-600 border-b border-gray-200 w-[180px]">Loại lương</th>
                                <th className="px-4 py-3 text-[12px] font-bold text-gray-600 border-b border-gray-200 text-center">Đi làm</th>
                                <th className="px-4 py-3 text-[12px] font-bold text-gray-600 border-b border-gray-200 text-center">Nghỉ làm</th>
                                <th className="px-4 py-3 text-[12px] font-bold text-gray-600 border-b border-gray-200 text-center">Đi muộn</th>
                                <th className="px-4 py-3 text-[12px] font-bold text-gray-600 border-b border-gray-200 text-center">Về sớm</th>
                                <th className="px-4 py-3 text-[12px] font-bold text-gray-600 border-b border-gray-200 text-center">Làm thêm</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employeeStats.map(emp => (
                                <tr key={emp.userId} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <p className="text-[13px] font-bold text-gray-800 uppercase">{emp.name}</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{emp.employeeCode || '---'}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-[12px] text-gray-600">{emp.salaryType}</span>
                                    </td>
                                    {emp.hasData ? (
                                        <>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-[13px] font-semibold text-green-600">{emp.onTime || '---'}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-[13px] font-semibold text-gray-500">{emp.dayOff || '---'}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-[13px] font-semibold text-amber-500">{emp.late || '---'}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-[13px] font-semibold text-amber-500">{emp.earlyLeave || '---'}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-[13px] font-semibold text-blue-600">{emp.overtime || '---'}</span>
                                            </td>
                                        </>
                                    ) : (
                                        <td colSpan={5} className="px-4 py-3">
                                            <span className="text-[12px] text-blue-500">Nhân viên chưa có dữ liệu chấm công</span>
                                        </td>
                                    )}
                                </tr>
                            ))}

                            {employeeStats.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-16 text-center">
                                        <p className="text-[13px] text-gray-400">Không tìm thấy nhân viên</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Footer Legend ──────────────────────────────────── */}
            <div className="flex items-center justify-center gap-6 px-5 py-2.5 border-t border-gray-100 bg-[#fbfcfd] flex-shrink-0">
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-1.5">
                        <span className={cn("h-2.5 w-2.5 rounded-full", config.dotClass)} />
                        <span className="text-[11px] text-gray-500 font-medium">{config.label}</span>
                    </div>
                ))}
            </div>

            {/* ── Attendance Dialog ──────────────────────────────── */}
            <AttendanceDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                data={dialogData}
                shifts={shifts}
                onSave={handleSaveTimesheet}
                onDelete={handleDeleteTimesheet}
            />
        </div>
    );
}

// ══════════════════════════════════════════════════════════════
// ── Shift Group Rows Component ─────────────────────────────────
// ══════════════════════════════════════════════════════════════
function ShiftGroupRows({
    group,
    allEmployeeNames,
    weekDates,
    today,
    onCellClick,
}: {
    group: ShiftGroup;
    allEmployeeNames: string[];
    weekDates: Date[];
    today: Date;
    onCellClick: (emp: EmployeeCell, date: Date, group: ShiftGroup) => void;
}) {
    return (
        <>
            {/* Shift header row */}
            <tr className="border-t-2 border-gray-200">
                <td
                    className="px-4 py-2 sticky left-0 bg-white z-[5] border-r border-gray-100 align-top"
                    rowSpan={allEmployeeNames.length + 1}
                >
                    <div className="pt-1">
                        <p className="text-[13px] font-extrabold text-gray-800 uppercase tracking-wide">
                            {group.shiftName}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                            {group.shiftTime}
                        </p>
                    </div>
                </td>
                {weekDates.map((d, i) => {
                    const isToday = isSameDay(d, today);
                    return (
                        <td key={i} className={cn("border-r border-gray-50 h-0 p-0", isToday && "bg-orange-50/30")} />
                    );
                })}
            </tr>

            {/* Employee rows */}
            {allEmployeeNames.map((empName) => (
                <tr key={`${group.shiftId}-${empName}`} className="hover:bg-gray-50/50 transition-colors">
                    {weekDates.map((d, i) => {
                        const dateStr = toDateStr(d);
                        const isToday = isSameDay(d, today);
                        const dayEmployees = group.byDate[dateStr] || [];
                        const emp = dayEmployees.find(e => e.name === empName);

                        return (
                            <td
                                key={i}
                                className={cn(
                                    "px-2 py-2 border-r border-gray-50 border-b border-b-gray-50 min-h-[56px] cursor-pointer hover:bg-blue-50/40 transition-colors",
                                    isToday && "bg-orange-50/30"
                                )}
                                onClick={() => emp && onCellClick(emp, d, group)}
                            >
                                {emp ? (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[12px] font-bold text-gray-800 uppercase leading-tight truncate">
                                            {emp.name}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-gray-300 text-[11px] leading-none">---</span>
                                        </div>
                                        <span
                                            className="text-[10px] font-medium leading-tight"
                                            style={{ color: STATUS_CONFIG[emp.status]?.color || '#d1d5db' }}
                                        >
                                            {STATUS_CONFIG[emp.status]?.label || 'Chưa chấm công'}
                                        </span>
                                    </div>
                                ) : null}
                            </td>
                        );
                    })}
                </tr>
            ))}
        </>
    );
}
