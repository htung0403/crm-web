import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Lead } from '@/hooks/useLeads';

interface LeadHenQuaShipDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<Lead>) => Promise<void>;
    lead: Lead | null;
}

export function LeadHenQuaShipDialog({ open, onClose, onSubmit, lead }: LeadHenQuaShipDialogProps) {
    const [method, setMethod] = useState<'direct' | 'ship'>('direct');
    const [appointmentTime, setAppointmentTime] = useState('');
    const [trackingCode, setTrackingCode] = useState('');
    const [shippingFee, setShippingFee] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (lead && open) {
            setMethod(lead.delivery_method || 'direct');
            setAppointmentTime(lead.appointment_time ? lead.appointment_time.slice(0, 10) : '');
            setTrackingCode(lead.tracking_code || '');
            setShippingFee(lead.shipping_fee?.toString() || '');
        }
    }, [lead, open]);

    const handleSubmit = async () => {
        if (!lead) return;
        setIsSubmitting(true);
        try {
            const data: Partial<Lead> = {
                delivery_method: method,
                pipeline_stage: 'hen_qua_ship',
                status: 'hen_qua_ship'
            };

            if (method === 'direct') {
                data.appointment_time = appointmentTime ? new Date(appointmentTime).toISOString() : undefined;
            } else {
                data.tracking_code = trackingCode;
                data.shipping_fee = parseFloat(shippingFee) || 0;
            }

            await onSubmit(data);
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Thông tin nhận hàng / Hẹn qua</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Phương thức</Label>
                        <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Chọn phương thức" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="direct">Nhận trực tiếp (Hẹn qua)</SelectItem>
                                <SelectItem value="ship">Ship hàng</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {method === 'direct' ? (
                        <div className="grid gap-2 animate-in fade-in slide-in-from-top-1">
                            <Label htmlFor="appointmentTime">Ngày khách hẹn qua</Label>
                            <Input
                                id="appointmentTime"
                                type="date"
                                value={appointmentTime}
                                onChange={(e) => setAppointmentTime(e.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                            <div className="grid gap-2">
                                <Label htmlFor="trackingCode">Mã vận chuyển</Label>
                                <Input
                                    id="trackingCode"
                                    value={trackingCode}
                                    onChange={(e) => setTrackingCode(e.target.value)}
                                    placeholder="Nhập mã vận chuyển"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="shippingFee">Phí ship</Label>
                                <Input
                                    id="shippingFee"
                                    type="number"
                                    value={shippingFee}
                                    onChange={(e) => setShippingFee(e.target.value)}
                                    placeholder="Nhập phí ship"
                                />
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Hủy</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Đang lưu...' : 'Lưu thông tin'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
