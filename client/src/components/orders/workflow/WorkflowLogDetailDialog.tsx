import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDateTime } from '@/lib/utils';
import { User, Clock, MessageSquare, Camera, Wrench, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowLogDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    log: any;
}

export function WorkflowLogDetailDialog({
    open,
    onOpenChange,
    log
}: WorkflowLogDetailDialogProps) {
    if (!log) return null;

    // Helper to extract technician and deadline if they are in the notes
    // Backend format: `${reason}${note ? `\nLưu ý: ${note}` : ''}${deadlineInfo}${techInfo}${displayPhotos}`
    // deadlineInfo = `\nHạn hoàn thành: ${deadline_days} ngày`
    // techInfo = `\nKỹ thuật viên: ${techName}`
    
    const parseNotes = (notes: string) => {
        if (!notes) return { reason: '', note: '', deadline: '', technician: '' };
        
        const lines = notes.split('\n');
        let reason = lines[0] || '';
        let note = '';
        let deadline = '';
        let technician = '';
        
        lines.forEach((line, idx) => {
            if (line.startsWith('Lưu ý: ')) note = line.replace('Lưu ý: ', '');
            else if (line.startsWith('Hạn hoàn thành: ')) deadline = line.replace('Hạn hoàn thành: ', '');
            else if (line.startsWith('Kỹ thuật viên: ')) technician = line.replace('Kỹ thuật viên: ', '');
            else if (idx > 0 && !line.startsWith('Ảnh bằng chứng: ')) {
                // If it's not any of the above, it's part of the reason or note? 
                // Mostly just skip or append to note if we don't know
            }
        });
        
        return { reason, note, deadline, technician };
    };

    const { reason, note, deadline, technician } = parseNotes(log.notes);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-white border-2">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <Badge 
                            className={cn(
                                "text-[10px] font-bold px-2 py-0.5",
                                log.action === 'completed' ? "bg-green-100 text-green-700 hover:bg-green-100" :
                                log.action === 'failed' ? "bg-red-100 text-red-700 hover:bg-red-100" :
                                log.action === 'skipped' ? "bg-orange-100 text-orange-700 hover:bg-orange-100" :
                                "bg-blue-100 text-blue-700 hover:bg-blue-100"
                            )}
                        >
                            {log.action === 'completed' ? 'HOÀN THÀNH' : log.action === 'failed' ? 'THẤT BẠI' : log.action === 'skipped' ? 'BỎ QUA' : 'PHÂN CÔNG'}
                        </Badge>
                        <span className="text-sm font-bold text-gray-700">{log.step_name}</span>
                    </div>
                    <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-gray-400" /> Chi tiết thao tác
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="max-h-[70vh] pr-4">
                    <div className="space-y-5 py-4">
                        {/* Meta info */}
                        <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2 text-xs">
                                <User className="h-3.5 w-3.5 text-gray-400" />
                                <span className="text-gray-500">Thực hiện bởi:</span>
                                <span className="font-bold text-gray-800">{log.created_by_user?.name || 'Hệ thống'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <Clock className="h-3.5 w-3.5 text-gray-400" />
                                <span className="text-gray-500">Vào lúc:</span>
                                <span className="font-medium text-gray-800">{formatDateTime(log.created_at)}</span>
                            </div>
                        </div>

                        {/* Content section */}
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Lý do/Thao tác</h4>
                                <p className="text-sm font-bold text-gray-800 leading-relaxed px-1">
                                    {reason || "Phân công bước quy trình"}
                                </p>
                            </div>

                            {note && (
                                <div className="space-y-1.5">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Ghi chú/Lưu ý</h4>
                                    <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 italic text-sm text-gray-700 leading-relaxed">
                                        "{note}"
                                    </div>
                                </div>
                            )}

                            {(technician || deadline) && (
                                <div className="grid grid-cols-2 gap-3">
                                    {technician && (
                                        <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 space-y-1">
                                            <div className="flex items-center gap-1.5 text-[9px] font-black text-purple-400 uppercase tracking-tight">
                                                <Wrench className="h-3 w-3" /> Kỹ thuật viên
                                            </div>
                                            <div className="text-xs font-bold text-purple-700">{technician}</div>
                                        </div>
                                    )}
                                    {deadline && (
                                        <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1">
                                            <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-400 uppercase tracking-tight">
                                                <Calendar className="h-3 w-3" /> Hạn hoàn thành
                                            </div>
                                            <div className="text-xs font-bold text-blue-700">{deadline}</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {log.photos && Array.isArray(log.photos) && log.photos.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Ảnh bằng chứng ({log.photos.length})</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {log.photos.map((photo: string, idx: number) => (
                                            <a 
                                                key={idx} 
                                                href={photo} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="aspect-square rounded-xl overflow-hidden border-2 border-white shadow-sm hover:ring-2 hover:ring-primary/20 transition-all bg-gray-50 flex items-center justify-center p-0.5"
                                            >
                                                <img src={photo} alt="" className="w-full h-full object-cover rounded-[10px]" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
