"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, currentMonthKey, formatMonth } from "@/lib/months";
import type { MonthKey } from "@/types";

export function MonthSelector({
  month,
  onChange,
  maxMonth,
}: {
  month: MonthKey;
  onChange: (m: MonthKey) => void;
  maxMonth?: MonthKey;
}) {
  const cap = maxMonth ?? currentMonthKey();
  const canGoNext = month < cap;

  return (
    <div className="inline-flex items-center gap-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-1 shadow-card">
      <button
        aria-label="Previous month"
        onClick={() => onChange(addMonths(month, -1))}
        className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-gray-100"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="px-3 py-1 text-sm font-medium text-gray-900 dark:text-gray-100 min-w-[130px] text-center">
        {formatMonth(month)}
      </span>
      <button
        aria-label="Next month"
        disabled={!canGoNext}
        onClick={() => canGoNext && onChange(addMonths(month, 1))}
        className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
