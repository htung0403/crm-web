import { useState, useEffect } from 'react';
import { Wrench, Plus, Trash2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { Service } from './types';
import { formatNumber, parseNumber } from './utils';
import { ImageUpload } from './ImageUpload';

// Department type from database
export interface DepartmentOption {
    id: string;
    code: string;
    name: string;
}

// Service-Department relationship with commission
export interface ServiceDepartment {
    department_id: string;
    commission_sale: number;
    commission_tech: number;
    is_primary: boolean;
}

// Helper to get department label from id
export const getDepartmentLabel = (departmentId: string, departments: DepartmentOption[]) => {
    return departments.find(d => d.id === departmentId)?.name || departmentId;
};

interface ServiceFormDialogProps {
    open: boolean;
    onClose: () => void;
    service?: Service | null;
    onSubmit: (data: Partial<Service>, departments?: ServiceDepartment[]) => Promise<void>;
    departments?: DepartmentOption[]; // Departments from database
    serviceDepartments?: ServiceDepartment[]; // Existing service-department relations
}

export function ServiceFormDialog({
    open,
    onClose,
    service,
    onSubmit,
    departments = [],
    serviceDepartments = []
}: ServiceFormDialogProps) {
    const [name, setName] = useState('');
    const [price, setPrice] = useState(0);
    const [priceDisplay, setPriceDisplay] = useState('0');
    const [duration, setDuration] = useState(24);
    const [submitting, setSubmitting] = useState(false);

    const [selectedDepartments, setSelectedDepartments] = useState<ServiceDepartment[]>([]);
    const [image, setImage] = useState<string | null>(null);

    // Memoize serviceDepartments to prevent infinite loop
    const serviceDepartmentsJson = JSON.stringify(serviceDepartments);

    // Reset form when service changes
    useEffect(() => {
        if (service) {
            setName(service.name || '');
            setPrice(service.price || 0);
            setPriceDisplay(formatNumber(service.price || 0));
            setDuration(service.duration || 24);
            setImage(service.image || null);
            // Load existing service-department relationships
            const parsedDepts = JSON.parse(serviceDepartmentsJson) as ServiceDepartment[];
            if (parsedDepts.length > 0) {
                setSelectedDepartments(parsedDepts);
            } else if (service.department) {
                // Backward compatibility: convert old single department to new format
                setSelectedDepartments([{
                    department_id: service.department,
                    commission_sale: service.commission_sale || service.commission_rate || 0,
                    commission_tech: service.commission_tech || 0,
                    is_primary: true
                }]);
            } else {
                setSelectedDepartments([]);
            }
        } else {
            setName('');
            setPrice(0);
            setPriceDisplay('0');
            setDuration(24);
            setSelectedDepartments([]);
            setImage(null);
        }
    }, [service, serviceDepartmentsJson, open]);

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numValue = parseNumber(value);
        setPrice(numValue);
        setPriceDisplay(numValue === 0 ? '0' : formatNumber(numValue));
    };

    const handlePriceFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (price === 0) e.target.select();
    };

    // Add new department
    const handleAddDepartment = () => {
        const availableDepts = departments.filter(
            d => !selectedDepartments.some(sd => sd.department_id === d.id)
        );
        if (availableDepts.length === 0) {
            toast.error('Đã thêm tất cả phòng ban');
            return;
        }
        setSelectedDepartments([...selectedDepartments, {
            department_id: '',
            commission_sale: 0,
            commission_tech: 0,
            is_primary: selectedDepartments.length === 0
        }]);
    };

    // Remove department
    const handleRemoveDepartment = (index: number) => {
        const updated = selectedDepartments.filter((_, i) => i !== index);
        // If removed the primary, set first one as primary
        if (updated.length > 0 && !updated.some(d => d.is_primary)) {
            updated[0].is_primary = true;
        }
        setSelectedDepartments(updated);
    };

    // Update department field
    const handleDepartmentChange = (index: number, field: keyof ServiceDepartment, value: any) => {
        const updated = [...selectedDepartments];
        if (field === 'is_primary' && value) {
            // Only one primary
            updated.forEach((d, i) => {
                d.is_primary = i === index;
            });
        } else {
            (updated[index] as any)[field] = value;
        }
        setSelectedDepartments(updated);
    };

    const handleSubmit = async () => {
        if (!name || price <= 0) {
            toast.error('Vui lòng điền đầy đủ thông tin');
            return;
        }

        // Validate departments
        const validDepts = selectedDepartments.filter(d => d.department_id);

        setSubmitting(true);
        try {
            await onSubmit({
                name,
                price,
                duration,
                image: image || undefined,
                status: 'active'
            }, validDepts);
            onClose();
        } catch (error) {
            console.error('Error saving service:', error);
        } finally {
            setSubmitting(false);
        }
    };

    // Get available departments for selection
    const getAvailableDepartments = (currentDeptId: string) => {
        return departments.filter(
            d => d.id === currentDeptId || !selectedDepartments.some(sd => sd.department_id === d.id)
        );
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5 text-primary" />
                        {service ? 'Sửa dịch vụ' : 'Thêm dịch vụ mới'}
                    </DialogTitle>
                    <DialogDescription>Nhập thông tin dịch vụ</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Image Upload */}
                    <div className="space-y-2">
                        <Label>Hình ảnh dịch vụ</Label>
                        <ImageUpload
                            value={image}
                            onChange={setImage}
                            folder="services"
                        />
                    </div>

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

                    {/* Multi-Department Section */}
                    <div className="pt-4 border-t space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Phòng ban thực hiện
                            </Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleAddDepartment}
                                disabled={selectedDepartments.length >= departments.length}
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                Thêm
                            </Button>
                        </div>

                        {selectedDepartments.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                Chưa có phòng ban nào. Nhấn "Thêm" để thêm phòng ban.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {selectedDepartments.map((sd, index) => (
                                    <div key={index} className="p-3 border rounded-lg bg-muted/30 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Select
                                                value={sd.department_id || 'none'}
                                                onValueChange={(v) => handleDepartmentChange(index, 'department_id', v === 'none' ? '' : v)}
                                            >
                                                <SelectTrigger className="flex-1">
                                                    <SelectValue placeholder="Chọn phòng ban" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Chọn phòng ban</SelectItem>
                                                    {getAvailableDepartments(sd.department_id).map(dept => (
                                                        <SelectItem key={dept.id} value={dept.id}>
                                                            {dept.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            {sd.is_primary ? (
                                                <Badge variant="default" className="shrink-0">Chính</Badge>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDepartmentChange(index, 'is_primary', true)}
                                                    className="text-xs shrink-0"
                                                >
                                                    Đặt làm chính
                                                </Button>
                                            )}

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveDepartment(index)}
                                                className="text-red-500 hover:text-red-700 shrink-0"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Hoa hồng Sale (%)</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={sd.commission_sale}
                                                    onChange={(e) => handleDepartmentChange(index, 'commission_sale', Number(e.target.value))}
                                                    onFocus={(e) => e.target.select()}
                                                    className="h-8"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Hoa hồng KTV (%)</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={sd.commission_tech}
                                                    onChange={(e) => handleDepartmentChange(index, 'commission_tech', Number(e.target.value))}
                                                    onFocus={(e) => e.target.select()}
                                                    className="h-8"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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
