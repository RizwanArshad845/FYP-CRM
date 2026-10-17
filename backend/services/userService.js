import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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

export const TIERS = ['Admin', 'Manager', 'Member'];

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
    if (existing.rows[0]) throw new ServiceError(409, `A user with email ${email} already exists`);

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
