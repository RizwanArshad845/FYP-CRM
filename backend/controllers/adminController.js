import pool from '../config/db.js';

// Get departmental performance stats (aggregated from live data)
export const getPerformanceStats = async (req, res) => {
    try {
        // 1. Sales Performance
        const salesStats = await pool.query(`
            SELECT 
                u.id, 
                u.first_name || ' ' || u.last_name as name, 
                r.name as role,
                COALESCE(SUM(c.payment_amount), 0) as monthly_revenue,
                COALESCE(SUM(mt.target_amount), 100000) as target_revenue,
                COUNT(c.id) as deals_closed,
                (SELECT COUNT(*) FROM call_recordings WHERE user_id = u.id) as calls_made,
                (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id AND status = 'completed') as tasks_completed,
                (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id AND status != 'completed' AND due_date < CURRENT_DATE) as tasks_missed,
                COALESCE((
                    SELECT ROUND((COUNT(CASE WHEN status IN ('on-time', 'tardy') THEN 1 END)::FLOAT / GREATEST(COUNT(*), 1)::FLOAT) * 100)
                    FROM daily_attendance WHERE user_id = u.id AND date = CURRENT_DATE
                ), 0) as daily_attendance_score,
                COALESCE((
                    SELECT ROUND((COUNT(CASE WHEN status IN ('on-time', 'tardy') THEN 1 END)::FLOAT / GREATEST(COUNT(*), 1)::FLOAT) * 100)
                    FROM daily_attendance WHERE user_id = u.id AND date >= CURRENT_DATE - INTERVAL '7 days'
                ), 0) as weekly_attendance_score,
                COALESCE((
                    SELECT ROUND((COUNT(CASE WHEN status IN ('on-time', 'tardy') THEN 1 END)::FLOAT / GREATEST(COUNT(*), 1)::FLOAT) * 100)
                    FROM daily_attendance WHERE user_id = u.id AND date >= date_trunc('month', CURRENT_DATE)
                ), 0) as monthly_attendance_score
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN clients c ON u.id = c.sales_agent_id
            LEFT JOIN monthly_targets mt ON u.id = mt.user_id AND date_trunc('month', mt.target_month) = date_trunc('month', CURRENT_DATE)
            WHERE r.name IN ('sales', 'sales_manager')
            GROUP BY u.id, u.first_name, u.last_name, r.name
        `);

        // 2. CST Performance
        const cstStats = await pool.query(`
            SELECT 
                u.id, 
                u.first_name || ' ' || u.last_name as name, 
                r.name as role,
                (SELECT COUNT(*) FROM clients WHERE cst_agent_id = u.id) as clients_managed,
                COALESCE((SELECT ROUND(AVG(rating), 1) FROM performance_reviews WHERE user_id = u.id), 0) as satisfaction_score,
                (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id AND status = 'completed') as tasks_completed,
                (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id AND status != 'completed' AND due_date < CURRENT_DATE) as tasks_missed,
                COALESCE((
                    SELECT ROUND((COUNT(CASE WHEN status IN ('on-time', 'tardy') THEN 1 END)::FLOAT / GREATEST(COUNT(*), 1)::FLOAT) * 100)
                    FROM daily_attendance WHERE user_id = u.id AND date = CURRENT_DATE
                ), 0) as daily_attendance_score,
                COALESCE((
                    SELECT ROUND((COUNT(CASE WHEN status IN ('on-time', 'tardy') THEN 1 END)::FLOAT / GREATEST(COUNT(*), 1)::FLOAT) * 100)
                    FROM daily_attendance WHERE user_id = u.id AND date >= CURRENT_DATE - INTERVAL '7 days'
                ), 0) as weekly_attendance_score,
                COALESCE((
                    SELECT ROUND((COUNT(CASE WHEN status IN ('on-time', 'tardy') THEN 1 END)::FLOAT / GREATEST(COUNT(*), 1)::FLOAT) * 100)
                    FROM daily_attendance WHERE user_id = u.id AND date >= date_trunc('month', CURRENT_DATE)
                ), 0) as monthly_attendance_score
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE r.name IN ('cst', 'cst_manager')
            GROUP BY u.id, u.first_name, u.last_name, r.name
        `);

        // 3. Finance Performance
        const financeStats = await pool.query(`
            SELECT 
                u.id, 
                u.first_name || ' ' || u.last_name as name, 
                r.name as role,
                (SELECT COUNT(*) FROM payrolls WHERE processed_by = u.id) as payments_processed,
                (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id AND status = 'completed') as tasks_completed,
                (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id AND status != 'completed' AND due_date < CURRENT_DATE) as tasks_missed,
                COALESCE((
                    SELECT ROUND((COUNT(CASE WHEN status IN ('on-time', 'tardy') THEN 1 END)::FLOAT / GREATEST(COUNT(*), 1)::FLOAT) * 100)
                    FROM daily_attendance WHERE user_id = u.id AND date = CURRENT_DATE
                ), 0) as daily_attendance_score,
                COALESCE((
                    SELECT ROUND((COUNT(CASE WHEN status IN ('on-time', 'tardy') THEN 1 END)::FLOAT / GREATEST(COUNT(*), 1)::FLOAT) * 100)
                    FROM daily_attendance WHERE user_id = u.id AND date >= CURRENT_DATE - INTERVAL '7 days'
                ), 0) as weekly_attendance_score,
                COALESCE((
                    SELECT ROUND((COUNT(CASE WHEN status IN ('on-time', 'tardy') THEN 1 END)::FLOAT / GREATEST(COUNT(*), 1)::FLOAT) * 100)
                    FROM daily_attendance WHERE user_id = u.id AND date >= date_trunc('month', CURRENT_DATE)
                ), 0) as monthly_attendance_score
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE r.name IN ('finance')
            GROUP BY u.id, u.first_name, u.last_name, r.name
        `);

        res.json({
            success: true,
            data: {
                sales: salesStats.rows,
                cst: cstStats.rows,
                finance: financeStats.rows
            }
        });
    } catch (error) {
        console.error('FATAL ERROR in getPerformanceStats:', error);
        res.status(500).json({ success: false, error: `Database error: ${error.message}` });
    }
};

// Get Company metrics for Admin Dashboard
export const getCompanyMetrics = async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                (SELECT COALESCE(SUM(payment_amount), 0) FROM clients WHERE status IN ('active', 'flagged')) as total_revenue,
                (SELECT COUNT(*) FROM clients WHERE status IN ('active', 'flagged')) as active_clients,
                (SELECT COUNT(*) FROM users WHERE status = 'active') as total_employees
        `);
        
        res.json({
            success: true,
            data: {
                ...stats.rows[0],
                revenue_target: 300000,
                client_retention: 89,
                employee_satisfaction: 87
            }
        });
    } catch (error) {
        console.error('Error fetching company metrics:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};

// Get detailed task entries
export const getTaskDetails = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                t.id, 
                u.first_name || ' ' || u.last_name as employee_name, 
                t.title, 
                t.priority, 
                t.status, 
                t.due_date,
                t.category
            FROM tasks t
            JOIN users u ON t.assigned_to = u.id
            ORDER BY t.due_date ASC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching task details:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};
