import pool from '../config/db.js';

// Assign a CST Agent to an onboarding client (CST Manager action)
export const assignCstAgent = async (req, res) => {
    try {
        const { id } = req.params;
        const { cst_agent_id } = req.body;
        const result = await pool.query(
            'UPDATE clients SET cst_agent_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [cst_agent_id, 'active', id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error assigning CST agent:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};

// Unassign a CST Agent from a client (Manager action)
export const unassignCstAgent = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "UPDATE clients SET cst_agent_id = NULL, status = 'onboarding', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
            [id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error unassigning CST agent:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};

// Get all CST agent targets for the current month with calculated achieved clients
export const getTargets = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                t.id, 
                t.agent_id, 
                u.first_name || ' ' || u.last_name AS agent_name, 
                t.target_month AS month, 
                t.target_clients,
                t.achieved_clients,
                t.target_amount,
                t.achieved_amount
            FROM cst_agent_targets t
            JOIN users u ON t.agent_id = u.id
            ORDER BY t.created_at DESC
        `);
        // Map keys to camelCase for frontend
        const data = result.rows.map(row => ({
            id: row.id,
            agentId: row.agent_id,
            agentName: row.agent_name,
            month: row.month,
            targetClients: row.target_clients,
            targetAmount: row.target_amount,
            achievedAmount: row.achieved_amount,
            achievedClients: row.achieved_clients
        }));
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching CST targets:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Set or update a target for a CST agent for a specific month
export const upsertTarget = async (req, res) => {
    try {
        const { agent_id, target_month, target_clients, target_amount } = req.body;
        // Ensure month is YYYY-MM (7 chars) to match VARCHAR(7) column
        const formattedMonth = target_month.substring(0, 7);
        const amount = target_amount !== undefined ? target_amount : (target_clients || 0);

        const result = await pool.query(`
            INSERT INTO cst_agent_targets (agent_id, target_month, target_clients, target_amount)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (agent_id, target_month)
            DO UPDATE SET 
                target_clients = EXCLUDED.target_clients,
                target_amount = EXCLUDED.target_amount,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [agent_id, formattedMonth, target_clients || amount, amount]);
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error upserting CST target:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Update achieved amount for a CST agent target
export const updateAchieved = async (req, res) => {
    try {
        const { id } = req.params;
        const { achieved } = req.body;
        
        const result = await pool.query(
            'UPDATE cst_agent_targets SET achieved_amount = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [achieved, id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating achieved CST target:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Update achieved clients for a CST agent target
export const updateAchievedClients = async (req, res) => {
    try {
        const { id } = req.params;
        const { achieved } = req.body;
        
        const result = await pool.query(
            'UPDATE cst_agent_targets SET achieved_clients = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [achieved, id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating achieved clients:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Delete a target for a CST agent
export const deleteTarget = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM cst_agent_targets WHERE id = $1', [id]);
        res.json({ success: true, message: 'Target deleted successfully' });
    } catch (error) {
        console.error('Error deleting CST target:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Update target amount via ID
export const updateTarget = async (req, res) => {
    try {
        const { id } = req.params;
        const { target_amount } = req.body;
        
        const result = await pool.query(
            'UPDATE cst_agent_targets SET target_amount = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [target_amount, id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating target:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Get all client strategies
export const getStrategies = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.*, c.company_name as client_name 
            FROM client_strategies s
            JOIN clients c ON s.client_id = c.id
            ORDER BY s.created_at DESC
        `);
        // map to camelCase for frontend
        const data = result.rows.map(row => ({
            id: row.id,
            clientId: row.client_id,
            clientName: row.client_name,
            strategyText: row.strategy_text,
            createdAt: row.created_at
        }));
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching strategies:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Insert or update a strategy for a client
export const upsertStrategy = async (req, res) => {
    try {
        const { client_id, strategy_text, created_by } = req.body;
        
        // Check if strategy exists to simulate upsert (since no UNIQUE constraint in user snippet)
        const check = await pool.query('SELECT id FROM client_strategies WHERE client_id = $1', [client_id]);
        
        let result;
        if (check.rows.length > 0) {
            result = await pool.query(`
                UPDATE client_strategies SET 
                    strategy_text = $1,
                    created_at = CURRENT_TIMESTAMP
                WHERE client_id = $2
                RETURNING *
            `, [strategy_text, client_id]);
        } else {
            result = await pool.query(`
                INSERT INTO client_strategies (client_id, strategy_text, created_by)
                VALUES ($1, $2, $3)
                RETURNING *
            `, [client_id, strategy_text, created_by]);
        }
        
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error upserting strategy:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Delete a strategy
export const deleteStrategy = async (req, res) => {
    try {
        const { client_id } = req.params;
        await pool.query('DELETE FROM client_strategies WHERE client_id = $1', [client_id]);
        res.json({ success: true, message: 'Strategy deleted successfully' });
    } catch (error) {
        console.error('Error deleting strategy:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Manager action to approve or reject a deactivation request
export const resolveDeactivation = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reviewed_by } = req.body; // 'approved' or 'rejected'
        const result = await pool.query(
            'UPDATE client_deactivation_requests SET status = $1, reviewed_by = $2 WHERE id = $3 RETURNING *',
            [status, reviewed_by, id]
        );
        if (status === 'approved' && result.rows.length > 0) {
            await pool.query("UPDATE clients SET status = 'deactivated' WHERE id = $1", [result.rows[0].client_id]);
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error resolving deactivation:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Dynamic Performance Calculation for CST Agent Performance Sheet
export const getAgentPerformanceMetrics = async (req, res) => {
    try {
        const query = `
            SELECT 
                mt.id as target_id,
                u.id as agent_id, 
                u.first_name, 
                u.last_name, 
                u.status as user_status,
                mt.target_month,
                mt.target_amount as total_target,
                mt.achieved_amount as total_achieved,
                (
                    SELECT COUNT(*) 
                    FROM call_recordings cr 
                    WHERE cr.user_id = u.id 
                    AND TO_CHAR(cr.created_at, 'YYYY-MM') = mt.target_month
                ) as recording_count,
                COALESCE((
                    SELECT LEAST(100, ROUND((SUM(EXTRACT(EPOCH FROM (da.clock_out - da.clock_in))/3600) / 160) * 100))
                    FROM daily_attendance da
                    WHERE da.user_id = u.id 
                    AND TO_CHAR(da.date, 'YYYY-MM') = mt.target_month
                ), 0) as attendance_pct
            FROM users u
            JOIN roles r ON u.role_id = r.id
            JOIN cst_agent_targets mt ON u.id = mt.agent_id
            WHERE r.name ILIKE '%cst%'
            ORDER BY mt.target_month DESC, total_achieved DESC;
        `;
        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error in getAgentPerformanceMetrics:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};
