import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// Generate department code
const generateDepartmentCode = async (): Promise<string> => {
    const { data } = await supabase
        .from('departments')
        .select('code')
        .order('created_at', { ascending: false })
        .limit(1);

    let nextNumber = 1;
    if (data && data.length > 0) {
        const lastCode = data[0].code;
        const match = lastCode.match(/PB(\d+)/);
        if (match) {
            nextNumber = parseInt(match[1]) + 1;
        }
    }
    return `PB${nextNumber.toString().padStart(3, '0')}`;
};

// Get all departments
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { status } = req.query;

        let query = supabase
            .from('departments')
            .select(`
                *,
                manager:users!departments_manager_id_fkey(id, name, email, avatar)
            `)
            .order('name', { ascending: true });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Get department by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('departments')
            .select(`
                *,
                manager:users!departments_manager_id_fkey(id, name, email, avatar)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!data) {
            res.status(404).json({ error: 'Department not found' });
            return;
        }

        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Create department
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { name, description, manager_id, status = 'active' } = req.body;

        if (!name) {
            res.status(400).json({ error: 'Department name is required' });
            return;
        }

        const code = await generateDepartmentCode();

        const { data, error } = await supabase
            .from('departments')
            .insert({
                code,
                name,
                description,
                manager_id,
                status
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        next(error);
    }
});

// Update department
router.put('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, description, manager_id, status } = req.body;

        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (manager_id !== undefined) updateData.manager_id = manager_id;
        if (status !== undefined) updateData.status = status;

        const { data, error } = await supabase
            .from('departments')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (!data) {
            res.status(404).json({ error: 'Department not found' });
            return;
        }

        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Delete department
router.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        // Check if department has any users or services
        const { data: users } = await supabase
            .from('users')
            .select('id')
            .eq('department_id', id)
            .limit(1);

        if (users && users.length > 0) {
            res.status(400).json({ error: 'Cannot delete department with assigned users' });
            return;
        }

        const { data: services } = await supabase
            .from('services')
            .select('id')
            .eq('department_id', id)
            .limit(1);

        if (services && services.length > 0) {
            res.status(400).json({ error: 'Cannot delete department with assigned services' });
            return;
        }

        const { error } = await supabase
            .from('departments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// Get technicians in a department
router.get('/:id/technicians', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('department_id', id)
            .eq('role', 'technician')
            .order('name', { ascending: true });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Get services in a department
router.get('/:id/services', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('services')
            .select('*')
            .eq('department_id', id)
            .order('name', { ascending: true });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        next(error);
    }
});

export default router;
