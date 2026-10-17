import express from 'express';
import { clockIn, clockOut, getStatus, getHistory, getAttendanceAll, breakIn, breakOut, getPerformanceGrid } from '../controllers/attendanceController.js';

import { allow } from '../policy/index.js';

const router = express.Router();


router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);
router.get('/status', getStatus);
router.get('/history', getHistory);

// Admin/Reports view all
router.get('/all', allow('attendance.view_all'), getAttendanceAll);
router.get('/performance-grid', allow('admin.dashboard'), getPerformanceGrid);

// Break management
router.post('/break-in', breakIn);
router.post('/break-out', breakOut);

export default router;
