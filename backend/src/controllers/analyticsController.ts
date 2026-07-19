import { Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analyticsService';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { Exporter } from '../utils/exporter';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AnalyticsController {
  static async getDashboardStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const householdId = parseInt(req.params.householdId, 10);
      if (isNaN(householdId)) throw new AppError('Invalid Household ID', 400);

      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const stats = await AnalyticsService.getDashboardStats(householdId, userId);
      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async getPersonalStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const stats = await AnalyticsService.getUserProfileStats(userId);
      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async exportReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const householdId = parseInt(req.params.householdId, 10);
      if (isNaN(householdId)) throw new AppError('Invalid Household ID', 400);

      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const format = req.query.format as string; // 'pdf' or 'excel'
      if (format !== 'pdf' && format !== 'excel') {
        throw new AppError("Invalid export format. Must be 'pdf' or 'excel'.", 400);
      }

      // Fetch household details
      const household = await prisma.household.findUnique({
        where: { id: householdId },
      });
      if (!household) throw new AppError('Household not found', 404);

      // Fetch all expenses for report
      const expenses = await prisma.expense.findMany({
        where: { householdId },
        include: {
          category: true,
          paidBy: true,
        },
        orderBy: { date: 'desc' },
      });

      const stats = await AnalyticsService.getDashboardStats(householdId, userId);

      const reportData = expenses.map((exp) => ({
        date: exp.date.toLocaleDateString(),
        title: exp.title,
        category: exp.category.name,
        paidBy: exp.paidBy.name,
        amount: exp.amount,
        status: exp.status,
      }));

      const filename = `expenses_report_household_${householdId}`;

      if (format === 'excel') {
        return Exporter.exportExcel(res, filename, reportData);
      } else {
        return Exporter.exportPDF(
          res,
          filename,
          household.name,
          {
            total: stats.totalHouseholdExpenses,
            members: stats.totalMembers,
            avg: stats.averageMonthlySpending,
          },
          reportData
        );
      }
    } catch (err) {
      return next(err);
    }
  }
}
