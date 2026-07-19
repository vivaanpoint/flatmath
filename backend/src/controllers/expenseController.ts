import { Response, NextFunction } from 'express';
import { ExpenseService } from '../services/expenseService';
import { AuthenticatedRequest } from '../middleware/auth';
import { PrismaClient, ExpenseStatus } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { broadcastToHousehold } from '../utils/socket';
import fs from 'fs';
import Tesseract from 'tesseract.js';

const prisma = new PrismaClient();

export class ExpenseController {
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const householdId = parseInt(req.params.householdId, 10);
      if (isNaN(householdId)) throw new AppError('Invalid Household ID', 400);

      // Handle multipart form-data parsing
      let body = { ...req.body };
      if (typeof body.splits === 'string') {
        body.splits = JSON.parse(body.splits);
      }
      if (typeof body.amount === 'string') {
        body.amount = parseFloat(body.amount);
      }
      if (typeof body.categoryId === 'string') {
        body.categoryId = parseInt(body.categoryId, 10);
      }
      if (typeof body.paidById === 'string') {
        body.paidById = parseInt(body.paidById, 10);
      }

      const receiptUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

      const expense = await ExpenseService.create({
        title: body.title,
        description: body.description,
        amount: body.amount,
        categoryId: body.categoryId,
        date: new Date(body.date),
        paidById: body.paidById,
        householdId,
        receiptUrl,
        notes: body.notes,
        splitType: body.splitType,
        splits: body.splits,
      });

      broadcastToHousehold(householdId, 'ledger_update', { type: 'EXPENSE_CREATED', data: expense });

      return res.status(201).json({
        success: true,
        message: 'Expense added successfully',
        data: expense,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const expenseId = parseInt(req.params.expenseId, 10);
      if (isNaN(expenseId)) throw new AppError('Invalid Expense ID', 400);

      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      // Handle multipart form-data parsing
      let body = { ...req.body };
      if (typeof body.splits === 'string') {
        body.splits = JSON.parse(body.splits);
      }
      if (typeof body.amount === 'string') {
        body.amount = parseFloat(body.amount);
      }
      if (typeof body.categoryId === 'string') {
        body.categoryId = parseInt(body.categoryId, 10);
      }
      if (typeof body.paidById === 'string') {
        body.paidById = parseInt(body.paidById, 10);
      }

      const receiptUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

      const updated = await ExpenseService.update(
        expenseId,
        {
          title: body.title,
          description: body.description,
          amount: body.amount,
          categoryId: body.categoryId,
          date: new Date(body.date),
          paidById: body.paidById,
          receiptUrl,
          notes: body.notes,
          splitType: body.splitType,
          splits: body.splits,
        },
        userId
      );

      broadcastToHousehold(updated.householdId, 'ledger_update', { type: 'EXPENSE_UPDATED', data: updated });

      return res.status(200).json({
        success: true,
        message: 'Expense updated successfully',
        data: updated,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const expenseId = parseInt(req.params.expenseId, 10);
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const expense = await ExpenseService.delete(expenseId, userId);
      broadcastToHousehold(expense.householdId, 'ledger_update', { type: 'EXPENSE_DELETED', data: expense });
      
      return res.status(200).json({
        success: true,
        message: 'Expense deleted successfully',
      });
    } catch (err) {
      return next(err);
    }
  }

  static async getExpenseDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const expenseId = parseInt(req.params.expenseId, 10);
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const details = await ExpenseService.getExpenseDetails(expenseId, userId);
      return res.status(200).json({
        success: true,
        data: details,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const householdId = parseInt(req.params.householdId, 10);
      if (isNaN(householdId)) throw new AppError('Invalid Household ID', 400);

      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const search = (req.query.search as string) || '';
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string, 10) : undefined;
      const paidById = req.query.paidById ? parseInt(req.query.paidById as string, 10) : undefined;
      const status = req.query.status as ExpenseStatus | undefined;
      
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const minAmount = req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined;
      const maxAmount = req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined;

      const result = await ExpenseService.list({
        householdId,
        page,
        limit,
        search,
        categoryId,
        paidById,
        status,
        startDate,
        endDate,
        minAmount,
        maxAmount,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const expenseId = parseInt(req.params.expenseId, 10);
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const expense = await ExpenseService.approve(expenseId, userId);
      broadcastToHousehold(expense.householdId, 'ledger_update', { type: 'EXPENSE_APPROVED', data: expense });

      return res.status(200).json({
        success: true,
        message: 'Expense approved successfully',
      });
    } catch (err) {
      return next(err);
    }
  }

  static async reject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const expenseId = parseInt(req.params.expenseId, 10);
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const expense = await ExpenseService.reject(expenseId, userId);
      broadcastToHousehold(expense.householdId, 'ledger_update', { type: 'EXPENSE_REJECTED', data: expense });

      return res.status(200).json({
        success: true,
        message: 'Expense rejected successfully',
      });
    } catch (err) {
      return next(err);
    }
  }

  static async getCategories(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const categories = await prisma.category.findMany();
      return res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (err) {
      return next(err);
    }
  }

  // --- RECURRING RULES ---

  static async createRecurringRule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const householdId = parseInt(req.params.householdId, 10);
      const { title, description, amount, categoryId, paidById, interval, startDate } = req.body;

      const rule = await ExpenseService.createRecurringRule({
        householdId,
        title,
        description,
        amount,
        categoryId,
        paidById,
        interval,
        startDate: new Date(startDate),
      });

      return res.status(201).json({
        success: true,
        message: 'Recurring bill schedule created successfully',
        data: rule,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async listRecurringRules(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const householdId = parseInt(req.params.householdId, 10);
      const rules = await ExpenseService.listRecurringRules(householdId);
      return res.status(200).json({
        success: true,
        data: rules,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async deleteRecurringRule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ruleId = parseInt(req.params.ruleId, 10);
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      await ExpenseService.deleteRecurringRule(ruleId, userId);
      return res.status(200).json({
        success: true,
        message: 'Recurring bill rule deleted successfully',
      });
    } catch (err) {
      return next(err);
    }
  }

  static async updateRecurringRule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ruleId = parseInt(req.params.ruleId, 10);
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const { title, description, amount, categoryId, paidById, interval, startDate } = req.body;

      const updated = await ExpenseService.updateRecurringRule(ruleId, userId, {
        title,
        description,
        amount,
        categoryId,
        paidById,
        interval,
        startDate,
      });

      return res.status(200).json({
        success: true,
        message: 'Recurring bill rule updated successfully',
        data: updated,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async scanReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new AppError('No receipt file uploaded', 400);
      }

      console.log('Starting local Tesseract OCR scanning on file:', req.file.path);
      
      // Perform OCR locally using tesseract.js
      const { data: { text } } = await Tesseract.recognize(
        req.file.path,
        'eng'
      );

      // Delete the file after scanning to keep the upload folder clean
      fs.unlinkSync(req.file.path);

      console.log('--- OCR Extracted Text Start ---');
      console.log(text);
      console.log('--- OCR Extracted Text End ---');

      // Parse OCR text lines
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      // Extract Merchant (first line that is not a generic header)
      let merchant: string | null = null;
      const genericHeaders = /^(bill|invoice|receipt|tax invoice|cash bill|sales memo|statement|transaction|payment|customer copy|merchant copy)$/i;
      for (const line of lines) {
        if (!genericHeaders.test(line) && line.length > 2 && isNaN(Number(line))) {
          merchant = line.replace(/[|:;]/g, '').trim();
          break;
        }
      }

      // Extract Date (format YYYY-MM-DD, DD-MM-YYYY or MM/DD/YYYY)
      let dateVal: string | null = null;
      const dateRegex = /(\d{4})[-/.](\d{2})[-/.](\d{2})|(\d{2})[-/.](\d{2})[-/.](\d{4})/g;
      const dateMatches = text.match(dateRegex);
      if (dateMatches && dateMatches.length > 0) {
        const match = dateMatches[0];
        const parts = match.split(/[-/.]/);
        if (parts[0].length === 4) {
          dateVal = `${parts[0]}-${parts[1]}-${parts[2]}`;
        } else if (parts[2].length === 4) {
          dateVal = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      if (!dateVal) {
        dateVal = new Date().toISOString().split('T')[0];
      }

      // Extract Amount (Grand Total)
      let amountVal: number | null = null;
      const totalRegex = /(total|grand|amount|net|sum|subtotal|due|pay)\b/i;
      const decimalRegex = /(?:[₹$£€\s])?(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/g;

      let possibleTotals: number[] = [];
      let allDecimals: number[] = [];

      for (const line of lines) {
        const decimalsInLine = [...line.matchAll(decimalRegex)];
        if (decimalsInLine.length > 0) {
          decimalsInLine.forEach(match => {
            const num = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(num)) {
              allDecimals.push(num);
              if (totalRegex.test(line)) {
                possibleTotals.push(num);
              }
            }
          });
        }
      }

      if (possibleTotals.length > 0) {
        amountVal = Math.max(...possibleTotals);
      } else if (allDecimals.length > 0) {
        amountVal = Math.max(...allDecimals);
      }

      console.log('Local OCR Parsed Result:', { merchant, date: dateVal, amount: amountVal });

      return res.status(200).json({
        success: true,
        message: 'Receipt scanned successfully locally',
        data: {
          amount: amountVal ? Number(amountVal) : null,
          merchant: merchant || null,
          date: dateVal || null
        }
      });
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return next(err);
    }
  }
}
