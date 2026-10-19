import express from 'express';
import {
    login, getMe, changePassword, getOrganizationBySlug, loginSchema, changePasswordSchema,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.post('/login', validate(loginSchema), login);
router.get('/organization/:slug', getOrganizationBySlug);
router.get('/me', protect, getMe);
router.post('/change-password', protect, validate(changePasswordSchema), changePassword);

export default router;
