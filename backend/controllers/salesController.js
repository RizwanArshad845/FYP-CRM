import pool from '../config/db.js';

// --- Important Call Recordings ---
export const deleteImportantRecording = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;
        
        // Ensure only owner can delete
        const result = await pool.query('DELETE FROM important_call_recordings WHERE id = $1 AND user_id = $2 RETURNING *', [id, user_id]);
        
        if (result.rows.length === 0) {
            return res.status(403).json({ success: false, error: 'Unauthorized or recording not found' });
        }
        
        res.json({ success: true, message: 'Recording deleted successfully' });
    } catch (error) {
        console.error('Error deleting important recording:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

export const updateImportantRecording = async (req, res) => {
    try {
        const { id } = req.params;
        const { client_id, recording_url, outcome, quality_rating } = req.body;
        const user_id = req.user.id;

        const result = await pool.query(
            `UPDATE important_call_recordings 
             SET client_id = COALESCE($1, client_id),
                 recording_url = COALESCE($2, recording_url),
                 outcome = COALESCE($3, outcome),
                 quality_rating = COALESCE($4, quality_rating),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5 AND user_id = $6
             RETURNING *`,
            [client_id, recording_url, outcome, quality_rating, id, user_id]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ success: false, error: 'Unauthorized or recording not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating important recording:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Update how much an agent has achieved against their monthly goal
export const updateAchieved = async (req, res) => {
    try {
        const { id } = req.params;
        const { achieved_amount } = req.body;
        const result = await pool.query(
            'UPDATE monthly_targets SET achieved_amount = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [achieved_amount, id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating target:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// View Follow Up Schedules (joined with clients)
// Sales agents can only see their own; sales managers see everyone's.
export const getFollowUps = async (req, res) => {
    try {
        const userRole = (req.user?.role || '').toLowerCase();
        const isSalesAgent = userRole === 'sales' || userRole === 'sales agent';

        let result;
        if (isSalesAgent) {
            // Filter to only this agent's follow-ups
            result = await pool.query(`
                SELECT 
                    f.*, 
                    COALESCE(c.company_name, f.client_name_text) as client_name, 
                    COALESCE(f.contact_no, c.contact_no_1) as contact_no,
                    u.first_name || ' ' || u.last_name as agent_name
                FROM follow_ups f
                LEFT JOIN clients c ON f.client_id = c.id
                LEFT JOIN users u ON f.sales_agent_id = u.id
                WHERE f.sales_agent_id = $1
                ORDER BY f.due_date ASC
            `, [req.user.id]);
        } else {
            // Sales manager (or higher) sees all follow-ups
            result = await pool.query(`
                SELECT 
                    f.*, 
                    COALESCE(c.company_name, f.client_name_text) as client_name, 
                    COALESCE(f.contact_no, c.contact_no_1) as contact_no,
                    u.first_name || ' ' || u.last_name as agent_name
                FROM follow_ups f
                LEFT JOIN clients c ON f.client_id = c.id
                LEFT JOIN users u ON f.sales_agent_id = u.id
                ORDER BY f.due_date ASC
            `);
        }

        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching follow ups:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Book Follow up schedules
export const createFollowUp = async (req, res) => {
    try {
        const { user_id, client_id, due_date, notes, status, closer_name, client_name_text, contact_time, follow_up_number, product, area, contact_no } = req.body;
        const result = await pool.query(
            'INSERT INTO follow_ups (sales_agent_id, client_id, due_date, notes, status, closer_name, client_name_text, contact_time, follow_up_number, product, area, contact_no) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
            [user_id, client_id || null, due_date, notes, status || 'pending', closer_name || null, client_name_text || null, contact_time || null, follow_up_number || null, product || null, area || null, contact_no || null]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error creating follow up:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// View all call recordings with metadata
export const getRecordings = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                r.*,
                u.first_name || ' ' || u.last_name AS agent_name,
                c.company_name AS client_name
            FROM call_recordings r
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN clients c ON r.client_id = c.id
            ORDER BY r.created_at DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching recordings:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Database error', 
            details: error.message 
        });
    }
};

// Submit call recordings
export const uploadRecording = async (req, res) => {
    try {
        const { user_id, client_id, recording_url, duration_seconds, transcript, outcome, quality_rating } = req.body;
        const result = await pool.query(
            'INSERT INTO call_recordings (user_id, client_id, recording_url, duration_seconds, transcript, outcome, quality_rating) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [user_id, client_id, recording_url, duration_seconds || 0, transcript || '', outcome || 'pending', quality_rating || 0]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error uploading recording:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Delete a Recording
export const deleteRecording = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM call_recordings WHERE id = $1', [id]);
        res.json({ success: true, message: 'Recording deleted successfully' });
    } catch (error) {
        console.error('Error deleting recording:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Update a Recording
export const updateRecording = async (req, res) => {
    try {
        const { id } = req.params;
        const { client_id, recording_url, outcome, quality_rating } = req.body;
        const result = await pool.query(
            `UPDATE call_recordings 
             SET client_id = COALESCE($1, client_id),
                 recording_url = COALESCE($2, recording_url),
                 outcome = COALESCE($3, outcome),
                 quality_rating = COALESCE($4, quality_rating),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5 RETURNING *`,
            [client_id, recording_url, outcome, quality_rating, id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating recording:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Update an existing Follow Up schedule/status
export const updateFollowUp = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, due_date, notes, client_id, sales_agent_id, closer_name, client_name_text, contact_time, follow_up_number, product, area, contact_no } = req.body;
        const result = await pool.query(
            `UPDATE follow_ups 
             SET status = COALESCE($1, status), 
                 due_date = COALESCE($2, due_date), 
                 notes = COALESCE($3, notes),
                 client_id = COALESCE($4, client_id),
                 sales_agent_id = COALESCE($5, sales_agent_id),
                 closer_name = COALESCE($6, closer_name),
                 client_name_text = COALESCE($7, client_name_text),
                 contact_time = COALESCE($8, contact_time),
                 follow_up_number = COALESCE($9, follow_up_number),
                 product = COALESCE($10, product),
                 area = COALESCE($11, area),
                 contact_no = COALESCE($12, contact_no),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $13 RETURNING *`,
            [status, due_date, notes, client_id, sales_agent_id, closer_name, client_name_text, contact_time, follow_up_number, product, area, contact_no, id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating follow up:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Delete a Follow Up
export const deleteFollowUp = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM follow_ups WHERE id = $1', [id]);
        res.json({ success: true, message: 'Follow up deleted successfully' });
    } catch (error) {
        console.error('Error deleting follow up:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Get Monthly Review Stats for Sales Agent
export const getMonthlyReview = async (req, res) => {
    try {
        const { month, year } = req.query; // '05', '2026'
        
        // Use provided month/year or default to current month/year
        const targetMonth = month ? month : String(new Date().getMonth() + 1).padStart(2, '0');
        const targetYear = year ? year : String(new Date().getFullYear());
        const datePattern = `${targetYear}-${targetMonth}%`;

        // 1. Target Achieved
        const targetsRes = await pool.query(
            `SELECT SUM(achieved_amount) as total_achieved 
             FROM monthly_targets 
             WHERE TO_CHAR(target_month, 'YYYY-MM') = $1`,
            [`${targetYear}-${targetMonth}`]
        );
        const totalAchieved = targetsRes.rows[0].total_achieved || 0;

        // 2. Attendance % and Performance %
        // Simplify for dashboard: find total hours across team and assume 160h per agent per month is 100%.
        const attRes = await pool.query(
            `SELECT COUNT(DISTINCT user_id) as active_agents,
                    SUM(EXTRACT(EPOCH FROM (clock_out - clock_in))/3600) as total_hours
             FROM daily_attendance 
             WHERE TO_CHAR(date, 'YYYY-MM') = $1`,
             [`${targetYear}-${targetMonth}`]
        );
        const activeAgents = parseInt(attRes.rows[0].active_agents) || 1;
        const totalHours = parseFloat(attRes.rows[0].total_hours) || 0;
        const attendancePct = Math.min(100, Math.round((totalHours / (activeAgents * 160)) * 100)) || 0;

        // Performance %: let's average the target achieved % across agents
        const perfRes = await pool.query(
            `SELECT AVG(CASE WHEN target_amount > 0 THEN (achieved_amount / target_amount) * 100 ELSE 0 END) as avg_perf
             FROM monthly_targets
             WHERE TO_CHAR(target_month, 'YYYY-MM') = $1`,
             [`${targetYear}-${targetMonth}`]
        );
        const performancePct = Math.round(parseFloat(perfRes.rows[0].avg_perf) || 0);

        // 3. Client Services Sold
        const servicesRes = await pool.query(
            `SELECT client_services, COUNT(*) as count
             FROM clients
             WHERE TO_CHAR(created_at, 'YYYY-MM') = $1
               AND client_services IS NOT NULL
               AND client_services != ''
             GROUP BY client_services
             ORDER BY count DESC`,
             [`${targetYear}-${targetMonth}`]
        );

        // 4. Areas Sold
        const areasRes = await pool.query(
            `SELECT service_area, COUNT(*) as count
             FROM clients
             WHERE TO_CHAR(created_at, 'YYYY-MM') = $1
               AND service_area IS NOT NULL
               AND service_area != ''
             GROUP BY service_area
             ORDER BY count DESC`,
             [`${targetYear}-${targetMonth}`]
        );

        res.json({
            success: true,
            data: {
                totalAchieved,
                attendancePct,
                performancePct,
                servicesSold: servicesRes.rows,
                areasSold: areasRes.rows
            }
        });

    } catch (error) {
        console.error('Error fetching monthly review:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// --- Important Call Recordings ---
export const getImportantRecordings = async (req, res) => {
    try {
        // Ensure table exists on-demand with correct schema
        await pool.query(`
            CREATE TABLE IF NOT EXISTS important_call_recordings (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
                recording_url TEXT,
                outcome VARCHAR(50) DEFAULT 'pending',
                quality_rating NUMERIC DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const result = await pool.query(`
            SELECT r.*, c.company_name, u.first_name || ' ' || u.last_name as agent_name
            FROM important_call_recordings r
            LEFT JOIN clients c ON r.client_id = c.id
            LEFT JOIN users u ON r.user_id = u.id
            ORDER BY r.created_at DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Fetch important recordings error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Database error', 
            details: error.message 
        });
    }
};

export const addImportantRecording = async (req, res) => {
    try {
        const { client_id, recording_url, outcome, quality_rating } = req.body;
        const user_id = req.user.id;

        const result = await pool.query(
            `INSERT INTO important_call_recordings (user_id, client_id, recording_url, outcome, quality_rating)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [user_id, client_id, recording_url, outcome || 'pending', quality_rating || 0]
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Add important recording error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Database error', 
            details: error.message 
        });
    }
};
