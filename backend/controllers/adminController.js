import pool from '../config/db.js';

// Shared per-user SQL fragments (u = users alias). Users are tenant-scoped, so
// subqueries keyed on u.id stay inside the tenant.
const attendanceScore = (dateCondition) => `
    COALESCE((
        SELECT ROUND((COUNT(CASE WHEN status IN ('on-time', 'tardy') THEN 1 END)::FLOAT / GREATEST(COUNT(*), 1)::FLOAT) * 100)
        FROM daily_attendance WHERE user_id = u.id AND ${dateCondition}
    ), 0)`;

const COMMON_COLUMNS = `
    u.id,
    u.first_name || ' ' || u.last_name as name,
    r.name as role,
    (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id AND status = 'completed') as tasks_completed,
    (SELECT COUNT(*) FROM tasks WHERE assigned_to = u.id AND status != 'completed' AND due_date < CURRENT_DATE) as tasks_missed,
    ${attendanceScore('date = CURRENT_DATE')} as daily_attendance_score,
    ${attendanceScore("date >= CURRENT_DATE - INTERVAL '7 days'")} as weekly_attendance_score,
    ${attendanceScore("date >= date_trunc('month', CURRENT_DATE)")} as monthly_attendance_score`;

const statsFor = (extraColumns, roles, tenantId) => pool.query(`
    SELECT ${COMMON_COLUMNS}, ${extraColumns}
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.name = ANY($1::text[]) AND u.tenant_id = $2
`, [roles, tenantId]);

// Departmental performance stats (aggregated from live data)
export const getPerformanceStats = async (req, res) => {
    const tenantId = req.user.tenantId;
    const [salesStats, cstStats, financeStats] = await Promise.all([
        statsFor(`
            (SELECT COALESCE(SUM(payment_amount), 0) FROM clients WHERE sales_agent_id = u.id) as monthly_revenue,
            COALESCE((SELECT SUM(target_amount) FROM monthly_targets
                      WHERE user_id = u.id AND date_trunc('month', target_month) = date_trunc('month', CURRENT_DATE)), 100000) as target_revenue,
            (SELECT COUNT(*) FROM clients WHERE sales_agent_id = u.id) as deals_closed,
            (SELECT COUNT(*) FROM call_recordings WHERE user_id = u.id) as calls_made`,
            ['sales', 'sales_manager'], tenantId),
        statsFor(`
            (SELECT COUNT(*) FROM clients WHERE cst_agent_id = u.id) as clients_managed,
            COALESCE((SELECT ROUND(AVG(rating), 1) FROM performance_reviews WHERE user_id = u.id), 0) as satisfaction_score`,
            ['cst', 'cst_manager'], tenantId),
        statsFor(`
            (SELECT COUNT(*) FROM payrolls WHERE processed_by = u.id) as payments_processed`,
            ['finance'], tenantId),
    ]);

    res.json({
        success: true,
        data: { sales: salesStats.rows, cst: cstStats.rows, finance: financeStats.rows },
    });
};

// Company metrics for the Admin Dashboard
export const getCompanyMetrics = async (req, res) => {
    const stats = await pool.query(`
        SELECT
            (SELECT COALESCE(SUM(payment_amount), 0) FROM clients WHERE status IN ('active', 'flagged') AND tenant_id = $1) as total_revenue,
            (SELECT COUNT(*) FROM clients WHERE status IN ('active', 'flagged') AND tenant_id = $1) as active_clients,
            (SELECT COUNT(*) FROM users WHERE status = 'active' AND tenant_id = $1) as total_employees
    `, [req.user.tenantId]);

    res.json({
        success: true,
        data: {
            ...stats.rows[0],
            // Placeholder figures until these are tracked
            revenue_target: 300000,
            client_retention: 89,
            employee_satisfaction: 87,
        },
    });
};

export const getTaskDetails = async (req, res) => {
    const result = await pool.query(`
        SELECT t.id, u.first_name || ' ' || u.last_name as employee_name,
               t.title, t.priority, t.status, t.due_date, t.category
        FROM tasks t
        JOIN users u ON t.assigned_to = u.id
        WHERE t.tenant_id = $1
        ORDER BY t.due_date ASC
    `, [req.user.tenantId]);
    res.json({ success: true, data: result.rows });
};
