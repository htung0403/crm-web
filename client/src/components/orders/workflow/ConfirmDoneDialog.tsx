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
import { orderItemsApi, orderProductsApi } from '@/lib/api';
import { toast } from 'sonner';

interface ConfirmDoneDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    itemId: string;
    isV2Service: boolean; // items vs services
    onSuccess: () => void;
}

export function ConfirmDoneDialog({
    open,
    onOpenChange,
    itemId,
    isV2Service,
    onSuccess,
}: ConfirmDoneDialogProps) {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            if (isV2Service) {
                // For V2 services, we might use completeService from orderProductsApi or orderItemsApi.complete
                // orderItemsApi.complete supports V2 items logic internally in our backend implementation!
                await orderItemsApi.complete(itemId, 'Hoàn thành dịch vụ');
            } else {
                await orderItemsApi.complete(itemId, 'Hoàn thành hạng mục');
            }

            toast.success('Đã hoàn thành hạng mục');
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || 'Có lỗi xảy ra khi hoàn thành');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Xác nhận Hoàn thành</DialogTitle>
                    <DialogDescription>
                        Bạn có chắc chắn muốn đánh dấu hạng mục này là "Hoàn thành" (Done)?
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Hủy
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Đang xử lý...' : 'Xác nhận Hoàn thành'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
