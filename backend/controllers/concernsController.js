import pool from '../config/db.js';

// Get all concerns (optionally filtered by type)
export const getConcerns = async (req, res) => {
    try {
        const isInternal = String(req.query.is_internal) === 'true' || req.url.includes('/internal');
        const table = isInternal ? 'internal_concerns' : 'concerns';
        
        console.log(`[GET_CONCERNS] URL: ${req.url}, Resolved Table: ${table}`);

        let query = `
            SELECT c.*, 
                   u_raised.first_name || ' ' || u_raised.last_name as raised_by_name
            FROM ${table} c
            LEFT JOIN users u_raised ON c.raised_by = u_raised.id
        `;
        
        if (table === 'concerns') {
            query = `
                SELECT c.*, 
                       u_raised.first_name || ' ' || u_raised.last_name as raised_by_name,
                       u_assigned.first_name || ' ' || u_assigned.last_name as assigned_to_name
                FROM concerns c
                LEFT JOIN users u_raised ON c.raised_by = u_raised.id
                LEFT JOIN users u_assigned ON c.assigned_to = u_assigned.id
            `;
        }
        
        const params = [];
        const role = (req.user.role || '').toLowerCase().trim();
        
        // Robust ID parsing: Check query first, then session
        let userId = parseInt(req.query.userId || req.user.id);
        if (isNaN(userId)) {
            userId = req.user.id;
        }
        
        console.log(`[GET_CONCERNS] User: ${userId} (${typeof userId}), Role: ${role}, Table: ${table}`);

        if (role === 'cst' || role === 'sales' || role === 'sales_manager') {
            // Agents only see what they raised - use explicit cast to handle potential DB type mismatch
            query += ' WHERE c.raised_by = $1::integer ';
            params.push(userId);
        }

        query += ' ORDER BY c.created_at DESC ';
        console.log(`[GET_CONCERNS] Final Query: ${query}`);

        const result = await pool.query(query, params);
        console.log(`[GET_CONCERNS] SUCCESS. Found ${result.rows.length} rows for user ${userId}`);
        
        // Force Vercel to NOT cache this response (fix for the 304 issue)
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        if (result.rows.length > 0) {
            console.log(`[GET_CONCERNS] First row sample:`, JSON.stringify(result.rows[0], null, 2));
        }
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching concerns:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Database error', 
            details: error.message 
        });
    }
};

// Create concern
export const createConcern = async (req, res) => {
    try {
        const { concern_type, description, assigned_to, is_internal } = req.body;
        const raised_by = req.user.id; // Force use authenticated user ID
        const isInternal = is_internal === true || String(is_internal) === 'true' || req.url.includes('/internal');
        const table = isInternal ? 'internal_concerns' : 'concerns';
        
        let result;
        if (isInternal) {
            result = await pool.query(
                'INSERT INTO internal_concerns (concern_type, description, raised_by) VALUES ($1, $2, $3) RETURNING *',
                [concern_type, description, raised_by]
            );
        } else {
            result = await pool.query(
                'INSERT INTO concerns (concern_type, description, raised_by, assigned_to) VALUES ($1, $2, $3, $4) RETURNING *',
                [concern_type, description, raised_by, assigned_to || null]
            );
        }
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error creating concern:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Database error', 
            details: error.message 
        });
    }
};

export const updateConcern = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, assigned_to, is_internal, concern_type, description } = req.body;
        const isInternal = is_internal === true || String(is_internal) === 'true' || req.url.includes('/internal');
        
        // Security: agents can only update their own concerns
        const userRole = (req.user.role || '').toLowerCase().trim();
        if (userRole === 'cst' || userRole === 'sales') {
            const updTable = isInternal ? 'internal_concerns' : 'concerns';
            const check = await pool.query(`SELECT raised_by FROM ${updTable} WHERE id = $1`, [id]);
            if (check.rows.length === 0 || Number(check.rows[0].raised_by) !== Number(req.user.id)) {
                return res.status(403).json({ success: false, error: 'Unauthorized to modify this concern' });
            }
        }

        let result;
        if (isInternal) {
            result = await pool.query(
                `UPDATE internal_concerns 
                 SET status = COALESCE($1, status), 
                     concern_type = COALESCE($2, concern_type),
                     description = COALESCE($3, description),
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $4 RETURNING *`,
                [status, concern_type, description, id]
            );
        } else {
            result = await pool.query(
                `UPDATE concerns 
                 SET status = COALESCE($1, status), 
                     assigned_to = COALESCE($2, assigned_to), 
                     concern_type = COALESCE($3, concern_type),
                     description = COALESCE($4, description),
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $5 RETURNING *`,
                [status, assigned_to, concern_type, description, id]
            );
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating concern:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Delete concern
export const deleteConcern = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_internal } = req.query;
        const isInternal = is_internal === 'true' || req.url.includes('/internal');
        const targetTable = isInternal ? 'internal_concerns' : 'concerns';
        
        // Security & Business Rules: agents can only delete their own PENDING concerns
        const userRole = (req.user.role || '').toLowerCase().trim();
        if (userRole === 'cst' || userRole === 'sales') {
            const check = await pool.query(`SELECT raised_by, status FROM ${targetTable} WHERE id = $1`, [id]);
            
            if (check.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Concern not found' });
            }

            if (Number(check.rows[0].raised_by) !== Number(req.user.id)) {
                return res.status(403).json({ success: false, error: 'Unauthorized to modify this concern' });
            }

            // Block deletion of In-Progress or Resolved concerns
            const status = (check.rows[0].status || 'open').toLowerCase();
            if (status !== 'open') {
                return res.status(400).json({ 
                    success: false, 
                    error: `Cannot delete concern. Current status is '${status}'. Only 'open' concerns can be deleted.` 
                });
            }
        }

        await pool.query(`DELETE FROM ${targetTable} WHERE id = $1`, [id]);
        res.json({ success: true, message: 'Concern deleted' });
    } catch (error) {
        console.error('Error deleting concern:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};
