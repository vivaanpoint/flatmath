import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from './errorHandler';
import { PrismaClient } from '@prisma/client';
import { Request } from 'express';

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

export const protect = async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  try {
    let token = '';

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Not authorized, no token provided', 401));
    }

    try {
      const decoded = verifyAccessToken(token);
      req.user = {
        id: decoded.userId,
        email: decoded.email,
      };
      return next();
    } catch (err: any) {
      return next(new AppError('Not authorized, token expired or invalid', 401));
    }
  } catch (err) {
    return next(err);
  }
};

export const requireMember = (roleRequirement?: 'OWNER' | 'MEMBER') => {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('Authentication required', 401));
      }

      // Check where householdId is: params, query, or headers
      const householdIdStr = req.params.householdId || req.query.householdId || req.headers['x-household-id'];
      if (!householdIdStr) {
        return next(new AppError('Household ID is required for this action', 400));
      }

      const householdId = parseInt(householdIdStr as string, 10);
      if (isNaN(householdId)) {
        return next(new AppError('Invalid Household ID', 400));
      }

      // Query database for membership
      const member = await prisma.member.findUnique({
        where: {
          userId_householdId: {
            userId,
            householdId,
          },
        },
      });

      if (!member || member.status !== 'ACTIVE') {
        return next(new AppError('Forbidden: You are not an active member of this household', 403));
      }

      if (roleRequirement === 'OWNER' && member.role !== 'OWNER') {
        return next(new AppError('Forbidden: Only the household owner can perform this action', 403));
      }

      // Attach householdId to request object for convenience (casted to any)
      (req as any).householdId = householdId;
      (req as any).memberRole = member.role;

      return next();
    } catch (err) {
      return next(err);
    }
  };
};
