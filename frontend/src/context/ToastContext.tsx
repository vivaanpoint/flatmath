import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full sm:w-auto">
        {toasts.map((toast) => {
          const Icon = {
            success: CheckCircle,
            error: AlertCircle,
            warning: AlertTriangle,
            info: Info
          }[toast.type];

          const colorClasses = {
            success: 'bg-emerald-900 border-emerald-800 text-emerald-100 dark:bg-emerald-950/90 dark:border-emerald-800/80',
            error: 'bg-red-900 border-red-800 text-red-100 dark:bg-red-950/90 dark:border-red-800/80',
            warning: 'bg-amber-900 border-amber-800 text-amber-100 dark:bg-amber-950/90 dark:border-amber-800/80',
            info: 'bg-blue-900 border-blue-800 text-blue-100 dark:bg-blue-950/90 dark:border-blue-800/80'
          }[toast.type];

          return (
            <div
              key={toast.id}
              className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg transition-all duration-300 transform translate-y-0 animate-fade-in ${colorClasses}`}
              role="alert"
            >
              <Icon className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1 text-sm font-medium pr-4">{toast.message}</div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-current opacity-70 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
