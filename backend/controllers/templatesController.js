import pool from '../config/db.js';

// Get templates
export const getTemplates = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, u.first_name || ' ' || u.last_name as created_by_name
            FROM cst_templates t
            LEFT JOIN users u ON t.created_by = u.id
            ORDER BY t.created_at DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Create template
export const createTemplate = async (req, res) => {
    try {
        const { title, content, type, created_by } = req.body;
        const result = await pool.query(
            'INSERT INTO cst_templates (title, content, type, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
            [title, content, type || 'email', created_by || null]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Update template
export const updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, type } = req.body;
        const result = await pool.query(
            'UPDATE cst_templates SET title = COALESCE($1, title), content = COALESCE($2, content), type = COALESCE($3, type), updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [title, content, type, id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Delete template
export const deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM cst_templates WHERE id = $1', [id]);
        res.json({ success: true, message: 'Template deleted' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};
