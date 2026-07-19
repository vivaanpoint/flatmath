import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDateShort } from '../utils/format';
import api from '../utils/api';
import {
  useExpenses,
  useCategories,
  useHouseholdDetails,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useApproveExpense,
  useRejectExpense
} from '../utils/queryHooks';
import {
  Plus,
  Search,
  Filter,
  FileText,
  Check,
  X,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  FolderOpen
} from 'lucide-react';
import Modal from '../components/Modal';

export const Expenses: React.FC = () => {
  const { householdId, user } = useAuth();
  const { showToast } = useToast();

  const getReceiptUrl = (url: string | null | undefined) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    return `${baseUrl}${url}`;
  };

  // Filters & State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
  const [selectedPaidBy, setSelectedPaidBy] = useState<number | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Modals & Drawers
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [activeExpenseId, setActiveExpenseId] = useState<number | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidById, setPaidById] = useState(user?.id.toString() || '');
  const [splitType, setSplitType] = useState<'EQUAL' | 'EXACT' | 'PERCENTAGE'>('EQUAL');
  const [splitParticipants, setSplitParticipants] = useState<Record<number, { checked: boolean; value: string }>>({});
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Fetch queries
  const { data: catData = [] } = useCategories();
  const { data: hhData } = useHouseholdDetails(householdId);
  const { data: ledgerData, isLoading } = useExpenses(householdId, {
    page,
    limit: 8,
    search,
    categoryId: selectedCategory,
    paidById: selectedPaidBy,
    status: selectedStatus || undefined
  });

  const createExpenseMutation = useCreateExpense(householdId || 0);
  const updateExpenseMutation = useUpdateExpense(householdId || 0);
  const deleteExpenseMutation = useDeleteExpense(householdId || 0);
  const approveMutation = useApproveExpense(householdId || 0);
  const rejectMutation = useRejectExpense(householdId || 0);

  const selectedExpense = ledgerData?.expenses?.find(e => e.id === activeExpenseId);
  const members = hhData?.members || [];

  const handleScanReceipt = async () => {
    if (!receiptFile) {
      showToast('Please select a receipt file first', 'warning');
      return;
    }

    setIsScanning(true);
    showToast('AI is reading receipt details...', 'info');

    try {
      const formData = new FormData();
      formData.append('receipt', receiptFile);

      const response = await api.post('/expenses/scan-receipt', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { amount: scannedAmount, merchant: scannedMerchant, date: scannedDate } = response.data.data;

      if (scannedAmount) {
        setAmount(scannedAmount.toString());
      }
      if (scannedMerchant) {
        setTitle(scannedMerchant);
      }
      if (scannedDate) {
        setDate(scannedDate.split('T')[0]);
      }

      showToast(response.data.message || 'AI scanned successfully!', 'success');
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || 'Failed to scan receipt';
      showToast(msg, 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // Reset Add Form
  const resetAddForm = () => {
    setTitle('');
    setDescription('');
    setAmount('');
    setCategoryId(catData[0]?.id.toString() || '');
    setDate(new Date().toISOString().split('T')[0]);
    setPaidById(user?.id.toString() || '');
    setSplitType('EQUAL');
    setReceiptFile(null);

    // Default all members checked
    const initialParticipants: Record<number, { checked: boolean; value: string }> = {};
    members.forEach(m => {
      initialParticipants[m.userId] = { checked: true, value: '' };
    });
    setSplitParticipants(initialParticipants);
  };

  const openAddModal = () => {
    resetAddForm();
    setIsAddOpen(true);
  };

  const openEditModal = (expense: any) => {
    setTitle(expense.title);
    setDescription(expense.description || '');
    setAmount(expense.amount.toString());
    setCategoryId(expense.categoryId.toString());
    setDate(new Date(expense.date).toISOString().split('T')[0]);
    setPaidById(expense.paidById.toString());
    setSplitType(expense.splitType || 'EQUAL');
    setReceiptFile(null);

    const initialParticipants: Record<number, { checked: boolean; value: string }> = {};
    members.forEach(m => {
      const part = expense.participants.find((p: any) => p.userId === m.userId);
      const isChecked = !!part;
      let val = '';
      if (part) {
        val = expense.splitType === 'EXACT'
          ? (part.shareAmount || '').toString()
          : expense.splitType === 'PERCENTAGE'
            ? (part.sharePercentage || '').toString()
            : '';
      }
      initialParticipants[m.userId] = { checked: isChecked, value: val };
    });
    setSplitParticipants(initialParticipants);
    setActiveExpenseId(expense.id);
    setIsEditOpen(true);
  };

  const handleParticipantCheck = (userId: number) => {
    setSplitParticipants(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        checked: !prev[userId]?.checked
      }
    }));
  };

  const handleParticipantValueChange = (userId: number, value: string) => {
    setSplitParticipants(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        value
      }
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent, isEditMode: boolean) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!title || isNaN(numAmount) || numAmount <= 0 || !categoryId || !paidById) {
      showToast('Please verify all details are filled and positive', 'warning');
      return;
    }

    const checkedParticipants = Object.entries(splitParticipants)
      .filter(([_, data]) => data.checked)
      .map(([userId, data]) => ({
        userId: parseInt(userId, 10),
        value: data.value ? parseFloat(data.value) : undefined
      }));

    if (checkedParticipants.length === 0) {
      showToast('At least one roommate must participate in the split', 'warning');
      return;
    }

    // Split Validation
    if (splitType === 'EXACT') {
      const totalSplit = checkedParticipants.reduce((sum, p) => sum + (p.value || 0), 0);
      if (Math.abs(totalSplit - numAmount) > 0.05) {
        showToast(`Sum of exact splits (${totalSplit}) must match total amount (${numAmount})`, 'error');
        return;
      }
    } else if (splitType === 'PERCENTAGE') {
      const totalPct = checkedParticipants.reduce((sum, p) => sum + (p.value || 0), 0);
      if (Math.abs(totalPct - 100) > 0.1) {
        showToast(`Sum of percentages (${totalPct}%) must equal exactly 100%`, 'error');
        return;
      }
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('amount', numAmount.toString());
    formData.append('categoryId', categoryId);
    formData.append('date', new Date(date).toISOString());
    formData.append('paidById', paidById);
    formData.append('splitType', splitType);
    formData.append('splits', JSON.stringify(checkedParticipants));
    if (receiptFile) {
      formData.append('receipt', receiptFile);
    }

    const options = {
      onSuccess: () => {
        showToast(isEditMode ? 'Expense updated!' : 'Expense added successfully!', 'success');
        setIsAddOpen(false);
        setIsEditOpen(false);
        setActiveExpenseId(null);
      },
      onError: (err: any) => {
        const msg = err.response?.data?.message || 'Error occurred';
        showToast(msg, 'error');
      }
    };

    if (isEditMode && activeExpenseId) {
      updateExpenseMutation.mutate({ expenseId: activeExpenseId, formData }, options);
    } else {
      createExpenseMutation.mutate(formData, options);
    }
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    deleteExpenseMutation.mutate(id, {
      onSuccess: () => {
        showToast('Expense deleted successfully', 'success');
        setActiveExpenseId(null);
      }
    });
  };

  const handleApprove = (id: number) => {
    approveMutation.mutate(id, {
      onSuccess: () => showToast('Expense approved', 'success')
    });
  };

  const handleReject = (id: number) => {
    rejectMutation.mutate(id, {
      onSuccess: () => showToast('Expense rejected', 'warning')
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

      {/* LEFT AREA: Ledger table & search filter stack */}
      <div className="lg:col-span-2 space-y-6">

        {/* Table Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 p-4 rounded-xl shadow-xs">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by description or keyword...."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-hidden"
            />
          </div>

          <button
            onClick={openAddModal}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-xs cursor-pointer shrink-0 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>

        {/* Expense List Card */}
        <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs overflow-hidden">

          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Transaction History</h3>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              {/* Category Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">Category:</span>
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  className="bg-transparent border-none text-xs font-semibold focus:ring-0 cursor-pointer text-gray-700 dark:text-gray-300"
                >
                  <option value="" className="text-gray-950">All</option>
                  {catData.map(c => (
                    <option key={c.id} value={c.id} className="text-gray-950">{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Paid By Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">Paid By:</span>
                <select
                  value={selectedPaidBy || ''}
                  onChange={(e) => setSelectedPaidBy(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  className="bg-transparent border-none text-xs font-semibold focus:ring-0 cursor-pointer text-gray-700 dark:text-gray-300"
                >
                  <option value="" className="text-gray-950">All</option>
                  {members.map(m => (
                    <option key={m.userId} value={m.userId} className="text-gray-950">{m.user.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-transparent border-none text-xs font-semibold focus:ring-0 cursor-pointer text-gray-700 dark:text-gray-300"
                >
                  <option value="" className="text-gray-950">Status</option>
                  <option value="PENDING" className="text-gray-950">Pending</option>
                  <option value="APPROVED" className="text-gray-950">Approved</option>
                  <option value="REJECTED" className="text-gray-950">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* List Content */}
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="h-12 bg-gray-50 dark:bg-[#15181e] rounded-lg animate-skeleton" />
              ))}
            </div>
          ) : !ledgerData || !ledgerData.expenses || ledgerData.expenses.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 gap-2">
              <FolderOpen className="w-12 h-12 text-gray-300" />
              <span className="text-sm font-semibold">No expenses found</span>
              <span className="text-xs">Adjust filters or record a new transaction.</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {ledgerData.expenses.map((expense) => {
                const isSelected = expense.id === activeExpenseId;
                const payer = members.find(m => m.userId === expense.paidById);

                const statusColor = {
                  APPROVED: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-950/40',
                  REJECTED: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-950/40',
                  PENDING: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-950/40'
                }[expense.status];

                return (
                  <div
                    key={expense.id}
                    onClick={() => setActiveExpenseId(expense.id)}
                    className={`px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-850/40 cursor-pointer transition-all ${isSelected ? 'bg-blue-50/20 dark:bg-blue-950/10 border-l-4 border-l-blue-600' : ''
                      }`}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2.5">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{expense.title}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${statusColor}`}>
                          {expense.status.toLowerCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>{expense.category.name}</span>
                        <span>•</span>
                        <span>Payer: {payer?.user.name || 'Roommate'}</span>
                        <span>•</span>
                        <span>{formatDateShort(expense.date)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-gray-900 dark:text-white">
                        {formatCurrency(expense.amount)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {ledgerData && ledgerData.pagination && ledgerData.pagination.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
              <span>Showing Page {page} of {ledgerData.pagination.pages}</span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-1.5 rounded border border-gray-200 dark:border-gray-800 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= ledgerData.pagination.pages}
                  onClick={() => setPage(page + 1)}
                  className="p-1.5 rounded border border-gray-200 dark:border-gray-800 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* RIGHT AREA: Selected Expense Details Drawer Panel */}
      <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-xs h-fit">
        {selectedExpense ? (
          <div className="space-y-6">

            {/* Header info */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-2 py-0.5 rounded">
                  {selectedExpense.category.name}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(selectedExpense)}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded transition-colors cursor-pointer"
                    title="Edit Expense"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(selectedExpense.id)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors cursor-pointer"
                    title="Delete Expense"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-3 leading-tight">
                {selectedExpense.title}
              </h3>
              {selectedExpense.description && (
                <p className="text-xs text-gray-500 mt-1 dark:text-gray-400 leading-normal">
                  {selectedExpense.description}
                </p>
              )}
            </div>

            {/* Total Block */}
            <div className="bg-gray-50 dark:bg-[#15181e] p-4 rounded-xl border border-gray-100 dark:border-gray-850 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500 font-semibold">Payer: {selectedExpense.paidBy.name}</span>
                <span className="text-[10px] text-gray-400 block mt-0.5 font-medium">
                  {formatDateShort(selectedExpense.date)}
                </span>
              </div>
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {formatCurrency(selectedExpense.amount)}
              </span>
            </div>

            {/* Splits Details */}
            <div>
              <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-3">Breakdown by Member</h4>
              <div className="space-y-3">
                {selectedExpense.participants.map((part) => {
                  const apr = selectedExpense.approvals?.find(a => a.userId === part.userId);
                  const approvalStatus = apr?.status || 'PENDING';

                  const appColor = {
                    APPROVED: 'text-emerald-500',
                    REJECTED: 'text-rose-500',
                    PENDING: 'text-gray-400'
                  }[approvalStatus];

                  return (
                    <div key={part.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${appColor} fill-current`} />
                        <span className="font-medium text-gray-800 dark:text-gray-300">
                          {part.user.name}
                        </span>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(part.amountOwed)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Receipt Preview */}
            {selectedExpense.receiptUrl && (
              <div>
                <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-2">Attached Receipt</h4>
                <div
                  onClick={() => setLightboxUrl(getReceiptUrl(selectedExpense.receiptUrl))}
                  className="group relative cursor-pointer overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 h-28 flex items-center justify-center bg-gray-50 dark:bg-gray-900 hover:brightness-95 transition-all"
                >
                  <img
                    src={getReceiptUrl(selectedExpense.receiptUrl)}
                    alt="Receipt preview"
                    className="h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs gap-1 font-semibold">
                    <Eye className="w-4 h-4" />
                    Open Receipt
                  </div>
                </div>
              </div>
            )}

            {/* Action Approvals */}
            {selectedExpense.status === 'PENDING' && (
              <div className="pt-4 border-t border-gray-100 dark:border-gray-850">
                {selectedExpense.participants.some(p => p.userId === user?.id) ? (
                  <div>
                    <p className="text-xs text-gray-500 mb-3 text-center">Verify and approve this expense split:</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleReject(selectedExpense.id)}
                        disabled={rejectMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer transition-colors border border-rose-200 dark:border-rose-950/50"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(selectedExpense.id)}
                        disabled={approveMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold cursor-pointer transition-colors border border-emerald-200 dark:border-emerald-950/50"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center italic">
                    Awaiting approvals from roommate participants.
                  </p>
                )}
              </div>
            )}

          </div>
        ) : (
          <div className="py-20 text-center text-gray-400 dark:text-gray-500 text-xs">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            Select an expense from the ledger to view details, receipts, and approvals.
          </div>
        )}
      </div>

      {/* LIGHTBOX MODAL */}
      <Modal isOpen={!!lightboxUrl} onClose={() => setLightboxUrl(null)} title="Receipt Image Document">
        <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg p-2 overflow-hidden max-h-[70vh]">
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="Receipt high resolution"
              className="max-w-full max-h-full object-contain rounded"
            />
          )}
        </div>
      </Modal>

      {/* ADD EXPENSE MODAL */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Record New Expense">
        <form onSubmit={(e) => handleFormSubmit(e, false)} className="space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Expense Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Milk & Veggies"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-950 dark:text-white"
              >
                {catData.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Paid By</label>
              <select
                value={paidById}
                onChange={(e) => setPaidById(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-950 dark:text-white"
              >
                {members.map(m => (
                  <option key={m.userId} value={m.userId}>{m.user.name}</option>
                ))}
              </select>
            </div>
          </div>


          {/* Splits selection */}
          <div className="p-4 bg-gray-50 dark:bg-[#15181e] rounded-xl border border-gray-100 dark:border-gray-850">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-bold text-gray-500 uppercase">Split Calculations</label>
              <select
                value={splitType}
                onChange={(e) => setSplitType(e.target.value as any)}
                className="bg-transparent border border-gray-200 dark:border-gray-800 text-xs rounded px-2 py-0.5 text-gray-700 dark:text-gray-300 font-semibold"
              >
                <option value="EQUAL">Split Equally</option>
                <option value="EXACT">Exact Share (₹)</option>
                <option value="PERCENTAGE">Percentage Share (%)</option>
              </select>
            </div>

            <div className="space-y-2.5 max-h-36 overflow-y-auto pr-1">
              {members.map(m => {
                const part = splitParticipants[m.userId] || { checked: false, value: '' };
                return (
                  <div key={m.userId} className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={part.checked}
                        onChange={() => handleParticipantCheck(m.userId)}
                        className="rounded text-blue-600 focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>{m.user.name}</span>
                    </label>

                    {part.checked && splitType !== 'EQUAL' && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400">{splitType === 'EXACT' ? '$' : '%'}</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={part.value}
                          onChange={(e) => handleParticipantValueChange(m.userId, e.target.value)}
                          className="w-16 px-1.5 py-0.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded text-center text-xs"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Receipt Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-500 uppercase">Receipt</label>
              {receiptFile && (
                <button
                  type="button"
                  onClick={handleScanReceipt}
                  disabled={isScanning}
                  className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    '✨ Auto-fill with AI'
                  )}
                </button>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 dark:file:bg-gray-800 dark:file:text-gray-300 hover:file:bg-gray-200 transition-all cursor-pointer"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="flex-1 py-2 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createExpenseMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70 text-white py-2 rounded-lg text-sm font-semibold cursor-pointer"
            >
              {createExpenseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Expense'}
            </button>
          </div>

        </form>
      </Modal>

      {/* EDIT EXPENSE MODAL */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Expense Details">
        <form onSubmit={(e) => handleFormSubmit(e, true)} className="space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Expense Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Electricity Bill"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-950 dark:text-white"
              >
                {catData.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Paid By</label>
              <select
                value={paidById}
                onChange={(e) => setPaidById(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-955 dark:text-white"
              >
                {members.map(m => (
                  <option key={m.userId} value={m.userId}>{m.user.name}</option>
                ))}
              </select>
            </div>
          </div>


          {/* Splits selection */}
          <div className="p-4 bg-gray-50 dark:bg-[#15181e] rounded-xl border border-gray-100 dark:border-gray-850">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-bold text-gray-500 uppercase">Split Calculations</label>
              <select
                value={splitType}
                onChange={(e) => setSplitType(e.target.value as any)}
                className="bg-transparent border border-gray-200 dark:border-gray-800 text-xs rounded px-2 py-0.5 text-gray-700 dark:text-gray-300 font-semibold"
              >
                <option value="EQUAL">Split Equally</option>
                <option value="EXACT">Exact Share (₹)</option>
                <option value="PERCENTAGE">Percentage Share (%)</option>
              </select>
            </div>

            <div className="space-y-2.5 max-h-36 overflow-y-auto pr-1">
              {members.map(m => {
                const part = splitParticipants[m.userId] || { checked: false, value: '' };
                return (
                  <div key={m.userId} className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={part.checked}
                        onChange={() => handleParticipantCheck(m.userId)}
                        className="rounded text-blue-600 focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>{m.user.name}</span>
                    </label>

                    {part.checked && splitType !== 'EQUAL' && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400">{splitType === 'EXACT' ? '$' : '%'}</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={part.value}
                          onChange={(e) => handleParticipantValueChange(m.userId, e.target.value)}
                          className="w-16 px-1.5 py-0.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded text-center text-xs"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Receipt Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-500 uppercase">Update Receipt</label>
              {receiptFile && (
                <button
                  type="button"
                  onClick={handleScanReceipt}
                  disabled={isScanning}
                  className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    '✨ Auto-fill with AI'
                  )}
                </button>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 dark:file:bg-gray-800 dark:file:text-gray-300 hover:file:bg-gray-200 transition-all cursor-pointer"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="flex-1 py-2 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateExpenseMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70 text-white py-2 rounded-lg text-sm font-semibold cursor-pointer"
            >
              {updateExpenseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </button>
          </div>

        </form>
      </Modal>

    </div>
  );
};

export default Expenses;
