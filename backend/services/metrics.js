import pool from '../config/db.js';
import { ownerScope } from '../utils/tenant.js';

// Monthly attendance as % of a 160-hour month, capped at 100.
// `userExpr` / `monthExpr` are trusted SQL fragments (column references), never user input.
export const attendancePctSql = (userExpr, monthExpr) => `
    COALESCE((
        SELECT LEAST(100, ROUND((SUM(EXTRACT(EPOCH FROM (da.clock_out - da.clock_in))/3600) / 160) * 100))
        FROM daily_attendance da
        WHERE da.user_id = ${userExpr}
        AND TO_CHAR(da.date, 'YYYY-MM') = ${monthExpr}
    ), 0)`;

const TARGET_TABLES = {
    // monthly_targets.target_month is a DATE; cst_agent_targets.target_month is 'YYYY-MM'
    sales: { table: 'monthly_targets', agentCol: 'user_id', monthExpr: "TO_CHAR(mt.target_month, 'YYYY-MM')", roles: ['sales', 'sales_manager'] },
    cst: { table: 'cst_agent_targets', agentCol: 'agent_id', monthExpr: 'mt.target_month', roles: ['cst', 'cst_manager'] },
};

// Per-agent, per-month target vs achieved, recordings and attendance.
export const getAgentPerformance = async (tenantId, kind) => {
    const t = TARGET_TABLES[kind];
    const { rows } = await pool.query(`
        SELECT
            mt.id as target_id,
            u.id as agent_id,
            u.first_name,
            u.last_name,
            u.status as user_status,
            mt.target_month,
            mt.target_amount as total_target,
            mt.achieved_amount as total_achieved,
            (
                SELECT COUNT(*)
                FROM call_recordings cr
                WHERE cr.user_id = u.id
                AND TO_CHAR(cr.created_at, 'YYYY-MM') = ${t.monthExpr}
            ) as recording_count,
            ${attendancePctSql('u.id', t.monthExpr)} as attendance_pct
        FROM users u
        JOIN roles r ON u.role_id = r.id
        JOIN ${t.table} mt ON u.id = mt.${t.agentCol}
        WHERE r.name = ANY($2::text[]) AND u.tenant_id = $1 AND mt.tenant_id = $1
        ORDER BY mt.target_month DESC, total_achieved DESC
    `, [tenantId, t.roles]);
    return rows;
};

// Update a target's achieved figure, limited by tier (own / team / org).
// `column` is chosen by the caller from a fixed set, never from the request.
export const updateTargetAchieved = async (user, kind, targetId, achieved, column = 'achieved_amount') => {
    const t = TARGET_TABLES[kind];
    const scope = ownerScope(user, t.agentCol, 4);
    const { rows } = await pool.query(
        `UPDATE ${t.table} SET ${column} = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND tenant_id = $3${scope.sql} RETURNING *`,
        [achieved, targetId, user.tenantId, ...scope.params]
    );
    return rows[0];
};
