import { Response, NextFunction } from 'express';
import { SettlementService } from '../services/settlementService';
import { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { broadcastToHousehold } from '../utils/socket';

export class SettlementController {
  static async getBalances(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const householdId = parseInt(req.params.householdId, 10);
      if (isNaN(householdId)) throw new AppError('Invalid Household ID', 400);

      const balances = await SettlementService.calculateBalances(householdId);
      return res.status(200).json({
        success: true,
        data: balances,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async getSuggestions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const householdId = parseInt(req.params.householdId, 10);
      if (isNaN(householdId)) throw new AppError('Invalid Household ID', 400);

      const simplify = req.query.simplify !== 'false';

      const suggestions = await SettlementService.getSettlementSuggestions(householdId, simplify);
      return res.status(200).json({
        success: true,
        data: suggestions,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async recordSettlement(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const householdId = parseInt(req.params.householdId, 10);
      if (isNaN(householdId)) throw new AppError('Invalid Household ID', 400);

      const { fromUserId, toUserId, amount, date, method } = req.body;
      const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
      if (isNaN(parsedAmount)) {
        throw new AppError('Amount must be a valid number', 400);
      }
      const parsedDate = date ? new Date(date) : new Date();

      const settlement = await SettlementService.recordSettlement({
        householdId,
        fromUserId,
        toUserId,
        amount: parsedAmount,
        date: parsedDate,
        method: method || 'UPI',
      });

      broadcastToHousehold(householdId, 'ledger_update', { type: 'SETTLEMENT_RECORDED', data: settlement });

      return res.status(201).json({
        success: true,
        message: 'Settlement recorded successfully',
        data: settlement,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async getHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const householdId = parseInt(req.params.householdId, 10);
      if (isNaN(householdId)) throw new AppError('Invalid Household ID', 400);

      const history = await SettlementService.getHistory(householdId);
      return res.status(200).json({
        success: true,
        data: history,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async getUPIQRCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const upiId = req.query.upiId as string;
      const payeeName = req.query.payeeName as string;
      const amount = parseFloat(req.query.amount as string);
      const note = (req.query.note as string) || 'Flatmate Ledger Settle';

      if (!upiId || !payeeName || isNaN(amount)) {
        throw new AppError('UPI ID, Payee Name, and valid numeric Amount are required parameters', 400);
      }

      const result = await SettlementService.generateUPIQRCode(upiId, payeeName, amount, note);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  }
  static async confirmSettlement(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const settlementId = parseInt(req.params.settlementId, 10);
      const userId = req.user?.id;
      if (isNaN(settlementId)) throw new AppError('Invalid Settlement ID', 400);
      if (!userId) throw new AppError('Unauthorized', 401);

      const settlement = await SettlementService.confirmSettlement(settlementId, userId);

      broadcastToHousehold(settlement.householdId, 'ledger_update', { type: 'SETTLEMENT_CONFIRMED', data: settlement });

      return res.status(200).json({
        success: true,
        message: 'Settlement confirmed successfully',
        data: settlement,
      });
    } catch (err) {
      return next(err);
    }
  }
}
