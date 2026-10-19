import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { env } from '../config/env.js';
import { DUMMY_HASH, loginSchema } from './authController.js';
import { getOrganization, getSummary, listOrganizations } from '../services/platformService.js';

export const platformLoginSchema = loginSchema.pick({ email: true, password: true });

// Same message and timing as the tenant login; the token is platform-scoped.
export const platformLogin = async (req, res) => {
    const { email, password } = req.body;
    const { rows } = await pool.query(
        'SELECT id, name, email, status, password_hash FROM platform_admins WHERE LOWER(email) = LOWER($1)',
        [email]
    );
    const admin = rows[0];
    const valid = await bcrypt.compare(password, admin ? admin.password_hash : DUMMY_HASH);
    if (!admin || !valid || admin.status !== 'active') {
        return res.status(401).json({ success: false, error: 'Incorrect email or password.' });
    }
    const token = jwt.sign({ id: admin.id, scope: 'platform' }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
    res.json({ success: true, token, admin: { id: admin.id, name: admin.name, email: admin.email } });
};

export const organizationsQuerySchema = z.object({
    search: z.string().trim().max(100).optional(),
    status: z.enum(['all', 'completed', 'in_progress']).optional(),
});

export const listOrgs = async (req, res) => {
    res.json({ success: true, data: await listOrganizations(req.query) });
};

export const getOrg = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ success: false, error: 'Invalid organization id' });
    const org = await getOrganization(id);
    if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });
    res.json({ success: true, data: org });
};

export const summary = async (req, res) => {
    res.json({ success: true, data: await getSummary() });
};
