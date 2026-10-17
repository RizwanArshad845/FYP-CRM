import express from 'express';
import { getPerformanceStats, getCompanyMetrics, getTaskDetails } from '../controllers/adminController.js';

import { requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireRole('admin'));

router.get('/performance-stats', getPerformanceStats);
router.get('/company-metrics', getCompanyMetrics);
router.get('/task-details', getTaskDetails);

export default router;
