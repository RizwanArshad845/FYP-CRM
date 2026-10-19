import { z } from 'zod';
import pool, { withTransaction } from '../config/db.js';
import { getOrganizationPortals } from '../services/sessionService.js';
import { FIELD_TYPES, getFieldDefinitions } from '../services/customFieldService.js';
import { httpError } from '../utils/tenant.js';
import {
    getPermissions, setPermissions, setPortalLabels, setPortalsEnabled,
} from '../services/organizationService.js';

// Organization Settings (admin, after onboarding): same portal/label rules as the wizard.

export const updateOrganizationSchema = z.object({
    name: z.string().trim().min(2).max(255),
    industry: z.string().trim().max(100).optional().nullable(),
    size: z.string().trim().max(50).optional().nullable(),
});

const settings = async (tenantId) => {
    const org = await pool.query('SELECT id, name, slug, industry, size, created_at FROM organizations WHERE id = $1', [tenantId]);
    return { organization: org.rows[0], portals: await getOrganizationPortals(tenantId) };
};

export const getOrganization = async (req, res) => {
    res.json({ success: true, data: await settings(req.user.tenantId) });
};

export const updateOrganization = async (req, res) => {
    const { name, industry, size } = req.body;
    await pool.query(
        'UPDATE organizations SET name = $1, industry = $2, size = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        [name, industry || null, size || null, req.user.tenantId]
    );
    res.json({ success: true, data: await settings(req.user.tenantId) });
};

export const updatePortals = async (req, res) => {
    await withTransaction((db) => setPortalsEnabled(db, req.user.tenantId, req.body.portals));
    res.json({ success: true, data: await settings(req.user.tenantId) });
};

export const updateLabels = async (req, res) => {
    await withTransaction((db) => setPortalLabels(db, req.user.tenantId, req.body.portals));
    res.json({ success: true, data: await settings(req.user.tenantId) });
};

// Permission dials: overrides are restrictions only; the catalog is the ceiling.
const flags = z.record(z.string().max(100), z.boolean());
export const permissionsSchema = z.object({
    permissions: z.array(z.object({
        portalKey: z.string().trim().min(1).max(50),
        tier: z.enum(['Manager', 'Member']),
        actions: flags.optional(),
        fields: flags.optional(),
    })).min(1).max(50),
});

export const getPermissionSettings = async (req, res) => {
    res.json({ success: true, data: await getPermissions(pool, req.user.tenantId) });
};

export const updatePermissionSettings = async (req, res) => {
    await withTransaction((db) => setPermissions(db, req.user.tenantId, req.body.permissions));
    res.json({ success: true, data: await getPermissions(pool, req.user.tenantId) });
};

// --- Custom client fields (plan 6.1) and pipeline stages (plan 6.2) ----------
// Add, edit and reorder only; the report has no delete for either.

const optionList = z.array(z.string().trim().min(1).max(100)).min(1, 'add at least one option').max(50)
    .refine((o) => new Set(o).size === o.length, 'options must be unique');

export const customFieldSchema = z.object({
    field_name: z.string().trim().min(1).max(100),
    field_type: z.enum(FIELD_TYPES),
    options: optionList.optional().nullable(),
}).refine((f) => f.field_type !== 'dropdown' || f.options?.length, { message: 'options: a dropdown needs at least one option' });

export const customFieldUpdateSchema = z.object({
    field_name: z.string().trim().min(1).max(100).optional(),
    options: optionList.optional(),
    display_order: z.number().int().min(0).optional(),
});

export const orderSchema = z.object({ ids: z.array(z.number().int().positive()).min(1).max(200) });

export const stageSchema = z.object({ stage_name: z.string().trim().min(1).max(100) });

// Sets the order of every row of `table` in the tenant to the order of `ids`.
// `table`/`column` come from the two fixed call sites below, never from the request.
const reorder = (table, column, tenantId, ids) => withTransaction(async (db) => {
    const { rows } = await db.query(`SELECT id FROM ${table} WHERE tenant_id = $1 AND object_type = 'client' FOR UPDATE`, [tenantId]);
    const current = new Set(rows.map((r) => r.id));
    if (ids.length !== current.size || new Set(ids).size !== ids.length || !ids.every((id) => current.has(id))) {
        throw httpError(400, 'ids must list every entry exactly once');
    }
    for (const [i, id] of ids.entries()) {
        await db.query(`UPDATE ${table} SET ${column} = $1 WHERE id = $2 AND tenant_id = $3`, [i + 1, id, tenantId]);
    }
});

export const listCustomFields = async (req, res) => {
    res.json({ success: true, data: await getFieldDefinitions(req.user.tenantId) });
};

export const createCustomField = async (req, res) => {
    const { field_name, field_type, options } = req.body;
    const { rows } = await pool.query(`
        INSERT INTO field_definitions (tenant_id, field_name, field_type, options, display_order)
        VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM field_definitions WHERE tenant_id = $1 AND object_type = 'client'))
        RETURNING id, field_name, field_type, options, display_order
    `, [req.user.tenantId, field_name, field_type, field_type === 'dropdown' ? JSON.stringify(options) : null]);
    res.status(201).json({ success: true, data: rows[0] });
};

// Renaming a field also renames its key in every client's custom_fields, so no value is lost.
export const updateCustomField = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { field_name, options, display_order } = req.body;
    const row = await withTransaction(async (db) => {
        const found = await db.query('SELECT * FROM field_definitions WHERE id = $1 AND tenant_id = $2 FOR UPDATE', [req.params.id, tenantId]);
        const def = found.rows[0];
        if (!def) throw httpError(404, 'Custom field not found');
        if (options && def.field_type !== 'dropdown') throw httpError(400, 'Only dropdown fields have options');
        const { rows } = await db.query(`
            UPDATE field_definitions SET field_name = COALESCE($1, field_name), options = COALESCE($2, options),
                   display_order = COALESCE($3, display_order)
            WHERE id = $4 AND tenant_id = $5 RETURNING id, field_name, field_type, options, display_order
        `, [field_name ?? null, options ? JSON.stringify(options) : null, display_order ?? null, def.id, tenantId]);
        if (field_name && field_name !== def.field_name) {
            await db.query(`
                UPDATE clients SET custom_fields = (custom_fields - $1::text) || jsonb_build_object($2::text, custom_fields -> $1::text)
                WHERE tenant_id = $3 AND custom_fields ? $1::text
            `, [def.field_name, field_name, tenantId]);
        }
        return rows[0];
    });
    res.json({ success: true, data: row });
};

export const reorderCustomFields = async (req, res) => {
    await reorder('field_definitions', 'display_order', req.user.tenantId, req.body.ids);
    res.json({ success: true, data: await getFieldDefinitions(req.user.tenantId) });
};

export const getPipelineStages = async (tenantId, db = pool) => (await db.query(
    "SELECT id, stage_name, stage_order FROM pipeline_stages WHERE tenant_id = $1 AND object_type = 'client' ORDER BY stage_order, id",
    [tenantId]
)).rows;

export const listPipelineStages = async (req, res) => {
    res.json({ success: true, data: await getPipelineStages(req.user.tenantId) });
};

export const createPipelineStage = async (req, res) => {
    const { rows } = await pool.query(`
        INSERT INTO pipeline_stages (tenant_id, stage_name, stage_order)
        VALUES ($1, $2, (SELECT COALESCE(MAX(stage_order), 0) + 1 FROM pipeline_stages WHERE tenant_id = $1 AND object_type = 'client'))
        RETURNING id, stage_name, stage_order
    `, [req.user.tenantId, req.body.stage_name]);
    res.status(201).json({ success: true, data: rows[0] });
};

export const renamePipelineStage = async (req, res) => {
    const { rows } = await pool.query(
        'UPDATE pipeline_stages SET stage_name = $1 WHERE id = $2 AND tenant_id = $3 RETURNING id, stage_name, stage_order',
        [req.body.stage_name, req.params.id, req.user.tenantId]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Stage not found' });
    res.json({ success: true, data: rows[0] });
};

export const reorderPipelineStages = async (req, res) => {
    await reorder('pipeline_stages', 'stage_order', req.user.tenantId, req.body.ids);
    res.json({ success: true, data: await getPipelineStages(req.user.tenantId) });
};
