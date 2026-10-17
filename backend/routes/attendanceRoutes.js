import express from 'express';
import { clockIn, clockOut, getStatus, getHistory, getAttendanceAll, breakIn, breakOut, getPerformanceGrid } from '../controllers/attendanceController.js';

import { requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();


router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);
router.get('/status', getStatus);
router.get('/history', getHistory);

// Admin/Reports view all
router.get('/all', getAttendanceAll);
router.get('/performance-grid', requireRole('admin'), getPerformanceGrid);

// Break management
router.post('/break-in', breakIn);
router.post('/break-out', breakOut);

export default router;
