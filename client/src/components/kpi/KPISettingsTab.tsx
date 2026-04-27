import { useState, useEffect } from 'react';
import { Save, Loader2, Search, RotateCcw, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useKPI, type KPIRankConfig } from '@/hooks/useKPI';
import { useEmployees } from '@/hooks/useEmployees';

const rankColors: Record<string, string> = {
    'A+': 'bg-emerald-100 text-emerald-800',
    'A': 'bg-blue-100 text-blue-800',
    'B': 'bg-amber-100 text-amber-800',
    'C': 'bg-orange-100 text-orange-800',
    'D': 'bg-red-100 text-red-800',
};

type EditingMap = Record<string, Partial<KPIRankConfig> & { _reset_to_global?: boolean }>;

export function KPISettingsTab() {
    const { rankConfigs, fetchRankConfigs, updateRankConfig, upsertEmployeeRankConfigs, loading } = useKPI();
    const { employees, fetchEmployees, loading: empLoading } = useEmployees();

    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('global');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingConfigs, setEditingConfigs] = useState<EditingMap>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchEmployees({ status: 'active' });
    }, [fetchEmployees]);

    useEffect(() => {
        setEditingConfigs({});
        fetchRankConfigs(selectedEmployeeId === 'global' ? undefined : selectedEmployeeId);
    }, [selectedEmployeeId, fetchRankConfigs]);

    const handleChange = (rankCode: string, field: keyof KPIRankConfig, value: any) => {
        setEditingConfigs(prev => ({
            ...prev,
            [rankCode]: { ...prev[rankCode], [field]: value, _reset_to_global: false },
        }));
    };

    const getValue = (config: KPIRankConfig, field: keyof KPIRankConfig) => {
        const editing = editingConfigs[config.rank_code];
        if (editing && editing[field] !== undefined) return editing[field];
        return config[field];
    };

    const handleResetToGlobal = (rankCode: string) => {
        setEditingConfigs(prev => ({
            ...prev,
            [rankCode]: { _reset_to_global: true },
        }));
    };

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            if (selectedEmployeeId === 'global') {
                for (const config of rankConfigs) {
                    const changes = editingConfigs[config.rank_code];
                    if (changes && Object.keys(changes).length > 0) {
                        await updateRankConfig(config.id, changes);
                    }
                }
            } else {
                const upsertList = Object.entries(editingConfigs)
                    .filter(([, changes]) => Object.keys(changes).length > 0)
                    .map(([rank_code, changes]) => ({
                        rank_code,
                        ...changes,
                        reset_to_global: changes._reset_to_global ?? false,
                    }));
                if (upsertList.length > 0) {
                    await upsertEmployeeRankConfigs(selectedEmployeeId, upsertList);
                }
            }
            setEditingConfigs({});
            fetchRankConfigs(selectedEmployeeId === 'global' ? undefined : selectedEmployeeId);
        } finally {
            setSaving(false);
        }
    };

    const filteredEmployees = employees.filter(e =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
    const hasChanges = Object.keys(editingConfigs).length > 0;
    const isGlobal = selectedEmployeeId === 'global';

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold">Cấu hình xếp loại KPI</h3>
                    <p className="text-sm text-muted-foreground">
                        Cấu hình mức xếp loại KPI theo từng nhân viên hoặc mặc định toàn cục
                    </p>
                </div>
                {hasChanges && (
                    <Button onClick={handleSaveAll} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Lưu thay đổi
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 items-start">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Chọn nhân viên
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="px-3 pb-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Tìm nhân viên..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-8 h-8 text-xs"
                                />
                            </div>
                        </div>

                        <div className="max-h-[480px] overflow-y-auto">
                            <button
                                type="button"
                                onClick={() => setSelectedEmployeeId('global')}
                                className={`w-full text-left px-3 py-2.5 text-sm transition-colors border-b ${
                                    isGlobal ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50'
                                }`}
                            >
                                <div className="font-medium">Mặc định toàn cục</div>
                                <div className={`text-xs ${isGlobal ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                    Áp dụng cho tất cả nhân viên chưa có override
                                </div>
                            </button>

                            {empLoading ? (
                                <div className="p-4 text-center text-muted-foreground text-xs">
                                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                                    Đang tải...
                                </div>
                            ) : filteredEmployees.length === 0 ? (
                                <div className="p-4 text-center text-muted-foreground text-xs">Không tìm thấy</div>
                            ) : (
                                filteredEmployees.map(emp => (
                                    <button
                                        key={emp.id}
                                        type="button"
                                        onClick={() => setSelectedEmployeeId(emp.id)}
                                        className={`w-full text-left px-3 py-2.5 text-sm transition-colors border-b last:border-b-0 ${
                                            selectedEmployeeId === emp.id
                                                ? 'bg-primary text-primary-foreground'
                                                : 'hover:bg-muted/50'
                                        }`}
                                    >
                                        <div className="font-medium truncate">{emp.name}</div>
                                        <div className={`text-xs ${selectedEmployeeId === emp.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                            <span className="uppercase">{emp.role}</span>
                                            {emp.department && <span> · {emp.department}</span>}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">
                                {isGlobal ? 'Cấu hình mặc định toàn cục' : `Cấu hình cho: ${selectedEmployee?.name ?? '...'}`}
                            </CardTitle>
                            {!isGlobal && (
                                <CardDescription className="text-xs">
                                    Hàng có badge <span className="font-semibold text-amber-600">override</span> đang dùng giá trị riêng. Hàng <span className="font-semibold">mặc định</span> kế thừa từ cấu hình toàn cục.
                                </CardDescription>
                            )}
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-muted/50 border-b">
                                        <tr>
                                            <th className="p-3 text-center text-xs font-medium text-muted-foreground w-16">Mã</th>
                                            <th className="p-3 text-left text-xs font-medium text-muted-foreground">Tên</th>
                                            <th className="p-3 text-center text-xs font-medium text-muted-foreground">Điểm min</th>
                                            <th className="p-3 text-center text-xs font-medium text-muted-foreground">Điểm max</th>
                                            <th className="p-3 text-center text-xs font-medium text-muted-foreground">Thưởng (VNĐ)</th>
                                            <th className="p-3 text-center text-xs font-medium text-muted-foreground">Phạt (VNĐ)</th>
                                            <th className="p-3 text-center text-xs font-medium text-muted-foreground">Hệ số HH (%)</th>
                                            {!isGlobal && (
                                                <th className="p-3 text-center text-xs font-medium text-muted-foreground w-24">Trạng thái</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading && rankConfigs.length === 0 ? (
                                            <tr>
                                                <td colSpan={isGlobal ? 7 : 8} className="p-8 text-center text-muted-foreground">
                                                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                                                    Đang tải...
                                                </td>
                                            </tr>
                                        ) : (
                                            rankConfigs.map(config => {
                                                const isOverride = config.is_override === true;
                                                const pending = editingConfigs[config.rank_code];
                                                const isPendingReset = pending?._reset_to_global === true;
                                                const isPendingOverride = !!pending && !isPendingReset;

                                                return (
                                                    <tr
                                                        key={config.rank_code}
                                                        className={`border-b transition-colors ${
                                                            isPendingReset ? 'bg-red-50/40' :
                                                            isPendingOverride ? 'bg-amber-50/40' :
                                                            isOverride ? 'bg-blue-50/30' :
                                                            'hover:bg-muted/30'
                                                        }`}
                                                    >
                                                        <td className="p-3 text-center">
                                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${rankColors[config.rank_code] || 'bg-gray-100'}`}>
                                                                {config.rank_code}
                                                            </span>
                                                        </td>
                                                        <td className="p-3">
                                                            <Input
                                                                className="h-8 text-sm"
                                                                value={getValue(config, 'rank_name') as string}
                                                                onChange={e => handleChange(config.rank_code, 'rank_name', e.target.value)}
                                                                disabled={isPendingReset}
                                                            />
                                                        </td>
                                                        <td className="p-3">
                                                            <Input
                                                                type="number"
                                                                className="h-8 text-sm text-center w-20 mx-auto"
                                                                value={getValue(config, 'min_score') as number}
                                                                onChange={e => handleChange(config.rank_code, 'min_score', Number(e.target.value))}
                                                                disabled={isPendingReset}
                                                            />
                                                        </td>
                                                        <td className="p-3">
                                                            <Input
                                                                type="number"
                                                                className="h-8 text-sm text-center w-20 mx-auto"
                                                                value={getValue(config, 'max_score') as number}
                                                                onChange={e => handleChange(config.rank_code, 'max_score', Number(e.target.value))}
                                                                disabled={isPendingReset}
                                                            />
                                                        </td>
                                                        <td className="p-3">
                                                            <Input
                                                                type="text"
                                                                className="h-8 text-sm text-center w-28 mx-auto"
                                                                value={(getValue(config, 'bonus_amount') as number || 0).toLocaleString('vi-VN')}
                                                                onChange={e => {
                                                                    const num = parseInt(e.target.value.replace(/\D/g, '') || '0', 10);
                                                                    handleChange(config.rank_code, 'bonus_amount', num);
                                                                }}
                                                                disabled={isPendingReset}
                                                            />
                                                        </td>
                                                        <td className="p-3">
                                                            <Input
                                                                type="text"
                                                                className="h-8 text-sm text-center w-28 mx-auto"
                                                                value={(getValue(config, 'penalty_amount') as number || 0).toLocaleString('vi-VN')}
                                                                onChange={e => {
                                                                    const num = parseInt(e.target.value.replace(/\D/g, '') || '0', 10);
                                                                    handleChange(config.rank_code, 'penalty_amount', num);
                                                                }}
                                                                disabled={isPendingReset}
                                                            />
                                                        </td>
                                                        <td className="p-3">
                                                            <Input
                                                                type="number"
                                                                className="h-8 text-sm text-center w-20 mx-auto"
                                                                value={getValue(config, 'commission_factor') as number}
                                                                onChange={e => handleChange(config.rank_code, 'commission_factor', Number(e.target.value))}
                                                                step="5"
                                                                min="0"
                                                                max="500"
                                                                disabled={isPendingReset}
                                                            />
                                                        </td>
                                                        {!isGlobal && (
                                                            <td className="p-3 text-center">
                                                                {isPendingReset ? (
                                                                    <Badge variant="destructive" className="text-[10px]">Sẽ reset</Badge>
                                                                ) : isOverride || isPendingOverride ? (
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100 border-0">override</Badge>
                                                                        {isOverride && (
                                                                            <button
                                                                                type="button"
                                                                                title="Về mặc định toàn cục"
                                                                                onClick={() => handleResetToGlobal(config.rank_code)}
                                                                                className="text-muted-foreground hover:text-destructive transition-colors"
                                                                            >
                                                                                <RotateCcw className="h-3.5 w-3.5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-[10px] text-muted-foreground">mặc định</Badge>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Hướng dẫn</CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground space-y-1">
                            <p><strong>Mặc định toàn cục:</strong> Áp dụng cho tất cả nhân viên chưa có cấu hình riêng.</p>
                            <p><strong>Override per nhân viên:</strong> Chọn nhân viên → chỉnh sửa bất kỳ hàng nào → Lưu. Hàng đó sẽ được đánh dấu <strong className="text-amber-600">override</strong>.</p>
                            <p><strong>Reset về mặc định:</strong> Nhấn icon <RotateCcw className="h-3 w-3 inline" /> để xóa override, nhân viên sẽ dùng lại giá trị toàn cục.</p>
                            <p><strong>Hệ số HH (%):</strong> 150 = nhận 150% hoa hồng, 80 = nhận 80% hoa hồng.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
