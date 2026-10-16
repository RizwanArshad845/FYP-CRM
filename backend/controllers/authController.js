import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Login user and return JWT
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Check if user exists
        const result = await pool.query(`
            SELECT u.*, r.name as role 
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE LOWER(u.email) = LOWER($1)
        `, [email]);

        // 1. Check if user exists
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const user = result.rows[0];
        
        // 1.5 Check if account is active
        if (user.status !== 'active') {
            return res.status(403).json({ success: false, error: 'Account is deactivated. Please contact your administrator.' });
        }

        // 2. Check password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        // 3. Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'crm_fallback_secret',
            { expiresIn: '24h' }
        );

        // 4. Return user info (excluding password)
        const { password_hash, ...userProfile } = user;
        res.json({
            success: true,
            token,
            user: userProfile
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// Get current user profile from token
export const getMe = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.first_name, u.last_name, u.email, u.status, r.name as role, d.name as department
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.id = $1
        `, [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};
