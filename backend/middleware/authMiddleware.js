import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

// Protect routes - verify JWT and attach user profile
export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'crm_fallback_secret');

            // Get user from token along with their role name
            const result = await pool.query(`
                SELECT u.id, u.email, u.role_id, r.name as role 
                FROM users u 
                JOIN roles r ON u.role_id = r.id 
                WHERE u.id = $1
            `, [decoded.id]);

            if (result.rows.length === 0) {
                return res.status(401).json({ success: false, error: 'User no longer exists' });
            }

            req.user = result.rows[0];
            next();

        } catch (error) {
            console.error('Auth middleware error:', error);
            res.status(401).json({ success: false, error: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ success: false, error: 'Not authorized, no token' });
    }
};

// Grant access to specific roles
export const authorize = (...roles) => {
    return async (req, res, next) => {
        try {
            const result = await pool.query('SELECT r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1', [req.user.id]);
            const role = result.rows[0].role;

            if (!roles.includes(role)) {
                return res.status(403).json({ success: false, error: `Role ${role} is not authorized to access this route` });
            }
            next();
        } catch (error) {
            res.status(500).json({ success: false, error: 'Server error check role' });
        }
    };
};
