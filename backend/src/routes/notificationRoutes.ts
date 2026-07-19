import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { protect } from '../middleware/auth';

const router = Router();

router.get('/', protect, NotificationController.list);
router.put('/read-all', protect, NotificationController.readAll);
router.put('/:notificationId/read', protect, NotificationController.read);

export default router;
