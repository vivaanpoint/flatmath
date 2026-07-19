import { PrismaClient, MemberStatus, ExpenseStatus } from '@prisma/client';
import { SettlementService } from './settlementService';
import { ActivityService } from './activityService';

const prisma = new PrismaClient();

export class AnalyticsService {
  static async getDashboardStats(householdId: number, userId: number) {
    // Fetch all independent stats concurrently in parallel
    const [
      memberCount,
      approvedExpenses,
      recentExpenses,
      upcomingRecurringBills,
      pendingSettlements,
      activityLogs,
      balances
    ] = await Promise.all([
      prisma.member.count({
        where: { householdId, status: MemberStatus.ACTIVE },
      }),
      prisma.expense.findMany({
        where: { householdId, status: ExpenseStatus.APPROVED },
        include: { category: true, paidBy: true, participants: true },
      }),
      prisma.expense.findMany({
        where: { householdId },
        include: {
          category: true,
          paidBy: { select: { name: true, avatar: true } },
        },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      prisma.recurringExpense.findMany({
        where: { householdId, isActive: true },
        include: { category: true },
        orderBy: { nextDueDate: 'asc' },
        take: 5,
      }),
      SettlementService.getSettlementSuggestions(householdId),
      ActivityService.getLogs(householdId, 20),
      SettlementService.calculateBalances(householdId),
    ]);

    const totalHouseholdExpenses = approvedExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // User specific stats: Total Paid, Total Owed, Net Balance
    const userBalance = balances.find((b) => b.id === userId);
    
    // Total paid by user
    const totalPaidByUser = approvedExpenses
      .filter((exp) => exp.paidById === userId)
      .reduce((sum, exp) => sum + exp.amount, 0);

    // Total owed by user
    const totalOwedByUser = approvedExpenses.reduce((sum, exp) => {
      const part = exp.participants.find((p) => p.userId === userId);
      return sum + (part ? part.amountOwed : 0);
    }, 0);

    // Contribution percentage
    const userContributionPercentage = totalHouseholdExpenses > 0
      ? Number(((totalPaidByUser / totalHouseholdExpenses) * 100).toFixed(1))
      : 0;

    // 4. Highest Spender
    const payerTotals: { [name: string]: number } = {};
    for (const exp of approvedExpenses) {
      const name = exp.paidBy.name;
      payerTotals[name] = (payerTotals[name] || 0) + exp.amount;
    }
    let highestSpenderName = 'N/A';
    let highestSpenderAmount = 0;
    for (const name in payerTotals) {
      if (payerTotals[name] > highestSpenderAmount) {
        highestSpenderAmount = payerTotals[name];
        highestSpenderName = name;
      }
    }

    // 5. Category breakdown
    const categoryTotals: { [cat: string]: number } = {};
    for (const exp of approvedExpenses) {
      const cat = exp.category.name;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount;
    }
    const categoryBreakdown = Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
      percentage: totalHouseholdExpenses > 0 ? Number(((amount / totalHouseholdExpenses) * 100).toFixed(1)) : 0,
    }));

    // 6. Member contribution chart
    const memberContributionChart = balances.map((b) => {
      const paid = approvedExpenses
        .filter((exp) => exp.paidById === b.id)
        .reduce((sum, exp) => sum + exp.amount, 0);
      return {
        id: b.id,
        name: b.name,
        paidAmount: Number(paid.toFixed(2)),
        percentage: totalHouseholdExpenses > 0 ? Number(((paid / totalHouseholdExpenses) * 100).toFixed(1)) : 0,
        netBalance: b.balance,
      };
    });

    // 7. Monthly spending trend (Last 6 months)
    const monthlyTrendMap: { [monthStr: string]: number } = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Seed last 6 months with 0
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
      monthlyTrendMap[key] = 0;
    }

    for (const exp of approvedExpenses) {
      const expDate = new Date(exp.date);
      const key = `${months[expDate.getMonth()]} ${expDate.getFullYear()}`;
      if (monthlyTrendMap[key] !== undefined) {
        monthlyTrendMap[key] += exp.amount;
      }
    }

    const monthlySpendingTrend = Object.entries(monthlyTrendMap).map(([month, amount]) => ({
      month,
      amount: Number(amount.toFixed(2)),
    }));

    // Average monthly spending
    const activeMonths = Object.keys(monthlyTrendMap).length || 1;
    const averageMonthlySpending = Number((totalHouseholdExpenses / activeMonths).toFixed(2));



    // Current month expenses
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const currentMonthExpenses = approvedExpenses
      .filter((exp) => {
        const d = new Date(exp.date);
        return d >= startOfMonth && d <= endOfMonth;
      })
      .reduce((sum, exp) => sum + exp.amount, 0);

    return {
      totalHouseholdExpenses: Number(totalHouseholdExpenses.toFixed(2)),
      currentMonthExpenses: Number(currentMonthExpenses.toFixed(2)),
      averageMonthlySpending,
      totalMembers: memberCount,
      highestSpender: {
        name: highestSpenderName,
        amount: Number(highestSpenderAmount.toFixed(2)),
      },
      userStats: {
        totalPaid: Number(totalPaidByUser.toFixed(2)),
        totalOwed: Number(totalOwedByUser.toFixed(2)),
        netBalance: userBalance ? userBalance.balance : 0,
        contributionPercentage: userContributionPercentage,
      },
      monthlySpendingTrend,
      categoryBreakdown,
      memberContributionChart,
      recentExpenses,
      upcomingRecurringBills,
      pendingSettlementsSummary: pendingSettlements,
      activityLogs,
    };
  }

  static async getUserProfileStats(userId: number) {
    // Aggregated stats for a user across all their households
    const memberships = await prisma.member.findMany({
      where: { userId, status: MemberStatus.ACTIVE },
    });

    const householdIds = memberships.map((m) => m.householdId);

    // Calculate aggregated numbers
    let totalPaid = 0;
    let totalOwed = 0;
    let netBalance = 0;

    for (const hId of householdIds) {
      const balances = await SettlementService.calculateBalances(hId);
      const b = balances.find((x) => x.id === userId);
      if (b) {
        netBalance += b.balance;
      }

      const approvedExpenses = await prisma.expense.findMany({
        where: { householdId: hId, status: ExpenseStatus.APPROVED },
        include: { participants: true },
      });

      const paid = approvedExpenses
        .filter((exp) => exp.paidById === userId)
        .reduce((sum, exp) => sum + exp.amount, 0);

      const owed = approvedExpenses.reduce((sum, exp) => {
        const part = exp.participants.find((p) => p.userId === userId);
        return sum + (part ? part.amountOwed : 0);
      }, 0);

      totalPaid += paid;
      totalOwed += owed;
    }

    // Spend history (aggregate monthly approved expenses)
    const expenses = await prisma.expense.findMany({
      where: {
        status: ExpenseStatus.APPROVED,
        participants: { some: { userId } },
      },
      include: { participants: true },
      orderBy: { date: 'desc' },
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const historyMap: { [monthStr: string]: number } = {};
    
    // Seed last 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
      historyMap[key] = 0;
    }

    for (const exp of expenses) {
      const expDate = new Date(exp.date);
      const key = `${months[expDate.getMonth()]} ${expDate.getFullYear()}`;
      if (historyMap[key] !== undefined) {
        const part = exp.participants.find((p) => p.userId === userId);
        if (part) {
          historyMap[key] += part.amountOwed;
        }
      }
    }

    const personalMonthlyHistory = Object.entries(historyMap).map(([month, amount]) => ({
      month,
      amount: Number(amount.toFixed(2)),
    }));

    return {
      totalPaid: Number(totalPaid.toFixed(2)),
      totalOwed: Number(totalOwed.toFixed(2)),
      netBalance: Number(netBalance.toFixed(2)),
      personalMonthlyHistory,
    };
  }
}
