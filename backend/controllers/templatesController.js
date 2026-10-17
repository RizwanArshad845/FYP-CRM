import pool from '../config/db.js';
import { ownerScope } from '../utils/tenant.js';

// Templates are shared in the org; changes are limited by tier: the author
// (Member), anyone in their team (Manager) or anyone (Admin).
const authorClause = (user, nextParam) => ownerScope(user, 'created_by', nextParam);

export const getTemplates = async (req, res) => {
    const result = await pool.query(`
        SELECT t.*, u.first_name || ' ' || u.last_name as created_by_name
        FROM cst_templates t
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.tenant_id = $1
        ORDER BY t.created_at DESC
    `, [req.user.tenantId]);
    res.json({ success: true, data: result.rows });
};

export const createTemplate = async (req, res) => {
    const { title, content, type } = req.body;
    const result = await pool.query(
        'INSERT INTO cst_templates (tenant_id, title, content, type, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [req.user.tenantId, title, content, type || 'email', req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
};

export const updateTemplate = async (req, res) => {
    const { title, content, type } = req.body;
    const own = authorClause(req.user, 6);
    const result = await pool.query(
        `UPDATE cst_templates SET title = COALESCE($1, title), content = COALESCE($2, content), type = COALESCE($3, type),
                updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND tenant_id = $5${own.sql} RETURNING *`,
        [title, content, type, req.params.id, req.user.tenantId, ...own.params]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true, data: result.rows[0] });
};

export const deleteTemplate = async (req, res) => {
    const own = authorClause(req.user, 3);
    const result = await pool.query(
        `DELETE FROM cst_templates WHERE id = $1 AND tenant_id = $2${own.sql} RETURNING id`,
        [req.params.id, req.user.tenantId, ...own.params]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true, message: 'Template deleted' });
};
