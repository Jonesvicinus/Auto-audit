"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import {
  DollarSign,
  TrendingDown,
  Wallet,
  PlusCircle,
  Percent,
  Banknote,
  BarChart3,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { StatTile } from "@/components/budget/StatTile";
import { CategoryProgress } from "@/components/budget/CategoryProgress";
import { MonthSelector } from "@/components/budget/MonthSelector";
import { ChartSwitcher } from "@/components/charts/ChartSwitcher";
import { StatTileSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { NudgeCards } from "@/components/dashboard/NudgeCards";
import type { TrendPoint } from "@/components/charts/TrendLineChart";

import { useBudget } from "@/lib/BudgetContext";
import {
  compareToPriorMonth,
  summarizeMonth,
  totalSpentInMonth,
  transactionsInMonth,
  getBudgetForMonth,
} from "@/lib/budgetCalc";
import { generateAlerts } from "@/lib/alerts";
import { currentMonthKey, formatMonth, trailingMonths } from "@/lib/months";
import { formatCurrency } from "@/lib/format";

export default function DashboardPage() {
  const { hydrated, transactions, budgets, categories, isEmptyAccount } = useBudget();
  const [month, setMonth] = useState<string>(currentMonthKey());
  const [displayMode, setDisplayMode] = useState<"remaining" | "percent">("remaining");

  const summary = useMemo(
    () => summarizeMonth(month, budgets, categories, transactions),
    [month, budgets, categories, transactions],
  );
  const alerts = useMemo(() => generateAlerts(summary), [summary]);
  const priorCompare = useMemo(
    () => compareToPriorMonth(month, budgets, transactions),
    [month, budgets, transactions],
  );
  const trend: TrendPoint[] = useMemo(() => {
    return trailingMonths(month, 12).map((m) => {
      const b = getBudgetForMonth(budgets, m);
      return {
        monthLabel: formatMonth(m, "short"),
        spent: Math.round(totalSpentInMonth(transactions, m) * 100) / 100,
        budget: b?.total ?? 0,
      };
    });
  }, [month, budgets, transactions]);

  const monthTx = transactionsInMonth(transactions, month);
  const hasSpending = monthTx.length > 0;

  // Loading skeleton — keeps layout stable while async hydration runs.
  if (!hydrated) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton />
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <Skeleton className="h-72 lg:col-span-2" rounded="rounded-2xl" />
          <Skeleton className="h-72" rounded="rounded-2xl" />
        </div>
      </div>
    );
  }

  // Brand-new authenticated user: nudge them through setup before showing the
  // empty stat tiles. Drops away once they add a budget or an expense.
  if (isEmptyAccount) {
    return (
      <div className="space-y-8">
        <NudgeCards />
        <Card>
          <CardHeader
            title="Your charts will live here"
            subtitle="As soon as you set a budget and log spending."
          />
          <EmptyState
            icon={<BarChart3 className="w-6 h-6" />}
            title="Nothing to chart yet."
            description="Once you've added a few expenses, you'll see budget-vs-actual bars, category share, and a 12-month trend right here."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthSelector month={month} onChange={setMonth} />
        <div className="inline-flex bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-1 shadow-card">
          <button
            onClick={() => setDisplayMode("remaining")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              displayMode === "remaining"
                ? "bg-gray-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
            }`}
          >
            <Banknote className="w-4 h-4" />
            Amount left
          </button>
          <button
            onClick={() => setDisplayMode("percent")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              displayMode === "percent"
                ? "bg-gray-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
            }`}
          >
            <Percent className="w-4 h-4" />
            Percent used
          </button>
        </div>
      </div>

      {/* Prior-month banner */}
      {priorCompare && priorCompare.budget > 0 && (
        <Alert level={priorCompare.delta > 0 ? "warn" : "info"}>
          {priorCompare.delta > 0 ? (
            <>
              Last month you spent{" "}
              <span className="font-semibold">{formatCurrency(priorCompare.delta)}</span>{" "}
              more than your budget.
            </>
          ) : priorCompare.delta < 0 ? (
            <>
              Last month you finished{" "}
              <span className="font-semibold">{formatCurrency(-priorCompare.delta)}</span>{" "}
              under budget. Nice work.
            </>
          ) : (
            <>Last month you landed exactly on budget.</>
          )}
        </Alert>
      )}

      {/* Stat tiles */}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatTile
          label="Monthly Budget"
          value={formatCurrency(summary.total)}
          sub={formatMonth(month)}
          icon={<Wallet className="w-5 h-5" />}
          tone="neutral"
        />
        <StatTile
          label="Spent So Far"
          value={formatCurrency(summary.spent)}
          sub={`${Math.round(summary.percentUsed)}% of budget used`}
          icon={<DollarSign className="w-5 h-5" />}
          tone="brand"
        />
        <StatTile
          label="Remaining"
          value={formatCurrency(summary.remaining)}
          sub={
            summary.remaining < 0
              ? `${formatCurrency(-summary.remaining)} over`
              : "Available to spend"
          }
          icon={<TrendingDown className="w-5 h-5" />}
          tone={summary.remaining < 0 ? "danger" : "neutral"}
        />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <Alert key={i} level={a.level}>
              {a.message}
            </Alert>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Categories */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Categories"
            subtitle="Your spending vs each category budget."
            action={
              <Link href="/budget">
                <Button size="sm" variant="outline">Edit Budget</Button>
              </Link>
            }
          />
          {hasSpending || summary.rows.some((r) => r.budget > 0) ? (
            <div className="space-y-3">
              {summary.rows.map((row, i) => (
                <div
                  key={row.category.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <CategoryProgress row={row} displayMode={displayMode} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<PlusCircle className="w-6 h-6" />}
              title="Nothing tracked for this month yet."
              description="Add a purchase or set up your budget to see progress here."
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
          )}
        </Card>

        {/* Charts */}
        <Card className="lg:col-span-1">
          <CardHeader title="Visualize" subtitle="Switch between three views." />
          {hasSpending ? (
            <ChartSwitcher rows={summary.rows} trend={trend} />
          ) : (
            <EmptyState
              icon={<BarChart3 className="w-6 h-6" />}
              title="No spending to chart."
              description="Charts appear once you log your first expense this month."
              size="sm"
            />
          )}
        </Card>
      </div>

      {/* Recent transactions preview */}
      <Card>
        <CardHeader
          title="Recent Transactions"
          subtitle={`${monthTx.length} in ${formatMonth(month)}`}
          action={
            <Link href="/transactions">
              <Button size="sm" variant="outline">View all</Button>
            </Link>
          }
        />
        {monthTx.length === 0 ? (
          <EmptyState
            icon={<PlusCircle className="w-6 h-6" />}
            title="No expenses yet this month."
            description="Add your first purchase to start tracking."
            action={
              <Link href="/add-expense">
                <Button leftIcon={<PlusCircle className="w-4 h-4" />}>
                  Add Expense
                </Button>
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
            {monthTx
              .slice()
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .slice(0, 6)
              .map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                return (
                  <li
                    key={tx.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-8 h-8 rounded-lg grid place-items-center text-xs font-semibold"
                        style={{
                          backgroundColor: `${cat?.color}22`,
                          color: cat?.color,
                        }}
                      >
                        {tx.merchant[0]?.toUpperCase() ?? "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {tx.merchant}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {cat?.name ?? "Other"}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(tx.amount)}
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
      </Card>
    </div>
  );
}
