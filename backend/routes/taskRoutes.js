import express from 'express';
import { getTasks, createTask, updateTaskStatus, submitTask, deleteTask, updateTask } from '../controllers/taskController.js';
import { requireRole, requireTier } from '../middleware/authMiddleware.js';

const router = express.Router();
// Delegating needs a manager-type portal and Manager tier or above
const delegators = [requireRole('admin', 'sales_manager', 'cst_manager'), requireTier('Manager')];

router.get('/', getTasks);
router.post('/', delegators, createTask);
router.put('/:id', delegators, updateTask);
router.patch('/:id/status', updateTaskStatus);
router.post('/:id/submit', submitTask);
router.delete('/:id', delegators, deleteTask);

export default router;
