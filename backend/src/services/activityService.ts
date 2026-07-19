import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ActivityService {
  static async log({
    householdId,
    userId,
    action,
    details,
  }: {
    householdId: number;
    userId: number;
    action: string;
    details: string;
  }) {
    return prisma.activityLog.create({
      data: {
        householdId,
        userId,
        action,
        details,
      },
    });
  }

  static async getLogs(householdId: number, limit: number = 50) {
    return prisma.activityLog.findMany({
      where: { householdId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
