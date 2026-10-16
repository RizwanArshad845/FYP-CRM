import express from 'express';
import {
    getActiveClients,
    requestDeactivation, flagClient,
    getSchedules, createSchedule, updateSchedule, deleteSchedule
} from '../controllers/cstController.js';

const router = express.Router();

// Active Clients
router.get('/active-clients', getActiveClients);

// Client Actions
router.post('/deactivation-requests', requestDeactivation);
router.post('/flags', flagClient);

// Schedules CRUD
router.get('/schedules', getSchedules);
router.post('/schedules', createSchedule);
router.put('/schedules/:id', updateSchedule);
router.delete('/schedules/:id', deleteSchedule);

// Client Notes CRUD
import { getClientNotes, createClientNote, updateClientNote, deleteClientNote } from '../controllers/cstController.js';
router.get('/notes/:clientId', getClientNotes);
router.post('/notes', createClientNote);
router.put('/notes/:id', updateClientNote);
router.delete('/notes/:id', deleteClientNote);

export default router;
