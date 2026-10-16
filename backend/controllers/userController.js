import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

// Get all users with their roles and departments
export const getUsers = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id, u.first_name, u.last_name, u.email, u.status, 
                r.name as role, d.name as department,
                COALESCE(u.base_salary, 0) as base_salary,
                u.role_id, u.department_id
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN departments d ON u.department_id = d.id
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, error: `Database error: ${error.message}` });
    }
};

// Get a single user by ID
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};

// Update user status
export const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const result = await pool.query(
            'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, status',
            [status, id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};

// Create a new employee with professional email generation and password hashing
export const createUser = async (req, res) => {
    try {
        const { first_name, last_name, role_id, department_id, password, base_salary } = req.body;

        // 1. Get role name (required for fallback generation)
        const roleResult = await pool.query('SELECT name FROM roles WHERE id = $1', [role_id]);
        if (roleResult.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid role ID' });
        }

        // 2. Determine email to use
        let emailToUse = req.body.email;
        if (!emailToUse) {
            const roleName = roleResult.rows[0].name.toLowerCase().replace(/\s+/g, '_');
            emailToUse = `${first_name.toLowerCase()}_${roleName}@nexuswave.com`;
        }

        // 3. Hash the password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password || 'welcome123', saltRounds);

        // 4. Insert user
        const result = await pool.query(
            'INSERT INTO users (first_name, last_name, email, password_hash, role_id, department_id, status, base_salary) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, first_name, last_name, email',
            [first_name, last_name, emailToUse, passwordHash, role_id, department_id, 'active', base_salary || 0]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ success: false, error: 'Database error or user already exists' });
    }
};

// Update an existing employee's details
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, email, role_id, department_id, password, status, base_salary } = req.body;

        let query, params;

        if (password) {
            const bcrypt = await import('bcryptjs');
            const passwordHash = await bcrypt.default.hash(password, 10);
            query = `UPDATE users SET first_name = $1, last_name = $2, email = $3, role_id = $4, department_id = $5, password_hash = $6, status = $7, base_salary = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $9 RETURNING *`;
            params = [first_name, last_name, email, role_id, department_id, passwordHash, status, base_salary, id];
        } else {
            query = `UPDATE users SET first_name = $1, last_name = $2, email = $3, role_id = $4, department_id = $5, status = $6, base_salary = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $8 RETURNING *`;
            params = [first_name, last_name, email, role_id, department_id, status, base_salary, id];
        }

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};

// Hard delete an employee (purges linked records first)
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Delete ALL dependent records to satisfy foreign key constraints
        // Core HR / attendance / payroll
        await pool.query('DELETE FROM payrolls WHERE user_id = $1', [id]);
        await pool.query('DELETE FROM performance_reviews WHERE user_id = $1 OR reviewer_id = $1', [id]);
        await pool.query('DELETE FROM daily_attendance WHERE user_id = $1', [id]);

        // Tasks
        await pool.query('DELETE FROM tasks WHERE assigned_to = $1 OR assigned_by = $1', [id]);

        // Call recordings
        await pool.query('DELETE FROM call_recordings WHERE user_id = $1', [id]);

        // CST-specific tables (these were the missing ones causing the FK violation)
        await pool.query('DELETE FROM cst_agent_notepads WHERE agent_id = $1', [id]);
        await pool.query('DELETE FROM cst_agent_targets WHERE agent_id = $1', [id]);

        // Client-linked records
        await pool.query('DELETE FROM client_strategies WHERE created_by = $1', [id]);
        await pool.query('DELETE FROM client_notes WHERE created_by = $1', [id]);
        await pool.query('DELETE FROM client_deactivation_requests WHERE reviewed_by = $1', [id]);

        // Events
        await pool.query('DELETE FROM events WHERE created_by_user_id = $1', [id]);

        // Monthly targets
        await pool.query('DELETE FROM monthly_targets WHERE user_id = $1', [id]);

        // 2. Clear FK references in the clients table without deleting the client
        await pool.query('UPDATE clients SET cst_agent_id = NULL WHERE cst_agent_id = $1', [id]);
        await pool.query('UPDATE clients SET sales_agent_id = NULL WHERE sales_agent_id = $1', [id]);

        // 3. Finally delete the user
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, message: 'User and all associated history purged successfully' });
    } catch (error) {
        console.error('Error hard-deleting user:', error);
        res.status(500).json({ success: false, error: `Critical purge failure: ${error.message}` });
    }
};

// Admin overview of all performance reviews
export const getPerformanceReviews = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                p.*, 
                r.first_name as reviewer_first, r.last_name as reviewer_last,
                e.first_name as employee_first, e.last_name as employee_last
            FROM performance_reviews p
            LEFT JOIN users r ON p.reviewer_id = r.id
            LEFT JOIN users e ON p.user_id = e.id
            ORDER BY p.created_at DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching performance reviews:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};

// Get all roles
export const getRoles = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM roles ORDER BY name ASC');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ success: false, error: `Database error: ${error.message}` });
    }
};

// Get all departments
export const getDepartments = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM departments ORDER BY name ASC');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ success: false, error: `Database error: ${error.message}` });
    }
};
