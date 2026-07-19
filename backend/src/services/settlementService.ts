import { PrismaClient, SettlementStatus, MemberStatus, ExpenseStatus } from '@prisma/client';
import QRCode from 'qrcode';
import { AppError } from '../middleware/errorHandler';
import { ActivityService } from './activityService';
import { NotificationService } from './notificationService';

const prisma = new PrismaClient();

interface UserBalance {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  balance: number;
}

export class SettlementService {
  static async calculateBalances(householdId: number) {
    // 1. Get all active members
    const members = await prisma.member.findMany({
      where: { householdId, status: MemberStatus.ACTIVE },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    const balances: { [userId: number]: UserBalance } = {};
    for (const m of members) {
      balances[m.userId] = {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatar: m.user.avatar,
        balance: 0,
      };
    }

    // 2. Get all approved expenses
    const expenses = await prisma.expense.findMany({
      where: { householdId, status: ExpenseStatus.APPROVED },
      include: {
        participants: true,
      },
    });

    // Add amounts paid, subtract amounts owed
    for (const exp of expenses) {
      const payerId = exp.paidById;
      if (balances[payerId]) {
        balances[payerId].balance += exp.amount;
      }

      for (const part of exp.participants) {
        if (balances[part.userId]) {
          balances[part.userId].balance -= part.amountOwed;
        }
      }
    }

    // 3. Get all completed settlements
    const completedSettlements = await prisma.settlement.findMany({
      where: { householdId, status: SettlementStatus.COMPLETED },
    });

    for (const set of completedSettlements) {
      if (balances[set.fromUserId]) {
        balances[set.fromUserId].balance += set.amount; // they paid their debt
      }
      if (balances[set.toUserId]) {
        balances[set.toUserId].balance -= set.amount; // they received money
      }
    }

    // Round balances to 2 decimal places
    for (const userId in balances) {
      balances[userId].balance = Number(balances[userId].balance.toFixed(2));
    }

    return Object.values(balances);
  }

  // Like calculateBalances but also factors in PENDING settlements.
  // Used only for suggestion computation so that a payment in progress
  // immediately removes the suggestion, while the balance card numbers
  // remain unchanged until the recipient confirms receipt.
  private static async calculateBalancesWithPending(householdId: number) {
    const members = await prisma.member.findMany({
      where: { householdId, status: MemberStatus.ACTIVE },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });

    const balances: { [userId: number]: UserBalance } = {};
    for (const m of members) {
      balances[m.userId] = { id: m.user.id, name: m.user.name, email: m.user.email, avatar: m.user.avatar, balance: 0 };
    }

    const expenses = await prisma.expense.findMany({
      where: { householdId, status: ExpenseStatus.APPROVED },
      include: { participants: true },
    });

    for (const exp of expenses) {
      if (balances[exp.paidById]) balances[exp.paidById].balance += exp.amount;
      for (const part of exp.participants) {
        if (balances[part.userId]) balances[part.userId].balance -= part.amountOwed;
      }
    }

    // Count both COMPLETED and PENDING settlements so in-progress payments hide suggestions
    const allSettlements = await prisma.settlement.findMany({
      where: { householdId, status: { in: [SettlementStatus.COMPLETED, SettlementStatus.PENDING] } },
    });

    for (const set of allSettlements) {
      if (balances[set.fromUserId]) balances[set.fromUserId].balance += set.amount;
      if (balances[set.toUserId])   balances[set.toUserId].balance   -= set.amount;
    }

    for (const userId in balances) {
      balances[userId].balance = Number(balances[userId].balance.toFixed(2));
    }

    return Object.values(balances);
  }

  static async getSettlementSuggestions(householdId: number, simplify: boolean = true) {
    if (!simplify) {
      // 1. Get all active members
      const members = await prisma.member.findMany({
        where: { householdId, status: MemberStatus.ACTIVE },
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } },
        },
      });

      const userMap: { [id: number]: any } = {};
      for (const m of members) {
        userMap[m.userId] = m.user;
      }

      // 2. Fetch all approved expenses
      const expenses = await prisma.expense.findMany({
        where: { householdId, status: ExpenseStatus.APPROVED },
        include: {
          participants: true,
        },
      });

      // 3. Track net direct debts: matrix[payerId][debtorId] = amount
      const debtMatrix: { [payerId: number]: { [debtorId: number]: number } } = {};

      const addDirectDebt = (payerId: number, debtorId: number, amount: number) => {
        if (payerId === debtorId) return;
        if (!debtMatrix[payerId]) debtMatrix[payerId] = {};
        if (!debtMatrix[payerId][debtorId]) debtMatrix[payerId][debtorId] = 0;
        debtMatrix[payerId][debtorId] += amount;
      };

      for (const exp of expenses) {
        const payerId = exp.paidById;
        for (const p of exp.participants) {
          addDirectDebt(payerId, p.userId, p.amountOwed);
        }
      }

      // 4. Fetch COMPLETED + PENDING settlements to offset direct debts
      //    (Pending = payment in progress, hide from suggestions immediately)
      const allSettlements = await prisma.settlement.findMany({
        where: { householdId, status: { in: [SettlementStatus.COMPLETED, SettlementStatus.PENDING] } },
      });

      for (const set of allSettlements) {
        addDirectDebt(set.toUserId, set.fromUserId, -set.amount);
      }

      // 5. Net the directional debts between every pair of users
      const suggestions: {
        fromUser: { id: number; name: string; email: string; avatar: string | null };
        toUser: { id: number; name: string; email: string; avatar: string | null };
        amount: number;
      }[] = [];

      const userIds = Object.keys(userMap).map(Number);

      for (let i = 0; i < userIds.length; i++) {
        for (let j = i + 1; j < userIds.length; j++) {
          const uId1 = userIds[i];
          const uId2 = userIds[j];

          const owedTo1 = debtMatrix[uId1]?.[uId2] || 0; // uId2 owes uId1
          const owedTo2 = debtMatrix[uId2]?.[uId1] || 0; // uId1 owes uId2

          const net = owedTo1 - owedTo2;

          if (net > 0.01) {
            suggestions.push({
              fromUser: { id: uId2, name: userMap[uId2].name, email: userMap[uId2].email, avatar: userMap[uId2].avatar },
              toUser: { id: uId1, name: userMap[uId1].name, email: userMap[uId1].email, avatar: userMap[uId1].avatar },
              amount: Number(net.toFixed(2)),
            });
          } else if (net < -0.01) {
            suggestions.push({
              fromUser: { id: uId1, name: userMap[uId1].name, email: userMap[uId1].email, avatar: userMap[uId1].avatar },
              toUser: { id: uId2, name: userMap[uId2].name, email: userMap[uId2].email, avatar: userMap[uId2].avatar },
              amount: Number((-net).toFixed(2)),
            });
          }
        }
      }

      return suggestions;
    }

    // For suggestions, count BOTH completed and pending settlements
    // so the suggestion disappears immediately after Settle Up is clicked.
    // (calculateBalances remains COMPLETED-only - balance numbers only update after Confirm)
    const userBalances = await this.calculateBalancesWithPending(householdId);

    // Filter debtors and creditors
    const debtors = userBalances
      .filter((b) => b.balance < -0.01)
      .map((b) => ({ ...b, balance: -b.balance })); // work with positive amounts owed

    const creditors = userBalances
      .filter((b) => b.balance > 0.01)
      .map((b) => ({ ...b }));

    // Sort debtors and creditors descending by amounts to pair largest first
    debtors.sort((a, b) => b.balance - a.balance);
    creditors.sort((a, b) => b.balance - a.balance);

    const suggestions: {
      fromUser: { id: number; name: string; email: string; avatar: string | null };
      toUser: { id: number; name: string; email: string; avatar: string | null };
      amount: number;
    }[] = [];

    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];

      if (debtor.balance < 0.01) {
        dIdx++;
        continue;
      }
      if (creditor.balance < 0.01) {
        cIdx++;
        continue;
      }

      const amountToSettle = Number(Math.min(debtor.balance, creditor.balance).toFixed(2));

      suggestions.push({
        fromUser: { id: debtor.id, name: debtor.name, email: debtor.email, avatar: debtor.avatar },
        toUser: { id: creditor.id, name: creditor.name, email: creditor.email, avatar: creditor.avatar },
        amount: amountToSettle,
      });

      debtor.balance -= amountToSettle;
      creditor.balance -= amountToSettle;

      if (debtor.balance < 0.01) dIdx++;
      if (creditor.balance < 0.01) cIdx++;
    }

    return suggestions;
  }

  static async recordSettlement({
    householdId,
    fromUserId,
    toUserId,
    amount,
    date = new Date(),
    status = SettlementStatus.PENDING,
    method = 'UPI',
  }: {
    householdId: number;
    fromUserId: number;
    toUserId: number;
    amount: number;
    date?: Date;
    status?: SettlementStatus;
    method?: string;
  }) {
    // Verify users are members
    const members = await prisma.member.findMany({
      where: {
        householdId,
        userId: { in: [fromUserId, toUserId] },
        status: MemberStatus.ACTIVE,
      },
      include: { user: true },
    });

    if (members.length !== 2) {
      throw new AppError('Both users must be active members of the household', 400);
    }

    const fromMember = members.find((m) => m.userId === fromUserId);
    const toMember = members.find((m) => m.userId === toUserId);

    const settlement = await prisma.settlement.create({
      data: {
        householdId,
        fromUserId,
        toUserId,
        amount,
        status,
        date,
        method,
      },
      include: {
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
      },
    });

    const methodDisplay = method === 'CASH' ? 'Cash' : 'UPI';

    if (status === SettlementStatus.COMPLETED) {
      await ActivityService.log({
        householdId,
        userId: fromUserId,
        action: 'SETTLEMENT_RECORDED',
        details: `${fromMember?.user?.name} settled ₹${amount} with ${toMember?.user?.name} via ${methodDisplay}.`,
      });

      await NotificationService.create({
        userId: toUserId,
        message: `${fromMember?.user?.name} marked a settlement of ₹${amount} as paid to you via ${methodDisplay}.`,
        type: 'SETTLEMENT_COMPLETED',
      });
    } else if (status === SettlementStatus.PENDING) {
      await ActivityService.log({
        householdId,
        userId: fromUserId,
        action: 'SETTLEMENT_INITIATED',
        details: `${fromMember?.user?.name} initiated a settlement of ₹${amount} with ${toMember?.user?.name} via ${methodDisplay} (Pending confirmation).`,
      });

      await NotificationService.create({
        userId: toUserId,
        message: `${fromMember?.user?.name} marked a settlement of ₹${amount} as paid to you via ${methodDisplay}. Confirm receipt to complete.`,
        type: 'SETTLEMENT_PENDING',
      });
    }

    return settlement;
  }

  static async confirmSettlement(settlementId: number, userId: number) {
    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId },
      include: {
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
      },
    });

    if (!settlement) {
      throw new AppError('Settlement not found', 404);
    }

    if (settlement.toUserId !== userId) {
      throw new AppError('Only the recipient of this settlement can confirm it', 403);
    }

    if (settlement.status === SettlementStatus.COMPLETED) {
      throw new AppError('Settlement has already been confirmed', 400);
    }

    const updated = await prisma.settlement.update({
      where: { id: settlementId },
      data: { status: SettlementStatus.COMPLETED },
    });

    const details = settlement.method === 'CASH'
      ? `${settlement.toUser.name} confirmed receipt of ₹${settlement.amount} cash payment from ${settlement.fromUser.name}.`
      : `${settlement.toUser.name} confirmed receipt of ₹${settlement.amount} UPI payment from ${settlement.fromUser.name}.`;

    await ActivityService.log({
      householdId: settlement.householdId,
      userId: settlement.toUserId,
      action: 'SETTLEMENT_RECORDED',
      details,
    });

    await NotificationService.create({
      userId: settlement.fromUserId,
      message: `${settlement.toUser.name} confirmed receipt of your ₹${settlement.amount} payment.`,
      type: 'SETTLEMENT_COMPLETED',
    });

    return updated;
  }

  static async getHistory(householdId: number) {
    return prisma.settlement.findMany({
      where: { householdId },
      include: {
        fromUser: { select: { id: true, name: true, email: true, avatar: true } },
        toUser: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  static async generateUPIQRCode(upiId: string, payeeName: string, amount: number, note: string) {
    // UPI Link Format: upi://pay?pa=recipient@upi&pn=RecipientName&am=Amount&cu=INR&tn=Note
    const encodedName = encodeURIComponent(payeeName);
    const encodedNote = encodeURIComponent(note);
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodedName}&am=${amount}&cu=INR&tn=${encodedNote}`;

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(upiLink, {
        width: 300,
        margin: 2,
      });
      return { upiLink, qrCodeDataUrl };
    } catch (err) {
      throw new AppError('Failed to generate UPI QR code', 500);
    }
  }
}
