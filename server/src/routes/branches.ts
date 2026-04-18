import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';

const router = Router();

// Get all branches
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { status } = req.query;

        let query = supabase
            .from('branches')
            .select('*')
            .order('name', { ascending: true });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({
            status: 'success',
            data: { branches: data || [] },
        });
    } catch (error) {
        next(error);
    }
});

export default router;
