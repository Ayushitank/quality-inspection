import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import styles from './Toast.module.css';

const DISMISS_AFTER_MS = 4000;
const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((message, { tone = 'success' } = {}) => {
    clearTimeout(timer.current);
    setToast({ message, tone, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), DISMISS_AFTER_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext value={show}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {toast && (
          <p key={toast.id} className={`${styles.toast} ${styles[toast.tone]}`}>
            {toast.message}
          </p>
        )}
      </div>
    </ToastContext>
  );
}

export const useToast = () => useContext(ToastContext);
