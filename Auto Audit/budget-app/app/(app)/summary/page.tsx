"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Printer, FileText, PlusCircle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MonthSelector } from "@/components/budget/MonthSelector";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { BudgetVsActualChart } from "@/components/charts/BudgetVsActualChart";

import { useBudget } from "@/lib/BudgetContext";
import { summarizeMonth, transactionsInMonth } from "@/lib/budgetCalc";
import { generateAlerts, generateInsight } from "@/lib/alerts";
import { currentMonthKey, formatMonth } from "@/lib/months";
import { formatCurrency, formatPercent } from "@/lib/format";

export default function MonthlySummaryPage() {
  const { transactions, categories, budgets, hydrated } = useBudget();
  const [month, setMonth] = useState(currentMonthKey());

  const summary = useMemo(
    () => summarizeMonth(month, budgets, categories, transactions),
    [month, budgets, categories, transactions],
  );
  const alerts = useMemo(() => generateAlerts(summary), [summary]);
  const insight = useMemo(() => generateInsight(summary), [summary]);
  const monthTx = transactionsInMonth(transactions, month);

  if (!hydrated) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <MonthSelector month={month} onChange={setMonth} />
        <Link href={`/report?month=${month}`}>
          <Button variant="outline" size="sm" leftIcon={<Printer className="w-4 h-4" />}>
            Printable Report
          </Button>
        </Link>
      </div>

      {monthTx.length === 0 && summary.total === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title={`No data for ${formatMonth(month)}.`}
            description="Once you set a budget and log spending for this month, the summary will appear here."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Link href="/add-expense">
                  <Button leftIcon={<PlusCircle className="w-4 h-4" />}>
                    Add Expense
                  </Button>
                </Link>
                <Link href="/budget">
                  <Button variant="outline">Edit Budget</Button>
                </Link>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title={`${formatMonth(month)} Summary`}
              subtitle={`${monthTx.length} transactions · ${formatCurrency(summary.spent)} spent`}
            />
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-xl bg-gray-50 dark:bg-neutral-950 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Budget</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatCurrency(summary.total)}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-neutral-950 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Spent</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-700 dark:text-brand-400">
                  {formatCurrency(summary.spent)}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-neutral-950 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
                <p
                  className={`mt-1 text-2xl font-semibold tabular-nums ${
                    summary.remaining < 0
                      ? "text-danger-700 dark:text-danger-400"
                      : "text-gray-900 dark:text-gray-100"
                  }`}
                >
                  {formatCurrency(summary.remaining)}
                </p>
              </div>
            </div>

            <Alert level="info" className="mt-5">
              <span className="text-sm">{insight}</span>
            </Alert>
          </Card>

          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <Alert key={i} level={a.level}>
                  {a.message}
                </Alert>
              ))}
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Category Spending" subtitle="Totals by category." />
              <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
                {summary.rows.map((row) => (
                  <li
                    key={row.category.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: row.category.color }}
                      />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {row.category.name}
                      </span>
                      {row.status === "over" && (
                        <span className="text-xs font-semibold text-danger-700 dark:text-danger-400 ml-1">
                          {formatCurrency(row.spent - row.budget)} over
                        </span>
                      )}
                      {row.status === "warn" && (
                        <span className="text-xs font-semibold text-warn-700 dark:text-warn-300 ml-1">
                          {formatPercent(row.percentUsed)} used
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(row.spent)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                        of {formatCurrency(row.budget)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader
                title="Where Your Money Went"
                subtitle="Category share of total spending."
              />
              <CategoryPieChart rows={summary.rows} />
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Budget vs Spent"
              subtitle="How each category did this month."
            />
            <BudgetVsActualChart rows={summary.rows} />
          </Card>
        </>
      )}
    </div>
  );
}
