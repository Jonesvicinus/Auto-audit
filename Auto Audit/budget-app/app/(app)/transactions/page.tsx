"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Pencil, Plus, Search, Trash2, X, ListOrdered } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { TransactionEditor } from "@/components/transactions/TransactionEditor";
import { MonthSelector } from "@/components/budget/MonthSelector";

import { useBudget } from "@/lib/BudgetContext";
import { transactionsInMonth } from "@/lib/budgetCalc";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { merchantFamilyKey } from "@/lib/fuzzyMatch";
import { currentMonthKey, formatMonth } from "@/lib/months";

type SortKey = "date" | "merchant" | "amount" | "category";

export default function TransactionsPage() {
  const {
    transactions,
    categories,
    updateTransaction,
    deleteTransaction,
    clearTransactionsForMonth,
    hydrated,
  } = useBudget();
  const toast = useToast();

  const [month, setMonth] = useState<string>(currentMonthKey());
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editing, setEditing] = useState<string | null>(null);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: "All categories" },
      ...categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories],
  );
  const categoryOptionsForEdit = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );

  const isFiltered = query.trim().length > 0 || categoryFilter !== "all";
  const monthTx = useMemo(
    () => transactionsInMonth(transactions, month),
    [transactions, month],
  );

  const rows = useMemo(() => {
    let list = monthTx.slice();
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((t) => t.merchant.toLowerCase().includes(q));
    }
    if (categoryFilter !== "all") {
      list = list.filter((t) => t.categoryId === categoryFilter);
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (sortKey === "merchant") cmp = a.merchant.localeCompare(b.merchant);
      else if (sortKey === "amount") cmp = a.amount - b.amount;
      else if (sortKey === "category") {
        const ac = categoryById.get(a.categoryId)?.name ?? "";
        const bc = categoryById.get(b.categoryId)?.name ?? "";
        cmp = ac.localeCompare(bc);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [monthTx, query, categoryFilter, sortKey, sortDir, categoryById]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" || key === "amount" ? "desc" : "asc");
    }
  }

  function clearFilters() {
    setQuery("");
    setCategoryFilter("all");
  }

  function handleClearMonth() {
    if (monthTx.length === 0) return;
    const monthLabel = formatMonth(month);
    const confirmed = window.confirm(
      `Clear all ${monthTx.length} expense${monthTx.length === 1 ? "" : "s"} from ${monthLabel}?\n\nThis cannot be undone.`,
    );
    if (!confirmed) return;
    const removed = monthTx.length;
    clearTransactionsForMonth(month);
    toast.danger(
      "Month expenses cleared",
      `${removed} expense${removed === 1 ? "" : "s"} removed from ${monthLabel}.`,
    );
    setEditing(null);
  }

  if (!hydrated) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-gray-100 dark:bg-neutral-800" />
        <div className="h-64 rounded-2xl bg-gray-100 dark:bg-neutral-800" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader
          title="Transactions"
          subtitle={`${monthTx.length} in ${formatMonth(month)} · ${transactions.length} total across your account.`}
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                size="sm"
                variant="danger"
                leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={handleClearMonth}
                disabled={monthTx.length === 0}
                title={`Clear all expenses from ${formatMonth(month)}`}
              >
                <span className="hidden sm:inline">Clear Month</span>
                <span className="sm:hidden">Clear</span>
              </Button>
              <Link href="/add-expense">
                <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                  Add Expense
                </Button>
              </Link>
            </div>
          }
        />

        <div className="grid md:grid-cols-[250px_1fr_240px] gap-3">
          <MonthSelector month={month} onChange={setMonth} />
          <Input
            placeholder="Search by merchant..."
            leftAdornment={<Search className="w-4 h-4" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select
            options={categoryOptions}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          />
        </div>

        {monthTx.length === 0 && transactions.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={<ListOrdered className="w-6 h-6" />}
              title="No transactions yet."
              description="Once you log a purchase, it'll show up here so you can search, sort, edit, or delete it."
              action={
                <Link href="/add-expense">
                  <Button leftIcon={<Plus className="w-4 h-4" />}>Add Expense</Button>
                </Link>
              }
            />
          </div>
        ) : monthTx.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={<ListOrdered className="w-6 h-6" />}
              title={`No expenses in ${formatMonth(month)}.`}
              description="Pick another month or add a purchase for this one."
              action={
                <Link href="/add-expense">
                  <Button leftIcon={<Plus className="w-4 h-4" />}>Add Expense</Button>
                </Link>
              }
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={<Search className="w-6 h-6" />}
              title="No matches."
              description={
                isFiltered
                  ? "Try a different search term or clear the filter."
                  : "Nothing to show here yet."
              }
              action={
                isFiltered ? (
                  <Button
                    variant="outline"
                    leftIcon={<X className="w-4 h-4" />}
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-neutral-800">
                  {[
                    { key: "date" as const, label: "Date" },
                    { key: "merchant" as const, label: "Merchant" },
                    { key: "category" as const, label: "Category" },
                    { key: "amount" as const, label: "Amount", align: "right" as const },
                  ].map((c) => (
                    <th
                      key={c.key}
                      className={`py-2 pr-3 font-medium ${
                        c.align === "right" ? "text-right" : ""
                      }`}
                    >
                      <button
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100"
                      >
                        {c.label}
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                  ))}
                  <th className="py-2 pr-2 w-20 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tx) => {
                  const cat = categoryById.get(tx.categoryId);
                  const isEditing = editing === tx.id;
                  return (
                    <React.Fragment key={tx.id}>
                      <tr className="border-b border-gray-100 dark:border-neutral-800/70 hover:bg-gray-50/50 dark:hover:bg-neutral-900/50">
                        <td className="py-3 pr-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td className="py-3 pr-3 text-gray-900 dark:text-gray-100 font-medium">
                          <div className="flex flex-col">
                            <span>{tx.merchant}</span>
                            {tx.note && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                {tx.note}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge tone="neutral">
                            <span
                              className="w-2 h-2 rounded-full mr-1 inline-block"
                              style={{ backgroundColor: cat?.color }}
                            />
                            {cat?.name ?? "—"}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3 text-right font-semibold tabular-nums">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="py-3 pr-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => setEditing(isEditing ? null : tx.id)}
                              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:hover:text-gray-100 rounded-lg"
                              aria-label="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete ${tx.merchant} for ${formatCurrency(tx.amount)}?`,
                                  )
                                ) {
                                  deleteTransaction(tx.id);
                                  toast.info("Transaction deleted");
                                }
                              }}
                              className="p-1.5 text-gray-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-700/20 rounded-lg"
                              aria-label="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isEditing && (
                        <tr className="border-b border-gray-100 dark:border-neutral-800/70">
                          <td colSpan={5} className="p-3">
                            <TransactionEditor
                              tx={tx}
                              categoryOptions={categoryOptionsForEdit}
                              onCancel={() => setEditing(null)}
                              onSave={(patch) => {
                                const categoryChanged =
                                  patch.categoryId !== undefined &&
                                  patch.categoryId !== tx.categoryId;
                                const merchantKey = merchantFamilyKey(
                                  patch.merchant ?? tx.merchant,
                                );
                                const matchingCount = categoryChanged
                                  ? transactions.filter(
                                      (t) => merchantFamilyKey(t.merchant) === merchantKey,
                                    ).length
                                  : 1;
                                updateTransaction(tx.id, patch);
                                setEditing(null);
                                toast.success(
                                  "Transaction updated",
                                  categoryChanged && matchingCount > 1
                                    ? `${matchingCount} matching merchant transactions were recategorized.`
                                    : undefined,
                                );
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
