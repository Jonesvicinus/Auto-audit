"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertTriangle, Info, AlertCircle, X } from "lucide-react";

type ToastTone = "success" | "info" | "warn" | "danger";

interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastApi {
  show: (t: Omit<ToastItem, "id"> | string) => void;
  success: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warn: (title: string, description?: string) => void;
  danger: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const toneClass: Record<ToastTone, string> = {
  success:
    "bg-white dark:bg-neutral-900 border-brand-200 dark:border-brand-700 text-gray-900 dark:text-gray-100",
  info: "bg-white dark:bg-neutral-900 border-blue-200 dark:border-blue-700 text-gray-900 dark:text-gray-100",
  warn: "bg-white dark:bg-neutral-900 border-warn-200 dark:border-warn-700 text-gray-900 dark:text-gray-100",
  danger:
    "bg-white dark:bg-neutral-900 border-danger-200 dark:border-danger-700 text-gray-900 dark:text-gray-100",
};

const iconFor = (tone: ToastTone) => {
  if (tone === "success") return <CheckCircle2 className="w-4 h-4 text-brand-600" />;
  if (tone === "warn") return <AlertTriangle className="w-4 h-4 text-warn-600" />;
  if (tone === "danger") return <AlertCircle className="w-4 h-4 text-danger-600" />;
  return <Info className="w-4 h-4 text-blue-600" />;
};

let counter = 0;
function nextId() {
  counter += 1;
  return `t-${Date.now()}-${counter}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setItems((s) => s.filter((t) => t.id !== id));
    const tm = timers.current[id];
    if (tm) {
      clearTimeout(tm);
      delete timers.current[id];
    }
  }, []);

  const show = useCallback(
    (input: Omit<ToastItem, "id"> | string) => {
      const item: ToastItem =
        typeof input === "string"
          ? { id: nextId(), tone: "info", title: input }
          : { id: nextId(), ...input };
      setItems((s) => [...s, item]);
      timers.current[item.id] = setTimeout(() => dismiss(item.id), 3000);
    },
    [dismiss],
  );

  const api: ToastApi = {
    show,
    success: (title, description) => show({ tone: "success", title, description }),
    info: (title, description) => show({ tone: "info", title, description }),
    warn: (title, description) => show({ tone: "warn", title, description }),
    danger: (title, description) => show({ tone: "danger", title, description }),
  };

  // Cleanup any pending timers on unmount.
  useEffect(() => {
    const t = timers.current;
    return () => {
      Object.values(t).forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[320px] max-w-[92vw] pointer-events-none"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl border shadow-pop animate-toast-in p-3 flex items-start gap-2 ${toneClass[t.tone]}`}
          >
            <span className="mt-0.5 shrink-0">{iconFor(t.tone)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {t.description}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:hover:text-gray-200"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
