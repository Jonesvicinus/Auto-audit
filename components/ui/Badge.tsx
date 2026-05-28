import React from "react";

type Tone = "neutral" | "brand" | "warn" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  neutral:
    "bg-gray-100 text-gray-700 border-gray-200 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700",
  brand:
    "bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-700/15 dark:text-brand-300 dark:border-brand-700/40",
  warn: "bg-warn-50 text-warn-700 border-warn-200 dark:bg-warn-700/15 dark:text-warn-300 dark:border-warn-700/40",
  danger:
    "bg-danger-50 text-danger-700 border-danger-200 dark:bg-danger-700/15 dark:text-danger-300 dark:border-danger-700/40",
  info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/60",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border rounded-full ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
