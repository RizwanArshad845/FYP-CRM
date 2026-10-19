import { httpError } from '../utils/tenant.js';
import {
    ACTIONS, FIELD_GROUPS, TIERS, eligibleAction, eligibleFieldGroup, isConfigurable,
} from '../policy/index.js';

export const DEFAULT_DEPARTMENTS = ['Administration', 'Sales', 'Customer Success', 'Finance', 'Human Resources'];
export const ONBOARDING_STEPS = ['portals', 'labels', 'employees', 'review', 'done'];

// First path segments the app uses itself; an organization slug must never equal one.
export const RESERVED_SLUGS = new Set([
    'api', 'login', 'signup', 'platform', 'onboarding', 'change-password', 'clock-in', 'dashboard', 'assets',
]);

const slugify = (name) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'org';

// Unique slug: "acme", then "acme-2", "acme-3", ...
export const uniqueSlug = async (db, name) => {
    const base = slugify(name);
    const { rows } = await db.query("SELECT slug FROM organizations WHERE slug = $1 OR slug LIKE $1 || '-%'", [base]);
    const taken = new Set([...rows.map((r) => r.slug), ...RESERVED_SLUGS]);
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

// The same tier labels on every enabled portal (the Admin portal only has the Admin tier).
// A label equal to the tier's own name, or blank, means "keep the default".
export const setTierLabels = async (db, tenantId, tierLabels) => {
    const clean = Object.fromEntries(
        Object.entries(tierLabels)
            .filter(([tier, label]) => TIERS.includes(tier) && typeof label === 'string' && label.trim() && label.trim() !== tier)
            .map(([tier, label]) => [tier, label.trim()])
    );
    const adminOnly = clean.Admin ? { Admin: clean.Admin } : {};
    await db.query(`
        UPDATE organization_portals op
        SET tier_labels = CASE WHEN pt.key = 'admin' THEN $2::jsonb ELSE $3::jsonb END, updated_at = CURRENT_TIMESTAMP
        FROM portal_types pt
        WHERE op.portal_type_id = pt.id AND op.tenant_id = $1 AND op.enabled
    `, [tenantId, JSON.stringify(adminOnly), JSON.stringify(clean)]);
};

// --- Permission dials ---------------------------------------------------------
// Per (portal, tier) restrictions on top of the fixed policy catalog. Only
// non-admin portals and Manager/Member tiers are configurable.

const CONFIGURABLE_TIERS = TIERS.filter((t) => isConfigurable('sales', t));

const orgPortals = async (db, tenantId) => {
    const { rows } = await db.query(`
        SELECT op.id, pt.key, COALESCE(op.custom_label, pt.label) AS label, op.enabled
        FROM organization_portals op JOIN portal_types pt ON pt.id = op.portal_type_id
        WHERE op.tenant_id = $1 ORDER BY pt.sort_order
    `, [tenantId]);
    return rows;
};

export const getPermissions = async (db, tenantId) => {
    const portals = (await orgPortals(db, tenantId)).filter((p) => p.enabled && p.key !== 'admin');
    const ids = portals.map((p) => p.id);
    const [actionRows, fieldRows] = await Promise.all([
        db.query('SELECT organization_portal_id, tier, action_key, allowed FROM portal_action_permissions WHERE organization_portal_id = ANY($1::int[])', [ids]),
        db.query('SELECT organization_portal_id, tier, field_group, visible FROM portal_field_visibility WHERE organization_portal_id = ANY($1::int[])', [ids]),
    ]);
    const lookup = (rows, keyCol, valCol) => new Map(rows.map((r) => [`${r.organization_portal_id}|${r.tier}|${r[keyCol]}`, r[valCol]]));
    const actionMap = lookup(actionRows.rows, 'action_key', 'allowed');
    const fieldMap = lookup(fieldRows.rows, 'field_group', 'visible');

    return portals.map((p) => ({
        key: p.key,
        label: p.label,
        tiers: CONFIGURABLE_TIERS.map((tier) => ({
            tier,
            actions: Object.entries(ACTIONS)
                .filter(([key]) => eligibleAction(key, p.key, tier))
                .map(([key, a]) => ({ key, label: a.label, allowed: actionMap.get(`${p.id}|${tier}|${key}`) !== false })),
            fields: Object.entries(FIELD_GROUPS)
                .filter(([key]) => eligibleFieldGroup(key, p.key))
                .map(([key, g]) => ({ key, label: g.label, visible: fieldMap.get(`${p.id}|${tier}|${key}`) !== false })),
        })),
    }));
};

// Upserts overrides. Rejects anything outside the catalog ceiling.
export const setPermissions = async (db, tenantId, entries) => {
    const byKey = new Map((await orgPortals(db, tenantId)).map((p) => [p.key, p]));
    for (const { portalKey, tier, actions = {}, fields = {} } of entries) {
        const portal = byKey.get(portalKey);
        if (!portal) throw httpError(400, `Unknown portal "${portalKey}"`);
        if (!isConfigurable(portalKey, tier)) throw httpError(400, `Permissions for ${portalKey} / ${tier} are fixed`);

        for (const [key, allowed] of Object.entries(actions)) {
            if (!eligibleAction(key, portalKey, tier)) {
                throw httpError(400, `Action "${key}" is not available to ${portalKey} / ${tier}`);
            }
            await db.query(`
                INSERT INTO portal_action_permissions (organization_portal_id, tier, action_key, allowed)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (organization_portal_id, tier, action_key)
                DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = CURRENT_TIMESTAMP
            `, [portal.id, tier, key, allowed]);
        }
        for (const [key, visible] of Object.entries(fields)) {
            if (!eligibleFieldGroup(key, portalKey)) {
                throw httpError(400, `Field group "${key}" is not available to ${portalKey}`);
            }
            await db.query(`
                INSERT INTO portal_field_visibility (organization_portal_id, tier, field_group, visible)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (organization_portal_id, tier, field_group)
                DO UPDATE SET visible = EXCLUDED.visible, updated_at = CURRENT_TIMESTAMP
            `, [portal.id, tier, key, visible]);
        }
    }
};
