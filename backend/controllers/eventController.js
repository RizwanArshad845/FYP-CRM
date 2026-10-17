import pool from '../config/db.js';

// Company calendar events, closest first
export const getEvents = async (req, res) => {
    const result = await pool.query('SELECT * FROM events WHERE tenant_id = $1 ORDER BY date ASC', [req.user.tenantId]);
    res.json({ success: true, data: result.rows });
};

export const createEvent = async (req, res) => {
    const { title, date, type } = req.body;
    const result = await pool.query(
        'INSERT INTO events (tenant_id, title, date, type, created_by_user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [req.user.tenantId, title, date, type, req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
};

export const updateEvent = async (req, res) => {
    const { title, date, type } = req.body;
    const result = await pool.query(
        'UPDATE events SET title = $1, date = $2, type = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND tenant_id = $5 RETURNING *',
        [title, date, type, req.params.id, req.user.tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Event not found' });
    res.json({ success: true, data: result.rows[0] });
};

export const deleteEvent = async (req, res) => {
    const result = await pool.query('DELETE FROM events WHERE id = $1 AND tenant_id = $2 RETURNING id', [req.params.id, req.user.tenantId]);
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Event not found' });
    res.json({ success: true, message: 'Event deleted successfully' });
};
