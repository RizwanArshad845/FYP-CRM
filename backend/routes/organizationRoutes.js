import express from 'express';
import {
    getOrganization, updateOrganization, updatePortals, updateLabels, updateOrganizationSchema,
    getPermissionSettings, updatePermissionSettings, permissionsSchema,
    listCustomFields, createCustomField, updateCustomField, reorderCustomFields,
    listPipelineStages, createPipelineStage, renamePipelineStage, reorderPipelineStages,
    customFieldSchema, customFieldUpdateSchema, orderSchema, stageSchema,
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
router.get('/permissions', getPermissionSettings);
router.put('/permissions', validate(permissionsSchema), updatePermissionSettings);

router.get('/custom-fields', listCustomFields);
router.post('/custom-fields', validate(customFieldSchema), createCustomField);
router.put('/custom-fields/order', validate(orderSchema), reorderCustomFields);
router.put('/custom-fields/:id', validate(customFieldUpdateSchema), updateCustomField);

router.get('/pipeline-stages', listPipelineStages);
router.post('/pipeline-stages', validate(stageSchema), createPipelineStage);
router.put('/pipeline-stages/order', validate(orderSchema), reorderPipelineStages);
router.put('/pipeline-stages/:id', validate(stageSchema), renamePipelineStage);

export default router;
