import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, getAvatarDetails, formatDate } from '../utils/format';
import { 
  useBalances, 
  useSuggestions, 
  useRecordSettlement, 
  useSettlementHistory,
  useHouseholdDetails,
  useConfirmSettlement
} from '../utils/queryHooks';
import { 
  Scale, 
  Check, 
  Loader2, 
  QrCode, 
  Zap,
  Info,
  History,
  Clock,
  Smartphone,
  CheckCircle2,
  IndianRupee,
  Coins
} from 'lucide-react';
import Modal from '../components/Modal';
import { QRCodeSVG } from 'qrcode.react';

export const Balances: React.FC = () => {
  const { householdId, user } = useAuth();
  const { showToast } = useToast();

  // Queries
  const { data: balances = [], isLoading: isBalLoading } = useBalances(householdId);
  const { data: suggestions = [], isLoading: isSugLoading } = useSuggestions(householdId, true);
  const { data: history = [], isLoading: isHistLoading } = useSettlementHistory(householdId);
  const { data: hhData } = useHouseholdDetails(householdId);
  
  const recordSettlementMutation = useRecordSettlement(householdId || 0);
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

  // States
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [fromUserId, setFromUserId] = useState<number | null>(null);
  const [toUserId, setToUserId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // UPI QR Code state
  const [upiId, setUpiId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH'>('UPI');

  // Detect mobile viewport — switches UPI section to deep-link mode
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const members = hhData?.members || [];

  // Load saved UPI ID from localStorage when payee changes
  useEffect(() => {
    if (toUserId) {
      const savedUpi = localStorage.getItem(`upi_id_${toUserId}`);
      setUpiId(savedUpi || '');
    } else {
      setUpiId('');
    }
  }, [toUserId]);

  const handleUpiIdChange = (value: string) => {
    setUpiId(value);
    if (toUserId) {
      localStorage.setItem(`upi_id_${toUserId}`, value.trim());
    }
  };

  const handleSettleTrigger = (sugg: any) => {
    setFromUserId(sugg.fromUser.id);
    setToUserId(sugg.toUser.id);
    setAmount(Number(sugg.amount).toFixed(2));
    setDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('UPI');
    setIsSettleModalOpen(true);
  };

  const handleRecordSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!fromUserId || !toUserId || isNaN(numAmount) || numAmount <= 0) {
      showToast('Please specify valid transaction details', 'warning');
      return;
    }

    if (fromUserId === toUserId) {
      showToast('Cannot settle balance with oneself', 'warning');
      return;
    }

    recordSettlementMutation.mutate(
      {
        fromUserId,
        toUserId,
        amount: numAmount,
        date: new Date(date).toISOString(),
        method: paymentMethod,
      },
      {
        onSuccess: () => {
          showToast('Settlement recorded successfully!', 'success');
          setIsSettleModalOpen(false);
        },
        onError: (err: any) => {
          const msg = err.response?.data?.message || 'Error recording settlement';
          showToast(msg, 'error');
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settlement Center</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Track individual standing balances and resolve optimized group debts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMN 1: Roommate Balances */}
        <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Scale className="w-4 h-4 text-blue-600" />
            Member Balances
          </h3>

          {isBalLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(n => (
                <div key={n} className="h-14 bg-gray-50 dark:bg-gray-800 rounded-lg animate-skeleton" />
              ))}
            </div>
          ) : balances.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-10">No roommate metrics calculated</p>
          ) : (
            <div className="space-y-4">
              {balances.map((b: any) => {
                const bal = b.balance;
                const balText = bal > 0 
                  ? `Gets back ${formatCurrency(bal)}` 
                  : bal < 0 
                    ? `Must pay ${formatCurrency(Math.abs(bal))}`
                    : 'Settled up';
                
                const balColor = bal > 0 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : bal < 0 
                    ? 'text-rose-600 dark:text-rose-400' 
                    : 'text-gray-400';

                const avatar = getAvatarDetails(b.name);
                return (
                  <div key={b.id} className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-[#15181e] rounded-lg border border-gray-100 dark:border-gray-800/40">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full ${avatar.colorClass} flex items-center justify-center font-semibold uppercase text-xs`}>
                        {avatar.initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{b.name}</p>
                        <p className="text-[10px] text-gray-500">{b.email}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold ${balColor}`}>{balText}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-4 border-b border-gray-150 dark:border-gray-800 pb-3">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              Optimized Transfers
            </h3>
          </div>

          {isSugLoading ? (
            <div className="space-y-3">
              {[1, 2].map(n => (
                <div key={n} className="h-14 bg-gray-50 dark:bg-gray-800 rounded-lg animate-skeleton" />
              ))}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-10 flex flex-col items-center gap-1.5 text-gray-400">
              <Check className="w-8 h-8 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 p-1.5 rounded-full" />
              <p className="text-xs font-bold text-gray-800 dark:text-white">All Clear!</p>
              <p className="text-[10px]">No debts detected inside this household.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {suggestions.map((s: any, idx) => {
                const isDebtor   = s.fromUser.id === user?.id;
                const isCreditor = s.toUser.id   === user?.id;
                
                return (
                  <div key={idx} className="p-3.5 bg-gray-50 dark:bg-[#15181e] rounded-lg border border-gray-100 dark:border-gray-800/40 flex flex-col justify-between gap-3">
                    <div className="text-xs">
                      <span className="font-bold text-gray-900 dark:text-white">{s.fromUser.name}</span>
                      <span className="text-gray-400 dark:text-gray-500 mx-1">owes</span>
                      <span className="font-bold text-gray-900 dark:text-white">{s.toUser.name}</span>
                      <span className="text-blue-600 dark:text-blue-400 font-bold block text-sm mt-1">
                        {formatCurrency(s.amount)}
                      </span>
                    </div>

                    {isDebtor && (() => {
                      const payeeUpi = localStorage.getItem(`upi_id_${s.toUser.id}`);
                      const upiLink = payeeUpi?.trim()
                        ? `upi://pay?pa=${encodeURIComponent(payeeUpi.trim())}&pn=${encodeURIComponent(s.toUser.name)}&am=${s.amount}&cu=INR&tn=${encodeURIComponent('FlatMath Settlement')}`
                        : null;

                      if (isMobile && upiLink) {
                        return (
                          <a
                            href={upiLink}
                            onClick={() => handleSettleTrigger(s)}
                            className="w-full py-1.5 rounded-lg text-xs font-semibold text-center cursor-pointer transition-all bg-blue-600 hover:bg-blue-700 text-white border border-transparent shadow-sm block"
                          >
                            Settle Up
                          </a>
                        );
                      }

                      return (
                        <button
                          type="button"
                          onClick={() => handleSettleTrigger(s)}
                          className="w-full py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all bg-blue-600 hover:bg-blue-700 text-white border border-transparent shadow-sm"
                        >
                          Settle Up
                        </button>
                      );
                    })()}

                    {isCreditor && (
                      <span className="w-full py-1.5 rounded-lg text-xs font-semibold text-center text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30">
                        Awaiting Payment
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* COLUMN 3: Settlement History */}
        <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            Past Settlements
          </h3>

          {isHistLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(n => (
                <div key={n} className="h-10 bg-gray-50 dark:bg-gray-800 rounded-lg animate-skeleton" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-10">No past payments recorded</p>
          ) : (() => {
            const pendingSettlements = history.filter((h: any) => h.status === 'PENDING');
            const completedSettlements = history.filter((h: any) => h.status === 'COMPLETED');
            return (
              <div className="space-y-5">
                {pendingSettlements.length > 0 && (
                  <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
                    <h4 className="font-bold text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Pending Verification ({pendingSettlements.length})
                    </h4>
                    <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                      {pendingSettlements.map((h: any) => {
                        const isRecipient = h.toUserId === user?.id;
                        return (
                          <div key={h.id} className="text-xs p-3 bg-amber-50/20 dark:bg-amber-950/5 rounded-lg border border-amber-200/40 dark:border-amber-950/20 flex flex-col gap-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white leading-snug">
                                  {h.fromUser.name} <span className="text-gray-400 font-normal">→</span> {h.toUser.name}
                                </p>
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1">
                                  {formatCurrency(h.amount)}
                                </p>
                                <span className="text-[9px] text-gray-400 block mt-0.5">
                                  Awaiting confirmation • via {h.method === 'CASH' ? 'Cash' : 'UPI'} • {formatDate(h.date)}
                                </span>
                              </div>
                              {isRecipient ? (
                                <button
                                  onClick={() => handleConfirmReceipt(h.id)}
                                  disabled={confirmMutation.isPending}
                                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-650/70 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-md cursor-pointer transition-colors shadow-xs shrink-0 flex items-center gap-1.5"
                                >
                                  {confirmMutation.isPending ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Check className="w-3 h-3" />
                                      Confirm
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="text-[9px] bg-amber-100/60 text-amber-800 dark:bg-amber-950/20 dark:text-amber-450 px-2 py-1 rounded font-semibold whitespace-nowrap align-middle">
                                  Pending approval
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  {pendingSettlements.length > 0 && (
                    <h4 className="font-bold text-[10px] text-gray-400 uppercase tracking-wider mb-3">
                      Completed
                    </h4>
                  )}
                  {completedSettlements.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">No completed settlements</p>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {completedSettlements.map((h: any) => (
                        <div key={h.id} className="text-xs p-3 bg-gray-50/50 dark:bg-gray-850/40 rounded-lg border border-gray-100 dark:border-gray-800/40 flex items-start gap-2.5">
                          <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white leading-snug">
                              {h.fromUser.name} <span className="text-gray-400 font-normal">→</span> {h.toUser.name}
                            </p>
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1">
                              {formatCurrency(h.amount)}
                            </p>
                            <span className="text-[9px] text-gray-400 block mt-0.5">
                              Settled via {h.method === 'CASH' ? 'Cash' : 'UPI'} • {formatDate(h.date)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

      </div>      {/* MARK AS PAID / UPI SETTLE UP MODAL */}
      <Modal 
        isOpen={isSettleModalOpen} 
        onClose={() => setIsSettleModalOpen(false)} 
        title={
          fromUserId === user?.id 
            ? (paymentMethod === 'UPI' ? "Settle Up via UPI" : "Settle Up via Cash") 
            : "Record Cash Settlement"
        }
      >
        <form onSubmit={handleRecordSettlement} className="space-y-5">
          {fromUserId === user?.id ? (
            /* ── ELITE UPI SETTLE UP FLOW (FOR SELF DEBTS) ── */
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              
              {/* Left Column: QR Code / Cash Details & UPI Details (span 3) */}
              <div className="md:col-span-3 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-[#15181e]/80 border border-gray-150 dark:border-gray-800/80 rounded-2xl p-5 shadow-inner gap-4">
                {(() => {
                  const payeeMember = members.find(m => m.userId === toUserId);
                  const payeeName = payeeMember?.user?.name || 'Roommate';
                  const avatar = getAvatarDetails(payeeName);
                  const upiLink = upiId.trim()
                    ? `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('FlatMath Settlement')}`
                    : '';

                  return (
                    <div className="w-full flex flex-col items-center gap-4">
                      {/* Payee Info */}
                      <div className="flex items-center gap-3 w-full border-b border-gray-100 dark:border-gray-800 pb-3">
                        <div className={`w-10 h-10 rounded-full ${avatar.colorClass} flex items-center justify-center font-bold uppercase text-sm`}>
                          {avatar.initials}
                        </div>
                        <div className="text-left min-w-0">
                          <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block tracking-wider">Sending To</span>
                          <span className="font-bold text-sm text-gray-900 dark:text-white block truncate">{payeeName}</span>
                        </div>
                      </div>

                      {/* Payment Method Switcher Tabs */}
                      <div className="inline-flex bg-gray-150 dark:bg-gray-800 p-0.5 rounded-lg text-[10px] font-bold select-none border border-gray-250 dark:border-gray-700 w-full justify-center">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('UPI')}
                          className={`flex-1 py-1 rounded-md transition-all cursor-pointer text-center ${
                            paymentMethod === 'UPI'
                              ? 'bg-white dark:bg-gray-750 text-blue-600 dark:text-blue-400 shadow-xs'
                              : 'text-gray-500 hover:text-gray-850 dark:hover:text-gray-300'
                          }`}
                        >
                          UPI QR Code
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('CASH')}
                          className={`flex-1 py-1 rounded-md transition-all cursor-pointer text-center ${
                            paymentMethod === 'CASH'
                              ? 'bg-white dark:bg-gray-750 text-emerald-600 dark:text-emerald-400 shadow-xs'
                              : 'text-gray-500 hover:text-gray-850 dark:hover:text-gray-300'
                          }`}
                        >
                          Cash Payment
                        </button>
                      </div>

                      {paymentMethod === 'UPI' ? (
                        <>
                          {/* QR Display Container */}
                          <div className="relative group flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-gray-200/80 shadow-md transition-transform duration-300 hover:scale-[1.02] max-w-[200px] w-full aspect-square">
                            {upiId.trim() ? (
                              <>
                                {/* Scanning Border Glow Frame */}
                                <div className="absolute -inset-0.5 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl blur-xs opacity-10 group-hover:opacity-20 transition-opacity" />
                                <div className="relative bg-white p-1 rounded-lg">
                                  <QRCodeSVG value={upiLink} size={144} includeMargin={false} />
                                </div>
                                {/* Scanning Laser Line (Micro-animation) */}
                                <div className="absolute left-4 right-4 h-[2px] bg-blue-500 opacity-60 dark:opacity-80 rounded-full animate-pulse top-1/2" />
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center text-center p-3 text-gray-400 gap-2 h-full">
                                <QrCode className="w-10 h-10 text-gray-300 animate-pulse" />
                                <span className="text-[10px] font-medium leading-normal">Configure UPI ID below to generate QR Code</span>
                              </div>
                            )}
                          </div>

                          {/* QR Footer text */}
                          {upiId.trim() && (
                            <div className="text-center">
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold block leading-tight">
                                Scan with GPay, PhonePe, or Paytm
                              </span>
                              <span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold block mt-1">
                                Amount Locked: {formatCurrency(parseFloat(amount) || 0)}
                              </span>
                            </div>
                          )}

                          {/* UPI ID Input field */}
                          <div className="w-full text-left space-y-1.5 mt-2">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Payee UPI ID</label>
                            <div className="relative">
                              <input
                                type="text"
                                required
                                placeholder="e.g. name@okaxis or 9876543210@paytm"
                                value={upiId}
                                onChange={(e) => handleUpiIdChange(e.target.value)}
                                className="w-full pl-3 pr-8 py-2 text-xs bg-white dark:bg-gray-900 border border-gray-250 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                              />
                              <QrCode className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            </div>
                          </div>

                          {/* Mobile Deep Link integration */}
                          {isMobile && upiId.trim() && (
                            <a
                              href={upiLink}
                              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md transition-all active:scale-95 mt-2"
                            >
                              <Smartphone className="w-4 h-4" />
                              Pay via Mobile UPI App
                            </a>
                          )}
                        </>
                      ) : (
                        /* ── CASH PAYMENT LAYOUT ── */
                        <div className="w-full flex flex-col items-center gap-4 py-6 text-center">
                          <div className="relative group flex flex-col items-center justify-center p-5 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200/80 dark:border-gray-800/80 shadow-xs max-w-[180px] w-full aspect-square gap-3 transition-transform duration-300 hover:scale-[1.02]">
                            <div className="absolute -inset-0.5 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl blur-xs opacity-10" />
                            <Coins className="w-12 h-12 text-emerald-500 animate-bounce relative" />
                            <span className="text-xs font-bold text-gray-800 dark:text-white relative">
                              Cash Settlement
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium px-4 leading-relaxed">
                            Handing over physical cash? Tap <strong>Record Settlement</strong> to notify {payeeName}.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Right Column: Record ledger entry details (span 2) */}
              <div className="md:col-span-2 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Paying Amount</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-xs bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white font-bold"
                      />
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Payment Date</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className={`border rounded-xl p-3 text-[10px] leading-relaxed transition-colors duration-300 ${
                    paymentMethod === 'UPI'
                      ? 'bg-blue-50/40 dark:bg-blue-950/10 border-blue-100/50 dark:border-blue-950/20 text-gray-500'
                      : 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-100/50 dark:border-emerald-950/20 text-gray-500'
                  }`}>
                    <Info className={`w-3.5 h-3.5 inline mr-1 -mt-0.5 shrink-0 ${
                      paymentMethod === 'UPI' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`} />
                    {paymentMethod === 'UPI' 
                      ? <>Scanning registers the transfer on UPI. Tap <strong>Record Settlement</strong> below to log the split update in the ledger.</>
                      : <>Hand over the cash amount to your roommate. Tap <strong>Record Settlement</strong> below to log the split update in the ledger.</>
                    }
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-gray-855">
                  <button
                    type="submit"
                    disabled={recordSettlementMutation.isPending}
                    className={`w-full flex items-center justify-center gap-2 text-white py-2 rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-all duration-300 ${
                      paymentMethod === 'UPI' 
                        ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70' 
                        : 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/70'
                    }`}
                  >
                    {recordSettlementMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Record Settlement
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSettleModalOpen(false)}
                    className="w-full py-2 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>

            </div>

          ) : (
            /* ── CASH LOG FLOW (WHEN LOGGING FOR ANOTHER ROOMMATE) ── */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Debtor (Payer)</label>
                  <select
                    value={fromUserId || ''}
                    onChange={(e) => setFromUserId(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-950 dark:text-white"
                  >
                    <option value="" disabled className="text-gray-955">Select Roommate</option>
                    {members.map(m => (
                      <option key={m.userId} value={m.userId}>{m.user.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Creditor (Payee)</label>
                  <select
                    value={toUserId || ''}
                    onChange={(e) => setToUserId(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-955 dark:text-white"
                  >
                    <option value="" disabled className="text-gray-955">Select Roommate</option>
                    {members.map(m => (
                      <option key={m.userId} value={m.userId}>{m.user.name}</option>
                    ))}
                  </select>
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
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Settled On Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#15181e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="flex-1 py-2 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordSettlementMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/70 text-white py-2 rounded-lg text-sm font-semibold cursor-pointer"
                >
                  {recordSettlementMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Settlement'}
                </button>
              </div>
            </div>
          )}
        </form>
      </Modal>

    </div>
  );
};

export default Balances;
