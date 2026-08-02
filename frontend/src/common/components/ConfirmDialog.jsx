import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback(({ title = 'Are you sure?', message, confirmLabel = 'Confirm', danger = false }) => {
    return new Promise((resolve) => {
      setState({ title, message, confirmLabel, danger, resolve });
    });
  }, []);

  const handleChoice = (result) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => handleChoice(false)} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 fade-in duration-200">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${state.danger ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
              <AlertTriangle className={`h-5 w-5 ${state.danger ? 'text-red-500' : 'text-amber-500'}`} />
            </div>
            <h3 className="text-base font-bold text-text-primary mb-1">{state.title}</h3>
            {state.message && <p className="text-sm text-text-secondary leading-relaxed">{state.message}</p>}
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => handleChoice(false)}>
                Cancel
              </Button>
              <Button
                className={`flex-1 ${state.danger ? 'bg-red-600 hover:bg-red-700 text-white border-red-600' : ''}`}
                onClick={() => handleChoice(true)}
              >
                {state.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
