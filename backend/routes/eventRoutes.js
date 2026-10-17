import express from 'express';
import {
    getEvents,
    createEvent,
    updateEvent,
    deleteEvent
} from '../controllers/eventController.js';

import { allow } from '../policy/index.js';

const router = express.Router();

router.get('/', getEvents);
router.post('/', allow('event.manage'), createEvent);
router.put('/:id', allow('event.manage'), updateEvent);
router.delete('/:id', allow('event.manage'), deleteEvent);

export default router;
