"use client";

import React, { useMemo, useState } from "react";
import { BarChart3, PieChart as PieIcon, TrendingUp } from "lucide-react";
import { BudgetVsActualChart } from "./BudgetVsActualChart";
import { CategoryPieChart } from "./CategoryPieChart";
import { TrendLineChart, type TrendPoint } from "./TrendLineChart";
import type { CategorySpendRow } from "@/lib/budgetCalc";

type ChartKey = "bars" | "pie" | "trend";

export function ChartSwitcher({
  rows,
  trend,
}: {
  rows: CategorySpendRow[];
  trend: TrendPoint[];
}) {
  const [active, setActive] = useState<ChartKey>("bars");

  const tabs = useMemo(
    () => [
      { key: "bars" as const, label: "Budget vs Spent", icon: <BarChart3 className="w-4 h-4" /> },
      { key: "pie" as const, label: "Category Share", icon: <PieIcon className="w-4 h-4" /> },
      { key: "trend" as const, label: "12-Month Trend", icon: <TrendingUp className="w-4 h-4" /> },
    ],
    [],
  );

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {tabs.map((t) => {
          const is = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                is
                  ? "bg-brand-50 dark:bg-brand-700/15 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-700/40"
                  : "bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="animate-fade-in" key={active}>
        {active === "bars" && <BudgetVsActualChart rows={rows} />}
        {active === "pie" && <CategoryPieChart rows={rows} />}
        {active === "trend" && <TrendLineChart data={trend} />}
      </div>
    </div>
  );
}
