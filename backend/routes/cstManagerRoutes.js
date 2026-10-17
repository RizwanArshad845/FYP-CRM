import express from 'express';
import { assignCstAgent, unassignCstAgent, resolveDeactivation, getTargets, upsertTarget, updateTarget, updateAchieved, updateAchievedClients, getStrategies, upsertStrategy, deleteStrategy, deleteTarget, getAgentPerformanceMetrics } from '../controllers/cstManagerController.js';

import { requireRole, requireTier } from '../middleware/authMiddleware.js';

const router = express.Router();

router.patch('/clients/:id/assign-cst', requireRole('cst_manager', 'admin'), requireTier('Manager'), assignCstAgent);
router.patch('/clients/:id/unassign-cst', requireRole('cst_manager', 'admin'), requireTier('Manager'), unassignCstAgent);
router.patch('/deactivation-requests/:id/resolve', requireRole('cst_manager', 'admin'), requireTier('Manager'), resolveDeactivation);

router.get('/targets', getTargets);
router.post('/targets', requireRole('cst_manager', 'admin'), requireTier('Manager'), upsertTarget);
router.patch('/targets/:id/achieved', requireRole('cst', 'cst_manager', 'admin'), updateAchieved);
router.patch('/targets/:id/achieved-clients', requireRole('cst', 'cst_manager', 'admin'), updateAchievedClients);
router.put('/targets/:id', requireRole('cst_manager', 'admin'), requireTier('Manager'), updateTarget);
router.delete('/targets/:id', requireRole('cst_manager', 'admin'), requireTier('Manager'), deleteTarget);

router.get('/strategies', getStrategies);
router.post('/strategies', requireRole('cst_manager', 'admin'), requireTier('Manager'), upsertStrategy);
router.delete('/strategies/:client_id', requireRole('cst_manager', 'admin'), requireTier('Manager'), deleteStrategy);

router.get('/agent-performance', getAgentPerformanceMetrics);

export default router;
