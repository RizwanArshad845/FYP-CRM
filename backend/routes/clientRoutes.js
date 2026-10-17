import express from 'express';
import {
    getClients, createClient, updateClient, toggleClientStatus,
    getDeactivationRequests, assignClient, unassignClient, discardClient
} from '../controllers/clientController.js';
import { requireRole, requireTier } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getClients);
router.post('/', requireRole('sales', 'sales_manager', 'cst_manager', 'admin'), createClient);
router.put('/:id', requireRole('sales_manager', 'cst_manager', 'admin'), requireTier('Manager'), updateClient);
router.get('/deactivation-requests', getDeactivationRequests);
// CST agents flag/unflag their own clients (ownership checked in the controller)
router.patch('/:id/status', requireRole('cst', 'cst_manager', 'admin'), toggleClientStatus);
router.patch('/:id/assign', requireRole('cst_manager', 'admin'), requireTier('Manager'), assignClient);
router.patch('/:id/unassign', requireRole('cst_manager', 'admin'), requireTier('Manager'), unassignClient);
router.patch('/:id/discard', requireRole('cst_manager', 'admin'), requireTier('Manager'), discardClient);

export default router;
