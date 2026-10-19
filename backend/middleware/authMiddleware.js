import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { env } from '../config/env.js';

const PASSWORD_CHANGE_ALLOWED = new Set(['/api/auth/me', '/api/auth/change-password']);

// Protect routes - verify JWT and attach the user profile loaded from the DB
// (role is never trusted from the token itself).
export const protect = async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
        return res.status(401).json({ success: false, error: 'Not authorized, no token' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, env.JWT_SECRET);
    } catch {
        return res.status(401).json({ success: false, error: 'Not authorized, token failed' });
    }
    // Platform admin tokens never open tenant routes (plan 4.2)
    if (decoded.scope === 'platform') {
        return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    try {
        const result = await pool.query(`
            SELECT u.id, u.email, u.role_id, u.status, u.tenant_id, u.must_change_password, r.name as role,
                   COALESCE(upa.tier, pt.default_tier, 'Member') AS tier,
                   upa.organization_portal_id, COALESCE(op.enabled, true) AS portal_enabled
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN user_portal_access upa ON upa.user_id = u.id
            LEFT JOIN organization_portals op ON op.id = upa.organization_portal_id
            LEFT JOIN portal_types pt ON pt.key = r.name
            WHERE u.id = $1
        `, [decoded.id]);

        const user = result.rows[0];
        if (!user || user.status !== 'active') {
            return res.status(401).json({ success: false, error: 'User no longer exists or is inactive' });
        }

        // Temporary passwords must be replaced before anything else is allowed.
        if (user.must_change_password && !PASSWORD_CHANGE_ALLOWED.has(req.baseUrl + req.path)) {
            return res.status(403).json({
                success: false,
                code: 'PASSWORD_CHANGE_REQUIRED',
                error: 'You must change your password before continuing',
            });
        }

        // A portal the organization switched off grants nothing beyond the session itself.
        if (!user.portal_enabled && !PASSWORD_CHANGE_ALLOWED.has(req.baseUrl + req.path)) {
            return res.status(403).json({
                success: false,
                code: 'PORTAL_DISABLED',
                error: 'Your portal is disabled for this organization',
            });
        }

        req.user = {
            id: user.id,
            email: user.email,
            role_id: user.role_id,
            role: user.role,
            tier: user.tier,
            tenantId: user.tenant_id,
            organizationPortalId: user.organization_portal_id,
        };
        next();
    } catch (error) {
        next(error);
    }
};
