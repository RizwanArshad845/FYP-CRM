import pool from '../config/db.js';

// Platform administrator queries (plan 4.3). Hard rule: read organizations,
// onboarding_state and organization_portals, and only COUNT(*) users and
// user_portal_access. Never select a column from users, clients or any other
// business table, so no names, emails, client data, salaries or notes leave here.

const ORG_FIELDS = `
    o.id, o.name, o.slug, o.industry, o.size, o.created_at,
    json_build_object('completed', COALESCE(os.completed, false), 'current_step', os.current_step) AS onboarding,
    COALESCE((
        SELECT json_agg(json_build_object('key', pt.key, 'custom_label', op.custom_label) ORDER BY pt.sort_order)
        FROM organization_portals op JOIN portal_types pt ON pt.id = op.portal_type_id
        WHERE op.tenant_id = o.id AND op.enabled
    ), '[]'::json) AS enabled_portals,
    json_build_object(
        'active', (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = o.id AND u.status = 'active'),
        'total', (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = o.id)
    ) AS employee_count`;

/** One row per organization; `search` matches name or slug, `status` is completed / in_progress. */
export const listOrganizations = async ({ search, status } = {}) => {
    const params = [];
    const where = [];
    if (search) {
        params.push(`%${search}%`);
        where.push(`(o.name ILIKE $${params.length} OR o.slug ILIKE $${params.length})`);
    }
    if (status === 'completed') where.push('COALESCE(os.completed, false)');
    if (status === 'in_progress') where.push('NOT COALESCE(os.completed, false)');
    const { rows } = await pool.query(`
        SELECT ${ORG_FIELDS}
        FROM organizations o
        LEFT JOIN onboarding_state os ON os.tenant_id = o.id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY o.created_at DESC, o.id DESC
    `, params);
    return rows;
};

/** The same fields for one organization, plus every portal type with its state and head count. */
export const getOrganization = async (id) => {
    const { rows } = await pool.query(`
        SELECT ${ORG_FIELDS}
        FROM organizations o
        LEFT JOIN onboarding_state os ON os.tenant_id = o.id
        WHERE o.id = $1
    `, [id]);
    if (!rows[0]) return null;
    const portals = await pool.query(`
        SELECT pt.key, pt.label AS default_label, COALESCE(op.enabled, false) AS enabled, op.custom_label,
               (SELECT COUNT(*)::int FROM user_portal_access upa WHERE upa.organization_portal_id = op.id) AS employee_count
        FROM portal_types pt
        LEFT JOIN organization_portals op ON op.portal_type_id = pt.id AND op.tenant_id = $1
        ORDER BY pt.sort_order
    `, [id]);
    return { ...rows[0], portals: portals.rows };
};

export const getSummary = async () => {
    const { rows } = await pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE COALESCE(os.completed, false))::int AS completed,
               COUNT(*) FILTER (WHERE NOT COALESCE(os.completed, false))::int AS onboarding
        FROM organizations o
        LEFT JOIN onboarding_state os ON os.tenant_id = o.id
    `);
    return rows[0];
};
