import express from 'express';
import {
    getClients, createClient, updateClient, toggleClientStatus,
    getDeactivationRequests, assignClient, unassignClient, discardClient,
    getClientCustomFields, getClientPipelineStages,
} from '../controllers/clientController.js';
import { allow } from '../policy/index.js';

const router = express.Router();

router.get('/', getClients);
router.get('/custom-fields', getClientCustomFields);
router.get('/pipeline-stages', getClientPipelineStages);
router.post('/', allow('client.create'), createClient);
router.put('/:id', allow('client.update'), updateClient);
router.get('/deactivation-requests', getDeactivationRequests);
// CST agents flag/unflag their own clients (ownership checked in the controller)
router.patch('/:id/status', allow('client.set_status'), toggleClientStatus);
router.patch('/:id/assign', allow('client.assign'), assignClient);
router.patch('/:id/unassign', allow('client.assign'), unassignClient);
router.patch('/:id/discard', allow('client.discard'), discardClient);

export default router;
