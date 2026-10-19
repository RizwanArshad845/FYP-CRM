import express from 'express';
import {
    platformLogin, platformLoginSchema, listOrgs, getOrg, summary, organizationsQuerySchema,
} from '../controllers/platformController.js';
import { protectPlatform } from '../middleware/platformAuth.js';
import { validate } from '../middleware/validate.js';

// Platform administrator API (plan 4.3): view only, no write routes.
const router = express.Router();

router.post('/auth/login', validate(platformLoginSchema), platformLogin);

router.use(protectPlatform);
router.get('/summary', summary);
router.get('/organizations', validate(organizationsQuerySchema, 'query'), listOrgs);
router.get('/organizations/:id', getOrg);

export default router;
