import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';

import userRoutes from './routes/userRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import cstRoutes from './routes/cstRoutes.js';
import salesRoutes from './routes/salesRoutes.js';
import cstManagerRoutes from './routes/cstManagerRoutes.js';
import salesManagerRoutes from './routes/salesManagerRoutes.js';
import financeRoutes from './routes/financeRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import authRoutes from './routes/authRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import notepadRoutes from './routes/notepadRoutes.js';
import concernsRoutes from './routes/concernsRoutes.js';
import templatesRoutes from './routes/templatesRoutes.js';
import boardRoutes from './routes/boardRoutes.js';
import onboardingRoutes from './routes/onboardingRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import platformRoutes from './routes/platformRoutes.js';
import { protect } from './middleware/authMiddleware.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

// Vercel sits behind a proxy; needed for correct client IPs in rate limiting.
app.set('trust proxy', 1);
app.use(helmet());
// Same-origin on Vercel needs no CORS; ALLOWED_ORIGINS covers a split dev/preview setup.
app.use(cors({ origin: env.ALLOWED_ORIGINS.length ? env.ALLOWED_ORIGINS : false }));
app.use(express.json({ limit: '1mb' }));

// Brute-force protection for credential and signup endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    message: { success: false, error: 'Too many attempts, please try again later' },
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Public (each router protects its own non-public routes)
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/change-password', authLimiter);
// Organization lookup for /<slug>/login pages: public, so limit enumeration
app.use('/api/auth/organization', rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    message: { success: false, error: 'Too many requests, please try again later' },
}));
app.use('/api/auth', authRoutes);
app.use('/api/onboarding/organization', authLimiter);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/platform/auth/login', authLimiter);
app.use('/api/platform', platformRoutes);

// Everything below requires a valid token
app.use('/api/organization', protect, organizationRoutes);
app.use('/api/users', protect, userRoutes);
app.use('/api/clients', protect, clientRoutes);
app.use('/api/tasks', protect, taskRoutes);
app.use('/api/cst', protect, cstRoutes);
app.use('/api/sales', protect, salesRoutes);
app.use('/api/cst-manager', protect, cstManagerRoutes);
app.use('/api/sales-manager', protect, salesManagerRoutes);
app.use('/api/finance', protect, financeRoutes);
app.use('/api/events', protect, eventRoutes);
app.use('/api/attendance', protect, attendanceRoutes);
app.use('/api/admin', protect, adminRoutes);
app.use('/api/notepads', protect, notepadRoutes);
app.use('/api/concerns', protect, concernsRoutes);
app.use('/api/templates', protect, templatesRoutes);
app.use('/api/boards', protect, boardRoutes);

app.use('/api', notFound);
app.use(errorHandler);

export default app;
