import express from 'express';
import { getTasks, createTask, updateTaskStatus, submitTask, deleteTask ,updateTask} from '../controllers/taskController.js';

const router = express.Router();

router.get('/', getTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.patch('/:id/status', updateTaskStatus);
router.post('/:id/submit', submitTask);
router.delete('/:id', deleteTask);

export default router;
