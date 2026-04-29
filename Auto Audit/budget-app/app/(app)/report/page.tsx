"use client";

import React, { Suspense, useMemo, useState } from "react";
import { Printer, Wallet } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { MonthSelector } from "@/components/budget/MonthSelector";
import { BudgetVsActualChart } from "@/components/charts/BudgetVsActualChart";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";

import { useBudget } from "@/lib/BudgetContext";
import { summarizeMonth, transactionsInMonth } from "@/lib/budgetCalc";
import { generateInsight } from "@/lib/alerts";
import { currentMonthKey, formatMonth } from "@/lib/months";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading report…</div>
      }
    >
      <ReportInner />
    </Suspense>
  );
}

function ReportInner() {
  const params = useSearchParams();
  const initialMonth = params?.get("month") ?? currentMonthKey();
  const { transactions, categories, budgets, user, hydrated } = useBudget();
  const [month, setMonth] = useState(initialMonth);

  const summary = useMemo(
    () => summarizeMonth(month, budgets, categories, transactions),
    [month, budgets, categories, transactions],
  );
  const insight = useMemo(() => generateInsight(summary), [summary]);
  const monthTx = useMemo(
    () =>
      transactionsInMonth(transactions, month).sort((a, b) => (a.date < b.date ? -1 : 1)),
    [transactions, month],
  );

  const overByCategory = summary.rows.filter((r) => r.status === "over");

  const crossoverByCategory = useMemo(() => {
    const result: Record<string, string | null> = {};
    for (const row of overByCategory) {
      let running = 0;
      const catTx = monthTx
        .filter((t) => t.categoryId === row.category.id)
        .sort((a, b) => (a.date < b.date ? -1 : 1));
      let crossoverDate: string | null = null;
      for (const t of catTx) {
        running += t.amount;
        if (running > row.budget && !crossoverDate) {
          crossoverDate = t.date;
          break;
        }
      }
      result[row.category.id] = crossoverDate;
    }
    return result;
  }, [overByCategory, monthTx]);

  if (!hydrated) return null;

  return (
    <div className="print-page space-y-6 animate-fade-in">
      {/* Controls — hidden on print */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <MonthSelector month={month} onChange={setMonth} />
        <Button leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </div>

      {/* Printable document — always renders in light tones for paper */}
      <article className="bg-white text-gray-900 rounded-2xl border border-gray-200 p-8 print-card">
        <header className="flex items-center justify-between pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-brand-600 text-white grid place-items-center">
              <Wallet className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold">Auto Audit · Monthly Report</h1>
              <p className="text-sm text-gray-500">
                {formatMonth(month)} · Prepared for {user.name}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Generated</p>
            <p className="text-sm font-medium">
              {new Date().toLocaleDateString("en-US", { dateStyle: "medium" })}
            </p>
          </div>
        </header>

        <section className="grid grid-cols-3 gap-4 mt-6">
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Total Budget</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCurrency(summary.total)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Spent</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCurrency(summary.spent)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">Remaining</p>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums ${
                summary.remaining < 0 ? "text-danger-700" : ""
              }`}
            >
              {formatCurrency(summary.remaining)}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-gray-200 p-4 bg-gray-50">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Insight</p>
          <p className="text-sm">{insight}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold mb-3">Category Totals</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 pr-3 font-medium text-right">Budget</th>
                <th className="py-2 pr-3 font-medium text-right">Spent</th>
                <th className="py-2 pr-3 font-medium text-right">Remaining</th>
                <th className="py-2 pr-3 font-medium text-right">Used</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((r) => (
                <tr key={r.category.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: r.category.color }}
                      />
                      {r.category.name}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatCurrency(r.budget)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatCurrency(r.spent)}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right tabular-nums ${
                      r.remaining < 0 ? "text-danger-700" : ""
                    }`}
                  >
                    {formatCurrency(r.remaining)}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right tabular-nums ${
                      r.status === "over"
                        ? "text-danger-700 font-semibold"
                        : r.status === "warn"
                          ? "text-warn-700"
                          : ""
                    }`}
                  >
                    {formatPercent(r.percentUsed)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {overByCategory.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-danger-700 mb-3">
              Overspending Detail
            </h2>
            <div className="space-y-2">
              {overByCategory.map((r) => {
                const over = r.spent - r.budget;
                const date = crossoverByCategory[r.category.id];
                return (
                  <div
                    key={r.category.id}
                    className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm"
                  >
                    <p className="font-medium text-danger-900">
                      {r.category.name}: {formatCurrency(over)} over budget
                    </p>
                    <p className="text-danger-700 mt-0.5">
                      {formatCurrency(r.spent)} spent against a {formatCurrency(r.budget)}{" "}
                      limit.
                      {date && <> Crossed the limit on {formatDate(date)}.</>}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-8 grid md:grid-cols-2 gap-6 print-break-before">
          <div className="rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold mb-2">Budget vs Spent</h3>
            <BudgetVsActualChart rows={summary.rows} />
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold mb-2">Category Share</h3>
            <CategoryPieChart rows={summary.rows} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold mb-3">
            Transactions ({monthTx.length})
          </h2>
          {monthTx.length === 0 ? (
            <p className="text-sm text-gray-500">
              No transactions recorded this month.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Merchant</th>
                  <th className="py-2 pr-3 font-medium">Category</th>
                  <th className="py-2 pr-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {monthTx.map((t) => {
                  const cat = categories.find((c) => c.id === t.categoryId);
                  return (
                    <tr key={t.id} className="border-b border-gray-100">
                      <td className="py-1.5 pr-3 text-gray-600">
                        {formatDate(t.date)}
                      </td>
                      <td className="py-1.5 pr-3">{t.merchant}</td>
                      <td className="py-1.5 pr-3 text-gray-600">{cat?.name ?? "—"}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {formatCurrency(t.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <footer className="mt-10 pt-4 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
          <span>Auto Audit · Personal Budget Report</span>
          <span>Page 1 of 1</span>
        </footer>
      </article>
    </div>
  );
}
