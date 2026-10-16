import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { updateAchieved, getFollowUps, createFollowUp, updateFollowUp, deleteFollowUp, uploadRecording, deleteRecording, getRecordings, updateRecording, getMonthlyReview, getImportantRecordings, addImportantRecording, deleteImportantRecording, updateImportantRecording } from '../controllers/salesController.js';

const router = express.Router();

router.patch('/targets/:id/achieved', protect, updateAchieved);

router.get('/follow-ups', protect, getFollowUps);
router.post('/follow-ups', protect, createFollowUp);
router.put('/follow-ups/:id', protect, updateFollowUp);
router.delete('/follow-ups/:id', protect, deleteFollowUp);

router.get('/recordings', protect, getRecordings);
router.post('/recordings', protect, uploadRecording);
router.put('/recordings/:id', protect, updateRecording);
router.delete('/recordings/:id', protect, deleteRecording);

router.get('/monthly-review', protect, getMonthlyReview);

router.get('/important-recordings', protect, getImportantRecordings);
router.post('/important-recordings', protect, addImportantRecording);
router.put('/important-recordings/:id', protect, updateImportantRecording);
router.delete('/important-recordings/:id', protect, deleteImportantRecording);

export default router;
