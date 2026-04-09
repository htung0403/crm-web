import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Search, ChevronLeft, ChevronRight, ChevronDown, Download, Upload,
    Info, X, Plus, Loader2, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn, formatNumber } from '@/lib/utils';
import { useUsers } from '@/hooks/useUsers';
import { useWorkSchedules, type Shift, type WorkSchedule } from '@/hooks/useWorkSchedules';
import { toast } from 'sonner';

// ── Constants ──────────────────────────────────────────────────
const DAY_LABELS = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];

const SHIFT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
    cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
};

function getShiftColor(colorKey: string) {
    return SHIFT_COLORS[colorKey] || SHIFT_COLORS.blue;
}

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

function formatVNDate(d: Date): string {
    const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return `${dayNames[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ── Employee row data ──────────────────────────────────────────
interface EmployeeRow {
    userId: string;
    name: string;
    employeeCode: string;
    role: string;
    salary: number;
    schedulesByDate: Record<string, WorkSchedule[]>;
}

// ── Add Schedule Dialog ────────────────────────────────────────
function AddScheduleDialog({
    open, onClose, selectedUser, selectedDate, shifts, allUsers, onSave, onCreateShift,
}: {
    open: boolean;
    onClose: () => void;
    selectedUser: { id: string; name: string } | null;
    selectedDate: Date | null;
    shifts: Shift[];
    allUsers: { id: string; name: string }[];
    onSave: (data: { user_id: string; shift_ids: string[]; schedule_date: string; repeat_weekly: boolean; apply_to_users: string[] }) => Promise<void>;
    onCreateShift: (data: { name: string; start_time: string; end_time: string; color: string }) => Promise<void>;
}) {
    const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
    const [repeatWeekly, setRepeatWeekly] = useState(false);
    const [applyToOthers, setApplyToOthers] = useState(false);
    const [selectedOtherUsers, setSelectedOtherUsers] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [showNewShift, setShowNewShift] = useState(false);
    const [newShiftName, setNewShiftName] = useState('');
    const [newShiftStart, setNewShiftStart] = useState('09:00');
    const [newShiftEnd, setNewShiftEnd] = useState('21:00');

    useEffect(() => {
        if (open) {
            setSelectedShiftIds([]);
            setRepeatWeekly(false);
            setApplyToOthers(false);
            setSelectedOtherUsers([]);
            setShowNewShift(false);
            setNewShiftName('');
        }
    }, [open]);

    const toggleShift = (shiftId: string) => {
        setSelectedShiftIds(prev =>
            prev.includes(shiftId) ? prev.filter(id => id !== shiftId) : [...prev, shiftId]
        );
    };

    const toggleOtherUser = (userId: string) => {
        setSelectedOtherUsers(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleSave = async () => {
        if (!selectedUser || !selectedDate || selectedShiftIds.length === 0) {
            toast.error('Vui lòng chọn ít nhất một ca làm việc');
            return;
        }
        setSaving(true);
        try {
            await onSave({
                user_id: selectedUser.id,
                shift_ids: selectedShiftIds,
                schedule_date: toDateStr(selectedDate),
                repeat_weekly: repeatWeekly,
                apply_to_users: applyToOthers ? selectedOtherUsers : [],
            });
            toast.success('Đã lưu lịch làm việc!');
            onClose();
        } catch (error: any) {
            toast.error(error?.message || 'Lỗi khi lưu lịch làm việc');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateShift = async () => {
        if (!newShiftName.trim()) { toast.error('Vui lòng nhập tên ca'); return; }
        try {
            await onCreateShift({ name: newShiftName.trim().toUpperCase(), start_time: newShiftStart, end_time: newShiftEnd, color: 'blue' });
            toast.success('Đã tạo ca mới!');
            setShowNewShift(false);
            setNewShiftName('');
        } catch { toast.error('Lỗi khi tạo ca'); }
    };

    if (!selectedUser || !selectedDate) return null;
    const otherUsers = allUsers.filter(u => u.id !== selectedUser.id);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-[480px] p-0">
                <div className="px-6 pt-6 pb-4">
                    <DialogHeader>
                        <DialogTitle className="text-[17px] font-bold text-gray-900">Thêm lịch làm việc</DialogTitle>
                    </DialogHeader>
                    <p className="text-[13px] text-gray-500 mt-1">
                        {selectedUser.name}<span className="mx-2 text-gray-300">|</span>{formatVNDate(selectedDate)}
                    </p>
                </div>

                <div className="px-6 pb-6 space-y-5">
                    {/* Shift selection */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-[13px] font-bold text-gray-700">Chọn ca làm việc</span>
                            <button onClick={() => setShowNewShift(true)} className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors">
                                <Plus className="h-3 w-3" />
                            </button>
                        </div>

                        {showNewShift && (
                            <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                                <Input placeholder="Tên ca (VD: CA TỐI)" className="h-[34px] text-[13px]" value={newShiftName} onChange={e => setNewShiftName(e.target.value)} />
                                <div className="flex gap-2">
                                    <Input type="time" className="h-[34px] text-[13px] flex-1" value={newShiftStart} onChange={e => setNewShiftStart(e.target.value)} />
                                    <span className="self-center text-gray-400 text-[13px]">-</span>
                                    <Input type="time" className="h-[34px] text-[13px] flex-1" value={newShiftEnd} onChange={e => setNewShiftEnd(e.target.value)} />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <Button variant="ghost" size="sm" onClick={() => setShowNewShift(false)} className="text-[12px] h-7">Hủy</Button>
                                    <Button size="sm" onClick={handleCreateShift} className="text-[12px] h-7">Tạo ca</Button>
                                </div>
                            </div>
                        )}

                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="grid grid-cols-2 gap-4">
                                {shifts.map(shift => {
                                    const checked = selectedShiftIds.includes(shift.id);
                                    const colors = getShiftColor(shift.color);
                                    return (
                                        <label key={shift.id} className="flex items-start gap-3 cursor-pointer group" onClick={() => toggleShift(shift.id)}>
                                            <div className={cn("mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors", checked ? "bg-blue-600 border-blue-600" : "border-gray-300 group-hover:border-gray-400")}>
                                                {checked && (<svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>)}
                                            </div>
                                            <div>
                                                <p className={cn("text-[13px] font-bold", colors.text)}>{shift.name}</p>
                                                <p className="text-[11px] text-gray-400">{shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}</p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Repeat weekly */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[13px] font-bold text-gray-700">Lặp lại hàng tuần</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">Lịch làm việc sẽ được tự động lặp lại vào các ngày trong tuần</p>
                        </div>
                        <Switch checked={repeatWeekly} onCheckedChange={setRepeatWeekly} />
                    </div>

                    {/* Apply to others */}
                    <div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[13px] font-bold text-gray-700">Thêm lịch tương tự cho nhân viên khác</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">Lịch làm việc sẽ được áp dụng cho các nhân viên được chọn</p>
                            </div>
                            <Switch checked={applyToOthers} onCheckedChange={setApplyToOthers} />
                        </div>
                        {applyToOthers && (
                            <div className="mt-3 max-h-[150px] overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                                {otherUsers.map(u => {
                                    const isSelected = selectedOtherUsers.includes(u.id);
                                    return (
                                        <label key={u.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer" onClick={() => toggleOtherUser(u.id)}>
                                            <div className={cn("w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors", isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300")}>
                                                {isSelected && (<svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>)}
                                            </div>
                                            <span className="text-[13px] text-gray-700">{u.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                    <Button variant="outline" onClick={onClose} disabled={saving} className="h-[36px] px-5 text-[13px]">Bỏ qua</Button>
                    <Button onClick={handleSave} disabled={saving || selectedShiftIds.length === 0} className="h-[36px] px-5 text-[13px]">
                        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Lưu
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Main Component ─────────────────────────────────────────────
export function WorkSchedulePage() {
    const { users, loading: usersLoading, fetchUsers } = useUsers();
    const {
        shifts, schedules, loading: schedulesLoading,
        fetchShifts, fetchSchedules, createSchedule, createShift, deleteSchedule
    } = useWorkSchedules();

    const [currentMonday, setCurrentMonday] = useState(() => getMondayOfWeek(new Date()));
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'employee' | 'shift'>('employee');
    const today = useMemo(() => new Date(), []);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogUser, setDialogUser] = useState<{ id: string; name: string } | null>(null);
    const [dialogDate, setDialogDate] = useState<Date | null>(null);

    // Delete confirmation state
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    useEffect(() => { fetchUsers(); fetchShifts(); }, []);

    const weekDates = useMemo(() => getWeekDates(currentMonday), [currentMonday]);
    const weekNum = getWeekNumber(currentMonday);
    const monthNum = currentMonday.getMonth() + 1;
    const yearNum = currentMonday.getFullYear();

    useEffect(() => {
        fetchSchedules(toDateStr(weekDates[0]), toDateStr(weekDates[6]));
    }, [currentMonday]);

    // ── Employee view data ─────────────────────────────────────
    const employeeRows: EmployeeRow[] = useMemo(() => {
        const activeUsers = users.filter(u => (u.status || 'active') === 'active');
        const schedulesByUser: Record<string, WorkSchedule[]> = {};
        for (const s of schedules) {
            if (!schedulesByUser[s.user_id]) schedulesByUser[s.user_id] = [];
            schedulesByUser[s.user_id].push(s);
        }
        return activeUsers.map(user => {
            const userSchedules = schedulesByUser[user.id] || [];
            const byDate: Record<string, WorkSchedule[]> = {};
            for (const ws of userSchedules) {
                if (!byDate[ws.schedule_date]) byDate[ws.schedule_date] = [];
                byDate[ws.schedule_date].push(ws);
            }
            return {
                userId: user.id, name: user.name,
                employeeCode: (user as any).employee_code || '',
                role: user.role, salary: user.salary || 0, schedulesByDate: byDate,
            };
        });
    }, [users, schedules]);

    const filteredRows = useMemo(() => {
        if (!searchTerm.trim()) return employeeRows;
        const q = searchTerm.toLowerCase();
        return employeeRows.filter(r => r.name.toLowerCase().includes(q) || r.employeeCode.toLowerCase().includes(q));
    }, [employeeRows, searchTerm]);

    const calcEstimatedSalary = useCallback((row: EmployeeRow) => {
        const totalShifts = Object.values(row.schedulesByDate).reduce((sum, arr) => sum + arr.length, 0);
        if (row.salary > 0 && totalShifts > 0) return Math.round((row.salary / 26) * totalShifts);
        return 0;
    }, []);

    const totalEstimatedSalary = useMemo(
        () => filteredRows.reduce((sum, r) => sum + calcEstimatedSalary(r), 0),
        [filteredRows, calcEstimatedSalary]
    );

    // ── Shift view data ────────────────────────────────────────
    const shiftViewData = useMemo(() => {
        if (viewMode !== 'shift') return [];
        const groupMap: Record<string, { shift: any; byDate: Record<string, WorkSchedule[]> }> = {};
        for (const ws of schedules) {
            const sid = ws.shift_id;
            if (!groupMap[sid]) groupMap[sid] = { shift: ws.shift, byDate: {} };
            const dateStr = ws.schedule_date;
            if (!groupMap[sid].byDate[dateStr]) groupMap[sid].byDate[dateStr] = [];
            groupMap[sid].byDate[dateStr].push(ws);
        }
        return Object.entries(groupMap).map(([shiftId, { shift, byDate }]) => ({
            shiftId,
            shiftName: shift?.name || 'CA',
            shiftTime: `${shift?.start_time?.slice(0, 5) || '00:00'} - ${shift?.end_time?.slice(0, 5) || '00:00'}`,
            shiftColor: shift?.color || 'blue',
            byDate,
        }));
    }, [schedules, viewMode]);

    // ── Navigation ─────────────────────────────────────────────
    const goToPrevWeek = () => { const prev = new Date(currentMonday); prev.setDate(prev.getDate() - 7); setCurrentMonday(prev); };
    const goToNextWeek = () => { const next = new Date(currentMonday); next.setDate(next.getDate() + 7); setCurrentMonday(next); };
    const goToCurrentWeek = () => setCurrentMonday(getMondayOfWeek(new Date()));

    const handleCellClick = (userId: string, userName: string, date: Date) => {
        setDialogUser({ id: userId, name: userName });
        setDialogDate(date);
        setDialogOpen(true);
    };

    const handleDeleteSchedule = (e: React.MouseEvent, scheduleId: string) => {
        e.stopPropagation();
        setPendingDeleteId(scheduleId);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!pendingDeleteId) return;
        try {
            await deleteSchedule(pendingDeleteId);
            toast.success('Đã xóa ca làm việc');
            await fetchSchedules(toDateStr(weekDates[0]), toDateStr(weekDates[6]));
        } catch { toast.error('Lỗi khi xóa ca'); }
        finally { setDeleteConfirmOpen(false); setPendingDeleteId(null); }
    };

    const handleSaveSchedule = async (data: { user_id: string; shift_ids: string[]; schedule_date: string; repeat_weekly: boolean; apply_to_users: string[] }) => {
        await createSchedule(data);
        await fetchSchedules(toDateStr(weekDates[0]), toDateStr(weekDates[6]));
    };

    const handleCreateShift = async (data: { name: string; start_time: string; end_time: string; color: string }) => {
        await createShift(data);
        await fetchShifts();
    };

    const loading = usersLoading || schedulesLoading;
    if (loading && users.length === 0) {
        return (<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
    }

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* ── Top bar ─────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3 border-b border-gray-100 bg-[#fbfcfd] gap-3 flex-shrink-0">
                <div className="flex items-center gap-4 flex-wrap">
                    <h1 className="text-[15px] font-bold text-gray-900 whitespace-nowrap">Lịch làm việc</h1>

                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-gray-400" />
                        <Input className="pl-8 h-[34px] w-[200px] border-gray-200 text-[13px] placeholder:text-gray-400 bg-white rounded-lg shadow-sm focus-visible:ring-1 focus-visible:ring-blue-500" placeholder="Tìm kiếm nhân viên" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:bg-gray-100" onClick={goToPrevWeek}><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="text-[13px] font-medium text-gray-700 whitespace-nowrap select-none">Tuần {weekNum} - Th. {monthNum} {yearNum}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:bg-gray-100" onClick={goToNextWeek}><ChevronRight className="h-4 w-4" /></Button>
                        <Button variant="outline" className="h-[30px] px-3 text-[12px] font-medium border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 ml-1" onClick={goToCurrentWeek}>Tuần này</Button>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'employee' | 'shift')}>
                        <SelectTrigger className="h-[34px] w-[220px] text-[13px] border-gray-200 bg-white shadow-sm rounded-lg">
                            <div className="flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5 text-gray-500" />
                                <SelectValue />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="employee">Xem theo nhân viên</SelectItem>
                            <SelectItem value="shift">Xem theo ca</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" className="h-[34px] px-3 text-[12px] font-medium border-gray-200 text-gray-600 rounded-lg shadow-sm hover:bg-gray-50 gap-1.5"><Upload className="h-3.5 w-3.5" />Import</Button>
                    <Button variant="outline" className="h-[34px] px-3 text-[12px] font-medium border-gray-200 text-gray-600 rounded-lg shadow-sm hover:bg-gray-50 gap-1.5"><Download className="h-3.5 w-3.5" />Xuất file</Button>
                </div>
            </div>

            {/* ── Table ────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse text-left min-w-[1100px]">
                    <thead className="bg-[#f2f6ff] sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 text-[12px] font-bold text-gray-700 border-b border-gray-200 w-[200px] sticky left-0 bg-[#f2f6ff] z-20">
                                {viewMode === 'employee' ? 'Nhân viên' : 'Ca làm việc'}
                            </th>
                            {weekDates.map((d, i) => {
                                const isToday = isSameDay(d, today);
                                return (
                                    <th key={i} className={cn("px-2 py-3 text-center border-b border-gray-200 min-w-[120px]", isToday && "bg-blue-50/60")}>
                                        <div className="flex items-center justify-center gap-1.5">
                                            <span className={cn("text-[12px] font-semibold", isToday ? "text-blue-600" : "text-gray-600")}>{DAY_LABELS[i]}</span>
                                            <span className={cn("inline-flex items-center justify-center font-bold text-[12px] min-w-[22px] h-[22px] rounded-full", isToday ? "bg-blue-600 text-white" : "text-gray-500")}>{d.getDate()}</span>
                                        </div>
                                    </th>
                                );
                            })}
                            {viewMode === 'employee' && (
                                <th className="px-4 py-3 text-right border-b border-gray-200 w-[130px] sticky right-0 bg-[#f2f6ff] z-20">
                                    <div className="flex items-center justify-end gap-1">
                                        <span className="text-[12px] font-bold text-gray-700">Lương dự kiến</span>
                                        <Info className="h-3.5 w-3.5 text-gray-400" />
                                    </div>
                                </th>
                            )}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                        {viewMode === 'employee' ? (
                            <>
                                {/* Total row */}
                                <tr className="bg-gray-50/60">
                                    <td className="px-4 py-2.5 sticky left-0 bg-gray-50/60 z-[5]" />
                                    {weekDates.map((_, i) => (<td key={i} className="px-2 py-2.5 text-center" />))}
                                    <td className="px-4 py-2.5 text-right sticky right-0 bg-gray-50/60 z-[5]">
                                        <span className="text-[13px] font-bold text-blue-700">{formatNumber(totalEstimatedSalary)}</span>
                                    </td>
                                </tr>

                                {/* Employee rows */}
                                {filteredRows.map((row) => {
                                    const salary = calcEstimatedSalary(row);
                                    const totalShifts = Object.values(row.schedulesByDate).reduce((sum, arr) => sum + arr.length, 0);
                                    return (
                                        <tr key={row.userId} className="hover:bg-blue-50/20 transition-colors group">
                                            <td className="px-4 py-3 sticky left-0 bg-white group-hover:bg-blue-50/20 z-[5] border-r border-gray-100">
                                                <div>
                                                    <p className="text-[13px] font-bold text-gray-800 uppercase leading-tight">{row.name}</p>
                                                    <p className="text-[11px] text-blue-600 font-medium mt-0.5">{row.employeeCode}</p>
                                                </div>
                                            </td>
                                            {weekDates.map((d, i) => {
                                                const key = toDateStr(d);
                                                const cellSchedules = row.schedulesByDate[key] || [];
                                                const isToday = isSameDay(d, today);
                                                return (
                                                    <td key={i} className={cn("px-1.5 py-3 text-center border-r border-gray-50 cursor-pointer hover:bg-blue-50/50 transition-colors", isToday && "bg-blue-50/30")} onClick={() => handleCellClick(row.userId, row.name, d)}>
                                                        {cellSchedules.length > 0 ? (
                                                            <div className="flex flex-col gap-1 items-center">
                                                                {cellSchedules.map(ws => {
                                                                    const colors = getShiftColor(ws.shift?.color || 'blue');
                                                                    return (
                                                                        <span key={ws.id} className={cn("relative inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold border whitespace-nowrap transition-all group/badge", colors.bg, colors.border, colors.text)}>
                                                                            {ws.shift?.name || 'CA'}
                                                                            <button onClick={(e) => handleDeleteSchedule(e, ws.id)} className="opacity-0 group-hover/badge:opacity-100 -mr-1 ml-0.5 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all shrink-0" title="Xóa ca này">
                                                                                <X className="h-2.5 w-2.5" />
                                                                            </button>
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-200 text-lg leading-none">+</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-4 py-3 text-right sticky right-0 bg-white group-hover:bg-blue-50/20 z-[5]">
                                                <p className="text-[13px] font-bold text-green-700">{formatNumber(salary)}</p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">{totalShifts} ca</p>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredRows.length === 0 && (
                                    <tr><td colSpan={9} className="px-4 py-12 text-center text-[13px] text-gray-400">Không tìm thấy nhân viên nào</td></tr>
                                )}
                            </>
                        ) : (
                            /* ── SHIFT VIEW ─────────────────────────────── */
                            <>
                                {shiftViewData.map((group) => {
                                    const maxEmployeesPerDay = weekDates.map(d => (group.byDate[toDateStr(d)] || []).length);
                                    const maxRows = Math.max(1, ...maxEmployeesPerDay);
                                    const colors = getShiftColor(group.shiftColor);

                                    return Array.from({ length: maxRows }, (_, rowIdx) => (
                                        <tr key={`${group.shiftId}-${rowIdx}`} className={cn("transition-colors", rowIdx === 0 && "border-t-2 border-gray-200")}>
                                            {rowIdx === 0 && (
                                                <td className="px-4 py-2 sticky left-0 bg-white z-[5] border-r border-gray-100 align-top" rowSpan={maxRows}>
                                                    <p className={cn("text-[13px] font-bold uppercase", colors.text)}>{group.shiftName}</p>
                                                    <p className="text-[11px] text-gray-400 mt-0.5">{group.shiftTime}</p>
                                                </td>
                                            )}
                                            {weekDates.map((d, dayIdx) => {
                                                const daySchedules = group.byDate[toDateStr(d)] || [];
                                                const ws = daySchedules[rowIdx];
                                                const isToday = isSameDay(d, today);
                                                return (
                                                    <td key={dayIdx} className={cn("px-2 py-1.5 border-r border-gray-50", isToday && "bg-blue-50/30")}>
                                                        {ws ? (
                                                            <span className="text-[12px] font-semibold text-blue-800 uppercase">{ws.user?.name || ''}</span>
                                                        ) : null}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ));
                                })}

                                {shiftViewData.length === 0 && (
                                    <tr><td colSpan={8} className="px-4 py-12 text-center text-[13px] text-gray-400">Chưa có lịch làm việc nào trong tuần này</td></tr>
                                )}
                            </>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Add Schedule Dialog ──────────────────────────── */}
            <AddScheduleDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                selectedUser={dialogUser}
                selectedDate={dialogDate}
                shifts={shifts}
                allUsers={users.filter(u => (u.status || 'active') === 'active').map(u => ({ id: u.id, name: u.name }))}
                onSave={handleSaveSchedule}
                onCreateShift={handleCreateShift}
            />

            {/* ── Delete Confirmation Dialog ──────────────────── */}
            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent className="max-w-[380px]">
                    <DialogHeader>
                        <DialogTitle className="text-[15px]">Xóa ca làm việc?</DialogTitle>
                        <DialogDescription className="text-[13px] text-gray-500">
                            Bạn có chắc muốn xóa ca làm việc này? Hành động này không thể hoàn tác.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" className="h-[34px] text-[13px]" onClick={() => setDeleteConfirmOpen(false)}>Hủy</Button>
                        <Button onClick={confirmDelete} className="h-[34px] text-[13px] bg-red-600 hover:bg-red-700 text-white">Xóa</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
