import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../utils/api';
import { useDashboardStats, useSettlementHistory, useConfirmSettlement } from '../utils/queryHooks';
import { formatCurrency, formatDate, formatDateShort } from '../utils/format';
import { 
  IndianRupee, 
  Users, 
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Download, 
  FileText, 
  Crown,
  ClipboardList,
  Clock,
  Check,
  Loader2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip as ChartTooltip, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar 
} from 'recharts';

export const Dashboard: React.FC = () => {
  const { householdId, user } = useAuth();
  const { showToast } = useToast();
  
  const { data: stats, isLoading, error } = useDashboardStats(householdId);
  const { data: history = [] } = useSettlementHistory(householdId);

  const confirmMutation = useConfirmSettlement(householdId || 0);

  const handleConfirmReceipt = (settlementId: number) => {
    confirmMutation.mutate(settlementId, {
      onSuccess: () => {
        showToast('Settlement confirmed and ledger balances updated!', 'success');
      },
      onError: (err: any) => {
        const msg = err.response?.data?.message || 'Failed to confirm settlement';
        showToast(msg, 'error');
      }
    });
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (!householdId) {
      showToast('No active household selected', 'warning');
      return;
    }

    setIsExporting(true);
    showToast(`Generating ${format.toUpperCase()} report...`, 'info');
    try {
      const response = await api.get(`/analytics/export/${householdId}?format=${format}`, {
        responseType: 'blob',
      });

      const fileExtension = format === 'pdf' ? 'pdf' : 'xlsx';
      const contentType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `flatmath_report_household_${householdId}.${fileExtension}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      showToast(`${format.toUpperCase()} report downloaded successfully!`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast(`Failed to export ${format.toUpperCase()} report`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#6b7280'];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl animate-skeleton" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl animate-skeleton" />
          <div className="h-80 bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl animate-skeleton" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
        <p className="text-red-500 font-semibold mb-2">Failed to load dashboard metrics</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Please check your network connection or verify household membership.</p>
      </div>
    );
  }



  const netBalance = stats.userStats.netBalance;
  const balanceLabel = netBalance > 0 ? 'You are owed' : netBalance < 0 ? 'You owe' : 'Settled up';
  const balanceColor = netBalance > 0 
    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' 
    : netBalance < 0 
      ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20' 
      : 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40';

  const pieData = stats.categoryBreakdown.map(item => ({
    name: item.category,
    value: item.amount
  }));

  const pendingClaims = history.filter((h: any) => h.status === 'PENDING' && h.toUserId === user?.id);

  return (
    <div className="space-y-6">
      
      {/* PENDING SETTLEMENT NOTIFICATION BANNERS */}
      {pendingClaims.map((claim: any) => (
        <div key={claim.id} className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-lg shrink-0 mt-0.5">
              <Clock className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-white leading-normal">
                {claim.fromUser.name} claims they sent you {formatCurrency(claim.amount)} via UPI/Cash.
              </p>
              <p className="text-[10px] text-gray-500 mt-1 dark:text-gray-400">
                Sent on {formatDate(claim.date)}. Confirm receipt to finalize the transfer and update ledger balances.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              onClick={() => handleConfirmReceipt(claim.id)}
              disabled={confirmMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/70 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all shadow-xs flex items-center gap-1.5 shrink-0"
            >
              {confirmMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Confirm & Approve
                </>
              )}
            </button>
          </div>
        </div>
      ))}

      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Household Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track shared group expenses, individual contributions, and active splits.</p>
        </div>
        
        {/* EXPORTS */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleExport('pdf')}
            disabled={isExporting}
            className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700/80 disabled:opacity-50 px-4 py-2 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            Export PDF Report
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={isExporting}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel Sheet
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Group Spend (Current Month) */}
        <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Group Spend (Current Month)</span>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatCurrency(stats.currentMonthExpenses)}
            </h3>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>

        {/* Your Contribution */}
        <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">You Paid</span>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatCurrency(stats.userStats.totalPaid)}
            </h3>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block">Your contributions</span>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        {/* Net Balance */}
        <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Net Balance</span>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatCurrency(Math.abs(stats.userStats.netBalance))}
            </h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded mt-1.5 inline-block font-semibold ${balanceColor}`}>
              {balanceLabel}
            </span>
          </div>
          <div className={`p-3 rounded-lg ${
            netBalance >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
          }`}>
            {netBalance >= 0 ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
          </div>
        </div>

        {/* Roommates */}
        <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Roommates</span>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {stats.totalMembers}
            </h3>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block">Active members</span>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* CHARTS GRAPHICS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Spending Trajectory */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold text-sm text-gray-900 dark:text-white">Spending Trajectory</h4>
          </div>
          <div className="h-64 w-full">
            {stats.monthlySpendingTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No monthly data logged yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.monthlySpendingTrend}>
                  <defs>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => formatCurrency(val).replace(/\.00$/, '')} />
                  <ChartTooltip 
                    contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    formatter={(value) => [formatCurrency(Number(value)), 'Amount']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorSpend)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Breakdown (Pie) */}
        <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-6">Category Breakdown</h4>
            <div className="h-44 w-full relative flex items-center justify-center">
              {pieData.length === 0 ? (
                <div className="text-xs text-gray-400">No category totals yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip 
                      contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                      formatter={(value) => [formatCurrency(Number(value)), 'Amount']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          
          {/* Pie Legends */}
          <div className="mt-4 grid grid-cols-2 gap-2 max-h-24 overflow-y-auto pr-1">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-gray-600 dark:text-gray-400 truncate">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* LOWER SPLIT LAYOUT: HIGHEST SPENDER + CONTRIBUTIONS CHART + RECENT EXPENSES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Contributor contributions */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-6">Share by Roommate</h4>
            <div className="h-56 w-full">
              {stats.memberContributionChart.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">No member spends recorded</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.memberContributionChart}>
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => formatCurrency(val).replace(/\.00$/, '')} />
                    <ChartTooltip 
                      contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                      formatter={(value) => [formatCurrency(Number(value)), 'Total Paid']}
                    />
                    <Bar dataKey="paidAmount" radius={[4, 4, 0, 0]}>
                      {stats.memberContributionChart.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Spender highlight & Recent Expenses */}
        <div className="space-y-6">
          
          {/* Highest Spender Card */}
          <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-lg shrink-0">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/25 px-1.5 py-0.5 rounded uppercase tracking-wider">
                Top Contributor
              </span>
              <h4 className="font-bold text-gray-900 dark:text-white mt-1 text-base">
                {stats.highestSpender && stats.highestSpender.name !== 'N/A' ? stats.highestSpender.name : 'Nobody yet'}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Paid {stats.highestSpender ? formatCurrency(stats.highestSpender.amount) : '₹0.00'} this cycle
              </p>
            </div>
          </div>

          {/* Recent Expenses List */}
          <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
            <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <ClipboardList className="w-4 h-4 text-gray-400" />
              Recent Expenses
            </h4>
            <div className="space-y-3.5 max-h-48 overflow-y-auto pr-1">
              {stats.recentExpenses.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No expenses recorded yet</p>
              ) : (
                stats.recentExpenses.map((exp) => (
                  <div key={exp.id} className="flex justify-between items-start text-xs">
                    <div className="flex gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-gray-850 dark:text-gray-300 font-semibold leading-normal">{exp.title}</p>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 block mt-0.5">
                          Payer: {exp.paidBy.name} • {formatDateShort(exp.date)}
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-gray-900 dark:text-white shrink-0 ml-2">
                      {formatCurrency(exp.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default Dashboard;
