// src/context/ToastContext.jsx
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};

let toastCounter = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (message, type = 'info', duration = 3500) => {
      toastCounter += 1;
      const id = toastCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      timers.current[id] = setTimeout(() => remove(id), duration);
      return id;
    },
    [remove]
  );

  /**
   * Stable identity, and it has to be.
   *
   * Pages build their loaders with `useCallback(..., [toast])` and run them from
   * `useEffect(..., [loadX])`. A fresh object here on every render made that a
   * feedback loop: a failed request shows a toast → setToasts re-renders this
   * provider → new `toast` object → new loader → the effect fires again →
   * another failed request. The same happened 3.5s later when a toast
   * auto-dismissed. Memoising it is what stops the dashboard hammering the API.
   */
  const toast = useMemo(
    () => ({
      success: (msg, d) => push(msg, 'success', d),
      error: (msg, d) => push(msg, 'error', d),
      info: (msg, d) => push(msg, 'info', d),
    }),
    [push]
  );

  const styles = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-gray-800',
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[90vw]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles[t.type]} text-white rounded-lg shadow-lg px-4 py-3 text-sm flex items-start justify-between gap-3 animate-[fadeIn_0.15s_ease-out]`}
            role="alert"
          >
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="text-white/80 hover:text-white font-bold leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
