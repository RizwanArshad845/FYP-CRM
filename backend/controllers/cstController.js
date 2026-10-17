import pool, { withTransaction } from '../config/db.js';
import { applyFieldVisibility } from '../policy/index.js';
import {
    assertClientAccess, assertUserInScope, getClientInTenant, httpError, isManager, ownerScope,
} from '../utils/tenant.js';

// Get all active clients in the organization with assigned agent info
export const getActiveClients = async (req, res) => {
    const result = await pool.query(`
        SELECT
            c.id, c.company_name, c.customer_name, c.email, c.phone, c.status,
            c.payment_amount, c.service_area, c.created_at, c.updated_at,
            COALESCE(sa.first_name || ' ' || sa.last_name, 'Unassigned') AS sales_agent_name,
            COALESCE(ca.first_name || ' ' || ca.last_name, 'Unassigned') AS cst_agent_name
        FROM clients c
        LEFT JOIN users sa ON c.sales_agent_id = sa.id
        LEFT JOIN users ca ON c.cst_agent_id = ca.id
        WHERE c.status = 'active' AND c.tenant_id = $1
        ORDER BY c.updated_at DESC
    `, [req.user.tenantId]);
    res.json({ success: true, data: await applyFieldVisibility(req.user, 'client', result.rows) });
};

// Request client deactivation (CST Agent)
export const requestDeactivation = async (req, res) => {
    const { client_id, reason } = req.body;
    const client = await getClientInTenant(req.user.tenantId, client_id);
    assertClientAccess(req.user, client);

    const result = await pool.query(
        'INSERT INTO client_deactivation_requests (tenant_id, client_id, requested_by, reason) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.user.tenantId, client.id, req.user.id, reason || 'Requested by agent']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
};

// Flag a client with a tag (CST Agent)
export const flagClient = async (req, res) => {
    const { client_id, tag_id } = req.body;
    const tenantId = req.user.tenantId;
    const client = await getClientInTenant(tenantId, client_id);
    assertClientAccess(req.user, client);

    const tag = await pool.query('SELECT 1 FROM tags WHERE id = $1 AND tenant_id = $2', [tag_id, tenantId]);
    if (!tag.rows[0]) throw httpError(400, 'Invalid tag');

    const row = await withTransaction(async (db) => {
        const result = await db.query(
            'INSERT INTO client_tags (tenant_id, client_id, tag_id, assigned_by) VALUES ($1, $2, $3, $4) RETURNING *',
            [tenantId, client.id, tag_id, req.user.id]
        );
        await db.query("UPDATE clients SET status = 'flagged', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2", [client.id, tenantId]);
        return result.rows[0];
    });
    res.status(201).json({ success: true, data: row });
};

// --- Schedules ---

export const getSchedules = async (req, res) => {
    const result = await pool.query(`
        SELECT s.*, u.first_name || ' ' || u.last_name AS user_name
        FROM schedules s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.tenant_id = $1
        ORDER BY s.start_time ASC
    `, [req.user.tenantId]);
    res.json({ success: true, data: result.rows });
};

// Members schedule for themselves; Manager/Admin tier may schedule for anyone in their scope.
export const createSchedule = async (req, res) => {
    const { title, description, start_time, end_time } = req.body;
    let userId = req.user.id;
    if (isManager(req.user) && req.body.user_id) {
        await assertUserInScope(req.user, req.body.user_id);
        userId = req.body.user_id;
    }
    const result = await pool.query(
        'INSERT INTO schedules (tenant_id, user_id, title, description, start_time, end_time) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [req.user.tenantId, userId, title, description || null, start_time, end_time]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
};

// Schedules and notes can be changed by their owner, or within a Manager/Admin's scope.
export const updateSchedule = async (req, res) => {
    const { title, description, start_time, end_time } = req.body;
    const own = ownerScope(req.user, 'user_id', 7);
    const result = await pool.query(
        `UPDATE schedules SET title = $1, description = $2, start_time = $3, end_time = $4
         WHERE id = $5 AND tenant_id = $6${own.sql} RETURNING *`,
        [title, description || null, start_time, end_time, req.params.id, req.user.tenantId, ...own.params]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Schedule not found' });
    res.json({ success: true, data: result.rows[0] });
};

export const deleteSchedule = async (req, res) => {
    const own = ownerScope(req.user, 'user_id', 3);
    const result = await pool.query(
        `DELETE FROM schedules WHERE id = $1 AND tenant_id = $2${own.sql} RETURNING id`,
        [req.params.id, req.user.tenantId, ...own.params]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Schedule not found' });
    res.json({ success: true, message: 'Schedule deleted successfully' });
};

// --- Client Notes ---

export const getClientNotes = async (req, res) => {
    const client = await getClientInTenant(req.user.tenantId, req.params.clientId);
    assertClientAccess(req.user, client);
    const result = await pool.query(`
        SELECT n.*, u.first_name || ' ' || u.last_name AS creator_name
        FROM client_notes n
        LEFT JOIN users u ON n.created_by = u.id
        WHERE n.client_id = $1 AND n.tenant_id = $2
        ORDER BY n.created_at DESC
    `, [client.id, req.user.tenantId]);
    res.json({ success: true, data: result.rows });
};

export const createClientNote = async (req, res) => {
    const { client_id, note_text } = req.body;
    const client = await getClientInTenant(req.user.tenantId, client_id);
    assertClientAccess(req.user, client);
    const result = await pool.query(
        'INSERT INTO client_notes (tenant_id, client_id, note_text, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.user.tenantId, client.id, note_text, req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
};

export const updateClientNote = async (req, res) => {
    const own = ownerScope(req.user, 'created_by', 4);
    const result = await pool.query(
        `UPDATE client_notes SET note_text = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND tenant_id = $3${own.sql} RETURNING *`,
        [req.body.note_text, req.params.id, req.user.tenantId, ...own.params]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Note not found' });
    res.json({ success: true, data: result.rows[0] });
};

export const deleteClientNote = async (req, res) => {
    const own = ownerScope(req.user, 'created_by', 3);
    const result = await pool.query(
        `DELETE FROM client_notes WHERE id = $1 AND tenant_id = $2${own.sql} RETURNING id`,
        [req.params.id, req.user.tenantId, ...own.params]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Note not found' });
    res.json({ success: true, message: 'Note deleted successfully' });
};
