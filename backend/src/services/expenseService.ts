import { PrismaClient, ExpenseStatus, ApprovalStatus, MemberStatus, RecurrenceInterval } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { ActivityService } from './activityService';
import { NotificationService } from './notificationService';

const prisma = new PrismaClient();

interface SplitInput {
  userId: number;
  value?: number; // amount for exact, percentage for percentage split
}

export class ExpenseService {
  static async create({
    title,
    description,
    amount,
    categoryId,
    date,
    paidById,
    householdId,
    receiptUrl,
    notes,
    splitType,
    splits,
  }: {
    title: string;
    description?: string;
    amount: number;
    categoryId: number;
    date: Date;
    paidById: number;
    householdId: number;
    receiptUrl?: string;
    notes?: string;
    splitType: 'EQUAL' | 'EXACT' | 'PERCENTAGE';
    splits: SplitInput[];
  }) {
    // 1. Verify Category exists
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new AppError('Category not found', 404);
    }

    // 2. Verify all split participants are members of the household
    const userIds = splits.map((s) => s.userId);
    const members = await prisma.member.findMany({
      where: {
        householdId,
        userId: { in: [...userIds, paidById] },
        status: MemberStatus.ACTIVE,
      },
      include: {
        user: true,
      },
    });

    const activeMemberIds = new Set(members.map((m) => m.userId));
    if (!activeMemberIds.has(paidById)) {
      throw new AppError('Paid-by user must be an active member of this household', 400);
    }
    for (const id of userIds) {
      if (!activeMemberIds.has(id)) {
        throw new AppError(`User ${id} is not an active member of this household`, 400);
      }
    }

    // 3. Process splits and calculate owed amounts
    const participantData: { userId: number; amountOwed: number; sharePercentage?: number; shareAmount?: number }[] = [];

    if (splitType === 'EQUAL') {
      const share = Number((amount / splits.length).toFixed(2));
      const sharePct = Number((100 / splits.length).toFixed(2));
      let runningSum = 0;
      let runningPctSum = 0;
      for (let i = 0; i < splits.length; i++) {
        // Adjust the last person's share and percentage to resolve rounding issues
        const actualShare = i === splits.length - 1 ? Number((amount - runningSum).toFixed(2)) : share;
        runningSum += actualShare;
        
        const actualPct = i === splits.length - 1 ? Number((100 - runningPctSum).toFixed(2)) : sharePct;
        runningPctSum += actualPct;

        participantData.push({
          userId: splits[i].userId,
          amountOwed: actualShare,
          sharePercentage: actualPct,
          shareAmount: actualShare,
        });
      }
    } else if (splitType === 'EXACT') {
      let sum = 0;
      for (const split of splits) {
        if (split.value === undefined || split.value < 0) {
          throw new AppError('Exact split amount must be a positive number', 400);
        }
        sum += Number(split.value.toFixed(2));
      }
      if (Math.abs(sum - amount) > 0.05) {
        throw new AppError(`Sum of splits (${sum}) does not equal the total amount (${amount})`, 400);
      }
      for (const split of splits) {
        const roundedValue = Number(split.value!.toFixed(2));
        participantData.push({
          userId: split.userId,
          amountOwed: roundedValue,
          sharePercentage: Number(((roundedValue / amount) * 100).toFixed(2)),
          shareAmount: roundedValue,
        });
      }
    } else if (splitType === 'PERCENTAGE') {
      let sumPct = 0;
      for (const split of splits) {
        if (split.value === undefined || split.value < 0 || split.value > 100) {
          throw new AppError('Split percentage must be between 0 and 100', 400);
        }
        sumPct += Number(split.value.toFixed(2));
      }
      if (Math.abs(sumPct - 100) > 0.01) {
        throw new AppError(`Sum of split percentages (${sumPct}%) must equal exactly 100%`, 400);
      }
      let runningSum = 0;
      let runningPctSum = 0;
      for (let i = 0; i < splits.length; i++) {
        const pct = Number(splits[i].value!.toFixed(2));
        const actualPct = i === splits.length - 1 ? Number((100 - runningPctSum).toFixed(2)) : pct;
        runningPctSum += actualPct;

        const share = Number(((actualPct / 100) * amount).toFixed(2));
        const actualShare = i === splits.length - 1 ? Number((amount - runningSum).toFixed(2)) : share;
        runningSum += actualShare;

        participantData.push({
          userId: splits[i].userId,
          amountOwed: actualShare,
          sharePercentage: actualPct,
          shareAmount: actualShare,
        });
      }
    }

    // 4. Create the expense inside a transaction
    const expense = await prisma.$transaction(async (tx) => {
      // Get other active household members for approval workflow
      const otherMembers = members.filter((m) => m.userId !== paidById);

      // Determine initial status: if no other members, it's auto-approved
      const initialStatus = otherMembers.length === 0 ? ExpenseStatus.APPROVED : ExpenseStatus.PENDING;

      const exp = await tx.expense.create({
        data: {
          title: title.trim(),
          description,
          amount,
          categoryId,
          date,
          paidById,
          householdId,
          receiptUrl,
          notes,
          status: initialStatus,
        },
      });

      // Create participants
      for (const part of participantData) {
        await tx.expenseParticipant.create({
          data: {
            expenseId: exp.id,
            userId: part.userId,
            amountOwed: part.amountOwed,
            sharePercentage: part.sharePercentage,
            shareAmount: part.shareAmount,
          },
        });
      }

      // Create approvals
      for (const m of otherMembers) {
        await tx.expenseApproval.create({
          data: {
            expenseId: exp.id,
            userId: m.userId,
            status: ApprovalStatus.PENDING,
          },
        });
      }

      return exp;
    });

    const payer = members.find((m) => m.userId === paidById);

    await ActivityService.log({
      householdId,
      userId: paidById,
      action: 'EXPENSE_ADDED',
      details: `Added expense '${title}' for ₹${amount}.`,
    });

    await NotificationService.notifyHousehold(
      householdId,
      `New expense '${title}' of ₹${amount} added by ${payer?.user?.name || 'roommate'}. Needs approval.`,
      'EXPENSE_ADDED',
      paidById
    );

    return expense;
  }

  static async update(
    expenseId: number,
    {
      title,
      description,
      amount,
      categoryId,
      date,
      paidById,
      receiptUrl,
      notes,
      splitType,
      splits,
    }: {
      title: string;
      description?: string;
      amount: number;
      categoryId: number;
      date: Date;
      paidById: number;
      receiptUrl?: string;
      notes?: string;
      splitType: 'EQUAL' | 'EXACT' | 'PERCENTAGE';
      splits: SplitInput[];
    },
    userId: number
  ) {
    const existingExpense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { approvals: true },
    });
    if (!existingExpense) {
      throw new AppError('Expense not found', 404);
    }

    // Verify creator or owner is updating
    const userMember = await prisma.member.findUnique({
      where: { userId_householdId: { userId, householdId: existingExpense.householdId } },
    });

    if (!userMember || (existingExpense.paidById !== userId && userMember.role !== 'OWNER')) {
      throw new AppError('You are not authorized to edit this expense', 403);
    }

    const householdId = existingExpense.householdId;

    // Process splits similar to creation
    const userIds = splits.map((s) => s.userId);
    const members = await prisma.member.findMany({
      where: {
        householdId,
        userId: { in: [...userIds, paidById] },
        status: MemberStatus.ACTIVE,
      },
    });

    const activeMemberIds = new Set(members.map((m) => m.userId));
    if (!activeMemberIds.has(paidById)) {
      throw new AppError('Paid-by user must be active in this household', 400);
    }

    const participantData: { userId: number; amountOwed: number; sharePercentage?: number; shareAmount?: number }[] = [];

    if (splitType === 'EQUAL') {
      const share = Number((amount / splits.length).toFixed(2));
      const sharePct = Number((100 / splits.length).toFixed(2));
      let runningSum = 0;
      let runningPctSum = 0;
      for (let i = 0; i < splits.length; i++) {
        const actualShare = i === splits.length - 1 ? Number((amount - runningSum).toFixed(2)) : share;
        runningSum += actualShare;

        const actualPct = i === splits.length - 1 ? Number((100 - runningPctSum).toFixed(2)) : sharePct;
        runningPctSum += actualPct;

        participantData.push({
          userId: splits[i].userId,
          amountOwed: actualShare,
          sharePercentage: actualPct,
          shareAmount: actualShare,
        });
      }
    } else if (splitType === 'EXACT') {
      let sum = 0;
      for (const split of splits) {
        sum += Number((split.value || 0).toFixed(2));
      }
      if (Math.abs(sum - amount) > 0.05) {
        throw new AppError(`Sum of splits (${sum}) does not equal total amount (${amount})`, 400);
      }
      for (const split of splits) {
        const roundedValue = Number((split.value || 0).toFixed(2));
        participantData.push({
          userId: split.userId,
          amountOwed: roundedValue,
          sharePercentage: Number(((roundedValue / amount) * 100).toFixed(2)),
          shareAmount: roundedValue,
        });
      }
    } else if (splitType === 'PERCENTAGE') {
      let sumPct = 0;
      for (const split of splits) {
        sumPct += Number((split.value || 0).toFixed(2));
      }
      if (Math.abs(sumPct - 100) > 0.01) {
        throw new AppError(`Sum of split percentages (${sumPct}%) must equal 100%`, 400);
      }
      let runningSum = 0;
      let runningPctSum = 0;
      for (let i = 0; i < splits.length; i++) {
        const pct = Number((splits[i].value || 0).toFixed(2));
        const actualPct = i === splits.length - 1 ? Number((100 - runningPctSum).toFixed(2)) : pct;
        runningPctSum += actualPct;

        const share = Number(((actualPct / 100) * amount).toFixed(2));
        const actualShare = i === splits.length - 1 ? Number((amount - runningSum).toFixed(2)) : share;
        runningSum += actualShare;

        participantData.push({
          userId: splits[i].userId,
          amountOwed: actualShare,
          sharePercentage: actualPct,
          shareAmount: actualShare,
        });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Delete old participants
      await tx.expenseParticipant.deleteMany({ where: { expenseId } });
      // Delete old approvals
      await tx.expenseApproval.deleteMany({ where: { expenseId } });

      const otherMembers = members.filter((m) => m.userId !== paidById);
      const initialStatus = otherMembers.length === 0 ? ExpenseStatus.APPROVED : ExpenseStatus.PENDING;

      // Update expense details
      const exp = await tx.expense.update({
        where: { id: expenseId },
        data: {
          title: title.trim(),
          description,
          amount,
          categoryId,
          date,
          paidById,
          receiptUrl: receiptUrl !== undefined ? receiptUrl : existingExpense.receiptUrl,
          notes,
          status: initialStatus,
        },
      });

      // Create new participants
      for (const part of participantData) {
        await tx.expenseParticipant.create({
          data: {
            expenseId,
            userId: part.userId,
            amountOwed: part.amountOwed,
            sharePercentage: part.sharePercentage,
            shareAmount: part.shareAmount,
          },
        });
      }

      // Create approvals
      for (const m of otherMembers) {
        await tx.expenseApproval.create({
          data: {
            expenseId,
            userId: m.userId,
            status: ApprovalStatus.PENDING,
          },
        });
      }

      return exp;
    });

    await ActivityService.log({
      householdId,
      userId,
      action: 'EXPENSE_EDITED',
      details: `Edited expense '${title}' (New amount ₹${amount}).`,
    });

    await NotificationService.notifyHousehold(
      householdId,
      `Expense '${title}' was updated. Resetting approval requests.`,
      'EXPENSE_EDITED',
      userId
    );

    return updated;
  }

  static async delete(expenseId: number, userId: number) {
    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense) {
      throw new AppError('Expense not found', 404);
    }

    const userMember = await prisma.member.findUnique({
      where: { userId_householdId: { userId, householdId: expense.householdId } },
    });

    if (!userMember || (expense.paidById !== userId && userMember.role !== 'OWNER')) {
      throw new AppError('You are not authorized to delete this expense', 403);
    }

    await prisma.expense.delete({ where: { id: expenseId } });

    await ActivityService.log({
      householdId: expense.householdId,
      userId,
      action: 'EXPENSE_DELETED',
      details: `Deleted expense '${expense.title}' of ₹${expense.amount}.`,
    });

    return expense;
  }

  static async approve(expenseId: number, userId: number) {
    const approval = await prisma.expenseApproval.findUnique({
      where: { expenseId_userId: { expenseId, userId } },
      include: { expense: true },
    });

    if (!approval) {
      throw new AppError('No pending approval request found for you on this expense', 404);
    }

    await prisma.expenseApproval.update({
      where: { id: approval.id },
      data: { status: ApprovalStatus.APPROVED },
    });

    // Check if ALL approvals are now APPROVED
    const remainingPending = await prisma.expenseApproval.count({
      where: {
        expenseId,
        status: { in: [ApprovalStatus.PENDING, ApprovalStatus.REJECTED] },
      },
    });

    if (remainingPending === 0) {
      await prisma.expense.update({
        where: { id: expenseId },
        data: { status: ExpenseStatus.APPROVED },
      });

      await NotificationService.notifyHousehold(
        approval.expense.householdId,
        `Expense '${approval.expense.title}' of ₹${approval.expense.amount} has been fully APPROVED.`,
        'EXPENSE_APPROVED'
      );
    }

    return approval.expense;
  }

  static async reject(expenseId: number, userId: number) {
    const approval = await prisma.expenseApproval.findUnique({
      where: { expenseId_userId: { expenseId, userId } },
      include: { expense: true },
    });

    if (!approval) {
      throw new AppError('No pending approval request found for you on this expense', 404);
    }

    await prisma.expenseApproval.update({
      where: { id: approval.id },
      data: { status: ApprovalStatus.REJECTED },
    });

    // Mark overall expense as REJECTED
    await prisma.expense.update({
      where: { id: expenseId },
      data: { status: ExpenseStatus.REJECTED },
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });

    await NotificationService.notifyHousehold(
      approval.expense.householdId,
      `Expense '${approval.expense.title}' was rejected by ${user?.name || 'roommate'}.`,
      'EXPENSE_REJECTED'
    );

    return approval.expense;
  }

  static async getExpenseDetails(expenseId: number, userId: number) {
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        category: true,
        paidBy: { select: { id: true, name: true, email: true, avatar: true } },
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
        approvals: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
      },
    });

    if (!expense) {
      throw new AppError('Expense not found', 404);
    }

    // Verify user is member of the household
    const member = await prisma.member.findUnique({
      where: { userId_householdId: { userId, householdId: expense.householdId } },
    });
    if (!member) {
      throw new AppError('Forbidden', 403);
    }

    return expense;
  }

  static async list({
    householdId,
    page = 1,
    limit = 10,
    search = '',
    categoryId,
    paidById,
    status,
    startDate,
    endDate,
    minAmount,
    maxAmount,
  }: {
    householdId: number;
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: number;
    paidById?: number;
    status?: ExpenseStatus;
    startDate?: Date;
    endDate?: Date;
    minAmount?: number;
    maxAmount?: number;
  }) {
    const skip = (page - 1) * limit;

    const where: any = {
      householdId,
    };

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (paidById) {
      where.paidById = paidById;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      where.amount = {};
      if (minAmount !== undefined) where.amount.gte = minAmount;
      if (maxAmount !== undefined) where.amount.lte = maxAmount;
    }

    const [total, data] = await prisma.$transaction([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          category: true,
          paidBy: { select: { id: true, name: true, email: true, avatar: true } },
          participants: {
            include: {
              user: { select: { id: true, name: true, email: true, avatar: true } },
            },
          },
          approvals: {
            include: {
              user: { select: { id: true, name: true, email: true, avatar: true } },
            },
          },
        },
      }),
    ]);

    return {
      expenses: data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // --- RECURRING EXPENSES MODULE ---

  static async createRecurringRule({
    householdId,
    title,
    description,
    amount,
    categoryId,
    paidById,
    interval,
    startDate,
  }: {
    householdId: number;
    title: string;
    description?: string;
    amount: number;
    categoryId: number;
    paidById: number;
    interval: RecurrenceInterval;
    startDate: Date;
  }) {
    // Verify categories
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) throw new AppError('Category not found', 404);

    // Verify user is member of the household
    const member = await prisma.member.findUnique({
      where: { userId_householdId: { userId: paidById, householdId } },
    });
    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new AppError('Paid-by user must be active household member', 400);
    }

    const nextDueDate = new Date(startDate);

    const rule = await prisma.recurringExpense.create({
      data: {
        householdId,
        title: title.trim(),
        description,
        amount,
        categoryId,
        paidById,
        interval,
        startDate,
        nextDueDate,
        isActive: true,
      },
    });

    await ActivityService.log({
      householdId,
      userId: paidById,
      action: 'RECURRING_EXPENSE_CREATED',
      details: `Created recurring bill rule '${title}' (₹${amount}, ${interval.toLowerCase()}).`,
    });

    return rule;
  }

  static async listRecurringRules(householdId: number) {
    return prisma.recurringExpense.findMany({
      where: { householdId },
      include: {
        category: true,
        paidBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async deleteRecurringRule(ruleId: number, userId: number) {
    const rule = await prisma.recurringExpense.findUnique({ where: { id: ruleId } });
    if (!rule) throw new AppError('Recurring expense not found', 404);

    const member = await prisma.member.findUnique({
      where: { userId_householdId: { userId, householdId: rule.householdId } },
    });

    if (!member || (rule.paidById !== userId && member.role !== 'OWNER')) {
      throw new AppError('Not authorized to delete this recurring rule', 403);
    }

    await prisma.recurringExpense.delete({ where: { id: ruleId } });
    return { success: true };
  }

  static async updateRecurringRule(ruleId: number, userId: number, data: any) {
    const rule = await prisma.recurringExpense.findUnique({ where: { id: ruleId } });
    if (!rule) throw new AppError('Recurring expense not found', 404);

    const member = await prisma.member.findUnique({
      where: { userId_householdId: { userId, householdId: rule.householdId } },
    });

    if (!member || member.status !== 'ACTIVE') {
      throw new AppError('Not authorized to modify this recurring rule', 403);
    }

    if (data.paidById !== undefined) {
      const payerMember = await prisma.member.findUnique({
        where: { userId_householdId: { userId: Number(data.paidById), householdId: rule.householdId } },
      });
      if (!payerMember || payerMember.status !== 'ACTIVE') {
        throw new AppError('Paid-by user must be active household member', 400);
      }
    }

    const updated = await prisma.recurringExpense.update({
      where: { id: ruleId },
      data: {
        title: data.title !== undefined ? data.title.trim() : undefined,
        description: data.description !== undefined ? data.description : undefined,
        amount: data.amount !== undefined ? Number(data.amount) : undefined,
        categoryId: data.categoryId !== undefined ? Number(data.categoryId) : undefined,
        paidById: data.paidById !== undefined ? Number(data.paidById) : undefined,
        interval: data.interval !== undefined ? data.interval : undefined,
        startDate: data.startDate !== undefined ? new Date(data.startDate) : undefined,
        nextDueDate: data.startDate !== undefined ? new Date(data.startDate) : undefined,
      },
    });

    return updated;
  }

  static async processRecurringExpenses() {
    console.log('Processing recurring bills checks...');
    const now = new Date();

    const pendingRules = await prisma.recurringExpense.findMany({
      where: {
        isActive: true,
        nextDueDate: { lte: now },
      },
    });

    for (const rule of pendingRules) {
      try {
        await prisma.$transaction(async (tx) => {
          // Get current active members to split this bill equally among
          const activeMembers = await tx.member.findMany({
            where: {
              householdId: rule.householdId,
              status: MemberStatus.ACTIVE,
            },
          });

          if (activeMembers.length === 0) return;

          // Generate splits
          const share = Number((rule.amount / activeMembers.length).toFixed(2));
          const sharePct = Number((100 / activeMembers.length).toFixed(2));
          let runningSum = 0;
          let runningPctSum = 0;
          const participantData: { userId: number; amountOwed: number; sharePercentage: number }[] = [];

          for (let i = 0; i < activeMembers.length; i++) {
            const actualShare = i === activeMembers.length - 1 ? Number((rule.amount - runningSum).toFixed(2)) : share;
            runningSum += actualShare;

            const actualPct = i === activeMembers.length - 1 ? Number((100 - runningPctSum).toFixed(2)) : sharePct;
            runningPctSum += actualPct;

            participantData.push({
              userId: activeMembers[i].userId,
              amountOwed: actualShare,
              sharePercentage: actualPct,
            });
          }

          // Create the expense. It is created with status PENDING so users approve/reject it.
          const otherMembers = activeMembers.filter((m) => m.userId !== rule.paidById);
          const initialStatus = otherMembers.length === 0 ? ExpenseStatus.APPROVED : ExpenseStatus.PENDING;

          const newExpense = await tx.expense.create({
            data: {
              title: `${rule.title} (Auto-Gen)`,
              description: `Automatically generated from recurring bill schedule. ${rule.description || ''}`,
              amount: rule.amount,
              categoryId: rule.categoryId,
              date: rule.nextDueDate,
              paidById: rule.paidById,
              householdId: rule.householdId,
              status: initialStatus,
              recurringExpenseId: rule.id,
            },
          });

          // Add participants
          for (const p of participantData) {
            await tx.expenseParticipant.create({
              data: {
                expenseId: newExpense.id,
                userId: p.userId,
                amountOwed: p.amountOwed,
                sharePercentage: p.sharePercentage,
                shareAmount: p.amountOwed,
              },
            });
          }

          // Add approvals
          for (const m of otherMembers) {
            await tx.expenseApproval.create({
              data: {
                expenseId: newExpense.id,
                userId: m.userId,
                status: ApprovalStatus.PENDING,
              },
            });
          }

          // Compute new nextDueDate
          const nextDate = new Date(rule.nextDueDate);
          if (rule.interval === RecurrenceInterval.DAILY) {
            nextDate.setDate(nextDate.getDate() + 1);
          } else if (rule.interval === RecurrenceInterval.WEEKLY) {
            nextDate.setDate(nextDate.getDate() + 7);
          } else if (rule.interval === RecurrenceInterval.MONTHLY) {
            nextDate.setMonth(nextDate.getMonth() + 1);
          }

          // Update rule nextDueDate
          await tx.recurringExpense.update({
            where: { id: rule.id },
            data: { nextDueDate: nextDate },
          });

          console.log(`Generated auto-expense for recurring bill '${rule.title}'`);
        });
      } catch (err) {
        console.error(`Failed to process recurring rule ID ${rule.id}:`, err);
      }
    }
  }
}
