import express from 'express';
import {
    getOrganization, updateOrganization, updatePortals, updateLabels, updateOrganizationSchema,
} from '../controllers/organizationController.js';
import { portalsSchema, labelsSchema } from '../controllers/onboardingController.js';
import { allow } from '../policy/index.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();
router.use(allow('org.settings'));

router.get('/', getOrganization);
router.put('/', validate(updateOrganizationSchema), updateOrganization);
router.put('/portals', validate(portalsSchema), updatePortals);
router.put('/labels', validate(labelsSchema), updateLabels);

export default router;
