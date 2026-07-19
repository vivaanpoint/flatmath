import { Response, NextFunction } from 'express';
import { NotificationService } from '../services/notificationService';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export class NotificationController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const notifications = await NotificationService.getNotifications(userId);
      return res.status(200).json({
        success: true,
        data: notifications,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async read(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const notificationId = parseInt(req.params.notificationId, 10);
      if (isNaN(notificationId)) throw new AppError('Invalid Notification ID', 400);

      await NotificationService.markAsRead(notificationId, userId);
      return res.status(200).json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (err) {
      return next(err);
    }
  }

  static async readAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      await NotificationService.markAllAsRead(userId);
      return res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (err) {
      return next(err);
    }
  }
}
