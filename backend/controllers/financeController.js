import { z } from 'zod';
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

// 'YYYY-MM' of a date in server time (toISOString would shift it to UTC)
const monthOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// The existing salary formula: net = base + bonus (accrued) - advances (deductions)
const netPay = (base, bonuses, deductions) => Number(base || 0) + Number(bonuses || 0) - Number(deductions || 0);

// Upserts one employee's payroll row for a month, keyed by user and pay period.
const upsertPayroll = async (db, { tenantId, userId, month, base, deductions, bonuses, status, processedBy }) => {
    const net = netPay(base, bonuses, deductions);
    const existing = await db.query(
        "SELECT id FROM payrolls WHERE user_id = $1 AND tenant_id = $2 AND pay_period_start = ($3 || '-01')::date FOR UPDATE",
        [userId, tenantId, month]
    );
    if (existing.rows[0]) {
        const result = await db.query(
            `UPDATE payrolls SET base_salary = $1, deductions = $2, bonuses = $3, net_pay = $4, status = $5,
                    processed_by = $6, updated_at = CURRENT_TIMESTAMP
             WHERE id = $7 RETURNING *`,
            [base, deductions, bonuses, net, status, processedBy, existing.rows[0].id]
        );
        return result.rows[0];
    }
    const result = await db.query(
        `INSERT INTO payrolls (tenant_id, user_id, pay_period_start, pay_period_end, base_salary, deductions, bonuses, net_pay, status, processed_by)
         VALUES ($1, $2, ($3 || '-01')::date, (($3 || '-01')::date + interval '1 month - 1 day')::date, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [tenantId, userId, month, base, deductions, bonuses, net, status, processedBy]
    );
    return result.rows[0];
};

// Upsert the current month's payroll row for an employee
export const updateEmployeeSalary = async (req, res) => {
    const userId = req.params.id;
    const tenantId = req.user.tenantId;
    const { base_salary, advance_payments, accrued_payments, payment_status } = req.body;
    await assertUsersInTenant(tenantId, [userId]);

    const row = await withTransaction((db) => upsertPayroll(db, {
        tenantId, userId, month: monthOf(new Date()), base: base_salary, deductions: advance_payments,
        bonuses: accrued_payments, status: payment_status, processedBy: req.user.id,
    }));
    res.json({ success: true, data: row });
};

export const payrollRunSchema = z.object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM'),
});

/**
 * UC6: pay every active employee for a month in one transaction. Employees without a
 * base salary are skipped and listed; a rerun updates the month's rows, never duplicates.
 * The month's existing bonus and advances are kept.
 */
export const runPayroll = async (req, res) => {
    const { month } = req.body;
    const tenantId = req.user.tenantId;
    const result = await withTransaction(async (db) => {
        const { rows: employees } = await db.query(`
            SELECT u.id, u.first_name || ' ' || u.last_name AS name, u.base_salary,
                   p.deductions, p.bonuses, p.status
            FROM users u
            LEFT JOIN payrolls p ON p.user_id = u.id AND p.tenant_id = u.tenant_id AND p.pay_period_start = ($2 || '-01')::date
            WHERE u.tenant_id = $1 AND u.status = 'active'
            ORDER BY u.first_name, u.id
        `, [tenantId, month]);

        const processed = [];
        const skipped = [];
        for (const e of employees) {
            if (!Number(e.base_salary)) {
                skipped.push({ user_id: e.id, name: e.name, reason: 'No base salary' });
                continue;
            }
            processed.push(await upsertPayroll(db, {
                tenantId, userId: e.id, month, base: e.base_salary, deductions: e.deductions ?? 0,
                bonuses: e.bonuses ?? 0, status: e.status ?? 'pending', processedBy: req.user.id,
            }));
        }
        return { processed, skipped };
    });
    res.json({ success: true, data: result });
};

// Slip rows from payrolls, newest first, optionally for one user and/or one month.
// `filters` is built here from fixed fragments, never from request text.
const slipRows = (tenantId, { userId, month } = {}) => {
    const params = [tenantId];
    let filters = '';
    if (userId != null) { params.push(userId); filters += ` AND p.user_id = $${params.length}`; }
    if (month) { params.push(month); filters += ` AND TO_CHAR(p.pay_period_start, 'YYYY-MM') = $${params.length}`; }
    return pool.query(`
        SELECT
            p.user_id, p.id AS payroll_id, p.pay_period_start, p.pay_period_end, p.base_salary,
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
        WHERE p.tenant_id = $1${filters}
        ORDER BY p.pay_period_start DESC, u.first_name, u.id
    `, params);
};

const isMonth = (m) => typeof m === 'string' && /^\d{4}-\d{2}$/.test(m);

// Every slip of a month, for "Download all slips"
export const getSalarySlips = async (req, res) => {
    if (!isMonth(req.query.month)) return res.status(400).json({ success: false, error: 'month must be YYYY-MM' });
    const { rows } = await slipRows(req.user.tenantId, { month: req.query.month });
    res.json({ success: true, data: rows });
};

export const generateSalarySlip = async (req, res) => {
    const userId = req.params.id;
    const tenantId = req.user.tenantId;
    const result = await slipRows(tenantId, { userId, month: isMonth(req.query.month) ? req.query.month : undefined });
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
