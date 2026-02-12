import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * Get chat messages for a product/item in a specific room
 * GET /api/product-chats/:entityId/:roomId
 */
router.get('/:entityId/:roomId', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { entityId, roomId } = req.params;

        const { data: messages, error } = await supabaseAdmin
            .from('product_chat_messages')
            .select(`
                *,
                sender:users(id, name, avatar)
            `)
            .eq('entity_id', entityId)
            .eq('room_id', roomId)
            .order('created_at', { ascending: true });

        if (error) {
            throw new ApiError('Không thể tải tin nhắn', 500);
        }

        res.json({
            status: 'success',
            data: messages
        });
    } catch (error) {
        next(error);
    }
});

/**
 * Send a new chat message
 * POST /api/product-chats
 */
router.post('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { entity_id, entity_type, room_id, content } = req.body;
        const sender_id = req.user?.id;

        if (!entity_id || !entity_type || !room_id || !content) {
            throw new ApiError('Thiếu thông tin gửi tin nhắn', 400);
        }

        const { data: message, error } = await supabaseAdmin
            .from('product_chat_messages')
            .insert({
                entity_id,
                entity_type,
                room_id,
                content,
                sender_id
            })
            .select(`
                *,
                sender:users(id, name, avatar)
            `)
            .single();

        if (error) {
            console.error('Error sending message:', error);
            throw new ApiError('Không thể gửi tin nhắn', 500);
        }

        res.json({
            status: 'success',
            data: message
        });
    } catch (error) {
        next(error);
    }
});

export default router;
