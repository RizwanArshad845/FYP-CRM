import pool from '../config/db.js';

// Resource boards are shared across the organization.

// Get a board state (latest, or by id)
export const getBoard = async (req, res) => {
    const params = [req.user.tenantId];
    let filter = '';
    if (req.query.id) {
        params.push(req.query.id);
        filter = ' AND b.id = $2';
    }
    const result = await pool.query(`
        SELECT b.*, u.first_name || ' ' || u.last_name as creator_name
        FROM resource_boards b
        LEFT JOIN users u ON b.created_by = u.id
        WHERE b.tenant_id = $1${filter}
        ORDER BY b.created_at DESC LIMIT 1
    `, params);
    res.json({ success: true, data: result.rows[0] || null });
};

export const listBoards = async (req, res) => {
    const result = await pool.query(`
        SELECT b.id, b.title, b.created_by, b.created_at, b.updated_at,
               u.first_name || ' ' || u.last_name as creator_name
        FROM resource_boards b
        LEFT JOIN users u ON b.created_by = u.id
        WHERE b.tenant_id = $1
        ORDER BY b.updated_at DESC
    `, [req.user.tenantId]);
    res.json({ success: true, data: result.rows });
};

// Save board state: update by id, or create a new board
export const saveBoard = async (req, res) => {
    const { id, title, board_state } = req.body;
    let result;
    if (id) {
        result = await pool.query(
            `UPDATE resource_boards SET board_state = $1, title = COALESCE($2, title), updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 AND tenant_id = $4 RETURNING *`,
            [JSON.stringify(board_state), title || null, id, req.user.tenantId]
        );
        if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Board not found' });
    } else {
        result = await pool.query(
            'INSERT INTO resource_boards (tenant_id, board_state, created_by, title) VALUES ($1, $2, $3, $4) RETURNING *',
            [req.user.tenantId, JSON.stringify(board_state), req.user.id, title || 'Untitled Board']
        );
    }
    res.json({ success: true, data: result.rows[0] });
};

export const deleteBoard = async (req, res) => {
    const result = await pool.query(
        'DELETE FROM resource_boards WHERE id = $1 AND tenant_id = $2 RETURNING id',
        [req.params.id, req.user.tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Board not found' });
    res.json({ success: true, message: 'Board deleted successfully' });
};
