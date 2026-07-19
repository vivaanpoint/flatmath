import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/format';
import { 
  useRecurringRules, 
  useCategories, 
  useHouseholdDetails, 
  useCreateRecurringRule, 
  useDeleteRecurringRule,
  useUpdateRecurringRule
} from '../utils/queryHooks';
import { 
  Trash2, 
  Loader2, 
  AlertCircle,
  Plus,
  Edit
} from 'lucide-react';
import Modal from '../components/Modal';

export const RecurringRules: React.FC = () => {
  const { householdId, user } = useAuth();
  const { showToast } = useToast();

  // Queries
  const { data: rules = [], isLoading } = useRecurringRules(householdId);
  const { data: catData = [] } = useCategories();
  const { data: hhData } = useHouseholdDetails(householdId);
  
  const createRuleMutation = useCreateRecurringRule(householdId || 0);
  const deleteRuleMutation = useDeleteRecurringRule(householdId || 0);
  const updateRuleMutation = useUpdateRecurringRule(householdId || 0);

  // States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paidById, setPaidById] = useState(user?.id.toString() || '');
  const [interval, setInterval] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('MONTHLY');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  const members = hhData?.members || [];

  const handleOpenModal = () => {
    setEditingRuleId(null);
    setTitle('');
    setDescription('');
    setAmount('');
    setCategoryId(catData[0]?.id.toString() || '');
    setPaidById(user?.id.toString() || '');
    setInterval('MONTHLY');
    setStartDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: any) => {
    setEditingRuleId(rule.id);
    setTitle(rule.title);
    setDescription(rule.description || '');
    setAmount(rule.amount.toString());
    setCategoryId(rule.categoryId.toString());
    setPaidById(rule.paidById.toString());
    setInterval(rule.interval);
    setStartDate(new Date(rule.startDate).toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!title || isNaN(numAmount) || numAmount <= 0 || !categoryId || !paidById) {
      showToast('Please verify all details are filled and positive', 'warning');
      return;
    }

    if (editingRuleId) {
      updateRuleMutation.mutate(
        {
          ruleId: editingRuleId,
          data: {
            title,
            description,
            amount: numAmount,
            categoryId: parseInt(categoryId, 10),
            paidById: parseInt(paidById, 10),
            interval,
            startDate: new Date(startDate).toISOString(),
          },
        },
        {
          onSuccess: () => {
            showToast('Recurring bill rule updated successfully!', 'success');
            setIsModalOpen(false);
          },
          onError: (err: any) => {
            const msg = err.response?.data?.message || 'Failed to update recurring rule';
            showToast(msg, 'error');
          },
        }
      );
    } else {
      createRuleMutation.mutate(
        {
          title,
          description,
          amount: numAmount,
          categoryId: parseInt(categoryId, 10),
          paidById: parseInt(paidById, 10),
          interval,
          startDate: new Date(startDate).toISOString(),
        },
        {
          onSuccess: () => {
            showToast('Recurring expense rule created successfully!', 'success');
            setIsModalOpen(false);
          },
          onError: (err: any) => {
            const msg = err.response?.data?.message || 'Failed to create recurring rule';
            showToast(msg, 'error');
          },
        }
      );
    }
  };

  const handleDeleteRule = (id: number) => {
    if (!window.confirm('Delete this recurring rule? Upcoming automatic bills will not be posted.')) return;
    
    deleteRuleMutation.mutate(id, {
      onSuccess: () => {
        showToast('Recurring rule deleted successfully', 'success');
      },
      onError: () => {
        showToast('Failed to delete recurring rule', 'error');
      }
    });
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recurring Expenses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage automated schedules for fixed shared utilities and monthly bills.</p>
        </div>
      </div>

      {/* WARNING INFO CALLOUT */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-900 text-blue-800 dark:text-blue-300 text-xs flex gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 text-blue-500" />
        <div>
          <p className="font-semibold mb-0.5">Automation Policy</p>
          <p className="leading-normal">
            FlatMath automatically logs active schedules on their respective due dates. A new entry will be generated on your behalf and split evenly across all active household members.
          </p>
        </div>
      </div>

      {/* CONTENT LIST */}
      {isLoading ? (
        <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
          {[1, 2].map(n => (
            <div key={n} className="h-16 bg-gray-50 dark:bg-gray-800 rounded-lg animate-skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rules.map((rule) => {
            const payer = members.find(m => m.userId === rule.paidById);
            return (
              <div 
                key={rule.id} 
                className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-gray-350 dark:hover:border-gray-700 transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-2 py-0.5 rounded">
                      {rule.interval.toLowerCase()}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(rule)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Edit Schedule Rule"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        disabled={deleteRuleMutation.isPending}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Delete Schedule Rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white truncate" title={rule.title}>
                    {rule.title}
                  </h3>
                  {rule.description ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2 leading-relaxed h-8">
                      {rule.description}
                    </p>
                  ) : (
                    <div className="h-8" />
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-850 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Amount</span>
                    <span className="font-black text-base text-blue-600 dark:text-blue-400">
                      {formatCurrency(rule.amount)}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Category</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{rule.category.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Paid by</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[120px]" title={payer?.user.name}>
                        {payer?.user.name || 'Roommate'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Next due</span>
                      <span className="font-medium text-gray-750 dark:text-gray-300">{formatDate(rule.nextDueDate)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Plus Trigger Placeholder Card */}
          <button
            onClick={handleOpenModal}
            className="border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50/50 dark:hover:bg-gray-900/10 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center min-h-[220px]"
          >
            <Plus className="w-8 h-8 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Create Schedule</span>
            <span className="text-[10px] text-gray-400">Configure a recurring expense</span>
          </button>
        </div>
      )}
      {/* CREATE/EDIT MODAL */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRuleId ? "Edit Recurring Bill" : "Add Recurring Bill"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bill Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Gas cylinder, Wi-Fi"
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
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Interval</label>
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-950 dark:text-white"
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-950 dark:text-white"
              >
                <option value="" disabled>Select Category</option>
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
            
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
            <textarea
              placeholder="e.g. Frequency: End of every month"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white h-16 resize-none"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-2 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70 text-white py-2 rounded-lg text-sm font-semibold cursor-pointer"
            >
              {createRuleMutation.isPending || updateRuleMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingRuleId ? (
                'Save Changes'
              ) : (
                'Schedule Bill'
              )}
            </button>
          </div>

        </form>
      </Modal>

    </div>
  );
};

export default RecurringRules;
