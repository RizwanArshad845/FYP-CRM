import { z } from 'zod';
import pool, { withTransaction } from '../config/db.js';
import { getOrganizationPortals } from '../services/sessionService.js';
import { setPortalLabels, setPortalsEnabled } from '../services/organizationService.js';

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
