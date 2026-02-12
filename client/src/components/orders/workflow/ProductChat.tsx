import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { productChatsApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';

interface Message {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    sender?: {
        id: string;
        name: string;
        avatar?: string;
    };
}

interface ProductChatProps {
    entityId: string;
    entityType: 'order_product' | 'order_item';
    roomId: string;
    currentUserId?: string;
}

export function ProductChat({ entityId, entityType, roomId, currentUserId }: ProductChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchMessages = async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const response = await productChatsApi.getMessages(entityId, roomId);
            if (response.data?.data) {
                setMessages(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
            toast.error('Không thể tải tin nhắn');
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages(true);

        // Subscribe to real-time updates for this product and room
        console.log('Subscribing to realtime for:', entityId, roomId);
        const channel = supabase
            .channel(`product_chat:${entityId}:${roomId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'product_chat_messages',
                    filter: `entity_id=eq.${entityId}`
                },
                (payload) => {
                    console.log('Realtime message received:', payload);
                    const newMsg = payload.new as any;
                    // Only process if it belongs to the current room
                    if (newMsg.room_id === roomId) {
                        // Refresh the messages to get joined sender info
                        fetchMessages();
                    }
                }
            )
            .subscribe((status) => {
                console.log('Realtime subscription status:', status);
                if (status === 'CHANNEL_ERROR') {
                    console.error('Realtime channel error - falling back to polling');
                }
            });

        // Polling fallback every 5 seconds (safety measure)
        const interval = setInterval(() => fetchMessages(), 5000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [entityId, roomId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        setSending(true);
        try {
            const response = await productChatsApi.sendMessage({
                entity_id: entityId,
                entity_type: entityType,
                room_id: roomId,
                content: newMessage.trim()
            });
            if (response.data?.data) {
                setMessages([...messages, response.data.data]);
                setNewMessage('');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Không thể gửi tin nhắn');
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p className="text-sm">Đang tải cuộc hội thoại...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 border rounded-lg bg-gray-50/50 overflow-hidden min-h-0">
            <div className="p-3 border-b bg-white rounded-t-lg">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Thảo luận nội bộ - {roomId.replace('_', ' ').toUpperCase()}
                </h4>
            </div>

            <ScrollArea className="flex-1 min-h-0 p-4">
                <div className="space-y-4">
                    {messages.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm italic">
                            Chưa có trao đổi nào tại bộ phận này.
                        </div>
                    ) : (
                        messages.map((msg) => {
                            const isMe = msg.sender_id === currentUserId;
                            return (
                                <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                                    <Avatar className="h-8 w-8 shrink-0">
                                        <AvatarImage src={msg.sender?.avatar} />
                                        <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                    </Avatar>
                                    <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : ''}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[11px] font-bold text-gray-700">{msg.sender?.name}</span>
                                            <span className="text-[10px] text-gray-400">{formatDateTime(msg.created_at)}</span>
                                        </div>
                                        <div className={`p-2.5 rounded-2xl text-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-white border rounded-tl-none shadow-sm'
                                            }`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            <form onSubmit={handleSend} className="p-3 bg-white border-t rounded-b-lg flex gap-2">
                <Input
                    placeholder="Nhập tin nhắn..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1"
                    disabled={sending}
                />
                <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
            </form>
        </div>
    );
}
