import express from 'express';
import { validate } from '../middleware/validate.js';
import {
    getEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    eventSchema,
    eventUpdateSchema,
} from '../controllers/eventController.js';

import { allow } from '../policy/index.js';

const router = express.Router();

router.get('/', getEvents);
router.post('/', allow('event.manage'), validate(eventSchema), createEvent);
router.put('/:id', allow('event.manage'), validate(eventUpdateSchema), updateEvent);
router.delete('/:id', allow('event.manage'), deleteEvent);

export default router;
