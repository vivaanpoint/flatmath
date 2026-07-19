import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';

// --- TYPES ---
export interface User {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
}

export interface Household {
  id: number;
  name: string;
  inviteCode: string;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: number;
    name: string;
    email: string;
  };
  _count?: {
    members: number;
  };
}

export interface Member {
  id: number;
  userId: number;
  householdId: number;
  role: 'OWNER' | 'MEMBER';
  status: 'ACTIVE' | 'PENDING';
  joinedAt: string;
  user: User;
}

export interface HouseholdDetails extends Household {
  members: Member[];
}

export interface Category {
  id: number;
  name: string;
}

export interface Participant {
  id: number;
  expenseId: number;
  userId: number;
  amountOwed: number;
  sharePercentage: number | null;
  shareAmount: number | null;
  user: User;
}

export interface Approval {
  id: number;
  expenseId: number;
  userId: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  updatedAt: string;
  user: User;
}

export interface Expense {
  id: number;
  title: string;
  description: string | null;
  amount: number;
  categoryId: number;
  date: string;
  paidById: number;
  householdId: number;
  receiptUrl: string | null;
  notes: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  recurringExpenseId: number | null;
  createdAt: string;
  updatedAt: string;
  category: Category;
  paidBy: User;
  participants: Participant[];
  approvals: Approval[];
}

export interface ExpenseListResponse {
  expenses: Expense[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface RecurringRule {
  id: number;
  householdId: number;
  title: string;
  description: string | null;
  amount: number;
  categoryId: number;
  paidById: number;
  interval: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  startDate: string;
  nextDueDate: string;
  isActive: boolean;
  createdAt: string;
  category: Category;
  paidBy: User;
}

export interface Balance {
  userId: number;
  name: string;
  email: string;
  avatar: string | null;
  totalPaid: number;
  totalOwed: number;
  netBalance: number; // positive = others owe them, negative = they owe others
}

export interface Suggestion {
  fromUserId: number;
  fromUserName: string;
  toUserId: number;
  toUserName: string;
  amount: number;
}

export interface Settlement {
  id: number;
  householdId: number;
  fromUserId: number;
  toUserId: number;
  amount: number;
  status: 'PENDING' | 'COMPLETED';
  date: string;
  createdAt: string;
  fromUser: User;
  toUser: User;
}

export interface DashboardStats {
  totalHouseholdExpenses: number;
  currentMonthExpenses: number;
  averageMonthlySpending: number;
  totalMembers: number;
  highestSpender: {
    name: string;
    amount: number;
  };
  userStats: {
    totalPaid: number;
    totalOwed: number;
    netBalance: number;
    contributionPercentage: number;
  };
  monthlySpendingTrend: {
    month: string;
    amount: number;
  }[];
  categoryBreakdown: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  memberContributionChart: {
    id: number;
    name: string;
    paidAmount: number;
    percentage: number;
    netBalance: number;
  }[];
  recentExpenses: {
    id: number;
    title: string;
    amount: number;
    date: string;
    category: Category;
    paidBy: User;
  }[];
  upcomingRecurringBills: any[];
  pendingSettlementsSummary: any[];
  activityLogs: {
    id: number;
    action: string;
    details: string;
    createdAt: string;
    user: {
      name: string;
    };
  }[];
}

export interface Notification {
  id: number;
  userId: number;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

// --- HOUSEHOLD HOOKS ---

export const useHouseholds = () => {
  return useQuery<Household[]>({
    queryKey: ['households'],
    queryFn: async () => {
      const res = await api.get('/households');
      return res.data.data;
    },
  });
};

export const usePendingInvites = () => {
  return useQuery<any[]>({
    queryKey: ['pendingInvites'],
    queryFn: async () => {
      const res = await api.get('/households/invitations/pending');
      return res.data.data;
    },
  });
};

export const useHouseholdDetails = (householdId: number | null) => {
  return useQuery<HouseholdDetails>({
    queryKey: ['household', householdId],
    queryFn: async () => {
      const res = await api.get(`/households/${householdId}`);
      return res.data.data;
    },
    enabled: !!householdId,
  });
};

export const useCreateHousehold = () => {
  const queryClient = useQueryClient();
  return useMutation<Household, Error, { name: string }>({
    mutationFn: async (data) => {
      const res = await api.post('/households', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
    },
  });
};

export const useJoinHousehold = () => {
  const queryClient = useQueryClient();
  return useMutation<Household, Error, { code: string }>({
    mutationFn: async (data) => {
      const res = await api.post('/households/join', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
    },
  });
};

export const useInviteMember = (householdId: number) => {
  return useMutation<any, Error, { email: string }>({
    mutationFn: async (data) => {
      const res = await api.post(`/households/${householdId}/invite`, data);
      return res.data.data;
    },
  });
};

export const useChangeMemberRole = (householdId: number) => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, { userId: number; role: 'OWNER' | 'MEMBER' }>({
    mutationFn: async ({ userId, role }) => {
      const res = await api.put(`/households/${householdId}/members/${userId}/role`, { role });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household', householdId] });
    },
  });
};

export const useRemoveMember = (householdId: number) => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, number>({
    mutationFn: async (userId) => {
      const res = await api.delete(`/households/${householdId}/members/${userId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['household', householdId] });
    },
  });
};

export const useDeleteHousehold = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, number>({
    mutationFn: async (householdId) => {
      const res = await api.delete(`/households/${householdId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
    },
  });
};

// --- EXPENSE HOOKS ---

export const useCategories = () => {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/expenses/categories');
      return res.data.data;
    },
  });
};

export const useExpenses = (
  householdId: number | null,
  filters: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: number;
    paidById?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
  }
) => {
  return useQuery<ExpenseListResponse>({
    queryKey: ['expenses', householdId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.search) params.append('search', filters.search);
      if (filters.categoryId) params.append('categoryId', filters.categoryId.toString());
      if (filters.paidById) params.append('paidById', filters.paidById.toString());
      if (filters.status) params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.minAmount) params.append('minAmount', filters.minAmount.toString());
      if (filters.maxAmount) params.append('maxAmount', filters.maxAmount.toString());

      const res = await api.get(`/expenses/list/${householdId}?${params.toString()}`);
      return res.data.data;
    },
    enabled: !!householdId,
  });
};

export const useExpenseDetails = (expenseId: number | null) => {
  return useQuery<Expense>({
    queryKey: ['expense', expenseId],
    queryFn: async () => {
      const res = await api.get(`/expenses/details/${expenseId}`);
      return res.data.data;
    },
    enabled: !!expenseId,
  });
};

export const useCreateExpense = (householdId: number) => {
  const queryClient = useQueryClient();
  return useMutation<Expense, Error, FormData>({
    mutationFn: async (formData) => {
      const res = await api.post(`/expenses/${householdId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', householdId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats', householdId] });
      queryClient.invalidateQueries({ queryKey: ['balances', householdId] });
      queryClient.invalidateQueries({ queryKey: ['suggestions', householdId] });
    },
  });
};

export const useUpdateExpense = (householdId: number) => {
  const queryClient = useQueryClient();
  return useMutation<Expense, Error, { expenseId: number; formData: FormData }>({
    mutationFn: async ({ expenseId, formData }) => {
      const res = await api.put(`/expenses/${expenseId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expenses', householdId] });
      queryClient.invalidateQueries({ queryKey: ['expense', variables.expenseId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats', householdId] });
      queryClient.invalidateQueries({ queryKey: ['balances', householdId] });
      queryClient.invalidateQueries({ queryKey: ['suggestions', householdId] });
    },
  });
};

export const useDeleteExpense = (householdId: number) => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, number>({
    mutationFn: async (expenseId) => {
      const res = await api.delete(`/expenses/${expenseId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', householdId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats', householdId] });
      queryClient.invalidateQueries({ queryKey: ['balances', householdId] });
      queryClient.invalidateQueries({ queryKey: ['suggestions', householdId] });
    },
  });
};

export const useApproveExpense = (householdId: number) => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, number>({
    mutationFn: async (expenseId) => {
      const res = await api.post(`/expenses/approve/${expenseId}`);
      return res.data;
    },
    onSuccess: (_, expenseId) => {
      queryClient.invalidateQueries({ queryKey: ['expenses', householdId] });
      queryClient.invalidateQueries({ queryKey: ['expense', expenseId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats', householdId] });
      queryClient.invalidateQueries({ queryKey: ['balances', householdId] });
      queryClient.invalidateQueries({ queryKey: ['suggestions', householdId] });
    },
  });
};

export const useRejectExpense = (householdId: number) => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, number>({
    mutationFn: async (expenseId) => {
      const res = await api.post(`/expenses/reject/${expenseId}`);
      return res.data;
    },
    onSuccess: (_, expenseId) => {
      queryClient.invalidateQueries({ queryKey: ['expenses', householdId] });
      queryClient.invalidateQueries({ queryKey: ['expense', expenseId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats', householdId] });
      queryClient.invalidateQueries({ queryKey: ['balances', householdId] });
      queryClient.invalidateQueries({ queryKey: ['suggestions', householdId] });
    },
  });
};

// --- RECURRING BILLS HOOKS ---

export const useCreateRecurringRule = (householdId: number) => {
  const queryClient = useQueryClient();
  return useMutation<
    RecurringRule,
    Error,
    {
      title: string;
      description?: string;
      amount: number;
      categoryId: number;
      paidById: number;
      interval: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      startDate: string;
    }
  >({
    mutationFn: async (data) => {
      const res = await api.post(`/expenses/recurring/${householdId}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringRules', householdId] });
    },
  });
};

export const useRecurringRules = (householdId: number | null) => {
  return useQuery<RecurringRule[]>({
    queryKey: ['recurringRules', householdId],
    queryFn: async () => {
      const res = await api.get(`/expenses/recurring/list/${householdId}`);
      return res.data.data;
    },
    enabled: !!householdId,
  });
};

export const useDeleteRecurringRule = (householdId: number) => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, number>({
    mutationFn: async (ruleId) => {
      const res = await api.delete(`/expenses/recurring/${ruleId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringRules', householdId] });
    },
  });
};

export const useUpdateRecurringRule = (householdId: number) => {
  const queryClient = useQueryClient();
  return useMutation<
    RecurringRule,
    Error,
    {
      ruleId: number;
      data: {
        title?: string;
        description?: string;
        amount?: number;
        categoryId?: number;
        paidById?: number;
        interval?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
        startDate?: string;
      };
    }
  >({
    mutationFn: async ({ ruleId, data }) => {
      const res = await api.put(`/expenses/recurring/${ruleId}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringRules', householdId] });
    },
  });
};

// --- SETTLEMENTS HOOKS ---

export const useBalances = (householdId: number | null) => {
  return useQuery<Balance[]>({
    queryKey: ['balances', householdId],
    queryFn: async () => {
      const res = await api.get(`/settlements/balances/${householdId}`);
      return res.data.data;
    },
    enabled: !!householdId,
  });
};

export const useSuggestions = (householdId: number | null, simplify: boolean = true) => {
  return useQuery<Suggestion[]>({
    queryKey: ['suggestions', householdId, simplify],
    queryFn: async () => {
      const res = await api.get(`/settlements/suggestions/${householdId}?simplify=${simplify}`);
      return res.data.data;
    },
    enabled: !!householdId,
  });
};

export const useRecordSettlement = (householdId: number) => {
  const queryClient = useQueryClient();
  return useMutation<
    any,
    Error,
    { fromUserId: number; toUserId: number; amount: number; date?: string; method?: string }
  >({
    mutationFn: async (data) => {
      const res = await api.post(`/settlements/record/${householdId}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balances', householdId] });
      queryClient.invalidateQueries({ queryKey: ['suggestions', householdId] });
      queryClient.invalidateQueries({ queryKey: ['settlementHistory', householdId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats', householdId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', householdId] });
    },
  });
};

export const useSettlementHistory = (householdId: number | null) => {
  return useQuery<Settlement[]>({
    queryKey: ['settlementHistory', householdId],
    queryFn: async () => {
      const res = await api.get(`/settlements/history/${householdId}`);
      return res.data.data;
    },
    enabled: !!householdId,
  });
};

export const useConfirmSettlement = (householdId: number) => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, number>({
    mutationFn: async (settlementId) => {
      const res = await api.post(`/settlements/confirm/${settlementId}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balances', householdId] });
      queryClient.invalidateQueries({ queryKey: ['suggestions', householdId] });
      queryClient.invalidateQueries({ queryKey: ['settlementHistory', householdId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats', householdId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', householdId] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

// --- ANALYTICS HOOKS ---

export const useDashboardStats = (householdId: number | null) => {
  return useQuery<DashboardStats>({
    queryKey: ['dashboardStats', householdId],
    queryFn: async () => {
      const res = await api.get(`/analytics/dashboard/${householdId}`);
      return res.data.data;
    },
    enabled: !!householdId,
  });
};

export const usePersonalStats = () => {
  return useQuery<any>({
    queryKey: ['personalStats'],
    queryFn: async () => {
      const res = await api.get('/analytics/personal');
      return res.data.data;
    },
  });
};

// --- NOTIFICATION HOOKS ---

export const useNotifications = () => {
  return useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return res.data.data;
    },
    refetchInterval: 15000, // Poll every 15s for dynamic header indicators
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, number>({
    mutationFn: async (notificationId) => {
      const res = await api.put(`/notifications/${notificationId}/read`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, void>({
    mutationFn: async () => {
      const res = await api.put('/notifications/read-all');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};
