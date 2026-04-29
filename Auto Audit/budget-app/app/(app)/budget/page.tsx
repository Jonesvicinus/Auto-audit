"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, RotateCcw } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { MonthSelector } from "@/components/budget/MonthSelector";

import { useBudget } from "@/lib/BudgetContext";
import {
  getBudgetForMonth,
  sumCategoryBudgets,
  categoryBudgetsExceedTotal,
} from "@/lib/budgetCalc";
import { currentMonthKey, formatMonth } from "@/lib/months";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";

const PALETTE = [
  "#10b981",
  "#3b82f6",
  "#a855f7",
  "#f59e0b",
  "#ec4899",
  "#14b8a6",
  "#6366f1",
  "#ef4444",
];

export default function BudgetSettingsPage() {
  const {
    categories,
    budgets,
    upsertBudget,
    addCategory,
    updateCategory,
    deleteCategory,
    resetDemo,
    hydrated,
  } = useBudget();
  const toast = useToast();

  const [month, setMonth] = useState(currentMonthKey());
  const [total, setTotal] = useState(0);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [newCatName, setNewCatName] = useState("");

  useEffect(() => {
    const b = getBudgetForMonth(budgets, month);
    setTotal(b?.total ?? 0);
    const next: Record<string, number> = {};
    for (const c of categories) {
      next[c.id] = b?.categories?.[c.id] ?? 0;
    }
    setLimits(next);
  }, [month, budgets, categories]);

  const categorySum = useMemo(() => sumCategoryBudgets(limits), [limits]);
  const slack = total - categorySum;
  const exceeds = categoryBudgetsExceedTotal({ month, total, categories: limits });

  function handleSave() {
    if (exceeds) {
      toast.warn("Categories exceed total", "Lower some categories before saving.");
      return;
    }
    upsertBudget({ month, total, categories: limits });
    toast.success(
      "Budget saved",
      `Updates applied to ${formatMonth(month)}.`,
    );
  }

  function handleAddCategory() {
    const name = newCatName.trim();
    if (!name) return;
    const color = PALETTE[categories.length % PALETTE.length];
    addCategory({ name, color });
    setNewCatName("");
    toast.success("Category added", name);
  }

  function handleDeleteCategory(id: string) {
    const cat = categories.find((c) => c.id === id);
    if (!cat || cat.isOther) return;
    const ok = window.confirm(
      `Delete "${cat.name}"? Existing transactions will be moved to Other.`,
    );
    if (ok) {
      deleteCategory(id);
      toast.info("Category removed", `${cat.name} merged into Other.`);
    }
  }

  function handleResetDemo() {
    const ok = window.confirm(
      "Reset all data for this account? This can't be undone.",
    );
    if (!ok) return;
    resetDemo();
    toast.info("Data reset");
  }

  if (!hydrated) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthSelector month={month} onChange={setMonth} />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RotateCcw className="w-4 h-4" />}
            onClick={handleResetDemo}
          >
            Reset data
          </Button>
          <Button leftIcon={<Save className="w-4 h-4" />} onClick={handleSave}>
            Save Budget
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader
            title="Total Monthly Budget"
            subtitle="Cap for all categories combined."
          />
          <Input
            name="total"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            value={total === 0 ? "" : total}
            onChange={(e) => setTotal(parseFloat(e.target.value) || 0)}
            leftAdornment={<span>$</span>}
          />
          <div className="mt-5 rounded-xl bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Categories total</span>
              <span className="tabular-nums font-medium">
                {formatCurrency(categorySum)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Monthly cap</span>
              <span className="tabular-nums font-medium">{formatCurrency(total)}</span>
            </div>
            <div
              className={`flex justify-between font-semibold ${
                slack < 0
                  ? "text-danger-700 dark:text-danger-400"
                  : "text-brand-700 dark:text-brand-400"
              }`}
            >
              <span>{slack < 0 ? "Over cap by" : "Unassigned"}</span>
              <span className="tabular-nums">{formatCurrency(Math.abs(slack))}</span>
            </div>
            {slack > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 pt-1">
                We'll add this to the Other category when you save.
              </p>
            )}
          </div>

          {exceeds && (
            <Alert level="danger" className="mt-4">
              Your category budgets add up to more than your total monthly budget.
              Lower some categories before saving.
            </Alert>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Category Budgets"
            subtitle={`Set a limit for each. Editing ${formatMonth(month)}.`}
          />
          <ul className="space-y-2">
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 bg-white dark:bg-neutral-900"
              >
                <span
                  aria-hidden
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      value={c.name}
                      disabled={c.isOther}
                      onChange={(e) => updateCategory(c.id, { name: e.target.value })}
                      className={`text-sm font-medium bg-transparent focus:outline-none rounded px-1 -mx-1 ${
                        c.isOther
                          ? "text-gray-700 dark:text-gray-300"
                          : "text-gray-900 dark:text-gray-100 hover:bg-gray-50 focus:bg-gray-50 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800"
                      }`}
                    />
                    {c.isOther && <Badge tone="neutral">Auto</Badge>}
                    {c.isDefault && !c.isOther && <Badge tone="brand">Default</Badge>}
                  </div>
                </div>
                <div className="w-32">
                  <Input
                    name={`limit-${c.id}`}
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min="0"
                    value={limits[c.id] === 0 ? "" : (limits[c.id] ?? 0)}
                    onChange={(e) =>
                      setLimits((l) => ({
                        ...l,
                        [c.id]: parseFloat(e.target.value) || 0,
                      }))
                    }
                    leftAdornment={<span>$</span>}
                  />
                </div>
                {!c.isOther && !c.isDefault && (
                  <button
                    onClick={() => handleDeleteCategory(c.id)}
                    aria-label={`Delete ${c.name}`}
                    className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-700/20 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center gap-2">
            <Input
              placeholder="New category name (e.g. Books)"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
            />
            <Button
              variant="outline"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleAddCategory}
              disabled={!newCatName.trim()}
            >
              Add Category
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Default categories can be renamed but not removed. Deleting a custom
            category moves its past transactions into Other.
          </p>
        </Card>
      </div>
    </div>
  );
}
