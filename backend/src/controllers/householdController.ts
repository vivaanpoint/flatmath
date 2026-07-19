import { Response, NextFunction } from 'express';
import { HouseholdService } from '../services/householdService';
import { AuthenticatedRequest } from '../middleware/auth';
import { Role } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

export class HouseholdController {
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name } = req.body;
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const household = await HouseholdService.create(name, userId);
      return res.status(201).json({
        success: true,
        message: 'Household created successfully',
        data: household,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const householdId = parseInt(req.params.householdId, 10);
      const { name } = req.body;
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const updated = await HouseholdService.update(householdId, name, userId);
      return res.status(200).json({
        success: true,
        message: 'Household updated successfully',
        data: updated,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const householdId = parseInt(req.params.householdId, 10);
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      await HouseholdService.delete(householdId, userId);
      return res.status(200).json({
        success: true,
        message: 'Household deleted successfully',
      });
    } catch (err) {
      return next(err);
    }
  }

  static async getHouseholdDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const householdId = parseInt(req.params.householdId, 10);
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const details = await HouseholdService.getHouseholdDetails(householdId, userId);
      return res.status(200).json({
        success: true,
        data: details,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async inviteByEmail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const householdId = parseInt(req.params.householdId, 10);
      const { email } = req.body;
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const invite = await HouseholdService.inviteByEmail(householdId, email, userId);
      return res.status(200).json({
        success: true,
        message: `Invitation successfully sent to ${email}`,
        data: invite,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async joinByCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { code } = req.body;
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const household = await HouseholdService.joinByCode(code, userId);
      return res.status(200).json({
        success: true,
        message: `Successfully joined household '${household.name}'`,
        data: household,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async getPendingInvitations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const email = req.user?.email;
      if (!email) throw new AppError('Unauthorized', 401);

      const invites = await HouseholdService.getPendingInvitations(email);
      return res.status(200).json({
        success: true,
        data: invites,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async removeMember(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const householdId = parseInt(req.params.householdId, 10);
      const targetUserId = parseInt(req.params.userId, 10);
      const requesterId = req.user?.id;
      if (!requesterId) throw new AppError('Unauthorized', 401);

      await HouseholdService.removeMember(householdId, targetUserId, requesterId);
      return res.status(200).json({
        success: true,
        message: 'Member removed successfully from the household',
      });
    } catch (err) {
      return next(err);
    }
  }

  static async changeMemberRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const householdId = parseInt(req.params.householdId, 10);
      const targetUserId = parseInt(req.params.userId, 10);
      const { role } = req.body;
      const requesterId = req.user?.id;
      if (!requesterId) throw new AppError('Unauthorized', 401);

      await HouseholdService.changeMemberRole(householdId, targetUserId, role as Role, requesterId);
      return res.status(200).json({
        success: true,
        message: `Member role changed to ${role} successfully`,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async getUserHouseholds(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const households = await HouseholdService.getUserHouseholds(userId);
      return res.status(200).json({
        success: true,
        data: households,
      });
    } catch (err) {
      return next(err);
    }
  }
}
