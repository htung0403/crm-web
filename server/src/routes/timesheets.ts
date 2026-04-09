import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin as supabase } from '../config/supabase';

const router = Router();

// ─── GET /api/timesheets ─────────────────────────────────────
// Query: start_date, end_date, user_id?, shift_id?
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { start_date, end_date, user_id, shift_id } = req.query;

        if (!start_date || !end_date) {
            res.status(400).json({ status: 'fail', message: 'start_date and end_date are required' });
            return;
        }

        let query = supabase
            .from('timesheets')
            .select(`
                *,
                shift:shifts(*),
                user:users!timesheets_user_id_fkey(id, name, email, phone, role, avatar, status, employee_code, salary, department_id),
                approver:users!timesheets_approved_by_fkey(id, name)
            `)
            .gte('schedule_date', start_date as string)
            .lte('schedule_date', end_date as string)
            .order('schedule_date', { ascending: true });

        if (user_id) query = query.eq('user_id', user_id as string);
        if (shift_id) query = query.eq('shift_id', shift_id as string);

        const { data, error } = await query;
        if (error) throw error;

        res.json({ status: 'success', data: { timesheets: data } });
    } catch (error) {
        next(error);
    }
});

// ─── POST /api/timesheets ────────────────────────────────────
// Create or update a single timesheet entry
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { user_id, shift_id, schedule_date, check_in, check_out, status, notes } = req.body;

        if (!user_id || !shift_id || !schedule_date) {
            res.status(400).json({ status: 'fail', message: 'user_id, shift_id, and schedule_date are required' });
            return;
        }

        const { data, error } = await supabase
            .from('timesheets')
            .upsert({
                user_id,
                shift_id,
                schedule_date,
                check_in: check_in || null,
                check_out: check_out || null,
                status: status || 'not_checked',
                notes: notes || null,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,shift_id,schedule_date' })
            .select(`
                *,
                shift:shifts(*),
                user:users!timesheets_user_id_fkey(id, name, email, role, avatar, employee_code)
            `)
            .single();

        if (error) throw error;

        res.status(201).json({ status: 'success', data: { timesheet: data } });
    } catch (error) {
        next(error);
    }
});

// ─── PUT /api/timesheets/:id ─────────────────────────────────
router.put('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { check_in, check_out, status, notes } = req.body;

        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (check_in !== undefined) updateData.check_in = check_in;
        if (check_out !== undefined) updateData.check_out = check_out;
        if (status !== undefined) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;

        const { data, error } = await supabase
            .from('timesheets')
            .update(updateData)
            .eq('id', id)
            .select(`
                *,
                shift:shifts(*),
                user:users!timesheets_user_id_fkey(id, name, email, role, avatar, employee_code)
            `)
            .single();

        if (error) throw error;
        res.json({ status: 'success', data: { timesheet: data } });
    } catch (error) {
        next(error);
    }
});

// ─── POST /api/timesheets/approve ────────────────────────────
// Bulk approve timesheets
router.post('/approve', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { timesheet_ids, approved_by } = req.body;

        if (!timesheet_ids || !Array.isArray(timesheet_ids) || timesheet_ids.length === 0) {
            res.status(400).json({ status: 'fail', message: 'timesheet_ids array is required' });
            return;
        }

        const { data, error } = await supabase
            .from('timesheets')
            .update({
                approved_by: approved_by || null,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .in('id', timesheet_ids)
            .select();

        if (error) throw error;

        res.json({ status: 'success', data: { count: data?.length || 0 } });
    } catch (error) {
        next(error);
    }
});

// ─── POST /api/timesheets/generate ───────────────────────────
// Auto-generate timesheet entries from work_schedules for a date range
router.post('/generate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { start_date, end_date } = req.body;

        if (!start_date || !end_date) {
            res.status(400).json({ status: 'fail', message: 'start_date and end_date are required' });
            return;
        }

        // Fetch work schedules for the date range
        const { data: schedules, error: schedError } = await supabase
            .from('work_schedules')
            .select('user_id, shift_id, schedule_date')
            .gte('schedule_date', start_date)
            .lte('schedule_date', end_date);

        if (schedError) throw schedError;

        if (!schedules || schedules.length === 0) {
            res.json({ status: 'success', data: { count: 0, message: 'No work schedules found for this range' } });
            return;
        }

        // Build timesheet rows from work schedules
        const rows = schedules.map(s => ({
            user_id: s.user_id,
            shift_id: s.shift_id,
            schedule_date: s.schedule_date,
            status: 'not_checked',
        }));

        const { data, error } = await supabase
            .from('timesheets')
            .upsert(rows, { onConflict: 'user_id,shift_id,schedule_date', ignoreDuplicates: true })
            .select();

        if (error) throw error;

        res.status(201).json({ status: 'success', data: { count: data?.length || 0 } });
    } catch (error) {
        next(error);
    }
});

// ─── DELETE /api/timesheets/:id ──────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('timesheets').delete().eq('id', id);
        if (error) throw error;
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export { router as timesheetsRouter };
export default router;
