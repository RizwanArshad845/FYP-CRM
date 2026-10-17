import express from 'express';
import { updateAchieved, getFollowUps, createFollowUp, updateFollowUp, deleteFollowUp, uploadRecording, deleteRecording, getRecordings, updateRecording, getMonthlyReview, getImportantRecordings, addImportantRecording, deleteImportantRecording, updateImportantRecording } from '../controllers/salesController.js';

import { requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

router.patch('/targets/:id/achieved', requireRole('sales', 'sales_manager', 'admin'), updateAchieved);

router.get('/follow-ups', getFollowUps);
router.post('/follow-ups', createFollowUp);
router.put('/follow-ups/:id', updateFollowUp);
router.delete('/follow-ups/:id', deleteFollowUp);

router.get('/recordings', getRecordings);
router.post('/recordings', uploadRecording);
router.put('/recordings/:id', updateRecording);
router.delete('/recordings/:id', deleteRecording);

router.get('/monthly-review', getMonthlyReview);

router.get('/important-recordings', getImportantRecordings);
router.post('/important-recordings', addImportantRecording);
router.put('/important-recordings/:id', updateImportantRecording);
router.delete('/important-recordings/:id', deleteImportantRecording);

export default router;
