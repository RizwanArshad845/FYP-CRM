import pool from '../config/db.js';

// Get all clients along with their assigned sales and cst agents
export const getClients = async (req, res) => {
    try {
        let query = `
            SELECT c.*, 
                   s.first_name || ' ' || s.last_name AS submitted_by_name,
                   cst.first_name || ' ' || cst.last_name AS assigned_name
            FROM clients c
            LEFT JOIN users s ON c.sales_agent_id = s.id
            LEFT JOIN users cst ON c.cst_agent_id = cst.id
        `;

        const params = [];
        const userId = req.user.id;
        const role = req.user.role;
        if (role === 'cst') {
            query += ' WHERE c.cst_agent_id = $1';
            params.push(userId);
        } else if (role === 'sales') {
            query += ' WHERE c.sales_agent_id = $1';
            params.push(userId);
        }
        query += ' ORDER BY c.created_at DESC';

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};

// Create a new client (typically triggered by Sales Agent or CST Agent)
export const createClient = async (req, res) => {
    try {
        const {
            companyName, customerName, email, email_2, paymentAmount,
            productSold, serviceArea, contactNo1, contactNo2,
            clientConcerns, tipsForTech, notes, digitalPresence,
            sales_agent_id, cst_agent_id, clientServices, cin, paymentGateway
        } = req.body;

        const safePaymentAmount = isNaN(parseFloat(paymentAmount)) ? 0 : parseFloat(paymentAmount);

        // Default status based on who is creating the client
        const userRole = req.user?.role?.name || req.user?.role || 'sales';
        let initialStatus = 'new';
        if (userRole === 'cst' || userRole === 'cst_manager') {
            initialStatus = 'existing';
        }

        const result = await pool.query(
            `INSERT INTO clients (
                company_name, customer_name, email, email_2, payment_amount, 
                product_sold, service_area, contact_no_1, contact_no_2, 
                client_concerns, tips_for_tech, notes, digital_presence, 
                sales_agent_id, cst_agent_id, status, client_services, cin, payment_gateway
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
            [
                companyName, customerName, email, email_2 || null, safePaymentAmount,
                productSold, serviceArea, contactNo1, contactNo2 || null,
                clientConcerns || null, tipsForTech || null, notes || null, digitalPresence || null,
                sales_agent_id || null, cst_agent_id || null, initialStatus, clientServices || null, cin || null, paymentGateway || null
            ]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error creating client:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Database error',
            detail: error.detail // Provides specific info like which key failed
        });
    }
};

// Assign a CST Agent to a client and mark as 'active'
export const assignClient = async (req, res) => {
    try {
        const { id } = req.params;
        const { agentId } = req.body;
        const result = await pool.query(
            "UPDATE clients SET cst_agent_id = $1, status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
            [agentId, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Client not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error assigning client:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

// Unassign a CST Agent and move back to 'onboarding'
export const unassignClient = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "UPDATE clients SET cst_agent_id = NULL, status = 'onboarding', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Client not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error unassigning client:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};



// General update to a client
export const updateClient = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            companyName, customerName, email, email_2, paymentAmount,
            productSold, serviceArea, contactNo1, contactNo2,
            clientConcerns, tipsForTech, notes, digitalPresence, clientServices,
            cin, paymentGateway
        } = req.body;

        const result = await pool.query(
            `UPDATE clients SET 
                company_name = COALESCE($1, company_name), 
                customer_name = COALESCE($2, customer_name), 
                email = COALESCE($3, email), 
                email_2 = COALESCE($4, email_2),
                payment_amount = COALESCE($5, payment_amount), 
                product_sold = COALESCE($6, product_sold), 
                service_area = COALESCE($7, service_area), 
                contact_no_1 = COALESCE($8, contact_no_1), 
                contact_no_2 = COALESCE($9, contact_no_2), 
                client_concerns = COALESCE($10, client_concerns), 
                tips_for_tech = COALESCE($11, tips_for_tech), 
                notes = COALESCE($12, notes), 
                digital_presence = COALESCE($13, digital_presence),
                client_services = COALESCE($14, client_services),
                cin = COALESCE($15, cin),
                payment_gateway = COALESCE($16, payment_gateway),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $17 RETURNING *`,
            [
                companyName, customerName, email, email_2,
                paymentAmount, productSold, serviceArea, contactNo1, contactNo2,
                clientConcerns, tipsForTech, notes, digitalPresence,
                clientServices, cin, paymentGateway, id
            ]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};

// Quick toggle active / deactivated status
export const toggleClientStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, flag_type } = req.body; // 'active', 'flagged', etc.
        const result = await pool.query(
            'UPDATE clients SET status = $1, flag_type = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [status, flag_type || null, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Client not found or no change made' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error toggling client status:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};

// Discard client
export const discardClient = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const result = await pool.query(
            'UPDATE clients SET status = $1, discard_reason = $2, discarded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            ['discarded', reason, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Client not found or already discarded' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error discarding client:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};

// Get pending deactivation requests from CST agents
export const getDeactivationRequests = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT dr.id, dr.client_id, dr.reason, dr.status, dr.created_at,
                   c.company_name,
                   dr.requested_by AS requested_by_raw
            FROM client_deactivation_requests dr
            JOIN clients c ON dr.client_id = c.id
            WHERE dr.status = 'pending'
            ORDER BY dr.created_at DESC
        `);

        // Resolve user names for numeric IDs, keep string names as-is
        const rows = [];
        for (const row of result.rows) {
            let requestedByName = String(row.requested_by_raw);
            if (/^\d+$/.test(requestedByName)) {
                try {
                    const userRes = await pool.query(
                        "SELECT first_name || ' ' || last_name AS name FROM users WHERE id = $1",
                        [parseInt(requestedByName)]
                    );
                    if (userRes.rows.length > 0) requestedByName = userRes.rows[0].name;
                } catch (_) { /* keep raw value */ }
            }
            rows.push({ ...row, requested_by: requestedByName });
        }

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching deactivation requests:', error);
        res.status(500).json({ success: false, error: 'Database connection error' });
    }
};
