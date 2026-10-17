import pool from '../config/db.js';
import { httpError, scopeOf } from '../utils/tenant.js';
import { ACTIONS, FIELD_GROUPS, TIERS, TIER_RANK } from './catalog.js';

// The single authorization chokepoint. Every route guard, field filter and (later)
// AI tool call asks this module, never role strings directly.

export { ACTIONS, FIELD_GROUPS, TIERS, TIER_RANK };
export {
    ownerScope, assertClientAccess, assertUsersInTenant, assertUserInScope, getClientInTenant,
    memberClientColumn, isManager,
} from '../utils/tenant.js';

export const scopeFor = scopeOf;

const atLeast = (tier, minTier) => (TIER_RANK[tier] ?? 0) >= TIER_RANK[minTier];

// Admin tier and the admin portal are never restricted by org overrides,
// so an organization can't lock itself out of its own settings.
export const isConfigurable = (portalKey, tier) => portalKey !== 'admin' && tier !== 'Admin';

/** Catalog ceiling: may this portal + tier ever perform the action? */
export const eligibleAction = (key, portalKey, tier) => {
    const a = ACTIONS[key];
    return !!a && a.portals.includes(portalKey) && atLeast(tier, a.minTier);
};

/** Catalog ceiling: may this portal ever see the field group? */
export const eligibleFieldGroup = (key, portalKey) => {
    const g = FIELD_GROUPS[key];
    return !!g && (!g.portals || g.portals.includes(portalKey));
};

// One query per request for the caller's overrides, memoized on the user object.
const overrideCache = new WeakMap();
const overridesFor = (user, db = pool) => {
    if (!overrideCache.has(user)) {
        const load = async () => {
            if (!user.organizationPortalId || !isConfigurable(user.role, user.tier)) {
                return { actions: new Map(), fields: new Map() };
            }
            const [actions, fields] = await Promise.all([
                db.query('SELECT action_key, allowed FROM portal_action_permissions WHERE organization_portal_id = $1 AND tier = $2',
                    [user.organizationPortalId, user.tier]),
                db.query('SELECT field_group, visible FROM portal_field_visibility WHERE organization_portal_id = $1 AND tier = $2',
                    [user.organizationPortalId, user.tier]),
            ]);
            return {
                actions: new Map(actions.rows.map((r) => [r.action_key, r.allowed])),
                fields: new Map(fields.rows.map((r) => [r.field_group, r.visible])),
            };
        };
        overrideCache.set(user, load());
    }
    return overrideCache.get(user);
};

export const can = async (user, actionKey) => {
    if (!ACTIONS[actionKey]) throw new Error(`Unknown action "${actionKey}"`);
    if (!user || !eligibleAction(actionKey, user.role, user.tier)) return false;
    const { actions } = await overridesFor(user);
    return actions.get(actionKey) !== false;
};

/** Express guard: 403 unless the caller may perform `actionKey`. Runs after `protect`. */
export const allow = (actionKey) => {
    if (!ACTIONS[actionKey]) throw new Error(`Unknown action "${actionKey}"`);
    return async (req, res, next) => {
        if (await can(req.user, actionKey)) return next();
        const { portals, minTier } = ACTIONS[actionKey];
        const tierTooLow = req.user && portals.includes(req.user.role) && !atLeast(req.user.tier, minTier);
        next(httpError(403, tierTooLow
            ? `This action requires the ${minTier} tier or above`
            : 'You do not have permission to perform this action'));
    };
};

/** Every action the user may currently perform (for hiding UI the server would reject). */
export const allowedActions = async (user) => {
    const keys = Object.keys(ACTIONS).filter((k) => eligibleAction(k, user.role, user.tier));
    const { actions } = await overridesFor(user);
    return keys.filter((k) => actions.get(k) !== false);
};

/** Column names the user may not see for an object type. */
export const hiddenColumns = async (user, objectType) => {
    const { fields } = await overridesFor(user);
    return Object.entries(FIELD_GROUPS)
        .filter(([key, g]) => g.objectType === objectType
            && (!eligibleFieldGroup(key, user.role) || fields.get(key) === false))
        .flatMap(([, g]) => g.columns);
};

/** Strips hidden columns from a row or an array of rows. */
export const applyFieldVisibility = async (user, objectType, rows) => {
    const hidden = await hiddenColumns(user, objectType);
    if (!hidden.length) return rows;
    const strip = (row) => {
        if (!row) return row;
        const copy = { ...row };
        for (const col of hidden) delete copy[col];
        return copy;
    };
    return Array.isArray(rows) ? rows.map(strip) : strip(rows);
};
