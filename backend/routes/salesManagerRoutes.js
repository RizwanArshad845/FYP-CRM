import express from 'express';
import { getTargets, createTarget, updateTarget, getAgentPerformanceMetrics, updateTargetAchievement, deleteTarget } from '../controllers/salesManagerController.js';

const router = express.Router();

router.get('/targets', getTargets);
router.post('/targets', createTarget);
router.put('/targets/:id', updateTarget);
router.delete('/targets/:id', deleteTarget);
router.patch('/targets/:id/achieved', updateTargetAchievement);
router.get('/agent-performance', getAgentPerformanceMetrics);

export default router;
