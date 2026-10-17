import express from 'express';
import { getTargets, createTarget, updateTarget, getAgentPerformanceMetrics, updateTargetAchievement, deleteTarget } from '../controllers/salesManagerController.js';

import { allow } from '../policy/index.js';

const router = express.Router();

router.get('/targets', getTargets);
router.post('/targets', allow('sales_target.manage'), createTarget);
router.put('/targets/:id', allow('sales_target.manage'), updateTarget);
router.delete('/targets/:id', allow('sales_target.manage'), deleteTarget);
router.patch('/targets/:id/achieved', allow('sales_target.update_achieved'), updateTargetAchievement);
router.get('/agent-performance', getAgentPerformanceMetrics);

export default router;
