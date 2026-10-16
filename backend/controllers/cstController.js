import pool from '../config/db.js';

// Get all active clients (status = 'active') with assigned agent info
export const getActiveClients = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.id,
                c.company_name,
                c.customer_name,
                c.email,
                c.phone,
                c.status,
                c.payment_amount,
                c.service_area,
                c.created_at,
                c.updated_at,
                COALESCE(sa.first_name || ' ' || sa.last_name, 'Unassigned') AS sales_agent_name,
                COALESCE(ca.first_name || ' ' || ca.last_name, 'Unassigned') AS cst_agent_name
            FROM clients c
            LEFT JOIN users sa ON c.sales_agent_id = sa.id
            LEFT JOIN users ca ON c.cst_agent_id = ca.id
            WHERE c.status = 'active'
            ORDER BY c.updated_at DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching active clients:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Request client deactivation (CST Agent)
export const requestDeactivation = async (req, res) => {
    try {
        const { client_id, reason } = req.body;
        const requested_by = req.user?.id || req.body.requested_by;
        const result = await pool.query(
            'INSERT INTO client_deactivation_requests (client_id, requested_by, reason) VALUES ($1, $2, $3) RETURNING *',
            [client_id, requested_by, reason || 'Requested by agent']
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error requesting deactivation:', error);
        res.status(500).json({ success: false, error: error.message || 'Database error' });
    }
};

// Flag a client with a tag (CST Agent)
export const flagClient = async (req, res) => {
    try {
        const { client_id, tag_id, assigned_by } = req.body;
        const result = await pool.query(
            'INSERT INTO client_tags (client_id, tag_id, assigned_by) VALUES ($1, $2, $3) RETURNING *',
            [client_id, tag_id, assigned_by]
        );
        await pool.query("UPDATE clients SET status = 'flagged' WHERE id = $1", [client_id]);
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error flagging client:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Get all schedules (with user info)
export const getSchedules = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                s.*,
                u.first_name || ' ' || u.last_name AS user_name
            FROM schedules s
            LEFT JOIN users u ON s.user_id = u.id
            ORDER BY s.start_time ASC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Create a new schedule entry
export const createSchedule = async (req, res) => {
    try {
        const { user_id, title, description, start_time, end_time } = req.body;
        const result = await pool.query(
            'INSERT INTO schedules (user_id, title, description, start_time, end_time) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [user_id, title, description || null, start_time, end_time]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error creating schedule:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Update an existing schedule entry
export const updateSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, start_time, end_time } = req.body;
        const result = await pool.query(
            'UPDATE schedules SET title = $1, description = $2, start_time = $3, end_time = $4 WHERE id = $5 RETURNING *',
            [title, description || null, start_time, end_time, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Schedule not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Delete a schedule entry
export const deleteSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM schedules WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Schedule not found' });
        }
        res.json({ success: true, message: 'Schedule deleted successfully' });
    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// --- Client Notes CRUD ---

// Get all notes for a specific client
export const getClientNotes = async (req, res) => {
    try {
        const { clientId } = req.params;
        const result = await pool.query(`
            SELECT 
                n.*,
                u.first_name || ' ' || u.last_name AS creator_name
            FROM client_notes n
            LEFT JOIN users u ON n.created_by = u.id
            WHERE n.client_id = $1
            ORDER BY n.created_at DESC
        `, [clientId]);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching client notes:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Create a new note for a client
export const createClientNote = async (req, res) => {
    try {
        const { client_id, note_text, created_by } = req.body;
        const result = await pool.query(
            'INSERT INTO client_notes (client_id, note_text, created_by) VALUES ($1, $2, $3) RETURNING *',
            [client_id, note_text, created_by]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error creating client note:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Update an existing client note
export const updateClientNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { note_text } = req.body;
        const result = await pool.query(
            'UPDATE client_notes SET note_text = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [note_text, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Note not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating client note:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Delete a client note
export const deleteClientNote = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM client_notes WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Note not found' });
        }
        res.json({ success: true, message: 'Note deleted successfully' });
    } catch (error) {
        console.error('Error deleting client note:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};
