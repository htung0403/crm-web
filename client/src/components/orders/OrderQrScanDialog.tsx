import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { AlertCircle, Camera, CameraOff, Loader2, QrCode } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseScannedCode } from '@/lib/parseQrCode';

const SCANNER_ELEMENT_ID = 'orders-qr-scanner';

interface OrderQrScanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onScan: (code: string) => void;
}

export function OrderQrScanDialog({ open, onOpenChange, onScan }: OrderQrScanDialogProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [hasCamera, setHasCamera] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [manualCode, setManualCode] = useState('');

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch {
                // ignore
            }
            scannerRef.current = null;
        }
        setIsScanning(false);
    };

    useEffect(() => {
        if (!open) {
            void stopScanner();
            setError(null);
            setManualCode('');
            return;
        }

        navigator.mediaDevices
            ?.getUserMedia({ video: true })
            .then(() => setHasCamera(true))
            .catch(() => {
                setHasCamera(false);
                setError('Không truy cập được camera. Nhập mã thủ công bên dưới.');
            });

        return () => {
            void stopScanner();
        };
    }, [open]);

    const handleDecoded = (decodedText: string) => {
        const code = parseScannedCode(decodedText);
        if (!code) return;
        void stopScanner();
        onScan(code);
        onOpenChange(false);
    };

    const startScanner = async () => {
        try {
            setError(null);
            setIsScanning(true);
            const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
            scannerRef.current = scanner;
            await scanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 220, height: 220 } },
                (text) => handleDecoded(text),
                () => {},
            );
        } catch (err) {
            setIsScanning(false);
            const message = err instanceof Error ? err.message : 'Không thể bật camera';
            setError(message);
        }
    };

    const submitManual = () => {
        const code = parseScannedCode(manualCode);
        if (!code) return;
        onScan(code);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={(next) => {
            if (!next) void stopScanner();
            onOpenChange(next);
        }}>
            <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
                <DialogHeader className="px-4 pt-4 pb-2">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <QrCode className="h-5 w-5" />
                        Quét mã đơn hàng
                    </DialogTitle>
                    <DialogDescription>
                        Quét mã QR trên phiếu (mã dịch vụ) hoặc nhập mã đơn / mã HĐ
                    </DialogDescription>
                </DialogHeader>

                <div className="px-4 pb-4 space-y-3">
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
                        <div id={SCANNER_ELEMENT_ID} className="h-full w-full" />
                        {!isScanning && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/90 p-4 text-center">
                                {hasCamera ? (
                                    <Camera className="h-10 w-10 text-muted-foreground" />
                                ) : (
                                    <CameraOff className="h-10 w-10 text-muted-foreground" />
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Đưa mã QR vào khung quét
                                </p>
                            </div>
                        )}
                        {isScanning && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <Loader2 className="h-8 w-8 animate-spin text-white" />
                            </div>
                        )}
                    </div>

                    {error && (
                        <p className="flex items-start gap-1.5 text-xs text-red-600">
                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {error}
                        </p>
                    )}

                    <div className="flex gap-2">
                        {isScanning ? (
                            <Button variant="outline" className="flex-1" onClick={() => void stopScanner()}>
                                Dừng
                            </Button>
                        ) : (
                            <Button className="flex-1" onClick={() => void startScanner()} disabled={!hasCamera}>
                                <Camera className="mr-2 h-4 w-4" />
                                Bật camera
                            </Button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <Input
                            placeholder="Mã đơn, mã HĐ..."
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                            className="h-9"
                        />
                        <Button variant="secondary" onClick={submitManual} disabled={!manualCode.trim()}>
                            Tìm
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
