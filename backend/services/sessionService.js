import pool from '../config/db.js';

// Portal config for an org: fixed catalog + the org's enable flag and labels.
export const getOrganizationPortals = async (tenantId, db = pool) => {
    const { rows } = await db.query(`
        SELECT pt.key, pt.label AS default_label, pt.description, pt.default_tier, pt.sort_order,
               op.enabled, op.custom_label, op.tier_labels
        FROM portal_types pt
        JOIN organization_portals op ON op.portal_type_id = pt.id AND op.tenant_id = $1
        ORDER BY pt.sort_order
    `, [tenantId]);
    return rows.map((r) => ({
        key: r.key,
        label: r.custom_label || r.default_label,
        defaultLabel: r.default_label,
        customLabel: r.custom_label,
        description: r.description,
        defaultTier: r.default_tier,
        enabled: r.enabled,
        tierLabels: r.tier_labels || {},
    }));
};

// Everything the frontend needs about the signed-in user and their organization.
export const buildSession = async (userId, db = pool) => {
    const { rows } = await db.query(`
        SELECT u.id, u.first_name, u.last_name, u.email, u.status, u.role_id, u.department_id,
               u.tenant_id, u.must_change_password,
               r.name AS role, d.name AS department, upa.tier,
               o.id AS org_id, o.name AS org_name, o.slug AS org_slug,
               COALESCE(os.completed, true) AS onboarding_completed, os.current_step
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN user_portal_access upa ON upa.user_id = u.id
        JOIN organizations o ON o.id = u.tenant_id
        LEFT JOIN onboarding_state os ON os.tenant_id = u.tenant_id
        WHERE u.id = $1
    `, [userId]);
    const u = rows[0];
    if (!u) return null;

    return {
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        status: u.status,
        role: u.role,
        role_id: u.role_id,
        department: u.department,
        department_id: u.department_id,
        tier: u.tier,
        mustChangePassword: u.must_change_password,
        onboardingCompleted: u.onboarding_completed,
        onboardingStep: u.current_step,
        organization: { id: u.org_id, name: u.org_name, slug: u.org_slug },
        portals: await getOrganizationPortals(u.tenant_id, db),
    };
};
