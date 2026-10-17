import { z } from 'zod';
import pool, { withTransaction } from '../config/db.js';
import { createUserRecord } from '../services/userService.js';
import { buildSession, getOrganizationPortals } from '../services/sessionService.js';
import {
    advanceStep, createOrganization, setPortalLabels, setPortalsEnabled,
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
});

export const labelsSchema = z.object({
    portals: z.array(z.object({
        key: portalKey,
        custom_label: z.string().trim().max(100).optional().nullable(),
        tier_labels: z.record(z.enum(TIERS), z.string().trim().max(100)).optional(),
    })).min(1).max(20),
});

const employeeSchema = z.object({
    first_name: z.string().trim().min(1, 'first name is required').max(100),
    last_name: z.string().trim().min(1, 'last name is required').max(100),
    email: z.string().trim().email('invalid email').max(255),
    portal_key: portalKey,
    // Optional, case-insensitive ("manager" works for CSV); defaults to the portal's tier
    tier: z.preprocess(
        (v) => (typeof v === 'string' && v.trim() ? v.trim()[0].toUpperCase() + v.trim().slice(1).toLowerCase() : undefined),
        z.enum(TIERS, { message: 'tier must be Admin, Manager or Member' }).optional(),
    ),
    department: z.string().trim().max(100).optional().nullable(),
});

export const employeesSchema = z.object({
    employees: z.array(z.unknown()).min(1).max(200),
});

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
        token: signToken({ id: user.id, tenant_id: org.id }),
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
 * Batch-create employees (manual rows or CSV). All rows are validated first;
 * if any row fails, nothing is created and per-row errors are returned.
 * Temporary passwords are returned once and never stored in plain text.
 */
export const addEmployees = async (req, res) => {
    const tenantId = req.user.tenantId;
    const errors = [];
    const rows = [];
    const seenEmails = new Set();

    req.body.employees.forEach((raw, index) => {
        const parsed = employeeSchema.safeParse(raw);
        if (!parsed.success) {
            errors.push({ row: index + 1, error: parsed.error.issues.map((i) => i.message).join(', ') });
            return;
        }
        const email = parsed.data.email.toLowerCase();
        if (seenEmails.has(email)) {
            errors.push({ row: index + 1, error: `duplicate email ${email} in this batch` });
            return;
        }
        seenEmails.add(email);
        rows.push({ index, ...parsed.data, email });
    });

    const [portals, departments, existing] = await Promise.all([
        getOrganizationPortals(tenantId),
        pool.query('SELECT id, LOWER(name) AS name FROM departments WHERE tenant_id = $1', [tenantId]),
        pool.query('SELECT LOWER(email) AS email FROM users WHERE LOWER(email) = ANY($1::text[])', [[...seenEmails]]),
    ]);
    const enabledPortals = new Set(portals.filter((p) => p.enabled).map((p) => p.key));
    const deptByName = new Map(departments.rows.map((d) => [d.name, d.id]));
    const takenEmails = new Set(existing.rows.map((r) => r.email));

    for (const row of rows) {
        if (!enabledPortals.has(row.portal_key)) {
            errors.push({ row: row.index + 1, error: `portal "${row.portal_key}" is not enabled` });
        }
        if (takenEmails.has(row.email)) {
            errors.push({ row: row.index + 1, error: `a user with email ${row.email} already exists` });
        }
        if (row.department && !deptByName.has(row.department.toLowerCase())) {
            errors.push({ row: row.index + 1, error: `unknown department "${row.department}"` });
        }
    }

    if (errors.length) {
        errors.sort((a, b) => a.row - b.row);
        return res.status(400).json({ success: false, error: 'Some rows are invalid; nothing was created', rowErrors: errors });
    }

    const created = await withTransaction(async (db) => {
        const out = [];
        for (const row of rows) {
            const { user, tempPassword } = await createUserRecord(db, {
                tenantId,
                firstName: row.first_name,
                lastName: row.last_name,
                email: row.email,
                portalKey: row.portal_key,
                tier: row.tier,
                departmentId: row.department ? deptByName.get(row.department.toLowerCase()) : null,
                mustChangePassword: true,
            });
            out.push({ ...user, portal_key: row.portal_key, tempPassword });
        }
        await advanceStep(db, tenantId, 'review');
        return out;
    });

    res.status(201).json({ success: true, data: { created, state: await wizardState(tenantId) } });
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
