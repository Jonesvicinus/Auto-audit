import React from "react";
import { AlertTriangle, Info, AlertCircle } from "lucide-react";
import type { AlertLevel } from "@/types";

const toneClasses: Record<
  AlertLevel,
  { bg: string; text: string; icon: React.ReactNode }
> = {
  info: {
    bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/60",
    text: "text-blue-800 dark:text-blue-200",
    icon: <Info className="w-4 h-4" />,
  },
  warn: {
    bg: "bg-warn-50 border-warn-200 dark:bg-warn-700/15 dark:border-warn-700/40",
    text: "text-warn-700 dark:text-warn-200",
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  danger: {
    bg: "bg-danger-50 border-danger-200 dark:bg-danger-700/15 dark:border-danger-700/40",
    text: "text-danger-700 dark:text-danger-200",
    icon: <AlertCircle className="w-4 h-4" />,
  },
};

export function Alert({
  level = "info",
  children,
  className = "",
}: {
  level?: AlertLevel;
  children: React.ReactNode;
  className?: string;
}) {
  const t = toneClasses[level];
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${t.bg} ${t.text} ${className}`}
    >
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
