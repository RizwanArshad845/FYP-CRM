import express from 'express';
import { assignCstAgent, unassignCstAgent, resolveDeactivation, resolveDeactivationBulk, resolveBulkSchema, getUnassignedClients, getTargets, upsertTarget, updateTarget, updateAchieved, updateAchievedClients, getStrategies, upsertStrategy, deleteStrategy, deleteTarget, getAgentPerformanceMetrics } from '../controllers/cstManagerController.js';

import { allow } from '../policy/index.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.patch('/clients/:id/assign-cst', allow('client.assign'), assignCstAgent);
router.patch('/clients/:id/unassign-cst', allow('client.assign'), unassignCstAgent);
router.get('/unassigned-clients', allow('client.assign'), getUnassignedClients);
router.patch('/deactivation-requests/:id/resolve', allow('deactivation.resolve'), resolveDeactivation);
router.post('/deactivation-requests/resolve-bulk', allow('deactivation.resolve'), validate(resolveBulkSchema), resolveDeactivationBulk);

router.get('/targets', getTargets);
router.post('/targets', allow('cst_target.manage'), upsertTarget);
router.patch('/targets/:id/achieved', allow('cst_target.update_achieved'), updateAchieved);
router.patch('/targets/:id/achieved-clients', allow('cst_target.update_achieved'), updateAchievedClients);
router.put('/targets/:id', allow('cst_target.manage'), updateTarget);
router.delete('/targets/:id', allow('cst_target.manage'), deleteTarget);

router.get('/strategies', getStrategies);
router.post('/strategies', allow('strategy.manage'), upsertStrategy);
router.delete('/strategies/:client_id', allow('strategy.manage'), deleteStrategy);

router.get('/agent-performance', getAgentPerformanceMetrics);

export default router;
