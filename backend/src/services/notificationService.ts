import { PrismaClient } from '@prisma/client';
import { sendToUser } from '../utils/socket';

const prisma = new PrismaClient();

export class NotificationService {
  static async create({ userId, message, type }: { userId: number; message: string; type: string }) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        message,
        type,
      },
    });

    // Dispatch real-time websocket message
    try {
      sendToUser(userId, 'new_notification', notification);
    } catch (err) {
      console.error('Error broadcasting single notification:', err);
    }

    return notification;
  }

  static async notifyHousehold(householdId: number, message: string, type: string, excludeUserId?: number) {
    // Get all active members
    const members = await prisma.member.findMany({
      where: {
        householdId,
        status: 'ACTIVE',
      },
    });

    const notificationsData = members
      .filter((m) => m.userId !== excludeUserId)
      .map((m) => ({
        userId: m.userId,
        message,
        type,
      }));

    if (notificationsData.length > 0) {
      await prisma.notification.createMany({
        data: notificationsData,
      });

      // Dispatch real-time websocket messages
      try {
        const createdNotifications = await prisma.notification.findMany({
          where: {
            userId: { in: notificationsData.map(n => n.userId) },
            message,
            isRead: false,
          },
          orderBy: { createdAt: 'desc' },
          take: notificationsData.length,
        });

        for (const notif of createdNotifications) {
          sendToUser(notif.userId, 'new_notification', notif);
        }
      } catch (err) {
        console.error('Error broadcasting household notifications:', err);
      }
    }
  }

  static async getNotifications(userId: number) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  static async markAsRead(notificationId: number, userId: number) {
    return prisma.notification.update({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  static async markAllAsRead(userId: number) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
