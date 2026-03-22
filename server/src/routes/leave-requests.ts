import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// Debug logging
router.use((req, res, next) => {
    console.log(`[LeaveRequests API] ${req.method} ${req.url}`);
    next();
});

// GET all leave requests (managers see all, others see their own)
router.get('/', async (req, res) => {
    try {
        const userId = req.query.user_id as string;
        const role = req.query.role as string; // passed from frontend auth ? nope, better to decode token or trust user_id for now

        let query = supabase.from('leave_requests').select(`
            *,
            users:user_id (id, name, email, avatar),
            approver:approved_by (id, name, email)
        `).order('created_at', { ascending: false });

        if (role !== 'admin' && role !== 'manager' && userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        res.json(data);
    } catch (error: any) {
        console.error('Error fetching leave requests:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST a new leave/late request
router.post('/', async (req, res) => {
    try {
        const { user_id, type, sub_type, start_time, end_time, reason } = req.body;

        if (!user_id || !type || !sub_type || !start_time || !reason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const payload = {
            user_id,
            type,
            sub_type,
            start_time,
            end_time,
            reason,
            status: 'pending'
        };

        const { data, error } = await supabase
            .from('leave_requests')
            .insert([payload])
            .select()
            .single();

        if (error) {
            throw error;
        }

        res.status(201).json(data);
    } catch (error: any) {
        console.error('Error creating leave request:', error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH to approve or reject a request
router.patch('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, approved_by } = req.body;

        if (!status || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        if (!approved_by) {
            return res.status(400).json({ error: 'Missing approved_by' });
        }

        const { data, error } = await supabase
            .from('leave_requests')
            .update({ 
                status, 
                approved_by,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        res.json(data);
    } catch (error: any) {
        console.error('Error updating leave request status:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
