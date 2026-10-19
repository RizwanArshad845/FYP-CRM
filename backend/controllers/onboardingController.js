import { z } from 'zod';
import pool, { withTransaction } from '../config/db.js';
import { createUserRecord, importEmployees } from '../services/userService.js';
import { buildSession, getOrganizationPortals } from '../services/sessionService.js';
import {
    advanceStep, createOrganization, setPortalLabels, setPortalsEnabled, setTierLabels,
} from '../services/organizationService.js';
import { signToken } from './authController.js';
import { TIERS } from '../policy/catalog.js';

const portalKey = z.string().trim().min(1).max(50);

export const signupSchema = z.object({
    organization: z.object({
        name: z.string().trim().min(2).max(255),
        industry: z.string().trim().max(100).optional(),
        size: z.string().trim().max(50).optional(),
    }),
    admin: z.object({
        first_name: z.string().trim().min(1).max(100),
        last_name: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(255),
        password: z.string().min(8, 'must be at least 8 characters').max(128),
    }),
});

export const portalsSchema = z.object({
    portals: z.array(z.object({ key: portalKey, enabled: z.boolean() })).min(1).max(20),
    // Wizard Portals step: one Member / Manager / Admin label for every enabled portal
    tier_labels: z.record(z.enum(TIERS), z.string().trim().max(100)).optional(),
});

export const labelsSchema = z.object({
    portals: z.array(z.object({
        key: portalKey,
        custom_label: z.string().trim().max(100).optional().nullable(),
        tier_labels: z.record(z.enum(TIERS), z.string().trim().max(100)).optional(),
    })).min(1).max(20),
});

export { employeesSchema } from '../services/userService.js';

// --- Public: create organization + first admin, return a session ---

export const signup = async (req, res) => {
    const { organization, admin } = req.body;

    const { user, org } = await withTransaction(async (db) => {
        const org = await createOrganization(db, organization);
        const dept = await db.query("SELECT id FROM departments WHERE tenant_id = $1 AND name = 'Administration'", [org.id]);
        const { user } = await createUserRecord(db, {
            tenantId: org.id,
            firstName: admin.first_name,
            lastName: admin.last_name,
            email: admin.email,
            portalKey: 'admin',
            departmentId: dept.rows[0]?.id ?? null,
            password: admin.password,
            mustChangePassword: false,
        });
        return { user, org };
    });

    res.status(201).json({
        success: true,
        token: await signToken(user.id),
        user: await buildSession(user.id),
    });
};

// --- Wizard steps (admin, onboarding not yet completed) ---

export const requireOnboardingIncomplete = async (req, res, next) => {
    const { rows } = await pool.query('SELECT completed FROM onboarding_state WHERE tenant_id = $1', [req.user.tenantId]);
    if (!rows[0] || rows[0].completed) {
        return res.status(409).json({ success: false, error: 'Onboarding is already complete' });
    }
    next();
};

const wizardState = async (tenantId) => {
    const [state, org, employees, departments] = await Promise.all([
        pool.query('SELECT current_step, completed FROM onboarding_state WHERE tenant_id = $1', [tenantId]),
        pool.query('SELECT id, name, slug, industry, size FROM organizations WHERE id = $1', [tenantId]),
        pool.query(`
            SELECT u.id, u.first_name, u.last_name, u.email, r.name AS portal_key, d.name AS department, upa.tier
            FROM users u
            JOIN roles r ON r.id = u.role_id
            LEFT JOIN departments d ON d.id = u.department_id
            LEFT JOIN user_portal_access upa ON upa.user_id = u.id
            WHERE u.tenant_id = $1
            ORDER BY u.created_at, u.id
        `, [tenantId]),
        pool.query('SELECT id, name FROM departments WHERE tenant_id = $1 ORDER BY name', [tenantId]),
    ]);
    return {
        step: state.rows[0]?.current_step,
        completed: state.rows[0]?.completed ?? false,
        organization: org.rows[0],
        portals: await getOrganizationPortals(tenantId),
        employees: employees.rows,
        departments: departments.rows,
    };
};

export const getState = async (req, res) => {
    res.json({ success: true, data: await wizardState(req.user.tenantId) });
};

export const updatePortals = async (req, res) => {
    await withTransaction(async (db) => {
        await setPortalsEnabled(db, req.user.tenantId, req.body.portals);
        if (req.body.tier_labels) await setTierLabels(db, req.user.tenantId, req.body.tier_labels);
        await advanceStep(db, req.user.tenantId, 'labels');
    });
    res.json({ success: true, data: await wizardState(req.user.tenantId) });
};

export const updateLabels = async (req, res) => {
    await withTransaction(async (db) => {
        await setPortalLabels(db, req.user.tenantId, req.body.portals);
        await advanceStep(db, req.user.tenantId, 'employees');
    });
    res.json({ success: true, data: await wizardState(req.user.tenantId) });
};

/**
 * Batch-create employees (manual rows or CSV). Valid rows are saved, invalid rows
 * are skipped and reported (UC2 alternative 8B). Temporary passwords are returned once.
 */
export const addEmployees = async (req, res) => {
    const tenantId = req.user.tenantId;
    const { created, rowErrors } = await importEmployees(tenantId, req.body.employees, async (db) => {
        await advanceStep(db, tenantId, 'review');
    });
    if (!created.length) {
        return res.status(400).json({ success: false, error: 'No valid rows; nothing was created', rowErrors });
    }
    res.status(201).json({ success: true, data: { created, rowErrors, state: await wizardState(tenantId) } });
};

// Skip adding employees for now (they can be added later from Employee Management)
export const skipEmployees = async (req, res) => {
    await advanceStep(pool, req.user.tenantId, 'review');
    res.json({ success: true, data: await wizardState(req.user.tenantId) });
};

export const complete = async (req, res) => {
    await pool.query(
        "UPDATE onboarding_state SET completed = true, current_step = 'done', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1",
        [req.user.tenantId]
    );
    res.json({ success: true, data: await buildSession(req.user.id) });
};
