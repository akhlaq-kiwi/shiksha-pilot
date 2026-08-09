import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X, WifiOff } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: { icon: CheckCircle2, bg: 'bg-success-50 dark:bg-success-500/10', border: 'border-success-200 dark:border-success-500/30', iconColor: 'text-success-600', titleColor: 'text-success-700 dark:text-success-300', msgColor: 'text-success-700 dark:text-success-300' },
  error:   { icon: XCircle,       bg: 'bg-danger-50 dark:bg-danger-500/10',   border: 'border-danger-200 dark:border-danger-500/30',   iconColor: 'text-danger-600',   titleColor: 'text-danger-700 dark:text-danger-300',   msgColor: 'text-danger-700 dark:text-danger-300'   },
  warning: { icon: AlertTriangle, bg: 'bg-warning-50 dark:bg-warning-500/10', border: 'border-warning-200 dark:border-warning-500/30', iconColor: 'text-warning-600', titleColor: 'text-warning-700 dark:text-warning-300', msgColor: 'text-warning-700 dark:text-warning-300' },
  info:    { icon: Info,          bg: 'bg-info-50 dark:bg-info-500/10',       border: 'border-info-200 dark:border-info-500/30',       iconColor: 'text-info-600',       titleColor: 'text-info-700 dark:text-info-300',       msgColor: 'text-info-700 dark:text-info-300'       },
};

/**
 * Persistent connectivity indicator. Replaces the old behaviour of silently
 * dropping all toasts while offline.
 */
function OfflineBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-0 left-0 right-0 z-[9998] flex items-center justify-center gap-2 bg-warning-600 px-4 py-2 text-center text-sm font-medium text-white"
    >
      <WifiOff className="h-4 w-4 flex-shrink-0" />
      You are offline. Changes you make may not be saved until the connection returns.
    </div>
  );
}

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
        {toast.action && (
          <button
            onClick={() => { toast.action.onClick(); onRemove(toast.id); }}
            className={`mt-1.5 text-xs font-semibold underline underline-offset-2 ${style.titleColor}`}
          >
            {toast.action.label}
          </button>
        )}
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

  const toast = useCallback(({ type = 'info', title, message, duration = 4000, action } = {}) => {
    // Feedback must NEVER be suppressed when offline — that is precisely when
    // the user most needs to know a save failed. An offline banner communicates
    // connectivity; swallowing toasts communicated nothing.
    const id = Date.now() + Math.random();
    setToasts(prev => {
      // Dedupe identical consecutive messages so repeated failures don't stack.
      const last = prev[prev.length - 1];
      if (last && last.type === type && last.message === message && last.title === title) return prev;
      return [...prev, { id, type, title, message, action }];
    });
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
  toast.show    = (type, title, message) => toast({ type: type || 'info', title, message });

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <OfflineBanner />
      {/* Toast container — top-right. role/aria-live so screen readers announce. */}
      <div
        className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none"
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
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
