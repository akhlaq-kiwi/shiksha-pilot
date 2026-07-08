import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: { icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-950/60', border: 'border-emerald-200 dark:border-emerald-800', iconColor: 'text-emerald-500', titleColor: 'text-emerald-900 dark:text-emerald-100', msgColor: 'text-emerald-700 dark:text-emerald-300' },
  error:   { icon: XCircle,       bg: 'bg-red-50 dark:bg-red-950/60',     border: 'border-red-200 dark:border-red-800',     iconColor: 'text-red-500',     titleColor: 'text-red-900 dark:text-red-100',     msgColor: 'text-red-700 dark:text-red-300'     },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-950/60', border: 'border-amber-200 dark:border-amber-800', iconColor: 'text-amber-500', titleColor: 'text-amber-900 dark:text-amber-100', msgColor: 'text-amber-700 dark:text-amber-300' },
  info:    { icon: Info,          bg: 'bg-blue-50 dark:bg-blue-950/60',   border: 'border-blue-200 dark:border-blue-800',   iconColor: 'text-blue-500',   titleColor: 'text-blue-900 dark:text-blue-100',   msgColor: 'text-blue-700 dark:text-blue-300'   },
};

function ToastItem({ toast, onRemove }) {
  const style = ICONS[toast.type] || ICONS.info;
  const Icon = style.icon;

  return (
    <div
      className={`
        flex items-start gap-3 w-full max-w-sm px-4 py-3.5 rounded-xl border shadow-lg
        backdrop-blur-sm pointer-events-auto
        animate-in slide-in-from-right-5 fade-in duration-300
        ${style.bg} ${style.border}
      `}
    >
      <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${style.iconColor}`} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className={`text-sm font-bold leading-tight ${style.titleColor}`}>{toast.title}</p>
        )}
        <p className={`text-sm leading-snug ${toast.title ? 'mt-0.5' : ''} ${style.msgColor}`}>{toast.message}</p>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className={`flex-shrink-0 p-0.5 rounded-md opacity-60 hover:opacity-100 transition-opacity ${style.iconColor}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const remove = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    if (!navigator.onLine) return null;
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type, title, message }]);
    if (duration > 0) {
      timers.current[id] = setTimeout(() => remove(id), duration);
    }
    return id;
  }, [remove]);

  // Convenience methods
  toast.success = (message, title) => toast({ type: 'success', title, message });
  toast.error   = (message, title) => toast({ type: 'error',   title, message });
  toast.warning = (message, title) => toast({ type: 'warning', title, message });
  toast.info    = (message, title) => toast({ type: 'info',    title, message });

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container — top-right */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
