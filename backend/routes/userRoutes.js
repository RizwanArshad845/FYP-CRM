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
    getDepartments
} from '../controllers/userController.js';

const router = express.Router();

router.get('/performance', getPerformanceReviews);
router.get('/roles', getRoles);
router.get('/departments', getDepartments);

router.get('/', getUsers);
router.post('/', createUser);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.patch('/:id/status', updateUserStatus);

export default router;
