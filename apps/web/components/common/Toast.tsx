'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, type, message, duration };
    
    setToasts((prev) => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div 
      className="fixed top-safe right-0 left-0 z-50 px-4 pt-4 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="max-w-md mx-auto space-y-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const icons: Record<ToastType, string> = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };

  const colors: Record<ToastType, string> = {
    success: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
    error: 'from-red-500/20 to-pink-500/20 border-red-500/30',
    info: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    warning: 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30',
  };

  return (
    <div
      role="alert"
      className={`glass-card rounded-xl p-4 flex items-center gap-3 pointer-events-auto animate-liquid-appear backdrop-blur-md bg-gradient-to-r ${colors[toast.type]}`}
    >
      <span className="text-2xl flex-shrink-0" aria-hidden="true">
        {icons[toast.type]}
      </span>
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="icon-btn w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
        aria-label="Close notification"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
