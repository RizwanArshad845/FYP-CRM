import { z } from 'zod';
import bcrypt from 'bcryptjs';
import pool, { withTransaction } from '../config/db.js';
import { applyFieldVisibility } from '../policy/index.js';
import {
    BCRYPT_ROUNDS, createUserRecord, importEmployees, portalKeyForRoleId, syncPortalAccess,
} from '../services/userService.js';


const optionalId = z.coerce.number().int().positive().nullable().optional()
    .or(z.literal('').transform(() => null));

export const createUserSchema = z.object({
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(255),
    role_id: z.coerce.number().int().positive(),
    // Optional: defaults to the portal's default tier (Admin portal is always Admin)
    tier: z.enum(['Admin', 'Manager', 'Member']).optional().or(z.literal('').transform(() => undefined)),
    department_id: optionalId,
    password: z.string().min(8).max(128).optional().or(z.literal('').transform(() => undefined)),
    base_salary: z.coerce.number().min(0).optional().default(0),
});

export const updateUserSchema = createUserSchema.extend({
    status: z.enum(['active', 'inactive']).optional(),
});

export const statusSchema = z.object({ status: z.enum(['active', 'inactive']) });

// Get all users in the caller's organization
export const getUsers = async (req, res) => {
    const result = await pool.query(`
        SELECT
            u.id, u.first_name, u.last_name, u.email, u.status,
            r.name as role, d.name as department, upa.tier,
            COALESCE(u.base_salary, 0) as base_salary,
            u.role_id, u.department_id
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN user_portal_access upa ON upa.user_id = u.id
        WHERE u.tenant_id = $1
        ORDER BY u.first_name, u.last_name
    `, [req.user.tenantId]);

    // Salaries: only portals the policy lets see the user.compensation group.
    res.json({ success: true, data: await applyFieldVisibility(req.user, 'user', result.rows) });
};

export const getUserById = async (req, res) => {
    const result = await pool.query(`
        SELECT u.id, u.first_name, u.last_name, u.email, u.status, u.role_id, u.department_id,
               u.base_salary, u.created_at, u.updated_at, r.name as role
        FROM users u LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1 AND u.tenant_id = $2
    `, [req.params.id, req.user.tenantId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: await applyFieldVisibility(req.user, 'user', user) });
};

export const updateUserStatus = async (req, res) => {
    if (Number(req.params.id) === req.user.id) {
        return res.status(400).json({ success: false, error: 'You cannot change your own status' });
    }
    const result = await pool.query(
        'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING id, status',
        [req.body.status, req.params.id, req.user.tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: result.rows[0] });
};

// Create an employee. Without a password, a temporary one is generated and returned once.
export const createUser = async (req, res) => {
    const { first_name, last_name, email, role_id, tier, department_id, password, base_salary } = req.body;
    const result = await withTransaction(async (client) => {
        const portalKey = await portalKeyForRoleId(client, role_id);
        return createUserRecord(client, {
            tenantId: req.user.tenantId,
            firstName: first_name,
            lastName: last_name,
            email,
            portalKey,
            tier,
            departmentId: department_id ?? null,
            password,
            baseSalary: base_salary,
            mustChangePassword: true,
        });
    });
    res.status(201).json({ success: true, data: result.user, tempPassword: result.tempPassword });
};

export const updateUser = async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, email, role_id, tier, department_id, password, status, base_salary } = req.body;
    const tenantId = req.user.tenantId;

    const updated = await withTransaction(async (client) => {
        const current = await client.query('SELECT id FROM users WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        if (!current.rows[0]) return null;

        const dupe = await client.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2', [email, id]);
        if (dupe.rows[0]) {
            const err = new Error(`A user with email ${email} already exists`);
            err.status = 409;
            throw err;
        }

        if (department_id != null) {
            const dept = await client.query('SELECT 1 FROM departments WHERE id = $1 AND tenant_id = $2', [department_id, tenantId]);
            if (!dept.rows[0]) {
                const err = new Error('Invalid department');
                err.status = 400;
                throw err;
            }
        }

        const portalKey = await portalKeyForRoleId(client, role_id);
        const access = await syncPortalAccess(client, tenantId, id, portalKey, tier);

        const params = [first_name, last_name, email, role_id, department_id ?? null, status ?? 'active', base_salary, id, tenantId];
        let setPassword = '';
        if (password) {
            params.push(await bcrypt.hash(password, BCRYPT_ROUNDS));
            // An admin-set password is temporary: the employee must replace it.
            setPassword = `, password_hash = $${params.length}, must_change_password = true`;
        }

        const result = await client.query(`
            UPDATE users SET first_name = $1, last_name = $2, email = LOWER($3), role_id = $4, department_id = $5,
                   status = $6, base_salary = $7, updated_at = CURRENT_TIMESTAMP${setPassword}
            WHERE id = $8 AND tenant_id = $9
            RETURNING id, first_name, last_name, email, role_id, department_id, status, base_salary
        `, params);
        return { ...result.rows[0], tier: access.tier };
    });

    if (!updated) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: updated });
};

// Hard delete an employee, purging or detaching every record that references them.
export const deleteUser = async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) {
        return res.status(400).json({ success: false, error: 'You cannot delete your own account' });
    }

    const deleted = await withTransaction(async (client) => {
        const found = await client.query('SELECT id FROM users WHERE id = $1 AND tenant_id = $2', [id, req.user.tenantId]);
        if (!found.rows[0]) return false;

        const statements = [
            // Personal history
            'DELETE FROM payrolls WHERE user_id = $1',
            'UPDATE payrolls SET processed_by = NULL WHERE processed_by = $1',
            'DELETE FROM performance_reviews WHERE user_id = $1 OR reviewer_id = $1',
            'DELETE FROM attendance_breaks WHERE attendance_id IN (SELECT id FROM daily_attendance WHERE user_id = $1)',
            'DELETE FROM daily_attendance WHERE user_id = $1',
            'DELETE FROM schedules WHERE user_id = $1',
            // Tasks they gave or received
            'DELETE FROM task_submissions WHERE task_id IN (SELECT id FROM tasks WHERE assigned_to = $1 OR assigned_by = $1)',
            'DELETE FROM tasks WHERE assigned_to = $1 OR assigned_by = $1',
            // Sales / CST work
            'DELETE FROM call_recordings WHERE user_id = $1',
            'DELETE FROM follow_ups WHERE sales_agent_id = $1',
            'DELETE FROM cst_agent_targets WHERE agent_id = $1',
            'DELETE FROM monthly_targets WHERE user_id = $1',
            'UPDATE monthly_targets SET assigned_by = NULL WHERE assigned_by = $1',
            // Client-linked records: keep the client, detach the person
            'UPDATE client_strategies SET created_by = NULL WHERE created_by::text = $1::text',
            'UPDATE client_notes SET created_by = NULL WHERE created_by = $1',
            'UPDATE client_tags SET assigned_by = NULL WHERE assigned_by = $1',
            'UPDATE client_deactivation_requests SET reviewed_by = NULL WHERE reviewed_by = $1',
            'UPDATE client_deactivation_requests SET requested_by = NULL WHERE requested_by = $1',
            'UPDATE clients SET cst_agent_id = NULL WHERE cst_agent_id = $1',
            'UPDATE clients SET sales_agent_id = NULL WHERE sales_agent_id = $1',
            'UPDATE events SET created_by_user_id = NULL WHERE created_by_user_id = $1',
        ];
        for (const sql of statements) await client.query(sql, [id]);

        // Remaining FKs (notepads, boards, important recordings, portal access, concerns,
        // templates) are ON DELETE CASCADE / SET NULL.
        await client.query('DELETE FROM users WHERE id = $1', [id]);
        return true;
    });

    if (!deleted) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, message: 'User and associated history removed' });
};

export const getPerformanceReviews = async (req, res) => {
    const result = await pool.query(`
        SELECT
            p.*,
            r.first_name as reviewer_first, r.last_name as reviewer_last,
            e.first_name as employee_first, e.last_name as employee_last
        FROM performance_reviews p
        LEFT JOIN users r ON p.reviewer_id = r.id
        LEFT JOIN users e ON p.user_id = e.id
        WHERE p.tenant_id = $1
        ORDER BY p.created_at DESC
    `, [req.user.tenantId]);
    res.json({ success: true, data: result.rows });
};

// Roles are the fixed global catalog, limited to portals this org has enabled.
export const getRoles = async (req, res) => {
    const result = await pool.query(`
        SELECT r.*
        FROM roles r
        JOIN portal_types pt ON pt.key = r.name
        JOIN organization_portals op ON op.portal_type_id = pt.id AND op.tenant_id = $1
        WHERE op.enabled
        ORDER BY pt.sort_order
    `, [req.user.tenantId]);
    res.json({ success: true, data: result.rows });
};

export const getDepartments = async (req, res) => {
    const result = await pool.query('SELECT * FROM departments WHERE tenant_id = $1 ORDER BY name ASC', [req.user.tenantId]);
    res.json({ success: true, data: result.rows });
};

// Add employees by form rows or CSV after onboarding; same rules as the wizard step.
export const importUsers = async (req, res) => {
    const { created, rowErrors } = await importEmployees(req.user.tenantId, req.body.employees);
    if (!created.length) {
        return res.status(400).json({ success: false, error: 'No valid rows; nothing was created', rowErrors });
    }
    res.status(201).json({ success: true, data: { created, rowErrors } });
};
