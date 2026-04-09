import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin as supabase } from '../config/supabase';

const router = Router();

// ─── SHIFTS (Shift Types) ────────────────────────────────────

// GET /api/work-schedules/shifts – list all shift types
router.get('/shifts', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { status } = req.query;
        let query = supabase
            .from('shifts')
            .select('*')
            .order('name', { ascending: true });

        if (status) query = query.eq('status', status as string);

        const { data, error } = await query;
        if (error) throw error;

        res.json({ status: 'success', data: { shifts: data } });
    } catch (error) {
        next(error);
    }
});

// POST /api/work-schedules/shifts – create a shift type
router.post('/shifts', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { name, start_time, end_time, color } = req.body;

        if (!name) {
            res.status(400).json({ status: 'fail', message: 'Shift name is required' });
            return;
        }

        const { data, error } = await supabase
            .from('shifts')
            .insert({ name, start_time: start_time || '09:00', end_time: end_time || '21:00', color: color || 'blue' })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ status: 'success', data: { shift: data } });
    } catch (error) {
        next(error);
    }
});

// PUT /api/work-schedules/shifts/:id – update a shift type
router.put('/shifts/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, start_time, end_time, color, status } = req.body;

        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (name !== undefined) updateData.name = name;
        if (start_time !== undefined) updateData.start_time = start_time;
        if (end_time !== undefined) updateData.end_time = end_time;
        if (color !== undefined) updateData.color = color;
        if (status !== undefined) updateData.status = status;

        const { data, error } = await supabase
            .from('shifts')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({ status: 'success', data: { shift: data } });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/work-schedules/shifts/:id
router.delete('/shifts/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        // Check if shift is used in any schedules
        const { data: existing } = await supabase
            .from('work_schedules')
            .select('id')
            .eq('shift_id', id)
            .limit(1);

        if (existing && existing.length > 0) {
            res.status(400).json({
                status: 'fail',
                message: 'Không thể xóa ca làm việc đang được sử dụng trong lịch'
            });
            return;
        }

        const { error } = await supabase.from('shifts').delete().eq('id', id);
        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// ─── WORK SCHEDULES ──────────────────────────────────────────

// GET /api/work-schedules?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&user_id=xxx
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { start_date, end_date, user_id } = req.query;

        if (!start_date || !end_date) {
            res.status(400).json({ status: 'fail', message: 'start_date and end_date are required' });
            return;
        }

        let query = supabase
            .from('work_schedules')
            .select(`
                *,
                shift:shifts(*),
                user:users!work_schedules_user_id_fkey(id, name, email, phone, role, avatar, status, employee_code, salary, department_id)
            `)
            .gte('schedule_date', start_date as string)
            .lte('schedule_date', end_date as string)
            .order('schedule_date', { ascending: true });

        if (user_id) {
            query = query.eq('user_id', user_id as string);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.json({ status: 'success', data: { schedules: data } });
    } catch (error) {
        next(error);
    }
});

// POST /api/work-schedules – create schedule(s)
// Body: { user_id, shift_ids[], schedule_date, repeat_weekly, apply_to_users[] }
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { user_id, shift_ids, schedule_date, repeat_weekly, apply_to_users, created_by } = req.body;

        if (!user_id || !shift_ids || !schedule_date) {
            res.status(400).json({ status: 'fail', message: 'user_id, shift_ids, and schedule_date are required' });
            return;
        }

        // Determine which users to create schedules for
        const targetUsers: string[] = [user_id];
        if (apply_to_users && Array.isArray(apply_to_users)) {
            for (const uid of apply_to_users) {
                if (!targetUsers.includes(uid)) targetUsers.push(uid);
            }
        }

        // Determine which dates to create schedules for
        const targetDates: string[] = [schedule_date];

        if (repeat_weekly) {
            // Get the day of week for the given date, then calculate all 7 days of that week (Mon-Sun)
            const baseDate = new Date(schedule_date + 'T00:00:00');
            const dayOfWeek = baseDate.getDay(); // 0=Sun, 1=Mon, ...
            const monday = new Date(baseDate);
            monday.setDate(baseDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

            targetDates.length = 0; // clear
            for (let i = 0; i < 7; i++) {
                const d = new Date(monday);
                d.setDate(monday.getDate() + i);
                const iso = d.toISOString().split('T')[0];
                targetDates.push(iso);
            }
        }

        // Build insert rows
        const rows: { user_id: string; shift_id: string; schedule_date: string; repeat_weekly: boolean; created_by?: string }[] = [];
        for (const uid of targetUsers) {
            for (const sid of shift_ids) {
                for (const date of targetDates) {
                    rows.push({
                        user_id: uid,
                        shift_id: sid,
                        schedule_date: date,
                        repeat_weekly: !!repeat_weekly,
                        created_by: created_by || undefined,
                    });
                }
            }
        }

        // Upsert (ignore conflicts on duplicate unique key)
        const { data, error } = await supabase
            .from('work_schedules')
            .upsert(rows, { onConflict: 'user_id,shift_id,schedule_date', ignoreDuplicates: true })
            .select(`
                *,
                shift:shifts(*),
                user:users!work_schedules_user_id_fkey(id, name, email, role, avatar, employee_code)
            `);

        if (error) throw error;

        res.status(201).json({ status: 'success', data: { schedules: data, count: rows.length } });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/work-schedules/:id – remove a single schedule entry
router.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('work_schedules')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// DELETE /api/work-schedules/bulk – remove schedules by user + date range
router.post('/bulk-delete', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { user_id, schedule_date, shift_id } = req.body;

        let query = supabase.from('work_schedules').delete();

        if (user_id) query = query.eq('user_id', user_id);
        if (schedule_date) query = query.eq('schedule_date', schedule_date);
        if (shift_id) query = query.eq('shift_id', shift_id);

        const { error } = await query;
        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export { router as workSchedulesRouter };
export default router;
