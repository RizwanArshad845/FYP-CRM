import pool from '../config/db.js';
import { assertUserInScope, getClientInTenant, isManager, ownerScope } from '../utils/tenant.js';
import { updateTargetAchieved } from '../services/metrics.js';

// Optional client reference: must belong to the tenant when given.
const optionalClientId = async (tenantId, clientId) => {
    if (clientId == null || clientId === '') return null;
    return (await getClientInTenant(tenantId, clientId)).id;
};

// The acting agent: Manager/Admin tier may act for someone in their scope; Members only for themselves.
const actingAgentId = async (user, requestedId) => {
    if (isManager(user) && requestedId) {
        await assertUserInScope(user, requestedId);
        return Number(requestedId);
    }
    return user.id;
};

// --- Important Call Recordings (always owner-only for writes) ---

export const getImportantRecordings = async (req, res) => {
    const result = await pool.query(`
        SELECT r.*, c.company_name, u.first_name || ' ' || u.last_name as agent_name
        FROM important_call_recordings r
        LEFT JOIN clients c ON r.client_id = c.id
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.tenant_id = $1
        ORDER BY r.created_at DESC
    `, [req.user.tenantId]);
    res.json({ success: true, data: result.rows });
};

export const addImportantRecording = async (req, res) => {
    const { client_id, recording_url, outcome, quality_rating } = req.body;
    const clientId = await optionalClientId(req.user.tenantId, client_id);
    const result = await pool.query(
        `INSERT INTO important_call_recordings (tenant_id, user_id, client_id, recording_url, outcome, quality_rating)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [req.user.tenantId, req.user.id, clientId, recording_url, outcome || 'pending', quality_rating || 0]
    );
    res.json({ success: true, data: result.rows[0] });
};

export const updateImportantRecording = async (req, res) => {
    const { client_id, recording_url, outcome, quality_rating } = req.body;
    const clientId = await optionalClientId(req.user.tenantId, client_id);
    const result = await pool.query(
        `UPDATE important_call_recordings
         SET client_id = COALESCE($1, client_id),
             recording_url = COALESCE($2, recording_url),
             outcome = COALESCE($3, outcome),
             quality_rating = COALESCE($4, quality_rating),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 AND user_id = $6 AND tenant_id = $7
         RETURNING *`,
        [clientId, recording_url, outcome, quality_rating, req.params.id, req.user.id, req.user.tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Recording not found' });
    res.json({ success: true, data: result.rows[0] });
};

export const deleteImportantRecording = async (req, res) => {
    const result = await pool.query(
        'DELETE FROM important_call_recordings WHERE id = $1 AND user_id = $2 AND tenant_id = $3 RETURNING id',
        [req.params.id, req.user.id, req.user.tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Recording not found' });
    res.json({ success: true, message: 'Recording deleted successfully' });
};

// Sales agent updates achievement against their own monthly target
export const updateAchieved = async (req, res) => {
    const row = await updateTargetAchieved(req.user, 'sales', req.params.id, req.body.achieved_amount);
    if (!row) return res.status(404).json({ success: false, error: 'Target not found' });
    res.json({ success: true, data: row });
};

// --- Follow-ups: scoped by tier (own / team / org) ---

export const getFollowUps = async (req, res) => {
    const scope = ownerScope(req.user, 'f.sales_agent_id', 2);
    const params = [req.user.tenantId, ...scope.params];
    const filter = scope.sql;
    const result = await pool.query(`
        SELECT
            f.*,
            COALESCE(c.company_name, f.client_name_text) as client_name,
            COALESCE(f.contact_no, c.contact_no_1) as contact_no,
            u.first_name || ' ' || u.last_name as agent_name
        FROM follow_ups f
        LEFT JOIN clients c ON f.client_id = c.id
        LEFT JOIN users u ON f.sales_agent_id = u.id
        WHERE f.tenant_id = $1${filter}
        ORDER BY f.due_date ASC
    `, params);
    res.json({ success: true, data: result.rows });
};

export const createFollowUp = async (req, res) => {
    const {
        user_id, client_id, due_date, notes, status, closer_name, client_name_text,
        contact_time, follow_up_number, product, area, contact_no,
    } = req.body;
    const tenantId = req.user.tenantId;
    const agentId = await actingAgentId(req.user, user_id);
    const clientId = await optionalClientId(tenantId, client_id);

    const result = await pool.query(
        `INSERT INTO follow_ups (tenant_id, sales_agent_id, client_id, due_date, notes, status, closer_name, client_name_text,
                                 contact_time, follow_up_number, product, area, contact_no)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
        [tenantId, agentId, clientId, due_date, notes, status || 'pending', closer_name || null, client_name_text || null,
            contact_time || null, follow_up_number || null, product || null, area || null, contact_no || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
};

export const updateFollowUp = async (req, res) => {
    const {
        status, due_date, notes, client_id, sales_agent_id, closer_name, client_name_text,
        contact_time, follow_up_number, product, area, contact_no,
    } = req.body;
    const tenantId = req.user.tenantId;
    const clientId = await optionalClientId(tenantId, client_id);
    // Only Manager/Admin tier may move a follow-up to a different agent (within their scope).
    let agentId = null;
    if (sales_agent_id && isManager(req.user)) {
        await assertUserInScope(req.user, sales_agent_id);
        agentId = sales_agent_id;
    }
    const own = ownerScope(req.user, 'sales_agent_id', 15);

    const result = await pool.query(
        `UPDATE follow_ups
         SET status = COALESCE($1, status),
             due_date = COALESCE($2, due_date),
             notes = COALESCE($3, notes),
             client_id = COALESCE($4, client_id),
             sales_agent_id = COALESCE($5, sales_agent_id),
             closer_name = COALESCE($6, closer_name),
             client_name_text = COALESCE($7, client_name_text),
             contact_time = COALESCE($8, contact_time),
             follow_up_number = COALESCE($9, follow_up_number),
             product = COALESCE($10, product),
             area = COALESCE($11, area),
             contact_no = COALESCE($12, contact_no),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $13 AND tenant_id = $14${own.sql} RETURNING *`,
        [status, due_date, notes, clientId, agentId, closer_name, client_name_text, contact_time,
            follow_up_number, product, area, contact_no, req.params.id, tenantId, ...own.params]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Follow up not found' });
    res.json({ success: true, data: result.rows[0] });
};

export const deleteFollowUp = async (req, res) => {
    const own = ownerScope(req.user, 'sales_agent_id', 3);
    const result = await pool.query(
        `DELETE FROM follow_ups WHERE id = $1 AND tenant_id = $2${own.sql} RETURNING id`,
        [req.params.id, req.user.tenantId, ...own.params]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Follow up not found' });
    res.json({ success: true, message: 'Follow up deleted successfully' });
};

// --- Call recordings ---

export const getRecordings = async (req, res) => {
    const result = await pool.query(`
        SELECT r.*, u.first_name || ' ' || u.last_name AS agent_name, c.company_name AS client_name
        FROM call_recordings r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN clients c ON r.client_id = c.id
        WHERE r.tenant_id = $1
        ORDER BY r.created_at DESC
    `, [req.user.tenantId]);
    res.json({ success: true, data: result.rows });
};

export const uploadRecording = async (req, res) => {
    const { user_id, client_id, recording_url, duration_seconds, transcript, outcome, quality_rating } = req.body;
    const tenantId = req.user.tenantId;
    const agentId = await actingAgentId(req.user, user_id);
    const clientId = await optionalClientId(tenantId, client_id);
    const result = await pool.query(
        `INSERT INTO call_recordings (tenant_id, user_id, client_id, recording_url, duration_seconds, transcript, outcome, quality_rating)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [tenantId, agentId, clientId, recording_url, duration_seconds || 0, transcript || '', outcome || 'pending', quality_rating || 0]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
};

export const updateRecording = async (req, res) => {
    const { client_id, recording_url, outcome, quality_rating } = req.body;
    const clientId = await optionalClientId(req.user.tenantId, client_id);
    const own = ownerScope(req.user, 'user_id', 7);
    const result = await pool.query(
        `UPDATE call_recordings
         SET client_id = COALESCE($1, client_id),
             recording_url = COALESCE($2, recording_url),
             outcome = COALESCE($3, outcome),
             quality_rating = COALESCE($4, quality_rating),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 AND tenant_id = $6${own.sql} RETURNING *`,
        [clientId, recording_url, outcome, quality_rating, req.params.id, req.user.tenantId, ...own.params]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Recording not found' });
    res.json({ success: true, data: result.rows[0] });
};

export const deleteRecording = async (req, res) => {
    const own = ownerScope(req.user, 'user_id', 3);
    const result = await pool.query(
        `DELETE FROM call_recordings WHERE id = $1 AND tenant_id = $2${own.sql} RETURNING id`,
        [req.params.id, req.user.tenantId, ...own.params]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Recording not found' });
    res.json({ success: true, message: 'Recording deleted successfully' });
};

// Monthly review stats for the sales dashboard (org-wide)
export const getMonthlyReview = async (req, res) => {
    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = /^\d{2}$/.test(month || '') ? month : String(now.getMonth() + 1).padStart(2, '0');
    const targetYear = /^\d{4}$/.test(year || '') ? year : String(now.getFullYear());
    const ym = `${targetYear}-${targetMonth}`;
    const tenantId = req.user.tenantId;

    const [targetsRes, attRes, perfRes, servicesRes, areasRes] = await Promise.all([
        pool.query(
            `SELECT SUM(achieved_amount) as total_achieved FROM monthly_targets
             WHERE TO_CHAR(target_month, 'YYYY-MM') = $1 AND tenant_id = $2`,
            [ym, tenantId]
        ),
        // Team attendance: total hours vs 160h per active agent
        pool.query(
            `SELECT COUNT(DISTINCT user_id) as active_agents,
                    SUM(EXTRACT(EPOCH FROM (clock_out - clock_in))/3600) as total_hours
             FROM daily_attendance WHERE TO_CHAR(date, 'YYYY-MM') = $1 AND tenant_id = $2`,
            [ym, tenantId]
        ),
        pool.query(
            `SELECT AVG(CASE WHEN target_amount > 0 THEN (achieved_amount / target_amount) * 100 ELSE 0 END) as avg_perf
             FROM monthly_targets WHERE TO_CHAR(target_month, 'YYYY-MM') = $1 AND tenant_id = $2`,
            [ym, tenantId]
        ),
        pool.query(
            `SELECT client_services, COUNT(*) as count FROM clients
             WHERE TO_CHAR(created_at, 'YYYY-MM') = $1 AND tenant_id = $2
               AND client_services IS NOT NULL AND client_services != ''
             GROUP BY client_services ORDER BY count DESC`,
            [ym, tenantId]
        ),
        pool.query(
            `SELECT service_area, COUNT(*) as count FROM clients
             WHERE TO_CHAR(created_at, 'YYYY-MM') = $1 AND tenant_id = $2
               AND service_area IS NOT NULL AND service_area != ''
             GROUP BY service_area ORDER BY count DESC`,
            [ym, tenantId]
        ),
    ]);

    const activeAgents = parseInt(attRes.rows[0].active_agents) || 1;
    const totalHours = parseFloat(attRes.rows[0].total_hours) || 0;

    res.json({
        success: true,
        data: {
            totalAchieved: targetsRes.rows[0].total_achieved || 0,
            attendancePct: Math.min(100, Math.round((totalHours / (activeAgents * 160)) * 100)) || 0,
            performancePct: Math.round(parseFloat(perfRes.rows[0].avg_perf) || 0),
            servicesSold: servicesRes.rows,
            areasSold: areasRes.rows,
        },
    });
};
