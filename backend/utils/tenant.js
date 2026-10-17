import pool from '../config/db.js';

// --- Row scope by tier --------------------------------------------------------
// Portal (role) decides which features a user has; tier decides whose records:
//   Member  -> only their own
//   Manager -> their team (users in the same portal family)
//   Admin   -> the whole organization
// This meaning is fixed and identical for every organization.

export const TIERS = ['Admin', 'Manager', 'Member'];
const TIER_RANK = { Member: 1, Manager: 2, Admin: 3 };

export const PORTAL_FAMILY = {
    admin: ['admin'],
    sales: ['sales', 'sales_manager'],
    sales_manager: ['sales', 'sales_manager'],
    cst: ['cst', 'cst_manager'],
    cst_manager: ['cst', 'cst_manager'],
    finance: ['finance'],
};

export const scopeOf = (user) => (user.tier === 'Admin' ? 'org' : user.tier === 'Manager' ? 'team' : 'own');

/** Manager or Admin tier: may act on records beyond their own. */
export const isManager = (user) => (TIER_RANK[user.tier] ?? 0) >= TIER_RANK.Manager;

export const httpError = (status, message) => Object.assign(new Error(message), { status });

/**
 * SQL fragment restricting `ownerCol` to what the user's tier may see, with
 * placeholders numbered from `nextParam`. `ownerCol` is a trusted column reference.
 */
export const ownerScope = (user, ownerCol, nextParam) => {
    const scope = scopeOf(user);
    if (scope === 'org') return { sql: '', params: [] };
    if (scope === 'own') return { sql: ` AND ${ownerCol} = $${nextParam}`, params: [user.id] };
    return {
        sql: ` AND ${ownerCol} IN (SELECT tu.id FROM users tu JOIN roles tr ON tr.id = tu.role_id
                WHERE tu.tenant_id = $${nextParam} AND tr.name = ANY($${nextParam + 1}::text[]))`,
        params: [user.tenantId, PORTAL_FAMILY[user.role] ?? [user.role]],
    };
};

// Throws 400 unless every given user id belongs to the tenant. Null/undefined ids are skipped.
export const assertUsersInTenant = async (tenantId, ids, db = pool) => {
    const wanted = [...new Set(ids.filter((id) => id != null && id !== '').map(Number))];
    if (!wanted.length) return;
    const { rows } = await db.query('SELECT id FROM users WHERE tenant_id = $1 AND id = ANY($2::int[])', [tenantId, wanted]);
    if (rows.length !== wanted.length) throw httpError(400, 'Referenced user does not exist in this organization');
};

/** Throws unless the target user is within the actor's tier scope (self / team / org). */
export const assertUserInScope = async (user, targetId, db = pool) => {
    if (targetId == null || targetId === '') return;
    const id = Number(targetId);
    if (id === user.id) return;
    if (scopeOf(user) === 'own') throw httpError(403, 'You can only act on your own records');
    const scope = ownerScope(user, 'u.id', 3);
    const { rows } = await db.query(
        `SELECT 1 FROM users u WHERE u.id = $1 AND u.tenant_id = $2${scope.sql}`,
        [id, user.tenantId, ...scope.params]
    );
    if (!rows[0]) throw httpError(400, 'Referenced user is not in your team or organization');
};

// Throws 404 unless the client exists in the tenant. Returns the row.
export const getClientInTenant = async (tenantId, clientId, db = pool) => {
    const { rows } = await db.query('SELECT * FROM clients WHERE id = $1 AND tenant_id = $2', [clientId, tenantId]);
    if (!rows[0]) throw httpError(404, 'Client not found');
    return rows[0];
};

// Clients are the team's shared pipeline: Managers/Admins see all of them;
// Members only the clients assigned to them in their portal family.
export const memberClientColumn = (user) => {
    const family = PORTAL_FAMILY[user.role] ?? [];
    if (family.includes('cst')) return 'cst_agent_id';
    if (family.includes('sales')) return 'sales_agent_id';
    return null; // admin / finance portals have no assigned clients: read access to all
};

export const assertClientAccess = (user, client) => {
    if (isManager(user)) return;
    const col = memberClientColumn(user);
    if (!col || client[col] === user.id) return;
    throw httpError(403, 'You do not have access to this client');
};
