import { createContext, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import Toast from './Toast';

interface ToastItem { id: number; message: string; type: 'warning' | 'error' | 'success'; }

interface ToastContextValue {
  showToast: (message: string, type?: 'warning' | 'error' | 'success') => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

let _id = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: 'warning' | 'error' | 'success' = 'warning') => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end">
          {toasts.map(t => (
            <Toast key={t.id} message={t.message} type={t.type} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
