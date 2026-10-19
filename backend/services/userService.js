import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import pool, { withTransaction } from '../config/db.js';
import { TIERS } from '../policy/catalog.js';
import { getOrganizationPortals } from './sessionService.js';

export const BCRYPT_ROUNDS = 10;

export class ServiceError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// 12 chars from an unambiguous alphabet; shown to the admin once, never stored in plain text.
export const generateTempPassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(12);
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
};

// Resolves a portal key (== role name) to the role and the org's portal row.
// Rejects portals the organization has disabled.
export const resolvePortal = async (client, tenantId, portalKey) => {
    const { rows } = await client.query(`
        SELECT r.id AS role_id, op.id AS organization_portal_id, op.enabled, pt.default_tier
        FROM portal_types pt
        JOIN roles r ON r.name = pt.key
        JOIN organization_portals op ON op.portal_type_id = pt.id AND op.tenant_id = $1
        WHERE pt.key = $2
    `, [tenantId, portalKey]);
    const portal = rows[0];
    if (!portal) throw new ServiceError(400, `Unknown portal "${portalKey}"`);
    if (!portal.enabled) throw new ServiceError(400, `The ${portalKey} portal is not enabled for this organization`);
    return portal;
};

export const portalKeyForRoleId = async (client, roleId) => {
    const { rows } = await client.query('SELECT name FROM roles WHERE id = $1', [roleId]);
    if (!rows[0]) throw new ServiceError(400, 'Invalid role');
    return rows[0].name;
};


// The tier for a portal assignment: the Admin portal is always Admin tier;
// elsewhere the chosen tier, or the portal's default.
export const resolveTier = (portalKey, portal, tier) => {
    if (portalKey === 'admin') return 'Admin';
    if (tier == null || tier === '') return portal.default_tier;
    if (!TIERS.includes(tier)) throw new ServiceError(400, `Invalid tier "${tier}"`);
    return tier;
};

/**
 * Creates a user inside the given transaction client, plus their portal access row.
 * With no password, a temporary one is generated and returned (once) as `tempPassword`.
 */
export const createUserRecord = async (client, {
    tenantId, firstName, lastName, email, portalKey, tier, departmentId = null,
    password, baseSalary = 0, mustChangePassword = true,
}) => {
    const portal = await resolvePortal(client, tenantId, portalKey);
    const finalTier = resolveTier(portalKey, portal, tier);

    if (departmentId != null) {
        const dept = await client.query('SELECT 1 FROM departments WHERE id = $1 AND tenant_id = $2', [departmentId, tenantId]);
        if (!dept.rows[0]) throw new ServiceError(400, 'Invalid department');
    }

    const existing = await client.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows[0]) throw new ServiceError(409, 'An account with this email already exists.');

    const tempPassword = password ? null : generateTempPassword();
    const passwordHash = await bcrypt.hash(password || tempPassword, BCRYPT_ROUNDS);

    const { rows } = await client.query(`
        INSERT INTO users (tenant_id, first_name, last_name, email, password_hash, role_id, department_id,
                           status, base_salary, must_change_password)
        VALUES ($1, $2, $3, LOWER($4), $5, $6, $7, 'active', $8, $9)
        RETURNING id, first_name, last_name, email
    `, [tenantId, firstName, lastName, email, passwordHash, portal.role_id, departmentId, baseSalary, mustChangePassword]);

    await client.query(`
        INSERT INTO user_portal_access (tenant_id, user_id, organization_portal_id, tier)
        VALUES ($1, $2, $3, $4)
    `, [tenantId, rows[0].id, portal.organization_portal_id, finalTier]);

    return { user: { ...rows[0], tier: finalTier }, tempPassword };
};

// Keeps user_portal_access in sync when an admin changes someone's portal or tier.
// Without an explicit tier, the current tier is kept if the portal is unchanged.
export const syncPortalAccess = async (client, tenantId, userId, portalKey, tier) => {
    const portal = await resolvePortal(client, tenantId, portalKey);
    let wanted = tier;
    if (wanted == null || wanted === '') {
        const current = await client.query(
            'SELECT tier FROM user_portal_access WHERE user_id = $1 AND organization_portal_id = $2',
            [userId, portal.organization_portal_id]
        );
        wanted = current.rows[0]?.tier;
    }
    const finalTier = resolveTier(portalKey, portal, wanted);
    await client.query(`
        INSERT INTO user_portal_access (tenant_id, user_id, organization_portal_id, tier)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE
        SET organization_portal_id = EXCLUDED.organization_portal_id, tier = EXCLUDED.tier
    `, [tenantId, userId, portal.organization_portal_id, finalTier]);
    return { ...portal, tier: finalTier };
};

// --- Employee batch import (onboarding wizard and Employee Management) ---------

const employeeSchema = z.object({
    first_name: z.string().trim().min(1, 'first name is required').max(100),
    last_name: z.string().trim().min(1, 'last name is required').max(100),
    email: z.string().trim().email('invalid email').max(255),
    portal_key: z.string().trim().min(1).max(50),
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

/**
 * Validates every row, then creates the valid ones in one transaction and skips the
 * rest. Returns { created (with one-time tempPassword), rowErrors [{ row, error }] },
 * rows numbered from 1. `afterCreate(db)` runs in the same transaction when any row is saved.
 */
export const importEmployees = async (tenantId, rawRows, afterCreate) => {
    const rowErrors = [];
    const rows = [];
    const seenEmails = new Set();

    rawRows.forEach((raw, index) => {
        const parsed = employeeSchema.safeParse(raw);
        if (!parsed.success) {
            rowErrors.push({ row: index + 1, error: parsed.error.issues.map((i) => i.message).join(', ') });
            return;
        }
        const email = parsed.data.email.toLowerCase();
        if (seenEmails.has(email)) {
            rowErrors.push({ row: index + 1, error: `duplicate email ${email} in this batch` });
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

    const valid = rows.filter((row) => {
        const problems = [];
        if (!enabledPortals.has(row.portal_key)) problems.push(`portal "${row.portal_key}" is not enabled`);
        if (takenEmails.has(row.email)) problems.push(`a user with email ${row.email} already exists`);
        if (row.department && !deptByName.has(row.department.toLowerCase())) problems.push(`unknown department "${row.department}"`);
        if (problems.length) rowErrors.push({ row: row.index + 1, error: problems.join(', ') });
        return !problems.length;
    });
    rowErrors.sort((a, b) => a.row - b.row);
    if (!valid.length) return { created: [], rowErrors };

    const created = await withTransaction(async (db) => {
        const out = [];
        for (const row of valid) {
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
        if (afterCreate) await afterCreate(db);
        return out;
    });
    return { created, rowErrors };
};
