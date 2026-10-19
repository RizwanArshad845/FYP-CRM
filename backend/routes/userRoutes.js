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
    importUsers,
} from '../controllers/userController.js';
import { employeesSchema } from '../services/userService.js';
import { allow } from '../policy/index.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.get('/performance', getPerformanceReviews);
router.get('/roles', getRoles);
router.get('/departments', getDepartments);

router.get('/', getUsers);
router.post('/', allow('user.manage'), validate(createUserSchema), createUser);
router.post('/import', allow('user.manage'), validate(employeesSchema), importUsers);
router.get('/:id', getUserById);
router.put('/:id', allow('user.manage'), validate(updateUserSchema), updateUser);
router.delete('/:id', allow('user.manage'), deleteUser);
router.patch('/:id/status', allow('user.manage'), validate(statusSchema), updateUserStatus);

export default router;
