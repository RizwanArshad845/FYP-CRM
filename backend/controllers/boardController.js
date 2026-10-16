import pool from '../config/db.js';

// Get a board state (latest or by ID)
export const getBoard = async (req, res) => {
    try {
        const { id } = req.query;
        let query = `
            SELECT b.*, u.first_name || ' ' || u.last_name as creator_name 
            FROM resource_boards b
            LEFT JOIN users u ON b.created_by = u.id
            ORDER BY b.created_at DESC LIMIT 1`;
        let params = [];

        if (id) {
            query = `
                SELECT b.*, u.first_name || ' ' || u.last_name as creator_name 
                FROM resource_boards b
                LEFT JOIN users u ON b.created_by = u.id
                WHERE b.id = $1`;
            params = [id];
        }

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows[0] || null });
    } catch (error) {
        console.error('Error fetching board:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// List all boards (if multiple exist)
export const listBoards = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.id, b.title, b.created_by, b.created_at, b.updated_at, 
                   u.first_name || ' ' || u.last_name as creator_name
            FROM resource_boards b
            LEFT JOIN users u ON b.created_by = u.id
            ORDER BY b.updated_at DESC`);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error listing boards:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Save board state (Upsert)
export const saveBoard = async (req, res) => {
    try {
        const { id, title, board_state, created_by } = req.body;
        
        let result;
        if (id) {
            result = await pool.query(
                'UPDATE resource_boards SET board_state = $1, title = COALESCE($2, title), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
                [JSON.stringify(board_state), title || null, id]
            );
        } else {
            result = await pool.query(
                'INSERT INTO resource_boards (board_state, created_by, title) VALUES ($1, $2, $3) RETURNING *',
                [JSON.stringify(board_state), created_by || null, title || 'Untitled Board']
            );
        }
        res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error saving board:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Delete a board
export const deleteBoard = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM resource_boards WHERE id = $1', [id]);
        res.json({ success: true, message: 'Board deleted successfully' });
    } catch (error) {
        console.error('Error deleting board:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};
