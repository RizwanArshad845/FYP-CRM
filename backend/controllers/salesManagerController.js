import pool from '../config/db.js';
import { assertUsersInTenant } from '../utils/tenant.js';
import { getAgentPerformance, updateTargetAchieved } from '../services/metrics.js';

// Get monthly sales targets across agents in the organization
export const getTargets = async (req, res) => {
    const result = await pool.query(`
        SELECT mt.*, (u.first_name || ' ' || u.last_name) AS agent_name
        FROM monthly_targets mt
        JOIN users u ON mt.user_id = u.id
        WHERE mt.tenant_id = $1
        ORDER BY mt.target_month DESC
    `, [req.user.tenantId]);
    res.json({ success: true, data: result.rows });
};

// Manager assigns a target to an agent
export const createTarget = async (req, res) => {
    const { user_id, target_month, target_amount } = req.body;
    await assertUsersInTenant(req.user.tenantId, [user_id]);
    const result = await pool.query(
        `INSERT INTO monthly_targets (tenant_id, user_id, assigned_by, target_month, target_amount, achieved_amount)
         VALUES ($1, $2, $3, $4, $5, 0) RETURNING *`,
        [req.user.tenantId, user_id, req.user.id, target_month, target_amount]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
};

// Manager updates an existing target
export const updateTarget = async (req, res) => {
    const { target_month, target_amount, user_id, achieved_amount } = req.body;
    await assertUsersInTenant(req.user.tenantId, [user_id]);

    // Fields left out keep their value
    const result = await pool.query(`
        UPDATE monthly_targets SET
            target_month = COALESCE($1, target_month), target_amount = COALESCE($2, target_amount),
            user_id = COALESCE($3, user_id),
            achieved_amount = COALESCE($4, achieved_amount),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5 AND tenant_id = $6 RETURNING *
    `, [target_month || null, target_amount ?? null, user_id || null, achieved_amount ?? null, req.params.id, req.user.tenantId]);

    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Target not found' });
    res.json({ success: true, data: result.rows[0] });
};

export const getAgentPerformanceMetrics = async (req, res) => {
    res.json({ success: true, data: await getAgentPerformance(req.user.tenantId, 'sales') });
};

// Sales agent updates their own achievement; managers can update anyone's
export const updateTargetAchievement = async (req, res) => {
    const row = await updateTargetAchieved(req.user, 'sales', req.params.id, req.body.achieved);
    if (!row) return res.status(404).json({ success: false, error: 'Target not found' });
    res.json({ success: true, data: row });
};

export const deleteTarget = async (req, res) => {
    const result = await pool.query(
        'DELETE FROM monthly_targets WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [req.params.id, req.user.tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Target not found' });
    res.json({ success: true, message: 'Target deleted successfully' });
};
