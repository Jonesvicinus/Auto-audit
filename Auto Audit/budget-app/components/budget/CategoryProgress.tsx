import React from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { CategorySpendRow } from "@/lib/budgetCalc";

type DisplayMode = "percent" | "remaining";

export function CategoryProgress({
  row,
  displayMode = "remaining",
}: {
  row: CategorySpendRow;
  displayMode?: DisplayMode;
}) {
  const { category, spent, budget, remaining, percentUsed, status } = row;

  const rightLabel =
    displayMode === "percent"
      ? formatPercent(percentUsed)
      : remaining >= 0
        ? `${formatCurrency(remaining)} left`
        : `${formatCurrency(Math.abs(remaining))} over`;

  const borderTone =
    status === "over"
      ? "border-danger-200 dark:border-danger-700/40 bg-danger-50/30 dark:bg-danger-700/10"
      : status === "warn"
        ? "border-warn-200 dark:border-warn-700/40 bg-warn-50/30 dark:bg-warn-700/10"
        : "border-gray-200 dark:border-neutral-800";

  const labelTone =
    status === "over"
      ? "text-danger-700 dark:text-danger-300"
      : status === "warn"
        ? "text-warn-700 dark:text-warn-300"
        : "text-gray-900 dark:text-gray-100";

  return (
    <div className={`rounded-xl border p-4 transition-colors ${borderTone}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: category.color }}
          />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {category.name}
          </span>
        </div>
        <div className="flex items-baseline gap-2 shrink-0">
          <span className={`text-sm font-semibold tabular-nums ${labelTone}`}>
            {rightLabel}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            {formatCurrency(spent)} / {formatCurrency(budget)}
          </span>
        </div>
      </div>
      <div className="mt-3">
        <ProgressBar value={percentUsed} status={status} />
      </div>
    </div>
  );
}
