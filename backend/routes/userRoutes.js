import express from 'express';
import {
    getUsers,
    getUserById,
    updateUserStatus,
    createUser,
    updateUser,
    deleteUser,
    getPerformanceReviews,
    getRoles,
    getDepartments,
    createUserSchema,
    updateUserSchema,
    statusSchema,
} from '../controllers/userController.js';
import { requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.get('/performance', getPerformanceReviews);
router.get('/roles', getRoles);
router.get('/departments', getDepartments);

router.get('/', getUsers);
router.post('/', requireRole('admin'), validate(createUserSchema), createUser);
router.get('/:id', getUserById);
router.put('/:id', requireRole('admin'), validate(updateUserSchema), updateUser);
router.delete('/:id', requireRole('admin'), deleteUser);
router.patch('/:id/status', requireRole('admin'), validate(statusSchema), updateUserStatus);

export default router;
