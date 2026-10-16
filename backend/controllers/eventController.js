import pool from '../config/db.js';

// Get all events, ordered by date ascending (closest events first)
export const getEvents = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM events ORDER BY date ASC');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};

// Create a new event
export const createEvent = async (req, res) => {
    try {
        const { title, date, type, created_by_user_id } = req.body;
        const result = await pool.query(
            'INSERT INTO events (title, date, type, created_by_user_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [title, date, type, created_by_user_id || null]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ success: false, error: error.message || 'Database connection error' });
    }
}

// Update an event
export const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, date, type } = req.body;
        const result = await pool.query(
            'UPDATE events SET title = $1, date = $2, type = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [title, date, type, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ success: false, error: error.message || 'Database connection error' });
    }
}

// Delete an event
export const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ success: false, error: error.message || 'Database connection error' });
    }
}
