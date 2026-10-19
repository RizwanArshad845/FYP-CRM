import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { env } from '../config/env.js';

// Guards /api/platform/*: only platform-scoped tokens, and the admin is reloaded
// on every request. Tenant tokens never pass (and protect rejects platform tokens).
export const protectPlatform = async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) return res.status(401).json({ success: false, error: 'Not authorized, no token' });

    let decoded;
    try {
        decoded = jwt.verify(token, env.JWT_SECRET);
    } catch {
        return res.status(401).json({ success: false, error: 'Not authorized, token failed' });
    }
    if (decoded.scope !== 'platform') return res.status(401).json({ success: false, error: 'Not authorized' });

    try {
        const { rows } = await pool.query('SELECT id, name, email, status FROM platform_admins WHERE id = $1', [decoded.id]);
        const admin = rows[0];
        if (!admin || admin.status !== 'active') {
            return res.status(401).json({ success: false, error: 'Platform admin no longer exists or is inactive' });
        }
        req.platformAdmin = { id: admin.id, name: admin.name, email: admin.email };
        next();
    } catch (error) {
        next(error);
    }
};
