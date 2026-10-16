import pool from '../config/db.js';
export const getEmployeesWithPayroll = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id,
                u.first_name || ' ' || u.last_name AS name,
                'EMP-' || LPAD(u.id::text, 3, '0') AS employee_id,
                u.email,
                COALESCE(d.name, 'Unassigned') AS department,
                COALESCE(r.name, 'Employee') AS role,
                CASE WHEN u.status = 'active' THEN true ELSE false END AS is_active,
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
            ORDER BY u.first_name ASC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching employees with payroll:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};
export const updateEmployeeSalary = async (req, res) => {
    try {
        const { id } = req.params; // user_id
        const { base_salary, advance_payments, accrued_payments, payment_status } = req.body;

        // Match frontend formula: totalSalary = baseSalary + accruedPayments - advancePayments
        const net_pay = parseFloat(base_salary || 0) + parseFloat(accrued_payments || 0) - parseFloat(advance_payments || 0);

        // Current month pay period
        const now = new Date();
        const pay_period_start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const pay_period_end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        // Check if a payroll record already exists for this user in the current period
        const existing = await pool.query(
            'SELECT id FROM payrolls WHERE user_id = $1 AND pay_period_start = $2',
            [id, pay_period_start]
        );

        let result;
        if (existing.rows.length > 0) {
            // Update existing payroll record
            result = await pool.query(
                `UPDATE payrolls 
                 SET base_salary = $1, 
                     deductions = $2, 
                     bonuses = $3, 
                     net_pay = $4, 
                     status = $5
                 WHERE id = $6 
                 RETURNING *`,
                [base_salary, advance_payments, accrued_payments, net_pay, payment_status, existing.rows[0].id]
            );
        } else {
            // Create new payroll record for this period
            result = await pool.query(
                `INSERT INTO payrolls 
                    (user_id, pay_period_start, pay_period_end, base_salary, deductions, bonuses, net_pay, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
                 RETURNING *`,
                [id, pay_period_start, pay_period_end, base_salary, advance_payments, accrued_payments, net_pay, payment_status]
            );
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating employee salary:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};
export const generateSalarySlip = async (req, res) => {
    try {
        const { id } = req.params; // user_id
        const { month } = req.query; // optional: e.g. '2026-03'

        const params = [id];
        let dateFilter = '';

        if (month) {
            dateFilter = ` AND TO_CHAR(p.pay_period_start, 'YYYY-MM') = $2`;
            params.push(month);
        }

        // Try to find a payroll record first
        let result = await pool.query(`
            SELECT 
                p.id AS payroll_id,
                p.pay_period_start,
                p.pay_period_end,
                p.base_salary,
                p.deductions AS advance_payments,
                p.bonuses AS accrued_payments,
                p.net_pay AS total_salary,
                p.status AS payment_status,
                p.created_at AS processed_at,
                u.first_name || ' ' || u.last_name AS employee_name,
                'EMP-' || LPAD(u.id::text, 3, '0') AS employee_id,
                u.email,
                COALESCE(d.name, 'Unassigned') AS department,
                COALESCE(r.name, 'Employee') AS role
            FROM payrolls p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE p.user_id = $1 ${dateFilter}
            ORDER BY p.pay_period_start DESC 
            LIMIT 1
        `, params);

        // If no payroll record exists, generate a virtual one from the users table (Base Salary only)
        if (result.rows.length === 0) {
            const userResult = await pool.query(`
                SELECT 
                    u.first_name || ' ' || u.last_name AS employee_name,
                    'EMP-' || LPAD(u.id::text, 3, '0') AS employee_id,
                    u.email,
                    COALESCE(d.name, 'Unassigned') AS department,
                    COALESCE(r.name, 'Employee') AS role,
                    COALESCE(u.base_salary, 0) AS base_salary
                FROM users u
                LEFT JOIN departments d ON u.department_id = d.id
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE u.id = $1
            `, [id]);

            if (userResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Employee not found' });
            }

            const u = userResult.rows[0];
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

            return res.json({ 
                success: true, 
                data: {
                    payroll_id: 0,
                    pay_period_start: start,
                    pay_period_end: end,
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
                    role: u.role
                }
            });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error generating salary slip:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};
// ==========================================
// EXPENSES CRUD
// ==========================================

// Get all expenses
export const getExpenses = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM expenses ORDER BY expense_date DESC');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Create a new expense
export const createExpense = async (req, res) => {
    try {
        const { category, amount, expense_date, status } = req.body;
        const result = await pool.query(
            "INSERT INTO expenses (category, amount, expense_date, status) VALUES ($1, $2, $3, $4) RETURNING *",
            [category, amount, expense_date, status || 'pending']
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Update an existing expense
export const updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const { category, amount, expense_date, status } = req.body;
        const result = await pool.query(
            "UPDATE expenses SET category = $1, amount = $2, expense_date = $3, status = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *",
            [category, amount, expense_date, status, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Expense not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Delete an expense
export const deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Expense not found' });
        }
        res.json({ success: true, message: 'Expense deleted successfully' });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};
