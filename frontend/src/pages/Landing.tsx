import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import api from '../utils/api';
import Logo from '../components/Logo';
import { 
  ArrowRight, 
  Sparkles, 
  Layers, 
  Zap, 
  TrendingUp, 
  QrCode, 
  Calendar, 
  Moon, 
  Sun,
  ShieldCheck,
  Percent,
  Smile,
  Loader2,
  ChevronDown,
  ArrowRightLeft,
  Scan,
  RefreshCw
} from 'lucide-react';


const ScrollReveal: React.FC<{ children: React.ReactNode; delay?: string }> = ({ children, delay = '0ms' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { 
        threshold: 0.02,
        rootMargin: "0px 0px -40px 0px"
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: delay }}
      className={`transition-all duration-1000 ease-out transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
    >
      {children}
    </div>
  );
};

const DummyReceiptPaper: React.FC<{ isScanning: boolean; onScanTrigger?: () => void }> = ({ isScanning, onScanTrigger }) => {
  return (
    <div className="relative bg-[#FAF8F5] text-slate-800 font-mono p-4 w-[240px] shadow-lg border border-amber-100 rounded-sm transform rotate-1 transition-all duration-300 flex flex-col text-[9px] leading-tight select-none border-dashed border-b-2">
      
      {/* Scanning Light overlay directly on the receipt */}
      {isScanning && (
        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_12px_rgba(99,102,241,1)] animate-[bounce_2.5s_infinite] z-30"></div>
      )}

      <div className="text-center font-bold tracking-wider mb-2 border-b border-dashed border-slate-300 pb-1">
        <span className="text-xs font-black block text-slate-900">SMART SUPERMARKET</span>
        <span className="text-[7px] text-slate-500 block mt-0.5">NEW DELHI, IN</span>
      </div>

      <div className="flex justify-between text-[7px] text-slate-500 mb-2">
        <span>DATE: 2026-07-21</span>
        <span>TIME: 13:30</span>
      </div>

      <div className="border-b border-dashed border-slate-300 pb-1 mb-2 text-left">
        <div className="flex justify-between">
          <span>PAID BY:</span>
          <span className="font-bold text-slate-900">vivaan</span>
        </div>
        <div className="flex justify-between mt-0.5">
          <span>CATEGORY:</span>
          <span className="font-bold text-slate-900 font-sans text-[8px] bg-blue-50 text-blue-700 px-1 rounded-sm">Internet & Food</span>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-1 text-left flex-1 mb-2">
        <div className="flex justify-between text-[8px]">
          <span>📶 Internet Router</span>
          <span className="font-semibold">₹1,200.00</span>
        </div>
        <div className="flex justify-between text-[8px]">
          <span>🥛 Organic Milk</span>
          <span className="font-semibold">₹60.00</span>
        </div>
        <div className="flex justify-between text-[8px]">
          <span>🍎 Fresh Apples</span>
          <span className="font-semibold">₹150.00</span>
        </div>
      </div>

      {/* Total amount */}
      <div className="border-t border-dashed border-slate-300 pt-1.5 flex justify-between font-extrabold text-[10px] text-slate-900">
        <span>TOTAL:</span>
        <span>₹1,410.00</span>
      </div>

      <div className="mt-3 text-center text-slate-400 text-[6px] tracking-wider border-t border-dashed border-slate-300 pt-1">
        * FLATMATH LEDGER OCR ENGINE *
      </div>

      {/* Hover Click to Scan Trigger Overlay */}
      {!isScanning && onScanTrigger && (
        <div 
          onClick={onScanTrigger}
          className="absolute inset-0 bg-slate-900/0 hover:bg-slate-900/60 transition-all duration-300 flex items-center justify-center opacity-0 hover:opacity-100 cursor-pointer rounded-sm"
        >
          <div className="bg-white text-indigo-650 font-bold px-3 py-1.5 rounded-lg shadow-md text-[9px] flex items-center gap-1.5 scale-90 hover:scale-100 transition-all duration-200">
            <Scan className="w-3 h-3 text-indigo-650" />
            Scan Receipt
          </div>
        </div>
      )}
    </div>
  );
};

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { isLoading, login, selectHousehold } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Showcase States
  const [isOptimized, setIsOptimized] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'scanning' | 'done'>('idle');

  const handleOcrScan = () => {
    if (ocrStatus !== 'idle') return;
    setOcrStatus('scanning');
    setTimeout(() => {
      setOcrStatus('done');
    }, 2500);
  };

  const handleOcrReset = () => {
    setOcrStatus('idle');
  };

  // Demo Login Handler
  const handleDemoLogin = async () => {
    setIsDemoLoading(true);
    try {
      const res = await api.post('/auth/demo');
      const { user: userData, accessToken } = res.data.data;
      login(userData, accessToken);
      showToast('Welcome to Demo Mode! Exploring Apartment 4B.', 'success');
      // Fetch households and navigate directly to dashboard
      const householdsRes = await api.get('/households');
      const households = householdsRes.data.data;
      if (households && households.length > 0) {
        selectHousehold(households[0].id);
        navigate('/dashboard');
      } else {
        navigate('/households');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Demo login failed. Please try again.';
      showToast(msg, 'error');
    } finally {
      setIsDemoLoading(false);
    }
  };

  // Split Calculator State
  const [calcAmount, setCalcAmount] = useState<number>(150);
  const [splitMethod, setSplitMethod] = useState<'equal' | 'percent' | 'exact'>('equal');
  const [percentages, setPercentages] = useState<{ [key: string]: number }>({
    'vivaan': 50,
    'Yuvraj': 30,
    'Bhavesh': 20
  });
  const [exacts, setExacts] = useState<{ [key: string]: number }>({
    'vivaan': 80,
    'Yuvraj': 45,
    'Bhavesh': 25
  });

  const roommates = ['vivaan', 'Yuvraj', 'Bhavesh'];

  // Handle calculator presets
  const handlePreset = (amount: number) => {
    setCalcAmount(amount);
    // Recalculate exacts proportionally for presets
    const totalExact = exacts['vivaan'] + exacts['Yuvraj'] + exacts['Bhavesh'];
    if (totalExact > 0) {
      const scale = amount / totalExact;
      setExacts({
        'vivaan': Math.round(exacts['vivaan'] * scale),
        'Yuvraj': Math.round(exacts['Yuvraj'] * scale),
        'Bhavesh': Math.round(exacts['Bhavesh'] * scale)
      });
    }
  };

  // Adjust percentages with bounds checking
  const handlePercentageChange = (name: string, value: number) => {
    const currentVal = percentages[name];
    const diff = value - currentVal;
    
    // Distribute diff to other roommates
    const others = roommates.filter(r => r !== name);
    const other1 = others[0];
    const other2 = others[1];
    
    const newOther1 = Math.max(0, Math.min(100, percentages[other1] - Math.round(diff / 2)));
    const newOther2 = 100 - value - newOther1;
    
    if (newOther2 >= 0 && newOther2 <= 100) {
      setPercentages({
        [name]: value,
        [other1]: newOther1,
        [other2]: newOther2
      });
    }
  };

  // Calculate specific roommate shares for display
  const getShare = (name: string): number => {
    if (splitMethod === 'equal') {
      return Number((calcAmount / roommates.length).toFixed(2));
    }
    if (splitMethod === 'percent') {
      return Number(((calcAmount * percentages[name]) / 100).toFixed(2));
    }
    // exact method
    const sumExact = exacts['vivaan'] + exacts['Yuvraj'] + exacts['Bhavesh'];
    if (sumExact === 0) return 0;
    return Number(((exacts[name] / sumExact) * calcAmount).toFixed(2));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 text-sm animate-pulse">Loading FlatMath...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 transition-colors duration-300 overflow-x-hidden">
      
      {/* BACKGROUND DECORATIONS */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-blue-500/10 dark:bg-blue-600/10 blur-[120px] animate-pulse"></div>
        <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-indigo-500/10 dark:bg-indigo-600/10 blur-[100px]"></div>
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-50 w-full border-b border-gray-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-[#0b0c10]/70 backdrop-blur-md transition-colors">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
              FlatMath
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            <Link
              to="/login"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-3 py-1.5"
            >
              Sign In
            </Link>

            <Link
              to="/register"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:shadow-md transition-all flex items-center gap-1.5"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 md:pt-24 md:pb-32 text-center">
        <ScrollReveal delay="0ms">
          {/* Glow Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-800/30 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-6 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5" />
            The Ultimate Shared Ledger for Flatmates
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white max-w-4xl mx-auto leading-[1.1] mb-6">
            Split Bills with Roommates. <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
              Keep the Peace.
            </span>
          </h1>
        </ScrollReveal>

        <ScrollReveal delay="150ms">
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Record expenses, choose custom splitting shares, automate recurring bills, approve transactions, and settle balances instantly via dynamic UPI QR codes.
          </p>
        </ScrollReveal>

        <ScrollReveal delay="300ms">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <button
              onClick={handleDemoLogin}
              disabled={isDemoLoading}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl text-base font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-75"
            >
              {isDemoLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading Demo account...
                </>
              ) : (
                <>
                  Try Live Demo Account
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            <a
              href="#calculator"
              className="w-full sm:w-auto bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60 px-8 py-4 rounded-xl text-base font-semibold shadow-xs transition-all flex items-center justify-center gap-2"
            >
              Try Live Calculator
            </a>
          </div>
        </ScrollReveal>

        {/* HERO VISUAL MOCKUP */}
        <ScrollReveal delay="450ms">
          <div className="relative max-w-5xl mx-auto rounded-2xl border border-gray-200 dark:border-gray-800/80 bg-white/40 dark:bg-[#111317]/40 p-2 md:p-3 shadow-2xl backdrop-blur-md">
            <div className="aspect-[16/10] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-[#0f1115] text-left p-4 md:p-6 flex flex-col justify-between relative">
            
            {/* Top Mock Window controls */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4 shrink-0">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-green-500/80"></span>
              </div>
              <div className="text-xs text-gray-500 font-mono bg-gray-900 px-3 py-1 rounded-md">flatmath.io/dashboard</div>
              <div className="w-12"></div>
            </div>

            {/* Mock Dashboard Layout */}
            <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden">
              {/* Sidebar */}
              <div className="col-span-3 hidden md:flex flex-col gap-2.5 border-r border-gray-800/60 pr-4">
                <div className="h-6 w-24 bg-gray-800 rounded-md animate-pulse mb-4"></div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={`h-8 rounded-lg flex items-center px-2 gap-2 ${i === 0 ? 'bg-blue-950/40 border border-blue-800/50' : ''}`}>
                    <div className={`w-4 h-4 rounded-full ${i === 0 ? 'bg-blue-500' : 'bg-gray-800'}`}></div>
                    <div className={`h-3 rounded-sm bg-gray-800 ${i === 0 ? 'w-16 bg-blue-400' : 'w-12'}`}></div>
                  </div>
                ))}
              </div>

              {/* Main Area */}
              <div className="col-span-12 md:col-span-9 flex flex-col gap-4 overflow-hidden">
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3">
                  {[{ label: 'Monthly Spent', val: '₹460.00', color: 'text-blue-400' }, { label: 'You Owe', val: '₹71.67', color: 'text-red-400' }, { label: 'You are Owed', val: '₹128.33', color: 'text-green-400' }].map((stat, i) => (
                    <div key={i} className="bg-[#15181f] border border-gray-800/80 rounded-xl p-3 flex flex-col justify-between gap-1 shadow-sm">
                      <span className="text-[10px] text-gray-500 font-medium truncate uppercase">{stat.label}</span>
                      <span className={`text-sm md:text-lg font-bold ${stat.color}`}>{stat.val}</span>
                    </div>
                  ))}
                </div>

                {/* Dashboard Chart Mock & Ledger mock */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0">
                  {/* Category Breakdown Donut Chart */}
                  <div className="bg-[#15181f] border border-gray-800/80 rounded-xl p-3 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-semibold text-gray-400">Category Breakdown</span>
                      <div className="w-8 h-2 bg-gray-800 rounded-sm"></div>
                    </div>
                    <div className="flex-1 flex items-center justify-around gap-6 px-2 py-1">
                      {/* Donut Chart SVG */}
                      <div className="relative w-32 h-32 shrink-0">
                        <svg viewBox="0 0 36 36" className="w-full h-full rotate-[-90deg]">
                          {/* Background Circle */}
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#1f2937" strokeWidth="4.5" />
                          {/* Internet segment: 65.2% (orange/amber) */}
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f59e0b" strokeWidth="4.5" strokeDasharray="65.2 100" strokeDashoffset="0" />
                          {/* Food segment: 34.8% (blue) */}
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#3b82f6" strokeWidth="4.5" strokeDasharray="34.8 100" strokeDashoffset="-65.2" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-lg font-black text-white">₹460</span>
                          <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Total</span>
                        </div>
                      </div>

                      {/* Legend Grid */}
                      <div className="flex flex-col gap-3 text-xs font-semibold text-gray-300">
                        <div className="flex items-center gap-2.5"><span className="w-3 h-3 rounded-full bg-amber-500 shrink-0"></span><span>Internet (65%)</span></div>
                        <div className="flex items-center gap-2.5"><span className="w-3 h-3 rounded-full bg-blue-500 shrink-0"></span><span>Food (35%)</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Expense Items List */}
                  <div className="bg-[#15181f] border border-gray-800/80 rounded-xl p-3 flex flex-col gap-2 overflow-y-auto">
                    <span className="text-[11px] font-semibold text-gray-400 mb-1">Recent Bills</span>
                    {[
                      { title: 'Wi-Fi', category: 'Internet', paidBy: 'vivaan', amount: '₹300.00', status: 'Approved', statusColor: 'bg-green-500/20 text-green-400 border-green-500/30' },
                      { title: 'Banana', category: 'Food', paidBy: 'Yuvraj', amount: '₹50.00', status: 'Pending', statusColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
                      { title: 'Bhujia', category: 'Food', paidBy: 'Bhavesh', amount: '₹110.00', status: 'Approved', statusColor: 'bg-green-500/20 text-green-400 border-green-500/30' }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[#1a1e26] border border-gray-800/40 text-xs shadow-xs hover:border-gray-700 transition-colors">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-white truncate max-w-[120px]">{item.title}</span>
                          <span className="text-[9px] text-gray-500">{item.category} • Paid by {item.paidBy}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{item.amount}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${item.statusColor}`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Bottom Accent blur layer for depth */}
            <div className="absolute bottom-[-1px] left-[5%] right-[5%] h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
          </div>
        </div>
        </ScrollReveal>
      </section>

      {/* CORE FEATURES GRID */}
      <section id="features" className="py-20 md:py-28 bg-white/40 dark:bg-[#111317]/20 border-y border-gray-200/60 dark:border-gray-800/60 backdrop-blur-xs relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <ScrollReveal>
            <div className="text-center max-w-2xl mx-auto mb-16 md:mb-20">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Engineered for Roommates
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                No more messy group chats, lost receipts, or awkward conversations about money. Everything you need to share expenses seamlessly.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <ScrollReveal delay="0ms">
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm dark:shadow-none hover:shadow-md hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all duration-300 group flex flex-col gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Smart Splitting Engine</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  Divide bills equally, by exact dollar shares, or custom percentage amounts. Perfect for rooms of different sizes or utility balances.
                </p>
              </div>
            </ScrollReveal>

            {/* Feature 2 */}
            <ScrollReveal delay="150ms">
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm dark:shadow-none hover:shadow-md hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all duration-300 group flex flex-col gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Auto Recurring Bills</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  Set up recurring rules for monthly Rent, Broadband, and Gas. FlatMath automatically adds the expenses on the date they are due.
                </p>
              </div>
            </ScrollReveal>

            {/* Feature 3 */}
            <ScrollReveal delay="300ms">
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm dark:shadow-none hover:shadow-md hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all duration-300 group flex flex-col gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <QrCode className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Dynamic UPI QR Code Settle</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  Generate custom UPI payment QR codes prefilled with the exact settlement amount and roommate's payment address for zero-friction payments.
                </p>
              </div>
            </ScrollReveal>

            {/* Feature 4 */}
            <ScrollReveal delay="0ms">
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm dark:shadow-none hover:shadow-md hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all duration-300 group flex flex-col gap-4">
                <div className="w-12 h-12 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Ledger Approvals Workflow</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  Roommates approve or reject pending expenses to keep the ledger accurate and maintain full transparency without surprises.
                </p>
              </div>
            </ScrollReveal>

            {/* Feature 5 */}
            <ScrollReveal delay="150ms">
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm dark:shadow-none hover:shadow-md hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all duration-300 group flex flex-col gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Monthly Spending Analytics</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  Interactive charts showcase household trends, roommate contribution margins, and category spending distributions over time.
                </p>
              </div>
            </ScrollReveal>

            {/* Feature 6 */}
            <ScrollReveal delay="300ms">
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm dark:shadow-none hover:shadow-md hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all duration-300 group flex flex-col gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">Audit Feeds & Reports</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  Trace changes through full household audit logs. Generate detailed PDF spending summaries or Excel sheets to archive.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ADVANCED SPLIT SHOWCASE */}
      <section id="showcase" className="py-20 md:py-28 relative z-10 max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">See It In Action</span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mt-2 text-gray-900 dark:text-white">
              Advanced Split Ledger Technology
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-4 leading-relaxed">
              Explore how FlatMath handles complex transactions and parses bills automatically.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          
          {/* 1. DEBT SIMPLIFIER STEPPER */}
          <ScrollReveal delay="0ms">
            <div className="h-full bg-white dark:bg-slate-900 border border-gray-250/60 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Debt Simplification Engine</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Minimizes direct transactions dynamically</p>
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 text-left leading-relaxed">
                  When roommates owe money back and forth, FlatMath simplifies the paths so you only execute the absolute minimum number of payments.
                </p>

                {/* VISUAL DIAGRAM */}
                <div className="relative h-64 bg-slate-50/50 dark:bg-[#151820]/50 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 flex items-center justify-center overflow-hidden">
                  
                  {/* Roommate Nodes */}
                  {/* vivaan (Top center) */}
                  <div className="absolute top-8 flex flex-col items-center z-10 transition-transform duration-300">
                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md border-2 border-white dark:border-slate-900">
                      V
                    </div>
                    <span className="text-xs font-bold text-gray-800 dark:text-white mt-1">vivaan</span>
                    <span className={`text-[10px] font-bold ${isOptimized ? 'text-emerald-500' : 'text-gray-400'}`}>
                      {isOptimized ? 'Receives ₹100' : 'Net: +₹100'}
                    </span>
                  </div>

                  {/* Yuvraj (Bottom Left) */}
                  <div className="absolute bottom-8 left-12 flex flex-col items-center z-10 transition-transform duration-300">
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center font-bold text-sm shadow-md border-2 border-white dark:border-slate-900">
                      Y
                    </div>
                    <span className="text-xs font-bold text-gray-800 dark:text-white mt-1">Yuvraj</span>
                    <span className={`text-[10px] font-bold ${isOptimized ? 'text-red-500' : 'text-gray-400'}`}>
                      {isOptimized ? 'Owes ₹100' : 'Net: -₹100'}
                    </span>
                  </div>

                  {/* Bhavesh (Bottom Right) */}
                  <div className="absolute bottom-8 right-12 flex flex-col items-center z-10 transition-transform duration-300">
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center font-bold text-sm shadow-md border-2 border-white dark:border-slate-900">
                      B
                    </div>
                    <span className="text-xs font-bold text-gray-800 dark:text-white mt-1">Bhavesh</span>
                    <span className="text-[10px] text-gray-400 font-bold mt-0.5">
                      {isOptimized ? 'Settled (₹0)' : 'Net: ₹0'}
                    </span>
                  </div>

                  {/* ARROWS CONTAINER */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <defs>
                      <marker id="arrow-red" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                      </marker>
                      <marker id="arrow-green" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                      </marker>
                    </defs>

                    {!isOptimized ? (
                      <>
                        {/* Red path 1: Yuvraj owes Bhavesh ₹150 */}
                        <line x1="25%" y1="75%" x2="75%" y2="75%" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" markerEnd="url(#arrow-red)" />
                        <text x="50%" y="82%" fill="#ef4444" className="text-[10px] font-bold text-center" textAnchor="middle">owes ₹150</text>

                        {/* Red path 2: Bhavesh owes vivaan ₹150 */}
                        <line x1="75%" y1="75%" x2="50%" y2="25%" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" markerEnd="url(#arrow-red)" />
                        <text x="68%" y="50%" fill="#ef4444" className="text-[10px] font-bold" textAnchor="middle">owes ₹150</text>

                        {/* Red path 3: vivaan owes Yuvraj ₹50 */}
                        <line x1="50%" y1="25%" x2="25%" y2="75%" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" markerEnd="url(#arrow-red)" />
                        <text x="32%" y="50%" fill="#ef4444" className="text-[10px] font-bold" textAnchor="middle">owes ₹50</text>
                      </>
                    ) : (
                      <>
                        {/* Green path: Yuvraj owes vivaan ₹100 directly */}
                        <line x1="25%" y1="75%" x2="50%" y2="25%" stroke="#10b981" strokeWidth="2.5" markerEnd="url(#arrow-green)" className="animate-pulse" />
                        <text x="32%" y="46%" fill="#10b981" className="text-[11px] font-extrabold" textAnchor="middle">pays ₹100 directly</text>
                      </>
                    )}
                  </svg>
                </div>
              </div>

              {/* TABS SWITCHER */}
              <div className="mt-6 flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-gray-200/40 dark:border-gray-800">
                <button
                  onClick={() => setIsOptimized(false)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    !isOptimized 
                      ? 'bg-white dark:bg-[#1d222b] text-red-500 shadow-xs' 
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                  }`}
                >
                  Unoptimized (3 steps)
                </button>
                <button
                  onClick={() => setIsOptimized(true)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isOptimized 
                      ? 'bg-white dark:bg-[#1d222b] text-emerald-500 shadow-xs' 
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                  }`}
                >
                  FlatMath Simplified (1 step)
                </button>
              </div>
            </div>
          </ScrollReveal>

          {/* 2. RECEIPT OCR SCANNER SIMULATOR */}
          <ScrollReveal delay="150ms">
            <div className="h-full bg-white dark:bg-slate-900 border border-gray-250/60 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
                    <Scan className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Smart Receipt Scanner (OCR)</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Automated ledger parsing demo</p>
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 text-left leading-relaxed">
                  Snap a picture of your utility bill or grocery bill. Our integrated OCR scans the print, extracts list prices, and builds the split ledger entry instantly.
                </p>

                {/* SIMULATOR SCREEN */}
                <div className="relative h-64 bg-slate-50/50 dark:bg-[#151820]/50 border border-gray-100 dark:border-gray-800 rounded-2xl flex items-center justify-center overflow-hidden">
                  
                  {ocrStatus === 'idle' && (
                    <DummyReceiptPaper isScanning={false} onScanTrigger={handleOcrScan} />
                  )}

                  {ocrStatus === 'scanning' && (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <DummyReceiptPaper isScanning={true} />
                      <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 p-4">
                        <span className="bg-slate-950/80 text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                          <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                          Extracting Ledger Parameters...
                        </span>
                      </div>
                    </div>
                  )}

                  {ocrStatus === 'done' && (
                    <div className="w-full h-full flex flex-col p-5 text-left overflow-y-auto bg-white dark:bg-slate-900">
                      <div className="flex justify-between items-start border-b border-gray-200/50 dark:border-gray-800 pb-2 mb-3">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                            Parsed Successfully
                          </span>
                          <h4 className="font-bold text-xs text-gray-900 dark:text-white">Smart Supermarket Inc.</h4>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-gray-900 dark:text-white">₹1,410.00</span>
                          <span className="text-[8px] text-gray-400 block font-medium">Paid by: vivaan</span>
                        </div>
                      </div>

                      {/* Extracted Meta Row */}
                      <div className="grid grid-cols-2 gap-2 mb-3 bg-gray-50/50 dark:bg-slate-950/30 p-2 rounded-lg border border-gray-100 dark:border-gray-800/40">
                        <div>
                          <span className="text-[8px] text-gray-450 block font-bold uppercase tracking-wider">Category</span>
                          <span className="text-[9px] font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Internet & Food
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] text-gray-450 block font-bold uppercase tracking-wider">Paid By</span>
                          <span className="text-[9px] font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> vivaan
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex justify-between items-center text-[10px] text-gray-600 dark:text-gray-400">
                          <span>📶 Internet Router / Router Setup</span>
                          <span className="font-semibold text-gray-800 dark:text-white">₹1,200.00</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-gray-600 dark:text-gray-400">
                          <span>🥛 Organic Fresh Milk</span>
                          <span className="font-semibold text-gray-800 dark:text-white">₹60.00</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-gray-600 dark:text-gray-400">
                          <span>🍎 Crisp Red Apples</span>
                          <span className="font-semibold text-gray-800 dark:text-white">₹150.00</span>
                        </div>
                      </div>

                      {/* Split Info Footer */}
                      <div className="mt-3 pt-2.5 border-t border-gray-200/50 dark:border-gray-800 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">
                          Split Suggested: <span className="text-indigo-650 dark:text-indigo-400 font-extrabold">₹470.00 / roommate</span>
                        </span>
                        <button
                          onClick={handleOcrReset}
                          className="text-[9px] font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md cursor-pointer transition-colors flex items-center gap-1"
                        >
                          <RefreshCw className="w-2.5 h-2.5" /> Scan Again
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* ACTION BTN FOR CONTEXT */}
              <div className="mt-6">
                <button
                  disabled={ocrStatus === 'scanning'}
                  onClick={ocrStatus === 'done' ? handleOcrReset : handleOcrScan}
                  className={`w-full py-2.5 text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-all duration-300 flex items-center justify-center gap-2 text-white ${
                    ocrStatus === 'scanning'
                      ? 'bg-indigo-650/50'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {ocrStatus === 'idle' && <>Simulate Scan Process</>}
                  {ocrStatus === 'scanning' && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing Receipt...</>}
                  {ocrStatus === 'done' && <><RefreshCw className="w-3.5 h-3.5" /> Reset Simulator</>}
                </button>
              </div>
            </div>
          </ScrollReveal>

        </div>
      </section>

      {/* INTERACTIVE DEMO SPLIT CALCULATOR SECTION */}
      <section id="calculator" className="py-20 md:py-28 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: Context / Action */}
            <div className="lg:col-span-5">
              <ScrollReveal delay="0ms">
                <div className="flex flex-col gap-6 text-left">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Interactive Demo</span>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                    Try the splitting engine right now
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                    Play around with the input slider, quick presets, and split modes below to see how FlatMath distributes bill allocations instantly with roomie totals.
                  </p>
                  
                  {/* Presets Grid */}
                  <div className="flex flex-col gap-3 mt-2">
                    <span className="text-xs font-semibold text-gray-400 uppercase">Quick Presets</span>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { label: '📶 Wi-Fi (₹60)', val: 60 },
                        { label: '🍕 Bhujia (₹90)', val: 90 },
                        { label: '🛒 Fruits (₹150)', val: 150 },
                        { label: '🔌 Electricity (₹300)', val: 300 }
                      ].map((preset, i) => (
                        <button
                          key={i}
                          onClick={() => handlePreset(preset.val)}
                          className={`text-xs px-3.5 py-2 rounded-lg border transition-all cursor-pointer ${
                            calcAmount === preset.val 
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-500/50' 
                              : 'bg-white dark:bg-[#111317] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selector Tabs */}
                  <div className="flex flex-col gap-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase">Split Method</span>
                    <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-[#15181e] p-1 rounded-xl border border-gray-200/50 dark:border-gray-800/60">
                      {(['equal', 'percent', 'exact'] as const).map((method) => (
                        <button
                          key={method}
                          onClick={() => setSplitMethod(method)}
                          className={`text-xs font-semibold py-2.5 rounded-lg capitalize transition-all cursor-pointer ${
                            splitMethod === method 
                              ? 'bg-white dark:bg-[#1d222b] text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200/20 dark:border-gray-800/30' 
                              : 'text-gray-500 hover:text-gray-700 dark:hover:text-white'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            {/* Right Column: Calculator Card */}
            <div className="lg:col-span-7">
              <ScrollReveal delay="150ms">
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden text-gray-900 dark:text-white">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>

                  {/* Total Input */}
                  <div className="flex flex-col gap-4 mb-8">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">Total Bill Amount</label>
                      <span className="text-3xl font-black text-blue-600 dark:text-blue-400 font-mono">₹{calcAmount}</span>
                    </div>

                    <div className="relative pt-4">
                      <input
                        type="range"
                        min="10"
                        max="3000"
                        step="10"
                        value={calcAmount}
                        onChange={(e) => setCalcAmount(Number(e.target.value))}
                        className="w-full h-2 bg-gray-150 dark:bg-gray-850 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400 font-semibold mt-2">
                        <span>₹10</span>
                        <span>₹1,500</span>
                        <span>₹3,000</span>
                      </div>
                    </div>
                  </div>

                  {/* Splitting Allocation Cards */}
                  <div className="flex flex-col gap-4">
                    <label className="text-xs font-semibold text-gray-400 uppercase text-left tracking-wide">Split Breakdown</label>
                    {roommates.map((name) => {
                      const share = getShare(name);
                      const pct = splitMethod === 'percent' 
                        ? percentages[name] 
                        : splitMethod === 'equal' 
                          ? Math.round(100 / roommates.length) 
                          : Math.round((exacts[name] / (exacts['vivaan'] + exacts['Yuvraj'] + exacts['Bhavesh'])) * 100);

                      return (
                        <div key={name} className="flex flex-col gap-2 p-4 rounded-2xl bg-gray-50/50 dark:bg-[#15181f]/80 border border-gray-100 dark:border-gray-800/40 shadow-xs">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                                name === 'vivaan' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                              }`}>
                                {name.charAt(0)}
                              </div>
                              <span className="font-semibold text-sm">{name}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-base font-bold text-gray-900 dark:text-white">₹{share}</span>
                              <span className="text-xs text-gray-400 block font-medium">{pct}% Share</span>
                            </div>
                          </div>

                          {/* Interactive adjust sliders inside roommate card if custom mode */}
                          {splitMethod === 'percent' && (
                            <div className="mt-2 flex items-center gap-3 pt-2 border-t border-gray-200/30 dark:border-gray-800/20">
                              <Percent className="w-3.5 h-3.5 text-gray-400" />
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={percentages[name]}
                                onChange={(e) => handlePercentageChange(name, Number(e.target.value))}
                                className="flex-1 h-1 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                              />
                              <span className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400 w-8 text-right">{percentages[name]}%</span>
                            </div>
                          )}

                          {/* Bar indicator */}
                          <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden mt-1">
                            <div 
                              className="bg-blue-600 h-full rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total Check */}
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center text-xs text-gray-400 font-semibold">
                    <span className="flex items-center gap-1"><Smile className="w-4 h-4 text-green-500" /> Roommates balanced</span>
                    <span>Sum total: ₹{calcAmount}.00</span>
                  </div>
                </div>
              </ScrollReveal>
            </div>

          </div>
        </div>
      </section>

      {/* WHY FLATMATH COMPARISON SECTION */}
      <section id="why-flatmath" className="py-20 md:py-28 bg-white/40 dark:bg-[#111317]/20 border-y border-gray-200/60 dark:border-gray-800/60 backdrop-blur-xs relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          <ScrollReveal>
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Head to Head</span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">
                Say goodbye to spreadsheet chaos
              </h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay="150ms">
            <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-lg bg-white dark:bg-[#111317]">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100 dark:bg-[#15181e] border-b border-gray-200 dark:border-gray-800">
                    <th className="p-4 md:p-6 font-bold text-gray-900 dark:text-white w-2/5">Feature</th>
                    <th className="p-4 md:p-6 font-semibold text-red-500 text-center w-3/10">Traditional Apps</th>
                    <th className="p-4 md:p-6 font-bold text-blue-600 dark:text-blue-400 text-center bg-blue-50/20 dark:bg-blue-950/10 w-3/10">FlatMath</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800/80">
                  {[
                    { feature: 'Splitting percentage & exact shares', traditional: 'Yes (Partial)', flatmath: 'Yes (Full)' },
                    { feature: 'Automated recurring utility templates', traditional: 'Requires manually inputting', flatmath: 'Set & forget posting' },
                    { feature: 'Audit Log history tracking', traditional: 'Lost in comments/history', flatmath: 'Comprehensive trace log' },
                    { feature: 'Ledger Approval workflow checks', traditional: 'Trust-based (no double check)', flatmath: 'Require roommate verify' },
                    { feature: 'UPI QR code dynamic amounts', traditional: 'Manual calculation entry', flatmath: 'Auto QR code builder' },
                    { feature: 'Detailed Excel/PDF ledger export', traditional: 'Behind premium paywall', flatmath: '100% Free downloads' }
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-[#15181e]/30 transition-colors">
                      <td className="p-4 md:p-6 font-medium text-gray-900 dark:text-white">{row.feature}</td>
                      <td className="p-4 md:p-6 text-gray-400 dark:text-gray-500 text-center font-medium">{row.traditional}</td>
                      <td className="p-4 md:p-6 text-blue-600 dark:text-blue-400 text-center font-bold bg-blue-50/10 dark:bg-blue-950/5">{row.flatmath}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-20 md:py-28 relative z-10 border-t border-gray-200/60 dark:border-gray-800/60 bg-gray-50/30 dark:bg-[#111317]/10 backdrop-blur-xs">
        <div className="max-w-4xl mx-auto px-6">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-gray-900 dark:text-white">
                Frequently Asked Questions
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                Got questions about FlatMath? We have got the answers to make bill splitting seamless.
              </p>
            </div>
          </ScrollReveal>

          <div className="flex flex-col gap-4">
            {[
              {
                q: "How does FlatMath handle uneven splits?",
                a: "FlatMath allows you to split bills using three options: Equal splits, exact Rupee shares, or customizable percentages. If roommate contributions result in decimal values (like ₹33.33), our smart ledger distributes the rounding difference automatically to keep balances clean."
              },
              {
                q: "What happens if a roommate goes offline during a push alert?",
                a: "Don't worry! We queue notifications in the background database. As soon as your roommate logs back in or reconnects, their active notification bell updates automatically via our WebSockets integration."
              },
              {
                q: "Is my receipt image stored permanently?",
                a: "Yes, receipt uploads are stored securely on our server database, linked directly to the corresponding expense item. You can inspect, download, or edit receipt attachments anytime from your household history tab."
              },
              {
                q: "How do roommate balance settlements work?",
                a: "We calculate the net balance matrix for the entire household. Instead of everyone sending multiple cross-payments, our engine optimizes the debts so that the minimum number of transactions is required to settle up."
              },
              {
                q: "Can we export ledger reports?",
                a: "Absolutely! You can download complete ledger statements as formatted Excel sheets or PDF documents at any time from your dashboard—completely free of charge."
              }
            ].map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <ScrollReveal key={idx} delay={`${idx * 80}ms`}>
                  <div 
                    className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111317]/60 overflow-hidden transition-all duration-300 hover:border-blue-500/40"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full px-6 py-5 flex items-center justify-between text-left font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown 
                        className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-300 ${
                          isOpen ? 'rotate-180 text-blue-500' : ''
                        }`}
                      />
                    </button>
                    <div 
                      className={`transition-all duration-300 ease-in-out ${
                        isOpen ? 'max-h-[250px] opacity-100 border-t border-gray-100 dark:border-gray-800/60' : 'max-h-0 opacity-0 pointer-events-none'
                      } overflow-hidden`}
                    >
                      <p className="px-6 py-5 text-sm leading-relaxed text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-black/10">
                        {faq.a}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0b0c10] py-12 relative z-10 transition-colors">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
              FlatMath
            </span>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} FlatMath Ledger. Made for roommate harmony. All rights reserved.
          </p>

          <div className="flex gap-4">
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">React + TS + Tailwind v4 + Prisma</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default Landing;
