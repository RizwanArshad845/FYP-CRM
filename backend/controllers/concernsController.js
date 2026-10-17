import pool from '../config/db.js';
import { ownerScope, scopeOf } from '../utils/tenant.js';

// Two concern tables with the same lifecycle: `concerns` (external, assignable)
// and `internal_concerns` (CST internal). Table names come from this fixed map only.
const TABLES = { external: 'concerns', internal: 'internal_concerns' };

// Visibility by tier: Member = concerns they raised, Manager = raised by their
// team, Admin = all. Members may only edit/delete their own (open) concerns.
const loadOwnedConcern = async (table, req, res) => {
    const scope = ownerScope(req.user, 'raised_by', 3);
    const { rows } = await pool.query(
        `SELECT raised_by, status FROM ${table} WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, req.user.tenantId]
    );
    const concern = rows[0];
    if (!concern) {
        res.status(404).json({ success: false, error: 'Concern not found' });
        return null;
    }
    const inScope = await pool.query(
        `SELECT 1 FROM ${table} WHERE id = $1 AND tenant_id = $2${scope.sql}`,
        [req.params.id, req.user.tenantId, ...scope.params]
    );
    if (!inScope.rows[0]) {
        res.status(403).json({ success: false, error: 'Unauthorized to modify this concern' });
        return null;
    }
    return concern;
};

export const concernHandlers = (kind) => {
    const table = TABLES[kind];
    const isInternal = kind === 'internal';

    const list = async (req, res) => {
        const params = [req.user.tenantId];
        let query = isInternal
            ? `SELECT c.*, u_raised.first_name || ' ' || u_raised.last_name as raised_by_name
               FROM internal_concerns c
               LEFT JOIN users u_raised ON c.raised_by = u_raised.id`
            : `SELECT c.*,
                      u_raised.first_name || ' ' || u_raised.last_name as raised_by_name,
                      u_assigned.first_name || ' ' || u_assigned.last_name as assigned_to_name
               FROM concerns c
               LEFT JOIN users u_raised ON c.raised_by = u_raised.id
               LEFT JOIN users u_assigned ON c.assigned_to = u_assigned.id`;
        const scope = ownerScope(req.user, 'c.raised_by', 2);
        query += ` WHERE c.tenant_id = $1${scope.sql}`;
        params.push(...scope.params);
        query += ' ORDER BY c.created_at DESC';

        const result = await pool.query(query, params);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ success: true, data: result.rows });
    };

    const create = async (req, res) => {
        const { concern_type, description, assigned_to } = req.body;
        const tenantId = req.user.tenantId;
        let result;
        if (isInternal) {
            result = await pool.query(
                'INSERT INTO internal_concerns (tenant_id, concern_type, description, raised_by) VALUES ($1, $2, $3, $4) RETURNING *',
                [tenantId, concern_type, description, req.user.id]
            );
        } else {
            if (assigned_to) {
                const ok = await pool.query('SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2', [assigned_to, tenantId]);
                if (!ok.rows[0]) return res.status(400).json({ success: false, error: 'Invalid assignee' });
            }
            result = await pool.query(
                'INSERT INTO concerns (tenant_id, concern_type, description, raised_by, assigned_to) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [tenantId, concern_type, description, req.user.id, assigned_to || null]
            );
        }
        res.status(201).json({ success: true, data: result.rows[0] });
    };

    const update = async (req, res) => {
        if (!(await loadOwnedConcern(table, req, res))) return;
        const { status, assigned_to, concern_type, description } = req.body;
        const tenantId = req.user.tenantId;

        let result;
        if (isInternal) {
            result = await pool.query(
                `UPDATE internal_concerns
                 SET status = COALESCE($1, status), concern_type = COALESCE($2, concern_type),
                     description = COALESCE($3, description), updated_at = CURRENT_TIMESTAMP
                 WHERE id = $4 AND tenant_id = $5 RETURNING *`,
                [status, concern_type, description, req.params.id, tenantId]
            );
        } else {
            if (assigned_to) {
                const ok = await pool.query('SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2', [assigned_to, tenantId]);
                if (!ok.rows[0]) return res.status(400).json({ success: false, error: 'Invalid assignee' });
            }
            result = await pool.query(
                `UPDATE concerns
                 SET status = COALESCE($1, status), assigned_to = COALESCE($2, assigned_to),
                     concern_type = COALESCE($3, concern_type), description = COALESCE($4, description),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $5 AND tenant_id = $6 RETURNING *`,
                [status, assigned_to, concern_type, description, req.params.id, tenantId]
            );
        }
        res.json({ success: true, data: result.rows[0] });
    };

    // Agents may only delete their own concerns while still 'open'
    const remove = async (req, res) => {
        const concern = await loadOwnedConcern(table, req, res);
        if (!concern) return;
        if (scopeOf(req.user) === 'own') {
            const status = (concern.status || 'open').toLowerCase();
            if (status !== 'open') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot delete concern. Current status is '${status}'. Only 'open' concerns can be deleted.`,
                });
            }
        }
        await pool.query(`DELETE FROM ${table} WHERE id = $1 AND tenant_id = $2`, [req.params.id, req.user.tenantId]);
        res.json({ success: true, message: 'Concern deleted' });
    };

    return { list, create, update, remove };
};
