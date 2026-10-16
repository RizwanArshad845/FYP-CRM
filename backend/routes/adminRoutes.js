import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getPerformanceStats, getCompanyMetrics, getTaskDetails } from '../controllers/adminController.js';

const router = express.Router();

router.get('/performance-stats', protect, getPerformanceStats);
router.get('/company-metrics', protect, getCompanyMetrics);
router.get('/task-details', protect, getTaskDetails);

export default router;
