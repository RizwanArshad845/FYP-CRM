import { z } from 'zod';
import pool, { withTransaction } from '../config/db.js';
import { assertUserInScope, ownerScope, scopeOf } from '../utils/tenant.js';

// Which tasks a user can see/act on, by tier: Member = ones they gave or received,
// Manager = also any task assigned to their team, Admin = all in the org.
const involvement = (user, nextParam) => {
    const scope = scopeOf(user);
    if (scope === 'org') return { sql: '', params: [] };
    const mine = `t.assigned_to = $${nextParam} OR t.assigned_by = $${nextParam}`;
    if (scope === 'own') return { sql: ` AND (${mine})`, params: [user.id] };
    const team = ownerScope(user, 't.assigned_to', nextParam + 1);
    return { sql: ` AND (${mine} OR (TRUE${team.sql}))`, params: [user.id, ...team.params] };
};

export const getTasks = async (req, res) => {
    const params = [req.user.tenantId];
    let query = `
        SELECT t.*, u.first_name || ' ' || u.last_name as assigned_to_name
        FROM tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.tenant_id = $1
    `;
    const inv = involvement(req.user, 2);
    query += inv.sql;
    params.push(...inv.params);

    const assignedTo = Number(req.query.assigned_to);
    if (Number.isInteger(assignedTo) && assignedTo > 0) {
        params.push(assignedTo);
        query += ` AND t.assigned_to = $${params.length}`;
    }
    query += ' ORDER BY t.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
};

// Delegate a task to someone in the delegator's scope (team for Managers, org for Admins)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'must be a date (YYYY-MM-DD)');
export const createTaskSchema = z.object({
    title: z.string().trim().min(1, 'title is required').max(255),
    description: z.string().max(5000).optional().nullable(),
    assigned_to: z.coerce.number().int().positive().optional().nullable(),
    due_date: z.union([z.literal(''), isoDate]).optional().nullable(),
    priority: z.string().trim().max(20).optional().nullable(),
    category: z.string().trim().max(100).optional().nullable(),
});
export const updateTaskSchema = createTaskSchema.partial();

export const createTask = async (req, res) => {
    const { title, description, assigned_to, due_date, priority, category } = req.body;
    const toId = assigned_to ? Number(assigned_to) : null;
    await assertUserInScope(req.user, toId);

    const result = await pool.query(
        `INSERT INTO tasks (tenant_id, title, description, assigned_to, assigned_by, due_date, status, priority, category)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8) RETURNING *`,
        [req.user.tenantId, title, description, toId, req.user.id, due_date || null, priority || 'medium', category || 'General']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
};

// Assignee or assigner (or admin) updates the status
export const updateTaskStatus = async (req, res) => {
    const inv = involvement(req.user, 4);
    const result = await pool.query(
        `UPDATE tasks t SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE t.id = $2 AND t.tenant_id = $3${inv.sql} RETURNING *`,
        [req.body.status, req.params.id, req.user.tenantId, ...inv.params]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Task not found' });
    res.json({ success: true, data: result.rows[0] });
};

// Assignee submits the task with notes/attachments
export const submitTask = async (req, res) => {
    const { submission_notes, attachment_url } = req.body;
    const tenantId = req.user.tenantId;

    const data = await withTransaction(async (db) => {
        const taskResult = await db.query(
            "UPDATE tasks SET status = 'submitted', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2 AND assigned_to = $3 RETURNING *",
            [req.params.id, tenantId, req.user.id]
        );
        if (!taskResult.rows[0]) return null;
        const submissionResult = await db.query(
            'INSERT INTO task_submissions (tenant_id, task_id, submission_notes, attachment_url) VALUES ($1, $2, $3, $4) RETURNING *',
            [tenantId, taskResult.rows[0].id, submission_notes, attachment_url]
        );
        return { task: taskResult.rows[0], submission: submissionResult.rows[0] };
    });

    if (!data) return res.status(404).json({ success: false, error: 'Task not found' });
    res.status(201).json({ success: true, data });
};

// Only whoever assigned the task (or an Admin-tier user) can edit or delete it
const assignerClause = (user, nextParam) =>
    scopeOf(user) === 'org' ? { sql: '', params: [] } : { sql: ` AND assigned_by = $${nextParam}`, params: [user.id] };

export const updateTask = async (req, res) => {
    const { title, description, priority, category, due_date } = req.body;
    const own = assignerClause(req.user, 9);
    const result = await pool.query(
        // Fields left out keep their value; an empty due date clears it
        `UPDATE tasks SET title = COALESCE($1, title), description = COALESCE($2, description), priority = COALESCE($3, priority),
                category = COALESCE($4, category), due_date = CASE WHEN $8::boolean THEN NULL ELSE COALESCE($5, due_date) END,
                updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 AND tenant_id = $7${own.sql} RETURNING *`,
        [title ?? null, description ?? null, priority ?? null, category ?? null, due_date || null, req.params.id, req.user.tenantId,
            due_date === '', ...own.params]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Task not found' });
    res.json({ success: true, data: result.rows[0] });
};

export const deleteTask = async (req, res) => {
    const own = assignerClause(req.user, 3);
    const deleted = await withTransaction(async (db) => {
        const task = await db.query(
            `SELECT id FROM tasks WHERE id = $1 AND tenant_id = $2${own.sql}`,
            [req.params.id, req.user.tenantId, ...own.params]
        );
        if (!task.rows[0]) return false;
        await db.query('DELETE FROM task_submissions WHERE task_id = $1', [task.rows[0].id]);
        await db.query('DELETE FROM tasks WHERE id = $1', [task.rows[0].id]);
        return true;
    });
    if (!deleted) return res.status(404).json({ success: false, error: 'Task not found' });
    res.json({ success: true, message: 'Task deleted successfully' });
};
