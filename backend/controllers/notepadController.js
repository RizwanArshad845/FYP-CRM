import pool from '../config/db.js';

// Each user has exactly one private notepad; the owner is always the caller.

export const getNotepad = async (req, res) => {
    const result = await pool.query('SELECT content FROM user_notepads WHERE user_id = $1', [req.user.id]);
    res.json({ success: true, data: result.rows[0] || { content: '' } });
};

export const updateNotepad = async (req, res) => {
    const content = typeof req.body.content === 'string' ? req.body.content : '';
    const result = await pool.query(`
        INSERT INTO user_notepads (tenant_id, user_id, content, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id)
        DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP
        RETURNING *
    `, [req.user.tenantId, req.user.id, content]);
    res.json({ success: true, data: result.rows[0] });
};

export const deleteNotepad = async (req, res) => {
    await pool.query('DELETE FROM user_notepads WHERE user_id = $1', [req.user.id]);
    res.json({ success: true, message: 'Notepad cleared successfully' });
};
