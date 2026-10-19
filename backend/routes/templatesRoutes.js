import express from 'express';
import { validate } from '../middleware/validate.js';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, templateSchema, templateUpdateSchema } from '../controllers/templatesController.js';
const router = express.Router();
router.get('/', getTemplates);
router.post('/', validate(templateSchema), createTemplate);
router.put('/:id', validate(templateUpdateSchema), updateTemplate);
router.delete('/:id', deleteTemplate);
export default router;
