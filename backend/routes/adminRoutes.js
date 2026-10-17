import express from 'express';
import { getPerformanceStats, getCompanyMetrics, getTaskDetails } from '../controllers/adminController.js';

import { allow } from '../policy/index.js';

const router = express.Router();
router.use(allow('admin.dashboard'));

router.get('/performance-stats', getPerformanceStats);
router.get('/company-metrics', getCompanyMetrics);
router.get('/task-details', getTaskDetails);

export default router;
