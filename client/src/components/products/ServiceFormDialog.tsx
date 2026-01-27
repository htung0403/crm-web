import { useState, useEffect } from 'react';
import { Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Service } from './types';
import { formatNumber, parseNumber } from './utils';

// Department type from database
export interface DepartmentOption {
    id: string;
    code: string;
    name: string;
}

// Helper to get department label from id
export const getDepartmentLabel = (departmentId: string, departments: DepartmentOption[]) => {
    return departments.find(d => d.id === departmentId)?.name || departmentId;
};

interface ServiceFormDialogProps {
    open: boolean;
    onClose: () => void;
    service?: Service | null;
    onSubmit: (data: Partial<Service>) => Promise<void>;
    departments?: DepartmentOption[]; // Departments from database
}

export function ServiceFormDialog({ open, onClose, service, onSubmit, departments = [] }: ServiceFormDialogProps) {
    const [name, setName] = useState('');
    const [price, setPrice] = useState(0);
    const [priceDisplay, setPriceDisplay] = useState('0');
    const [duration, setDuration] = useState(24);
    const [commissionRate, setCommissionRate] = useState(0);
    const [department, setDepartment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Reset form when service changes
    useEffect(() => {
        if (service) {
            setName(service.name || '');
            setPrice(service.price || 0);
            setPriceDisplay(formatNumber(service.price || 0));
            setDuration(service.duration || 24);
            setCommissionRate(service.commission_rate || 0);
            setDepartment(service.department || '');
        } else {
            setName('');
            setPrice(0);
            setPriceDisplay('0');
            setDuration(24);
            setCommissionRate(0);
            setDepartment('');
        }
    }, [service, open]);

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numValue = parseNumber(value);
        setPrice(numValue);
        setPriceDisplay(numValue === 0 ? '0' : formatNumber(numValue));
    };

    const handlePriceFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (price === 0) e.target.select();
    };

    const handleCommissionFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (commissionRate === 0) e.target.select();
    };

    const handleSubmit = async () => {
        if (!name || price <= 0) {
            toast.error('Vui lòng điền đầy đủ thông tin');
            return;
        }
        setSubmitting(true);
        try {
            await onSubmit({
                name,
                price,
                duration,
                commission_rate: commissionRate,
                department: department || undefined,
                status: 'active'
            });
            onClose();
        } catch (error) {
            console.error('Error saving service:', error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5 text-primary" />
                        {service ? 'Sửa dịch vụ' : 'Thêm dịch vụ mới'}
                    </DialogTitle>
                    <DialogDescription>Nhập thông tin dịch vụ</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Mã dịch vụ</Label>
                        <Input value={service?.code || 'DV...'} disabled className="bg-muted" />
                        <p className="text-xs text-muted-foreground">Mã tự động sinh khi tạo</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Tên dịch vụ *</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên dịch vụ" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Giá dịch vụ *</Label>
                            <Input
                                type="text"
                                value={priceDisplay}
                                onChange={handlePriceChange}
                                onFocus={handlePriceFocus}
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Thời lượng (giờ)</Label>
                            <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tỷ lệ hoa hồng (%)</Label>
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                value={commissionRate}
                                onChange={(e) => setCommissionRate(Number(e.target.value))}
                                onFocus={handleCommissionFocus}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Phòng ban thực hiện</Label>
                            <Select value={department || 'none'} onValueChange={(v) => setDepartment(v === 'none' ? '' : v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn phòng ban" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Không chọn</SelectItem>
                                    {departments.map(dept => (
                                        <SelectItem key={dept.id} value={dept.id}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Huỷ</Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Đang lưu...' : 'Lưu'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
