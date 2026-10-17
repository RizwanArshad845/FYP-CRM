import express from 'express';
import { getTargets, createTarget, updateTarget, getAgentPerformanceMetrics, updateTargetAchievement, deleteTarget } from '../controllers/salesManagerController.js';

import { requireRole, requireTier } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/targets', getTargets);
router.post('/targets', requireRole('sales_manager', 'admin'), requireTier('Manager'), createTarget);
router.put('/targets/:id', requireRole('sales_manager', 'admin'), requireTier('Manager'), updateTarget);
router.delete('/targets/:id', requireRole('sales_manager', 'admin'), requireTier('Manager'), deleteTarget);
router.patch('/targets/:id/achieved', requireRole('sales', 'sales_manager', 'admin'), updateTargetAchievement);
router.get('/agent-performance', getAgentPerformanceMetrics);

export default router;
