import express from 'express';
import { 
    getClients, createClient, updateClient, toggleClientStatus, 
    getDeactivationRequests, assignClient, unassignClient, discardClient
} from '../controllers/clientController.js';

const router = express.Router();

router.get('/', getClients);
router.post('/', createClient);
router.put('/:id', updateClient);
router.get('/deactivation-requests', getDeactivationRequests);
router.patch('/:id/status', toggleClientStatus);
router.patch('/:id/assign', assignClient);
router.patch('/:id/unassign', unassignClient);
router.patch('/:id/discard', discardClient);

export default router;
