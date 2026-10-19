import express from 'express';
import { allow } from '../policy/index.js';
import {
    getActiveClients,
    requestDeactivation, flagClient,
    getSchedules, createSchedule, updateSchedule, deleteSchedule
} from '../controllers/cstController.js';

const router = express.Router();

// Active Clients
router.get('/active-clients', getActiveClients);

// Client Actions
router.post('/deactivation-requests', allow('deactivation.request'), requestDeactivation);
router.post('/flags', allow('client.flag'), flagClient);

// Schedules CRUD
router.get('/schedules', getSchedules);
router.post('/schedules', createSchedule);
router.put('/schedules/:id', updateSchedule);
router.delete('/schedules/:id', deleteSchedule);

// Client Notes CRUD
import { getClientNotes, createClientNote, updateClientNote, deleteClientNote } from '../controllers/cstController.js';
router.get('/notes/:clientId', getClientNotes);
router.post('/notes', allow('note.add'), createClientNote);
router.put('/notes/:id', updateClientNote);
router.delete('/notes/:id', deleteClientNote);

export default router;
