import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useKPI, type KPIRankConfig } from '@/hooks/useKPI';
import { formatCurrency } from '@/lib/utils';

const rankColors: Record<string, string> = {
    'A+': 'bg-emerald-100 text-emerald-800',
    'A': 'bg-blue-100 text-blue-800',
    'B': 'bg-amber-100 text-amber-800',
    'C': 'bg-orange-100 text-orange-800',
    'D': 'bg-red-100 text-red-800',
};

export function KPISettingsTab() {
    const { rankConfigs, fetchRankConfigs, updateRankConfig, loading } = useKPI();
    const [editingConfigs, setEditingConfigs] = useState<Record<string, Partial<KPIRankConfig>>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchRankConfigs();
    }, [fetchRankConfigs]);

    const handleChange = (id: string, field: string, value: any) => {
        setEditingConfigs(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: value,
            }
        }));
    };

    const getValue = (config: KPIRankConfig, field: keyof KPIRankConfig) => {
        const editing = editingConfigs[config.id];
        if (editing && editing[field] !== undefined) return editing[field];
        return config[field];
    };

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            for (const [id, changes] of Object.entries(editingConfigs)) {
                if (Object.keys(changes).length > 0) {
                    await updateRankConfig(id, changes);
                }
            }
            setEditingConfigs({});
            fetchRankConfigs();
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = Object.keys(editingConfigs).length > 0;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold">Cấu hình xếp loại KPI</h3>
                    <p className="text-sm text-muted-foreground">
                        Cấu hình các mức xếp loại KPI và thưởng/phạt/hệ số hoa hồng tương ứng
                    </p>
                </div>
                {hasChanges && (
                    <Button onClick={handleSaveAll} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Lưu thay đổi
                    </Button>
                )}
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="p-3 text-center text-sm font-medium text-muted-foreground w-20">Mã</th>
                                    <th className="p-3 text-left text-sm font-medium text-muted-foreground">Tên</th>
                                    <th className="p-3 text-center text-sm font-medium text-muted-foreground">Điểm min</th>
                                    <th className="p-3 text-center text-sm font-medium text-muted-foreground">Điểm max</th>
                                    <th className="p-3 text-center text-sm font-medium text-muted-foreground">Thưởng (VNĐ)</th>
                                    <th className="p-3 text-center text-sm font-medium text-muted-foreground">Phạt (VNĐ)</th>
                                    <th className="p-3 text-center text-sm font-medium text-muted-foreground">Hệ số HH</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && rankConfigs.length === 0 ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Đang tải...</td></tr>
                                ) : (
                                    rankConfigs.map(config => (
                                        <tr key={config.id} className="border-b hover:bg-muted/30">
                                            <td className="p-3 text-center">
                                                <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${rankColors[config.rank_code] || 'bg-gray-100'}`}>
                                                    {config.rank_code}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <Input
                                                    className="h-8 text-sm"
                                                    value={getValue(config, 'rank_name') as string}
                                                    onChange={e => handleChange(config.id, 'rank_name', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-3">
                                                <Input
                                                    type="number"
                                                    className="h-8 text-sm text-center w-20 mx-auto"
                                                    value={getValue(config, 'min_score') as number}
                                                    onChange={e => handleChange(config.id, 'min_score', Number(e.target.value))}
                                                />
                                            </td>
                                            <td className="p-3">
                                                <Input
                                                    type="number"
                                                    className="h-8 text-sm text-center w-20 mx-auto"
                                                    value={getValue(config, 'max_score') as number}
                                                    onChange={e => handleChange(config.id, 'max_score', Number(e.target.value))}
                                                />
                                            </td>
                                            <td className="p-3">
                                                <Input
                                                    type="number"
                                                    className="h-8 text-sm text-center w-28 mx-auto"
                                                    value={getValue(config, 'bonus_amount') as number}
                                                    onChange={e => handleChange(config.id, 'bonus_amount', Number(e.target.value))}
                                                    step="50000"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <Input
                                                    type="number"
                                                    className="h-8 text-sm text-center w-28 mx-auto"
                                                    value={getValue(config, 'penalty_amount') as number}
                                                    onChange={e => handleChange(config.id, 'penalty_amount', Number(e.target.value))}
                                                    step="50000"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <Input
                                                    type="number"
                                                    className="h-8 text-sm text-center w-20 mx-auto"
                                                    value={getValue(config, 'commission_factor') as number}
                                                    onChange={e => handleChange(config.id, 'commission_factor', Number(e.target.value))}
                                                    step="0.05"
                                                    min="0"
                                                    max="2"
                                                />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Explanation */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Hướng dẫn</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                    <p><strong>Điểm min / max:</strong> Khoảng điểm để xếp vào loại này. VD: A+ là 95-100 điểm.</p>
                    <p><strong>Thưởng:</strong> Số tiền thưởng KPI khi đạt xếp loại này.</p>
                    <p><strong>Phạt:</strong> Số tiền phạt KPI khi rơi vào xếp loại này (thường là loại D).</p>
                    <p><strong>Hệ số HH:</strong> Hệ số nhân với hoa hồng. VD: 1.10 = hoa hồng x110%, 0.50 = hoa hồng x50%.</p>
                    <p>Sau khi KPI tháng được khóa, các giá trị này sẽ được áp dụng để tính thưởng/phạt/hoa hồng cho nhân sự.</p>
                </CardContent>
            </Card>
        </div>
    );
}
