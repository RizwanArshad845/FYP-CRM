import pool from '../config/db.js';

// Get tasks, optionally filtered by assigned_to
export const getTasks = async (req, res) => {
    try {
        const { assigned_to } = req.query;
        let query = `
            SELECT t.*, u.first_name || ' ' || u.last_name as assigned_to_name
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
        `;
        const params = [];

        if (assigned_to) {
            query += ` WHERE t.assigned_to = $1 `;
            params.push(assigned_to);
        }

        query += ` ORDER BY t.created_at DESC `;

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};

// Create a new task assigned to an employee
export const createTask = async (req, res) => {
    try {
        const { title, description, assigned_to, assigned_by, due_date, priority, category } = req.body;
        
        // Ensure IDs are integers
        const toId = assigned_to ? parseInt(assigned_to) : null;
        const fromId = assigned_by && !isNaN(parseInt(assigned_by)) ? parseInt(assigned_by) : (req.user?.id || null);

        const result = await pool.query(
            'INSERT INTO tasks (title, description, assigned_to, assigned_by, due_date, status, priority, category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [title, description, toId, fromId, due_date || null, 'pending', priority || 'medium', category || 'General']
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};

// Update task status (e.g., from 'pending' to 'completed')
export const updateTaskStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const result = await pool.query(
            'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};

// Employee submits task with notes/attachments
export const submitTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { submission_notes, attachment_url } = req.body;
        
        await pool.query('BEGIN');
        const submissionResult = await pool.query(
            'INSERT INTO task_submissions (task_id, submission_notes, attachment_url) VALUES ($1, $2, $3) RETURNING *',
            [id, submission_notes, attachment_url]
        );
        const taskResult = await pool.query(
            "UPDATE tasks SET status = 'submitted' WHERE id = $1 RETURNING *",
            [id]
        );
        await pool.query('COMMIT');
        
        res.status(201).json({ success: true, data: { task: taskResult.rows[0], submission: submissionResult.rows[0] } });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error submitting task:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};

// Update all task fields
export const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, priority, category, due_date } = req.body;
        
        console.log('UPDATING TASK:', { id, title, description, priority, category, due_date });

        const result = await pool.query(
            'UPDATE tasks SET title = $1, description = $2, priority = $3, category = $4, due_date = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
            [title, description, priority, category, (due_date === '' ? null : due_date), id]
        );
        
        if (result.rows.length === 0) {
            console.warn(`Task update failed: Task ID ${id} not found.`);
            return res.status(404).json({ success: false, error: 'Task not found' });
        }
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('CRITICAL TASK UPDATE ERROR:', error);
        res.status(500).json({ success: false, error: 'Database connection error', detail: error.message });
    }
};

// Delete a task entirely
export const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
        res.json({ success: true, message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};
