import pool, { withTransaction } from '../config/db.js';
import { applyFieldVisibility } from '../policy/index.js';
import { assertUsersInTenant, getClientInTenant } from '../utils/tenant.js';
import { getAgentPerformance, updateTargetAchieved } from '../services/metrics.js';

// Assign a CST Agent to an onboarding client
export const assignCstAgent = async (req, res) => {
    const { cst_agent_id } = req.body;
    await assertUsersInTenant(req.user.tenantId, [cst_agent_id]);
    const result = await pool.query(
        "UPDATE clients SET cst_agent_id = $1, status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING *",
        [cst_agent_id, req.params.id, req.user.tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Client not found' });
    res.json({ success: true, data: await applyFieldVisibility(req.user, 'client', result.rows[0]) });
};

export const unassignCstAgent = async (req, res) => {
    const result = await pool.query(
        "UPDATE clients SET cst_agent_id = NULL, status = 'onboarding', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2 RETURNING *",
        [req.params.id, req.user.tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Client not found' });
    res.json({ success: true, data: await applyFieldVisibility(req.user, 'client', result.rows[0]) });
};

// All CST agent targets in the organization
export const getTargets = async (req, res) => {
    const result = await pool.query(`
        SELECT t.id, t.agent_id, u.first_name || ' ' || u.last_name AS agent_name,
               t.target_month AS month, t.target_clients, t.achieved_clients,
               t.target_amount, t.achieved_amount
        FROM cst_agent_targets t
        JOIN users u ON t.agent_id = u.id
        WHERE t.tenant_id = $1
        ORDER BY t.created_at DESC
    `, [req.user.tenantId]);
    // camelCase keys are what the frontend expects for this endpoint
    const data = result.rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        agentName: row.agent_name,
        month: row.month,
        targetClients: row.target_clients,
        targetAmount: row.target_amount,
        achievedAmount: row.achieved_amount,
        achievedClients: row.achieved_clients,
    }));
    res.json({ success: true, data });
};

// Set or update a target for a CST agent for a specific month
export const upsertTarget = async (req, res) => {
    const { agent_id, target_month, target_clients, target_amount } = req.body;
    if (typeof target_month !== 'string' || !/^\d{4}-\d{2}/.test(target_month)) {
        return res.status(400).json({ success: false, error: 'target_month must be YYYY-MM' });
    }
    await assertUsersInTenant(req.user.tenantId, [agent_id]);

    const formattedMonth = target_month.substring(0, 7);
    const amount = target_amount !== undefined ? target_amount : (target_clients || 0);

    const result = await pool.query(`
        INSERT INTO cst_agent_targets (tenant_id, agent_id, target_month, target_clients, target_amount)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (agent_id, target_month)
        DO UPDATE SET
            target_clients = EXCLUDED.target_clients,
            target_amount = EXCLUDED.target_amount,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
    `, [req.user.tenantId, agent_id, formattedMonth, target_clients || amount, amount]);
    res.json({ success: true, data: result.rows[0] });
};

// CST agents update their own achieved figures; managers can update anyone's
export const updateAchieved = async (req, res) => {
    const row = await updateTargetAchieved(req.user, 'cst', req.params.id, req.body.achieved, 'achieved_amount');
    if (!row) return res.status(404).json({ success: false, error: 'Target not found' });
    res.json({ success: true, data: row });
};

export const updateAchievedClients = async (req, res) => {
    const row = await updateTargetAchieved(req.user, 'cst', req.params.id, req.body.achieved, 'achieved_clients');
    if (!row) return res.status(404).json({ success: false, error: 'Target not found' });
    res.json({ success: true, data: row });
};

export const deleteTarget = async (req, res) => {
    const result = await pool.query(
        'DELETE FROM cst_agent_targets WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [req.params.id, req.user.tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Target not found' });
    res.json({ success: true, message: 'Target deleted successfully' });
};

export const updateTarget = async (req, res) => {
    const result = await pool.query(
        'UPDATE cst_agent_targets SET target_amount = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING *',
        [req.body.target_amount, req.params.id, req.user.tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Target not found' });
    res.json({ success: true, data: result.rows[0] });
};

export const getStrategies = async (req, res) => {
    const result = await pool.query(`
        SELECT s.*, c.company_name as client_name
        FROM client_strategies s
        JOIN clients c ON s.client_id = c.id
        WHERE s.tenant_id = $1
        ORDER BY s.created_at DESC
    `, [req.user.tenantId]);
    const data = result.rows.map((row) => ({
        id: row.id,
        clientId: row.client_id,
        clientName: row.client_name,
        strategyText: row.strategy_text,
        createdAt: row.created_at,
    }));
    res.json({ success: true, data });
};

// One strategy per client: update it if present, otherwise create it
export const upsertStrategy = async (req, res) => {
    const { client_id, strategy_text } = req.body;
    const tenantId = req.user.tenantId;
    const client = await getClientInTenant(tenantId, client_id);

    const row = await withTransaction(async (db) => {
        const updated = await db.query(`
            UPDATE client_strategies SET strategy_text = $1, created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE client_id = $2 AND tenant_id = $3 RETURNING *
        `, [strategy_text, client.id, tenantId]);
        if (updated.rows[0]) return updated.rows[0];

        const inserted = await db.query(`
            INSERT INTO client_strategies (tenant_id, client_id, strategy_text, created_by)
            VALUES ($1, $2, $3, $4) RETURNING *
        `, [tenantId, client.id, strategy_text, req.user.id]);
        return inserted.rows[0];
    });
    res.json({ success: true, data: row });
};

export const deleteStrategy = async (req, res) => {
    await pool.query('DELETE FROM client_strategies WHERE client_id = $1 AND tenant_id = $2', [req.params.client_id, req.user.tenantId]);
    res.json({ success: true, message: 'Strategy deleted successfully' });
};

// Approve or reject a deactivation request; approval deactivates the client
export const resolveDeactivation = async (req, res) => {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, error: "status must be 'approved' or 'rejected'" });
    }
    const tenantId = req.user.tenantId;

    const row = await withTransaction(async (db) => {
        const result = await db.query(
            'UPDATE client_deactivation_requests SET status = $1, reviewed_by = $2 WHERE id = $3 AND tenant_id = $4 RETURNING *',
            [status, req.user.id, req.params.id, tenantId]
        );
        const request = result.rows[0];
        if (request && status === 'approved') {
            await db.query(
                "UPDATE clients SET status = 'deactivated', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2",
                [request.client_id, tenantId]
            );
        }
        return request;
    });

    if (!row) return res.status(404).json({ success: false, error: 'Request not found' });
    res.json({ success: true, data: row });
};

export const getAgentPerformanceMetrics = async (req, res) => {
    res.json({ success: true, data: await getAgentPerformance(req.user.tenantId, 'cst') });
};
