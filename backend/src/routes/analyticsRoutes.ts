import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController';
import { protect, requireMember } from '../middleware/auth';

const router = Router();

router.get('/dashboard/:householdId', protect, requireMember(), AnalyticsController.getDashboardStats);
router.get('/personal', protect, AnalyticsController.getPersonalStats);
router.get('/export/:householdId', protect, requireMember(), AnalyticsController.exportReport);

export default router;
