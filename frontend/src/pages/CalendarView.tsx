import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useExpenses, useRecurringRules } from '../utils/queryHooks';
import { formatCurrency } from '../utils/format';
import { 
  ChevronLeft, 
  ChevronRight, 
  Receipt,
  Clock
} from 'lucide-react';
import Modal from '../components/Modal';

export const CalendarView: React.FC = () => {
  const { householdId } = useAuth();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayExpenses, setSelectedDayExpenses] = useState<any[] | null>(null);
  const [selectedDayRecurring, setSelectedDayRecurring] = useState<any[] | null>(null);
  const [selectedDateLabel, setSelectedDateLabel] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calculate start/end of month for server-side filter bounds
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  const startDateStr = firstDayOfMonth.toISOString();
  const endDateStr = lastDayOfMonth.toISOString();

  // Queries
  const { data: ledger, isLoading: isExpensesLoading } = useExpenses(householdId, {
    startDate: startDateStr,
    endDate: endDateStr,
    limit: 100
  });

  const { data: recurringRules = [] } = useRecurringRules(householdId);

  const expenses = ledger?.expenses || [];

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Calendar calculations
  const daysInMonth = lastDayOfMonth.getDate();
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon ...
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Calendar cells array
  const calendarCells: { date: Date | null; isCurrentMonth: boolean }[] = [];
  
  // Previous month padding cells
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    calendarCells.push({
      date: new Date(year, month - 1, prevMonthLastDay - i),
      isCurrentMonth: false
    });
  }

  // Current month cells
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({
      date: new Date(year, month, i),
      isCurrentMonth: true
    });
  }

  // Next month padding cells to complete a 6-row (42 cells) grid
  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false
    });
  }

  // Filter expenses and recurring for a particular calendar date cell
  const getEventsForDate = (date: Date) => {
    const dStr = date.toDateString();
    
    const dayExpenses = expenses.filter(e => new Date(e.date).toDateString() === dStr);
    
    // Project active recurring bills onto their monthly due dates
    const dayRecurring = recurringRules.filter(r => {
      if (!r.isActive) return false;
      const nextDue = new Date(r.nextDueDate);
      // Simplify check: is due date matching this cell date
      return nextDue.toDateString() === dStr;
    });

    return { dayExpenses, dayRecurring };
  };

  const handleDayClick = (date: Date, dayExpenses: any[], dayRecurring: any[]) => {
    if (dayExpenses.length === 0 && dayRecurring.length === 0) return;
    setSelectedDateLabel(date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    setSelectedDayExpenses(dayExpenses);
    setSelectedDayRecurring(dayRecurring);
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expense Timeline</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">A monthly view of logged expenses and automated utility bills.</p>
        </div>
        
        {/* Navigation buttons */}
        <div className="flex items-center gap-2.5 bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-lg p-1">
          <button
            onClick={handlePrevMonth}
            className="p-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold px-3 select-none text-gray-900 dark:text-white min-w-28 text-center">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md cursor-pointer transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CALENDAR BLOCK */}
      <div className="bg-white dark:bg-[#111317] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs overflow-hidden">
        
        {/* Week Day Titles */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800/80 bg-gray-50 dark:bg-gray-900/60 text-center py-2.5 text-xs font-bold text-gray-500">
          {daysOfWeek.map(day => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* Days grid */}
        {isExpensesLoading ? (
          <div className="grid grid-cols-7 h-[420px]">
            {Array.from({ length: 42 }).map((_, idx) => (
              <div key={idx} className="border-r border-b border-gray-100 dark:border-gray-800/40 p-2 animate-skeleton" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {calendarCells.map((cell, idx) => {
              if (!cell.date) return null;
              
              const { dayExpenses, dayRecurring } = getEventsForDate(cell.date);
              const totalEvents = dayExpenses.length + dayRecurring.length;
              
              const isToday = cell.date.toDateString() === new Date().toDateString();

              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(cell.date!, dayExpenses, dayRecurring)}
                  className={`min-h-20 border-r border-b border-gray-150 dark:border-gray-800/40 p-2 flex flex-col justify-between transition-all ${
                    cell.isCurrentMonth 
                      ? 'bg-transparent text-gray-900 dark:text-white' 
                      : 'bg-gray-50/20 dark:bg-gray-900/10 text-gray-400 dark:text-gray-600'
                  } ${
                    totalEvents > 0 ? 'hover:bg-blue-50/20 dark:hover:bg-blue-950/5 cursor-pointer' : ''
                  } ${
                    isToday ? 'bg-blue-50/40 dark:bg-blue-950/20 font-bold border-2 border-blue-500/50' : ''
                  }`}
                >
                  <span className={`text-[10px] self-end rounded-full w-5 h-5 flex items-center justify-center ${
                    isToday ? 'bg-blue-600 text-white font-bold' : ''
                  }`}>
                    {cell.date.getDate()}
                  </span>

                  {/* Badges preview */}
                  <div className="mt-1 space-y-1">
                    {dayExpenses.slice(0, 2).map(e => {
                      const statusClasses = e.status === 'PENDING'
                        ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'
                        : e.status === 'REJECTED'
                          ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                          : 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400';
                      
                      return (
                        <div 
                          key={e.id} 
                          className={`text-[9px] px-1 py-0.5 rounded font-semibold truncate flex items-center gap-0.5 ${statusClasses}`}
                          title={`${e.title} (${formatCurrency(e.amount)})`}
                        >
                          <Receipt className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{e.title}</span>
                        </div>
                      );
                    })}

                    {dayRecurring.slice(0, 1).map(r => (
                      <div 
                        key={r.id} 
                        className="text-[9px] px-1 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 font-semibold truncate flex items-center gap-0.5"
                        title={`Recurring: ${r.title} (${formatCurrency(r.amount)})`}
                      >
                        <Clock className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{r.title}</span>
                      </div>
                    ))}

                    {totalEvents > 3 && (
                      <div className="text-[8px] text-gray-400 font-bold text-center">
                        +{totalEvents - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* DETAIL MODAL ON DAY CLICK */}
      <Modal 
        isOpen={!!selectedDayExpenses || !!selectedDayRecurring} 
        onClose={() => { setSelectedDayExpenses(null); setSelectedDayRecurring(null); }}
        title={`Activity for ${selectedDateLabel}`}
      >
        <div className="space-y-5">
          
          {/* Expenses lists */}
          {selectedDayExpenses && selectedDayExpenses.length > 0 && (
            <div>
              <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-2.5">Daily Expenses</h4>
              <div className="space-y-2">
                {selectedDayExpenses.map(e => (
                  <div key={e.id} className="p-3 bg-gray-50 dark:bg-[#15181e] border border-gray-100 dark:border-gray-800 rounded-lg flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                        {e.title}
                        {e.status === 'PENDING' && (
                          <span className="text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-semibold">
                            Pending Approval
                          </span>
                        )}
                        {e.status === 'REJECTED' && (
                          <span className="text-[9px] bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 px-1.5 py-0.5 rounded font-semibold">
                            Rejected
                          </span>
                        )}
                      </p>
                      <span className="text-gray-500 mt-0.5 block">{e.category.name} • Payer: {e.paidBy.name}</span>
                    </div>
                    <span className="font-black text-sm text-blue-600 dark:text-blue-400">{formatCurrency(e.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recurring lists */}
          {selectedDayRecurring && selectedDayRecurring.length > 0 && (
            <div>
              <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-2.5">Recurring Bills Due</h4>
              <div className="space-y-2">
                {selectedDayRecurring.map(r => (
                  <div key={r.id} className="p-3 bg-amber-50/20 border border-amber-200 dark:bg-amber-950/10 dark:border-amber-900/60 rounded-lg flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-gray-950 dark:text-white">{r.title}</p>
                      <span className="text-gray-500 dark:text-gray-400 mt-0.5 block">Automated split • {r.category.name}</span>
                    </div>
                     <span className="font-black text-sm text-amber-600 dark:text-amber-400">{formatCurrency(r.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </Modal>

    </div>
  );
};

export default CalendarView;
