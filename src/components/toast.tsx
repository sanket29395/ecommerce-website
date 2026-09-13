"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type ToastTone = "success" | "error" | "info" | "warning";

type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ShowToast = (message: string, tone?: ToastTone) => void;
const ToastContext = createContext<ShowToast | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const active = useRef(new Map<string, string>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    for (const [key, value] of active.current)
      if (value === id) active.current.delete(key);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback<ShowToast>(
    (message, tone = "info") => {
      const text = message.trim();
      if (!text) return;
      const key = `${tone}:${text}`;
      if (active.current.has(key)) return;
      const id = crypto.randomUUID();
      active.current.set(key, id);
      setToasts((current) => [
        ...current.slice(-3),
        { id, message: text, tone },
      ]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), 5000),
      );
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
      active.current.clear();
    },
    [],
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        className="toast-viewport"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <div className={`toast toast-${toast.tone}`} key={toast.id}>
            <span className="toast-mark" aria-hidden="true" />
            <p>{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              &#215;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

export function inferToastTone(message: string): ToastTone {
  if (/\b(saved|updated|added|sent|ready|removed|success)\b/i.test(message))
    return "success";
  if (
    /\b(unable|failed|invalid|incorrect|unavailable|insufficient|error|expired|required|cannot|must|not found)\b/i.test(
      message,
    )
  )
    return "error";
  return "info";
}
