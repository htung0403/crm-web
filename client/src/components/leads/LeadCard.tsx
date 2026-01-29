import { Draggable } from '@hello-pangea/dnd';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatTimeAgo } from '@/lib/utils';
import type { Lead } from '@/hooks/useLeads';
import { sourceLabels } from './constants';

interface LeadCardProps {
    lead: Lead;
    index: number;
    onClick: () => void;
}

export function LeadCard({ lead, index, onClick }: LeadCardProps) {
    // Use channel first, fallback to source for legacy data
    const channelKey = lead.channel || lead.source || '';
    const source = sourceLabels[channelKey] || { label: channelKey || 'Khác', color: 'bg-gray-100 text-gray-700' };

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
                                <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                                    {lead.name.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">
                                    {lead.name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {lead.phone}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClick();
                            }}
                        >
                            <Eye className="h-3.5 w-3.5" />
                        </Button>
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
