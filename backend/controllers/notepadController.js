import pool from '../config/db.js';

export const getNotepad = async (req, res) => {
    try {
        const { userId } = req.query; // Role is no longer needed since userId is unique in the users table

        if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });

        const result = await pool.query(`SELECT content FROM user_notepads WHERE user_id = $1`, [userId]);

        if (result.rows.length === 0) {
            return res.json({ success: true, data: { content: '' } });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error fetching notepad:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

export const updateNotepad = async (req, res) => {
    try {
        const { userId, content } = req.body;

        if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });

        const result = await pool.query(`
            INSERT INTO user_notepads (user_id, content, updated_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) 
            DO UPDATE SET content = $2, updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [userId, content]);

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating notepad:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

export const deleteNotepad = async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });

        await pool.query(`DELETE FROM user_notepads WHERE user_id = $1`, [userId]);
        res.json({ success: true, message: 'Notepad cleared successfully' });
    } catch (error) {
        console.error('Error deleting notepad:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};
