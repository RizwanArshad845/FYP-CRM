import pool, { withTransaction } from '../config/db.js';
import { assertUsersInTenant } from '../utils/tenant.js';

export const getEmployeesWithPayroll = async (req, res) => {
    const result = await pool.query(`
        SELECT
            u.id,
            u.first_name || ' ' || u.last_name AS name,
            'EMP-' || LPAD(u.id::text, 3, '0') AS employee_id,
            u.email,
            COALESCE(d.name, 'Unassigned') AS department,
            COALESCE(r.name, 'Employee') AS role,
            (u.status = 'active') AS is_active,
            COALESCE(u.base_salary, 0) AS base_salary,
            COALESCE(p.deductions, 0) AS advance_payments,
            COALESCE(p.bonuses, 0) AS accrued_payments,
            COALESCE(p.net_pay, 0) AS total_salary,
            COALESCE(p.status, 'pending') AS payment_status,
            u.created_at AS hire_date
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN LATERAL (
            SELECT * FROM payrolls
            WHERE user_id = u.id
            ORDER BY pay_period_start DESC
            LIMIT 1
        ) p ON true
        WHERE u.tenant_id = $1
        ORDER BY u.first_name ASC
    `, [req.user.tenantId]);
    res.json({ success: true, data: result.rows });
};

// Upsert the current month's payroll row for an employee
export const updateEmployeeSalary = async (req, res) => {
    const userId = req.params.id;
    const tenantId = req.user.tenantId;
    const { base_salary, advance_payments, accrued_payments, payment_status } = req.body;
    await assertUsersInTenant(tenantId, [userId]);

    // Same formula as the frontend: total = base + accrued - advance
    const net_pay = parseFloat(base_salary || 0) + parseFloat(accrued_payments || 0) - parseFloat(advance_payments || 0);
    const now = new Date();
    const pay_period_start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const pay_period_end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const row = await withTransaction(async (db) => {
        const existing = await db.query(
            'SELECT id FROM payrolls WHERE user_id = $1 AND pay_period_start = $2 AND tenant_id = $3 FOR UPDATE',
            [userId, pay_period_start, tenantId]
        );
        if (existing.rows[0]) {
            const result = await db.query(
                `UPDATE payrolls SET base_salary = $1, deductions = $2, bonuses = $3, net_pay = $4, status = $5,
                        processed_by = $6, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $7 RETURNING *`,
                [base_salary, advance_payments, accrued_payments, net_pay, payment_status, req.user.id, existing.rows[0].id]
            );
            return result.rows[0];
        }
        const result = await db.query(
            `INSERT INTO payrolls (tenant_id, user_id, pay_period_start, pay_period_end, base_salary, deductions, bonuses, net_pay, status, processed_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [tenantId, userId, pay_period_start, pay_period_end, base_salary, advance_payments, accrued_payments, net_pay, payment_status, req.user.id]
        );
        return result.rows[0];
    });
    res.json({ success: true, data: row });
};

export const generateSalarySlip = async (req, res) => {
    const userId = req.params.id;
    const tenantId = req.user.tenantId;
    const params = [userId, tenantId];
    let dateFilter = '';
    if (typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)) {
        params.push(req.query.month);
        dateFilter = " AND TO_CHAR(p.pay_period_start, 'YYYY-MM') = $3";
    }

    const result = await pool.query(`
        SELECT
            p.id AS payroll_id, p.pay_period_start, p.pay_period_end, p.base_salary,
            p.deductions AS advance_payments, p.bonuses AS accrued_payments,
            p.net_pay AS total_salary, p.status AS payment_status, p.created_at AS processed_at,
            u.first_name || ' ' || u.last_name AS employee_name,
            'EMP-' || LPAD(u.id::text, 3, '0') AS employee_id,
            u.email,
            COALESCE(d.name, 'Unassigned') AS department,
            COALESCE(r.name, 'Employee') AS role
        FROM payrolls p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE p.user_id = $1 AND p.tenant_id = $2${dateFilter}
        ORDER BY p.pay_period_start DESC
        LIMIT 1
    `, params);
    if (result.rows[0]) return res.json({ success: true, data: result.rows[0] });

    // No payroll yet: build a virtual slip from the base salary
    const userResult = await pool.query(`
        SELECT u.first_name || ' ' || u.last_name AS employee_name,
               'EMP-' || LPAD(u.id::text, 3, '0') AS employee_id,
               u.email,
               COALESCE(d.name, 'Unassigned') AS department,
               COALESCE(r.name, 'Employee') AS role,
               COALESCE(u.base_salary, 0) AS base_salary
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1 AND u.tenant_id = $2
    `, [userId, tenantId]);
    const u = userResult.rows[0];
    if (!u) return res.status(404).json({ success: false, error: 'Employee not found' });

    const now = new Date();
    res.json({
        success: true,
        data: {
            payroll_id: 0,
            pay_period_start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
            pay_period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
            base_salary: u.base_salary,
            advance_payments: 0,
            accrued_payments: 0,
            total_salary: u.base_salary,
            payment_status: 'pending',
            processed_at: now.toISOString(),
            employee_name: u.employee_name,
            employee_id: u.employee_id,
            email: u.email,
            department: u.department,
            role: u.role,
        },
    });
};

// --- Expenses ---

export const getExpenses = async (req, res) => {
    const result = await pool.query('SELECT * FROM expenses WHERE tenant_id = $1 ORDER BY expense_date DESC', [req.user.tenantId]);
    res.json({ success: true, data: result.rows });
};

export const createExpense = async (req, res) => {
    const { category, amount, expense_date, status } = req.body;
    const result = await pool.query(
        'INSERT INTO expenses (tenant_id, category, amount, expense_date, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [req.user.tenantId, category, amount, expense_date, status || 'pending']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
};

export const updateExpense = async (req, res) => {
    const { category, amount, expense_date, status } = req.body;
    const result = await pool.query(
        `UPDATE expenses SET category = $1, amount = $2, expense_date = $3, status = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 AND tenant_id = $6 RETURNING *`,
        [category, amount, expense_date, status, req.params.id, req.user.tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Expense not found' });
    res.json({ success: true, data: result.rows[0] });
};

export const deleteExpense = async (req, res) => {
    const result = await pool.query('DELETE FROM expenses WHERE id = $1 AND tenant_id = $2 RETURNING id', [req.params.id, req.user.tenantId]);
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Expense not found' });
    res.json({ success: true, message: 'Expense deleted successfully' });
};
