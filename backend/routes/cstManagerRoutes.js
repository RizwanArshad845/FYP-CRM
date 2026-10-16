import express from 'express';
import { assignCstAgent, unassignCstAgent, resolveDeactivation, getTargets, upsertTarget, updateTarget, updateAchieved, updateAchievedClients, getStrategies, upsertStrategy, deleteStrategy, deleteTarget, getAgentPerformanceMetrics } from '../controllers/cstManagerController.js';

const router = express.Router();

router.patch('/clients/:id/assign-cst', assignCstAgent);
router.patch('/clients/:id/unassign-cst', unassignCstAgent);
router.patch('/deactivation-requests/:id/resolve', resolveDeactivation);

router.get('/targets', getTargets);
router.post('/targets', upsertTarget);
router.patch('/targets/:id/achieved', updateAchieved);
router.patch('/targets/:id/achieved-clients', updateAchievedClients);
router.put('/targets/:id', updateTarget);
router.delete('/targets/:id', deleteTarget);

router.get('/strategies', getStrategies);
router.post('/strategies', upsertStrategy);
router.delete('/strategies/:client_id', deleteStrategy);

router.get('/agent-performance', getAgentPerformanceMetrics);

export default router;
