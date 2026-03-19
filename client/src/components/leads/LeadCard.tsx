import { Draggable } from '@hello-pangea/dnd';
import { Eye, Trash2, Flame, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatTimeAgo } from '@/lib/utils';
import type { Lead } from '@/hooks/useLeads';
import { sourceLabels } from './constants';
import { useAuth } from '@/contexts/AuthContext';

interface LeadCardProps {
    lead: Lead;
    index: number;
    onClick: () => void;
    onDelete?: (id: string) => void;
}

export function LeadCard({ lead, index, onClick, onDelete }: LeadCardProps) {
    const { user } = useAuth();
    // Use channel first, fallback to source for legacy data
    const channelKey = lead.channel || lead.source || '';
    const source = sourceLabels[channelKey] || { label: channelKey || 'Khác', color: 'bg-gray-100 text-gray-700' };

    const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager';

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete && window.confirm(`Bạn có chắc chắn muốn xóa lead "${lead.name}"?`)) {
            onDelete(lead.id);
        }
    };

    return (
        <Draggable draggableId={lead.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`kanban-card bg-white rounded-lg border p-3 cursor-pointer group ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/20' : 'shadow-sm hover:shadow-md'
                        }`}
                    onClick={onClick}
                >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-8 w-8 shrink-0">
                                {lead.fb_profile_pic && <AvatarImage src={lead.fb_profile_pic} alt={lead.name} />}
                                <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                                    {lead.name.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                             <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <p className="font-bold text-sm text-foreground truncate">
                                        {lead.name}
                                    </p>
                                    {lead.lead_score !== undefined && lead.lead_score > 0 && (
                                        <div className="flex items-center gap-0.5 shrink-0 bg-slate-50 px-1 rounded-md border border-slate-100" title={`Heat Score: ${lead.lead_score}`}>
                                            <Flame className={`h-3 w-3 ${
                                                lead.lead_score >= 80 ? 'text-red-500 fill-red-500 animate-pulse' :
                                                lead.lead_score >= 60 ? 'text-orange-500 fill-orange-500' :
                                                'text-blue-400 fill-blue-400'
                                            }`} />
                                            <span className={`text-[9px] font-black ${
                                                lead.lead_score >= 80 ? 'text-red-600' :
                                                lead.lead_score >= 60 ? 'text-orange-600' :
                                                'text-blue-600'
                                            }`}>
                                                {lead.lead_score}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1">
                                    <p className="text-[11px] text-muted-foreground truncate font-medium">
                                        {lead.phone}
                                    </p>
                                    {lead.loss_risk?.toLowerCase() === 'high' && (
                                        <div className="inline-flex items-center gap-1 bg-red-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-sm shadow-sm animate-bounce w-fit mt-0.5">
                                            <AlertTriangle className="h-2.5 w-2.5" />
                                            NGUY CƠ RỚT KHÁCH
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClick();
                                }}
                            >
                                <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {isManagerOrAdmin && onDelete && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                                    onClick={handleDelete}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${source.color}`}>
                            {source.label}
                        </span>
                        {lead.company && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 truncate max-w-[120px]">
                                {lead.company}
                            </span>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <div className="flex items-center gap-1.5">
                            {lead.assigned_user ? (
                                <>
                                    <Avatar className="h-5 w-5">
                                        <AvatarFallback className="text-[10px] bg-secondary/20">
                                            {lead.assigned_user.name.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="truncate max-w-[80px]">{lead.assigned_user.name}</span>
                                </>
                            ) : (
                                <span className="text-muted-foreground/60">Chưa gán</span>
                            )}
                        </div>
                        <span>{formatTimeAgo(lead.created_at)}</span>
                    </div>
                </div>
            )}
        </Draggable>
    );
}
