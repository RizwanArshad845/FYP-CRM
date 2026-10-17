import express from 'express';
import {
    getEvents,
    createEvent,
    updateEvent,
    deleteEvent
} from '../controllers/eventController.js';

import { requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getEvents);
router.post('/', requireRole('admin'), createEvent);
router.put('/:id', requireRole('admin'), updateEvent);
router.delete('/:id', requireRole('admin'), deleteEvent);

export default router;
