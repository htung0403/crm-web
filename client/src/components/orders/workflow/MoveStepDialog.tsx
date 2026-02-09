import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { orderItemsApi } from '@/lib/api';
import { toast } from 'sonner';

interface MoveStepDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    itemId: string;
    targetRoomId: string;
    targetRoomName: string;
    onSuccess: () => void;
}

export function MoveStepDialog({
    open,
    onOpenChange,
    itemId,
    targetRoomId,
    targetRoomName,
    onSuccess,
}: MoveStepDialogProps) {
    const [reason, setReason] = useState('');
    const [deadline, setDeadline] = useState<number>(3); // Default 3 days
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!reason.trim()) {
            toast.error('Vui lòng nhập lý do/mục đích');
            return;
        }
        if (deadline <= 0) {
            toast.error('Hạn hoàn thành phải lớn hơn 0');
            return;
        }

        setLoading(true);
        try {
            await orderItemsApi.changeRoom(itemId, {
                targetRoomId,
                reason: reason.trim(),
                deadline_days: deadline
            });
            toast.success('Đã chuyển quy trình thành công');
            onSuccess();
            onOpenChange(false);
            setReason('');
            setDeadline(3);
        } catch (error: any) {
            toast.error(error.message || 'Có lỗi xảy ra khi chuyển quy trình');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Chuyển sang {targetRoomName}</DialogTitle>
                    <DialogDescription>
                        Vui lòng nhập lý do/mục đích và hạn hoàn thành cho bước này.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="reason">Lý do / Mục đích <span className="text-red-500">*</span></Label>
                        <Textarea
                            id="reason"
                            placeholder="Ví dụ: Cần mạ lại, chuyển sang dán đế..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="deadline">Hạn hoàn thành (ngày) <span className="text-red-500">*</span></Label>
                        <Input
                            id="deadline"
                            type="number"
                            min="1"
                            value={deadline}
                            onChange={(e) => setDeadline(Number(e.target.value))}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Hủy
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Đang xử lý...' : 'Xác nhận chuyển'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
