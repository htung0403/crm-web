import { Router } from 'express';
import bcrypt from 'bcrypt';
import { supabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest, requireManager } from '../middleware/auth.js';

const router = Router();

// Get technicians list (cho tất cả user đã đăng nhập - dùng để phân công)
router.get('/technicians', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { data: technicians, error } = await supabaseAdmin
            .from('users')
            .select('id, name, avatar, phone, department, status, role')
            .eq('role', 'technician')
            .eq('status', 'active')
            .order('name', { ascending: true });

        if (error) {
            throw new ApiError('Lỗi khi lấy danh sách kỹ thuật viên', 500);
        }

        res.json({
            status: 'success',
            data: { users: technicians || [] },
        });
    } catch (error) {
        next(error);
    }
});

// Get sales list (cho tất cả user đã đăng nhập - dùng để phân công)
router.get('/sales', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { data: sales, error } = await supabaseAdmin
            .from('users')
            .select('id, name, avatar, phone, department, status, role')
            .eq('role', 'sale')
            .eq('status', 'active')
            .order('name', { ascending: true });

        if (error) {
            throw new ApiError('Lỗi khi lấy danh sách sales', 500);
        }

        res.json({
            status: 'success',
            data: { users: sales || [] },
        });
    } catch (error) {
        next(error);
    }
});

// Get all users (chỉ manager)
router.get('/', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { role, department, status, search } = req.query;

        let query = supabaseAdmin
            .from('users')
            .select('id, email, name, role, phone, avatar, department, department_id, departments!department_id(name), status, created_at, last_login, salary, commission, bank_account, bank_name, telegram_chat_id, employee_code, timekeeping_code, dob, gender, identity_card, job_title_id, join_date, payroll_branch_id, working_branch_id, kiotviet_account, facebook, address, mobile_device, notes')
            .order('created_at', { ascending: false });

        if (role) query = query.eq('role', role);
        if (department) query = query.eq('department', department);
        if (status) query = query.eq('status', status);
        if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);

        const { data: users, error } = await query;

        if (error) {
            throw new ApiError('Lỗi khi lấy danh sách người dùng', 500);
        }

        // Fetch all departments for name resolution fallback
        const { data: deptList } = await supabaseAdmin.from('departments').select('id, name');
        const deptMap = new Map((deptList || []).map(d => [d.id, d.name]));

        // Map snake_case to camelCase
        const mappedUsers = (users || []).map((user: any) => ({
            ...user,
            department: user.departments?.name || (user.department ? (deptMap.get(user.department) || user.department) : null),
            departmentId: user.department_id,
            bankAccount: user.bank_account,
            bankName: user.bank_name,
            telegramChatId: user.telegram_chat_id,
            employeeCode: user.employee_code,
            timekeepingCode: user.timekeeping_code,
            jobTitleId: user.job_title_id,
            joinDate: user.join_date,
            payrollBranchId: user.payroll_branch_id,
            workingBranchId: user.working_branch_id,
            kiotvietAccount: user.kiotviet_account,
            mobileDevice: user.mobile_device,
            identityCard: user.identity_card,
        }));

        res.json({
            status: 'success',
            data: { users: mappedUsers },
        });
    } catch (error) {
        next(error);
    }
});

// Create new user (manager only) - Uses bcrypt for password hashing
router.post('/', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { 
            email, password, name, phone, role, department, avatar, salary, commission, bankAccount, bankName, telegramChatId,
            dob, gender, identityCard, jobTitleId, joinDate, payrollBranchId, workingBranchId, kiotvietAccount, facebook, address, mobileDevice, notes 
        } = req.body;

        if (!email || !password || !name) {
            throw new ApiError('Email, mật khẩu và tên là bắt buộc', 400);
        }

        if (password.length < 6) {
            throw new ApiError('Mật khẩu phải có ít nhất 6 ký tự', 400);
        }

        // Check if email already exists
        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            throw new ApiError('Email đã tồn tại trong hệ thống', 400);
        }

        // Hash password with bcrypt
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Generate timekeepingCode
        const { data: lastTimekeeping } = await supabaseAdmin
            .from('users')
            .select('timekeeping_code')
            .order('created_at', { ascending: false })
            .limit(1);
        
        let nt = 1;
        if (lastTimekeeping && lastTimekeeping.length > 0 && lastTimekeeping[0].timekeeping_code) {
            const match = lastTimekeeping[0].timekeeping_code.match(/CC(\d+)/);
            if (match) nt = parseInt(match[1]) + 1;
        }
        const timekeepingCode = `CC${nt.toString().padStart(4, '0')}`;

        // Insert user record into users table
        const { data: user, error: insertError } = await supabaseAdmin
            .from('users')
            .insert({
                email,
                password_hash: passwordHash,
                name,
                phone: phone || null,
                role: role || 'sale',
                department: department || null,
                avatar: avatar || null,
                salary: salary || 0,
                commission: commission || 0,
                bank_account: bankAccount || null,
                bank_name: bankName || null,
                telegram_chat_id: telegramChatId || null,
                status: 'active',
                created_at: new Date().toISOString(),
                timekeeping_code: timekeepingCode,
                dob: dob || null,
                gender: gender || null,
                identity_card: identityCard || null,
                job_title_id: jobTitleId || null,
                join_date: joinDate || null,
                payroll_branch_id: payrollBranchId || null,
                working_branch_id: workingBranchId || null,
                kiotviet_account: kiotvietAccount || null,
                facebook: facebook || null,
                address: address || null,
                mobile_device: mobileDevice || null,
                notes: notes || null
            })
            .select('id, email, name, role, phone, avatar, department, status, created_at, salary, commission, bank_account, bank_name, telegram_chat_id, employee_code, timekeeping_code, dob, gender, identity_card, job_title_id, join_date, payroll_branch_id, working_branch_id, kiotviet_account, facebook, address, mobile_device, notes')
            .single();

        if (insertError) {
            throw new ApiError(`Lỗi tạo hồ sơ người dùng: ${insertError.message}`, 500);
        }

        // Map snake_case to camelCase
        const mappedUser = {
            ...user,
            bankAccount: user.bank_account,
            bankName: user.bank_name,
            telegramChatId: user.telegram_chat_id,
            employeeCode: user.employee_code,
            timekeepingCode: user.timekeeping_code,
            jobTitleId: user.job_title_id,
            joinDate: user.join_date,
            payrollBranchId: user.payroll_branch_id,
            workingBranchId: user.working_branch_id,
            kiotvietAccount: user.kiotviet_account,
            mobileDevice: user.mobile_device,
            identityCard: user.identity_card,
        };

        res.status(201).json({
            status: 'success',
            data: { user: mappedUser },
            message: 'Đã tạo tài khoản nhân viên thành công',
        });
    } catch (error) {
        next(error);
    }
});

// Get user by ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        // Chỉ cho phép xem thông tin của chính mình hoặc quản lý
        if (req.user!.id !== id && req.user!.role !== 'manager' && req.user!.role !== 'admin') {
            throw new ApiError('Không có quyền xem thông tin người dùng này', 403);
        }

        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('id, email, name, role, phone, avatar, department, status, created_at, last_login, salary, commission, bank_account, bank_name, telegram_chat_id, employee_code, timekeeping_code, dob, gender, identity_card, job_title_id, join_date, payroll_branch_id, working_branch_id, kiotviet_account, facebook, address, mobile_device, notes')
            .eq('id', id)
            .single();

        if (error || !user) {
            throw new ApiError('Không tìm thấy người dùng', 404);
        }

        res.json({
            status: 'success',
            data: { 
                user: {
                    ...user,
                    bankAccount: user.bank_account,
                    bankName: user.bank_name,
                    telegramChatId: user.telegram_chat_id,
                    employeeCode: user.employee_code,
                    timekeepingCode: user.timekeeping_code,
                    jobTitleId: user.job_title_id,
                    joinDate: user.join_date,
                    payrollBranchId: user.payroll_branch_id,
                    workingBranchId: user.working_branch_id,
                    kiotvietAccount: user.kiotviet_account,
                    mobileDevice: user.mobile_device,
                    identityCard: user.identity_card,
                } 
            },
        });
    } catch (error) {
        next(error);
    }
});

// Update user
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;
        const { 
            name, phone, avatar, department, departmentId, status, role, salary, commission, bankAccount, bankName, telegramChatId,
            dob, gender, identityCard, jobTitleId, joinDate, payrollBranchId, workingBranchId, kiotvietAccount, facebook, address, mobileDevice, notes,
            kpiPolicyId
        } = req.body;

        // Chỉ cho phép cập nhật thông tin của chính mình hoặc quản lý
        const isOwner = req.user!.id === id;
        const isManager = req.user!.role === 'manager' || req.user!.role === 'admin';

        if (!isOwner && !isManager) {
            throw new ApiError('Không có quyền cập nhật thông tin người dùng này', 403);
        }

        const updateData: Record<string, any> = {
            updated_at: new Date().toISOString(),
        };

        // Thông tin cơ bản - ai cũng có thể cập nhật cho mình
        if (name) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone || null;
        if (avatar !== undefined) updateData.avatar = avatar || null;
        if (telegramChatId !== undefined) updateData.telegram_chat_id = telegramChatId || null;
        if (dob !== undefined) updateData.dob = dob || null;
        if (gender !== undefined) updateData.gender = gender || null;
        if (identityCard !== undefined) updateData.identity_card = identityCard || null;
        if (facebook !== undefined) updateData.facebook = facebook || null;
        if (address !== undefined) updateData.address = address || null;
        if (mobileDevice !== undefined) updateData.mobile_device = mobileDevice || null;
        if (notes !== undefined) updateData.notes = notes || null;

        // Chỉ manager mới được cập nhật role, status, department, salary, etc.
        if (isManager) {
            if (department !== undefined) updateData.department = department || null;
            if (departmentId !== undefined) updateData.department_id = departmentId || null;
            if (status) updateData.status = status;
            if (role) updateData.role = role;
            if (salary !== undefined) updateData.salary = salary;
            if (commission !== undefined) updateData.commission = commission;
            if (bankAccount !== undefined) updateData.bank_account = bankAccount || null;
            if (bankName !== undefined) updateData.bank_name = bankName || null;
            if (jobTitleId !== undefined) updateData.job_title_id = jobTitleId || null;
            if (joinDate !== undefined) updateData.join_date = joinDate || null;
            if (payrollBranchId !== undefined) updateData.payroll_branch_id = payrollBranchId || null;
            if (workingBranchId !== undefined) updateData.working_branch_id = workingBranchId || null;
            if (kiotvietAccount !== undefined) updateData.kiotviet_account = kiotvietAccount || null;
            if (kpiPolicyId !== undefined) updateData.kpi_policy_id = kpiPolicyId || null;
        }

        console.log('[DEBUG PUT /users/:id] req.body.jobTitleId =', jobTitleId, '| updateData =', JSON.stringify(updateData));

        const { data: user, error } = await supabaseAdmin
            .from('users')
            .update(updateData)
            .eq('id', id)
            .select('id, email, name, role, phone, avatar, department, department_id, departments!department_id(name), status, salary, commission, bank_account, bank_name, telegram_chat_id, employee_code, timekeeping_code, dob, gender, identity_card, job_title_id, join_date, payroll_branch_id, working_branch_id, kiotviet_account, facebook, address, mobile_device, notes, kpi_policy_id')
            .single();

        if (error) {
            console.error('[DEBUG PUT /users/:id] Supabase error:', error);
            throw new ApiError('Lỗi khi cập nhật người dùng', 500);
        }

        // Map snake_case to camelCase for response
        const mappedUser = {
            ...user,
            department: (user as any).departments?.name || (user as any).department || null,
            departmentId: (user as any).department_id,
            bankAccount: user.bank_account,
            bankName: user.bank_name,
            telegramChatId: user.telegram_chat_id,
            employeeCode: user.employee_code,
            timekeepingCode: user.timekeeping_code,
            jobTitleId: user.job_title_id,
            joinDate: user.join_date,
            payrollBranchId: user.payroll_branch_id,
            workingBranchId: user.working_branch_id,
            kiotvietAccount: user.kiotviet_account,
            mobileDevice: user.mobile_device,
            identityCard: user.identity_card,
            kpiPolicyId: user.kpi_policy_id,
        };

        res.json({
            status: 'success',
            data: { user: mappedUser },
        });
    } catch (error) {
        next(error);
    }
});

// Delete user (soft delete - chỉ manager)
router.delete('/:id', authenticate, requireManager, async (req: AuthenticatedRequest, res, next) => {
    try {
        const { id } = req.params;

        // Không cho phép xóa chính mình
        if (req.user!.id === id) {
            throw new ApiError('Không thể xóa tài khoản của chính mình', 400);
        }

        const { error } = await supabaseAdmin
            .from('users')
            .update({ status: 'inactive', updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            throw new ApiError('Lỗi khi xóa người dùng', 500);
        }

        res.json({
            status: 'success',
            message: 'Đã vô hiệu hóa người dùng',
        });
    } catch (error) {
        next(error);
    }
});

export { router as usersRouter };
