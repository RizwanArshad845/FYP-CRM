import { httpError } from '../utils/tenant.js';
import { TIERS } from '../policy/catalog.js';

export const DEFAULT_DEPARTMENTS = ['Administration', 'Sales', 'Customer Success', 'Finance', 'Human Resources'];
export const ONBOARDING_STEPS = ['portals', 'labels', 'employees', 'review', 'done'];

const slugify = (name) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'org';

// Unique slug: "acme", then "acme-2", "acme-3", ...
export const uniqueSlug = async (db, name) => {
    const base = slugify(name);
    const { rows } = await db.query("SELECT slug FROM organizations WHERE slug = $1 OR slug LIKE $1 || '-%'", [base]);
    const taken = new Set(rows.map((r) => r.slug));
    if (!taken.has(base)) return base;
    for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
};

// Creates the org with every catalog portal enabled, default departments and onboarding state.
export const createOrganization = async (db, { name, industry, size }) => {
    const slug = await uniqueSlug(db, name);
    const org = (await db.query(
        'INSERT INTO organizations (name, slug, industry, size) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, slug, industry || null, size || null]
    )).rows[0];

    await db.query(
        'INSERT INTO organization_portals (tenant_id, portal_type_id) SELECT $1, id FROM portal_types',
        [org.id]
    );
    await db.query(
        'INSERT INTO departments (tenant_id, name) SELECT $1, unnest($2::text[])',
        [org.id, DEFAULT_DEPARTMENTS]
    );
    await db.query("INSERT INTO onboarding_state (tenant_id, current_step) VALUES ($1, 'portals')", [org.id]);
    return org;
};

// Moves the wizard forward to `step` (never backwards).
export const advanceStep = async (db, tenantId, step) => {
    await db.query(`
        UPDATE onboarding_state
        SET current_step = $2, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1 AND array_position($3::text[], current_step) < array_position($3::text[], $2)
    `, [tenantId, step, ONBOARDING_STEPS]);
};

// Enable/disable portals. Admin is always on; a portal with active users can't be turned off.
export const setPortalsEnabled = async (db, tenantId, portals) => {
    for (const { key, enabled } of portals) {
        if (key === 'admin' && !enabled) throw httpError(400, 'The Admin portal cannot be disabled');
        if (!enabled) {
            const inUse = await db.query(`
                SELECT COUNT(*)::int AS n FROM users u
                JOIN roles r ON r.id = u.role_id
                WHERE u.tenant_id = $1 AND r.name = $2 AND u.status = 'active'
            `, [tenantId, key]);
            if (inUse.rows[0].n > 0) {
                throw httpError(409, `Cannot disable the ${key} portal while ${inUse.rows[0].n} active employee(s) use it`);
            }
        }
        const result = await db.query(`
            UPDATE organization_portals op SET enabled = $3, updated_at = CURRENT_TIMESTAMP
            FROM portal_types pt
            WHERE op.portal_type_id = pt.id AND op.tenant_id = $1 AND pt.key = $2
        `, [tenantId, key, enabled]);
        if (!result.rowCount) throw httpError(400, `Unknown portal "${key}"`);
    }
};

// Display-only labels: portal name and per-tier names. Never changes permissions.
export const setPortalLabels = async (db, tenantId, portals) => {
    for (const { key, custom_label, tier_labels } of portals) {
        const cleanTiers = Object.fromEntries(
            Object.entries(tier_labels || {})
                .filter(([tier, label]) => TIERS.includes(tier) && typeof label === 'string' && label.trim())
                .map(([tier, label]) => [tier, label.trim()])
        );
        const result = await db.query(`
            UPDATE organization_portals op
            SET custom_label = NULLIF($3, ''), tier_labels = $4::jsonb, updated_at = CURRENT_TIMESTAMP
            FROM portal_types pt
            WHERE op.portal_type_id = pt.id AND op.tenant_id = $1 AND pt.key = $2
        `, [tenantId, key, (custom_label || '').trim(), JSON.stringify(cleanTiers)]);
        if (!result.rowCount) throw httpError(400, `Unknown portal "${key}"`);
    }
};
