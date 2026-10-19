import express from 'express';
import { validate } from '../middleware/validate.js';
import { getTasks, createTask, updateTaskStatus, submitTask, deleteTask, updateTask, createTaskSchema, updateTaskSchema } from '../controllers/taskController.js';
import { allow } from '../policy/index.js';

const router = express.Router();
// Delegating needs a manager-type portal and Manager tier or above (see policy catalog)
const delegators = allow('task.delegate');

router.get('/', getTasks);
router.post('/', delegators, validate(createTaskSchema), createTask);
router.put('/:id', delegators, validate(updateTaskSchema), updateTask);
router.patch('/:id/status', updateTaskStatus);
router.post('/:id/submit', submitTask);
router.delete('/:id', delegators, deleteTask);

export default router;
