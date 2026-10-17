import express from 'express';
import {
    signup, getState, updatePortals, updateLabels, addEmployees, skipEmployees, complete,
    requireOnboardingIncomplete, signupSchema, portalsSchema, labelsSchema, employeesSchema,
} from '../controllers/onboardingController.js';
import { protect, requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

// Public: create an organization and its first admin
router.post('/organization', validate(signupSchema), signup);

// Wizard steps: the org's admin, until onboarding is completed
const wizard = [protect, requireRole('admin'), requireOnboardingIncomplete];
router.get('/state', ...wizard, getState);
router.put('/portals', ...wizard, validate(portalsSchema), updatePortals);
router.put('/labels', ...wizard, validate(labelsSchema), updateLabels);
router.post('/employees', ...wizard, validate(employeesSchema), addEmployees);
router.post('/employees/skip', ...wizard, skipEmployees);
router.post('/complete', ...wizard, complete);

export default router;
