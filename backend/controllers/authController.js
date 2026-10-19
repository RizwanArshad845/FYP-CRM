import { z } from 'zod';
import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { buildSession } from '../services/sessionService.js';
import { BCRYPT_ROUNDS } from '../services/userService.js';

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', BCRYPT_ROUNDS);

export const loginSchema = z.object({
    email: z.string().trim().min(1).max(255),
    password: z.string().min(1).max(128),
    // Slug from an organization's own login URL (/<slug>/login); optional on /login
    organization: z.string().trim().min(1).max(100).optional(),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8, 'must be at least 8 characters').max(128),
});

// Claims carry user, organization, portal and tier (plan 5.1). They are informational:
// protect still reloads the user from the database on every request.
export const signToken = async (userId, db = pool) => {
    const { rows } = await db.query(`
        SELECT u.id, u.tenant_id, r.name AS portal, upa.tier, upa.organization_portal_id
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN user_portal_access upa ON upa.user_id = u.id
        WHERE u.id = $1
    `, [userId]);
    const u = rows[0];
    return jwt.sign(
        { id: u.id, tenantId: u.tenant_id, portal: u.portal, tier: u.tier, organizationPortalId: u.organization_portal_id },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN }
    );
};

// Public: the organization behind a /<slug>/login URL. Name and slug only.
export const getOrganizationBySlug = async (req, res) => {
    const { rows } = await pool.query('SELECT name, slug FROM organizations WHERE slug = $1', [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Organization not found' });
    res.json({ success: true, data: rows[0] });
};

// Login user and return JWT plus the session profile
export const login = async (req, res) => {
    const { email, password, organization } = req.body;
    const result = await pool.query(`
        SELECT u.id, u.tenant_id, u.status, u.password_hash, o.slug
        FROM users u JOIN organizations o ON o.id = u.tenant_id
        WHERE LOWER(u.email) = LOWER($1)
    `, [email]);
    const user = result.rows[0];

    // Same message and similar timing for unknown email, wrong password, or an account
    // that belongs to a different organization than the login URL's.
    const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !valid || (organization && organization !== user.slug)) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    if (user.status !== 'active') {
        return res.status(403).json({ success: false, error: 'Account is deactivated. Please contact your administrator.' });
    }

    res.json({ success: true, token: await signToken(user.id), user: await buildSession(user.id) });
};

// Current user profile from token
export const getMe = async (req, res) => {
    const session = await buildSession(req.user.id);
    if (!session) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: session });
};

// Replace the current password; clears the forced-change flag
export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
        return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    }
    if (currentPassword === newPassword) {
        return res.status(400).json({ success: false, error: 'New password must be different from the current one' });
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query(
        'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [hash, req.user.id]
    );
    res.json({ success: true, data: await buildSession(req.user.id) });
};
