import { z } from 'zod';
import pool, { withTransaction } from '../config/db.js';
import { clientImportSchema, clientSchema } from '../validation/clientSchema.js';
import { applyFieldVisibility, can } from '../policy/index.js';
import { getFieldDefinitions, validateCustomFields } from '../services/customFieldService.js';
import { getPipelineStages } from './organizationController.js';
import {
    assertClientAccess, assertUsersInTenant, getClientInTenant, isManager, memberClientColumn,
} from '../utils/tenant.js';

// Get clients in the caller's organization; Member tier only sees their own.
export const getClients = async (req, res) => {
    const params = [req.user.tenantId];
    let query = `
        SELECT c.*,
               s.first_name || ' ' || s.last_name AS submitted_by_name,
               cst.first_name || ' ' || cst.last_name AS assigned_name,
               ps.stage_name,
               -- Latest contact: the newest follow up, note or call recording (plan 6.3)
               (SELECT MAX(x.at) FROM (
                    SELECT MAX(f.created_at) AS at FROM follow_ups f WHERE f.client_id = c.id AND f.tenant_id = c.tenant_id
                    UNION ALL SELECT MAX(n.created_at) FROM client_notes n WHERE n.client_id = c.id AND n.tenant_id = c.tenant_id
                    UNION ALL SELECT MAX(r.created_at) FROM call_recordings r WHERE r.client_id = c.id AND r.tenant_id = c.tenant_id
               ) x) AS last_contact
        FROM clients c
        LEFT JOIN users s ON c.sales_agent_id = s.id
        LEFT JOIN users cst ON c.cst_agent_id = cst.id
        LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id AND ps.tenant_id = c.tenant_id
        WHERE c.tenant_id = $1
    `;
    // Member tier in a sales/CST portal sees only assigned clients
    const memberCol = isManager(req.user) ? null : memberClientColumn(req.user);
    if (memberCol) {
        params.push(req.user.id);
        query += ` AND c.${memberCol} = $2`;
    }
    query += ' ORDER BY c.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: await applyFieldVisibility(req.user, 'client', result.rows) });
};

// Inserts one client validated by clientSchema; `custom` is the checked custom field object.
const insertClient = async (db, tenantId, c, status, custom) => (await db.query(
    `INSERT INTO clients (
        tenant_id, company_name, customer_name, email, email_2, payment_amount,
        product_sold, service_area, contact_no_1, contact_no_2,
        client_concerns, tips_for_tech, notes, digital_presence,
        sales_agent_id, cst_agent_id, status, client_services, cin, payment_gateway, custom_fields
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING *`,
    [
        tenantId, c.companyName, c.customerName ?? null, c.email || null, c.email_2 || null, c.paymentAmount ?? 0,
        c.productSold ?? null, c.serviceArea ?? null, c.contactNo1 ?? null, c.contactNo2 || null,
        c.clientConcerns || null, c.tipsForTech || null, c.notes || null, c.digitalPresence || null,
        c.sales_agent_id || null, c.cst_agent_id || null, status, c.clientServices || null, c.cin || null, c.paymentGateway || null,
        Object.keys(custom).length ? JSON.stringify(custom) : null,
    ]
)).rows[0];

// Create a new client (Sales Manager entry form or CST Manager existing-client form)
export const createClient = async (req, res) => {
    const c = { ...req.body };
    const tenantId = req.user.tenantId;

    // Member-tier sales staff can only create clients for themselves.
    if (!isManager(req.user) && memberClientColumn(req.user) === 'sales_agent_id') {
        c.sales_agent_id = req.user.id;
        c.cst_agent_id = null;
    }
    await assertUsersInTenant(tenantId, [c.sales_agent_id, c.cst_agent_id]);

    const custom = validateCustomFields(await getFieldDefinitions(tenantId), c.customFields);
    const initialStatus = ['cst', 'cst_manager'].includes(req.user.role) ? 'existing' : 'new';

    const row = await insertClient(pool, tenantId, c, initialStatus, custom);
    res.status(201).json({ success: true, data: await applyFieldVisibility(req.user, 'client', row) });
};

/**
 * Client CSV import for sales managers (plan 7.5): each row goes through the same
 * clientSchema as POST /clients plus the custom field rules. Valid rows are saved in
 * one transaction with status 'new'; invalid rows are skipped and listed.
 */
export const importClients = async (req, res) => {
    const tenantId = req.user.tenantId;
    const definitions = await getFieldDefinitions(tenantId);
    const rowErrors = [];
    const valid = [];

    for (const [index, raw] of req.body.clients.entries()) {
        const parsed = clientSchema.safeParse(raw);
        if (!parsed.success) {
            // Plain field names, e.g. "payment amount: payment must be 0 or more"
            const label = (i) => String(i.path[0] ?? 'row').replace(/_/g, ' ').replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase();
            rowErrors.push({
                row: index + 1,
                error: parsed.error.issues.map((i) => (i.message.startsWith(label(i)) ? i.message : `${label(i)}: ${i.message}`)).join(', '),
            });
            continue;
        }
        const c = { ...parsed.data, sales_agent_id: parsed.data.sales_agent_id ?? req.user.id };
        try {
            const custom = validateCustomFields(definitions, c.customFields);
            await assertUsersInTenant(tenantId, [c.sales_agent_id, c.cst_agent_id]);
            valid.push({ c, custom });
        } catch (error) {
            if (!error.status || error.status >= 500) throw error;
            rowErrors.push({ row: index + 1, error: error.message });
        }
    }

    if (!valid.length) {
        return res.status(400).json({ success: false, error: 'No valid rows; nothing was created', rowErrors });
    }
    const created = await withTransaction(async (db) => {
        const out = [];
        for (const { c, custom } of valid) out.push(await insertClient(db, tenantId, c, 'new', custom));
        return out;
    });
    res.status(201).json({ success: true, data: { created: await applyFieldVisibility(req.user, 'client', created), rowErrors } });
};

// Assign a CST Agent to a client and mark as 'active'
export const assignClient = async (req, res) => {
    const { agentId } = req.body;
    await assertUsersInTenant(req.user.tenantId, [agentId]);
    const result = await pool.query(
        "UPDATE clients SET cst_agent_id = $1, status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING *",
        [agentId, req.params.id, req.user.tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Client not found' });
    res.json({ success: true, data: await applyFieldVisibility(req.user, 'client', result.rows[0]) });
};

// Unassign a CST Agent and move back to 'onboarding'
export const unassignClient = async (req, res) => {
    const result = await pool.query(
        "UPDATE clients SET cst_agent_id = NULL, status = 'onboarding', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2 RETURNING *",
        [req.params.id, req.user.tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Client not found' });
    res.json({ success: true, data: await applyFieldVisibility(req.user, 'client', result.rows[0]) });
};

// General update to a client
export const updateClient = async (req, res) => {
    const {
        companyName, customerName, email, email_2, paymentAmount,
        productSold, serviceArea, contactNo1, contactNo2,
        clientConcerns, tipsForTech, notes, digitalPresence, clientServices,
        cin, paymentGateway,
    } = req.body;
    // Custom fields are replaced as a whole when sent, and left alone otherwise.
    const custom = req.body.customFields === undefined ? null
        : validateCustomFields(await getFieldDefinitions(req.user.tenantId), req.body.customFields);

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
            custom_fields = COALESCE($19::jsonb, custom_fields),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $17 AND tenant_id = $18 RETURNING *`,
        [
            companyName, customerName, email, email_2,
            paymentAmount, productSold, serviceArea, contactNo1, contactNo2,
            clientConcerns, tipsForTech, notes, digitalPresence,
            clientServices, cin, paymentGateway, req.params.id, req.user.tenantId,
            custom ? JSON.stringify(custom) : null,
        ]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Client not found' });
    res.json({ success: true, data: await applyFieldVisibility(req.user, 'client', result.rows[0]) });
};

// Status / flag changes. CST agents may only change their own clients.
export const toggleClientStatus = async (req, res) => {
    const { status, flag_type } = req.body;
    // Flagging is its own permission on top of changing status
    if ((status === 'flagged' || flag_type) && !(await can(req.user, 'client.flag'))) {
        return res.status(403).json({ success: false, error: 'You do not have permission to perform this action' });
    }
    const client = await getClientInTenant(req.user.tenantId, req.params.id);
    assertClientAccess(req.user, client);

    const result = await pool.query(
        'UPDATE clients SET status = $1, flag_type = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND tenant_id = $4 RETURNING *',
        [status, flag_type || null, client.id, req.user.tenantId]
    );
    res.json({ success: true, data: await applyFieldVisibility(req.user, 'client', result.rows[0]) });
};

export { clientSchema, clientImportSchema };

export const stageMoveSchema = z.object({ stage_id: z.number().int().positive() });

// Kanban move (plan 6.3): sets the stage and when it changed; never touches status.
export const moveClientStage = async (req, res) => {
    const tenantId = req.user.tenantId;
    const client = await getClientInTenant(tenantId, req.params.id);
    assertClientAccess(req.user, client);
    const stage = await pool.query('SELECT id FROM pipeline_stages WHERE id = $1 AND tenant_id = $2', [req.body.stage_id, tenantId]);
    if (!stage.rows[0]) return res.status(400).json({ success: false, error: 'Stage does not exist in this organization' });

    const result = await pool.query(
        'UPDATE clients SET stage_id = $1, stage_changed_at = now(), updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING *',
        [stage.rows[0].id, client.id, tenantId]
    );
    res.json({ success: true, data: await applyFieldVisibility(req.user, 'client', result.rows[0]) });
};

export const discardClient = async (req, res) => {
    const result = await pool.query(
        `UPDATE clients SET status = 'discarded', discard_reason = $1, discarded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND tenant_id = $3 RETURNING *`,
        [req.body.reason, req.params.id, req.user.tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: 'Client not found' });
    res.json({ success: true, data: await applyFieldVisibility(req.user, 'client', result.rows[0]) });
};

// Pending deactivation requests from CST agents
export const getDeactivationRequests = async (req, res) => {
    const result = await pool.query(`
        SELECT dr.id, dr.client_id, dr.reason, dr.status, dr.created_at,
               c.company_name, c.flag_type,
               COALESCE(u.first_name || ' ' || u.last_name, 'Unknown') AS requested_by
        FROM client_deactivation_requests dr
        JOIN clients c ON dr.client_id = c.id
        LEFT JOIN users u ON u.id = dr.requested_by
        WHERE dr.status = 'pending' AND dr.tenant_id = $1
        ORDER BY dr.created_at DESC
    `, [req.user.tenantId]);
    res.json({ success: true, data: result.rows });
};

// Definitions and stages for client forms and the board: readable by anyone in the tenant.
export const getClientCustomFields = async (req, res) => {
    res.json({ success: true, data: await getFieldDefinitions(req.user.tenantId) });
};

export const getClientPipelineStages = async (req, res) => {
    res.json({ success: true, data: await getPipelineStages(req.user.tenantId) });
};
