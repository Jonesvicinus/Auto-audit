import type {
  Category,
  MonthKey,
  MonthlyBudget,
  Transaction,
} from "@/types";
import { monthKeyOf, addMonths } from "./months";
import { activeCategoriesForMonth } from "./categorySchedule";

export interface CategorySpendRow {
  category: Category;
  budget: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  status: "normal" | "warn" | "over";
}

export interface MonthSummary {
  month: MonthKey;
  total: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  rows: CategorySpendRow[];
}

// -----------------------------------------------------------------------------
// Transactions for a given month
// -----------------------------------------------------------------------------
export function transactionsInMonth(
  transactions: Transaction[],
  month: MonthKey,
): Transaction[] {
  return transactions.filter((t) => t.date.slice(0, 7) === month);
}

export function totalSpentInMonth(
  transactions: Transaction[],
  month: MonthKey,
): number {
  return transactionsInMonth(transactions, month).reduce(
    (sum, t) => sum + t.amount,
    0,
  );
}

// -----------------------------------------------------------------------------
// Budget lookup. If a month is missing, we copy forward from the prior month.
// -----------------------------------------------------------------------------
export function getBudgetForMonth(
  budgets: MonthlyBudget[],
  month: MonthKey,
): MonthlyBudget | null {
  const direct = budgets.find((b) => b.month === month);
  if (direct) return direct;
  // Find the most recent prior budget to copy forward.
  const prior = budgets
    .filter((b) => b.month < month)
    .sort((a, b) => (a.month < b.month ? 1 : -1))[0];
  if (prior) return { ...prior, month, categories: { ...prior.categories } };
  return null;
}

// Insert a budget copied from prior month if we don't already have one.
// Returns a potentially new array. Safe to call repeatedly.
export function ensureBudgetForMonth(
  budgets: MonthlyBudget[],
  month: MonthKey,
  fallbackTotal = 0,
  fallbackCategories: Record<string, number> = {},
): MonthlyBudget[] {
  if (budgets.some((b) => b.month === month)) return budgets;
  const carryover = getBudgetForMonth(budgets, month);
  const next: MonthlyBudget = carryover ?? {
    month,
    total: fallbackTotal,
    categories: fallbackCategories,
  };
  return [...budgets, { ...next, month }];
}

// -----------------------------------------------------------------------------
// Summary table for Dashboard / Summary / Report
// -----------------------------------------------------------------------------
export function summarizeMonth(
  month: MonthKey,
  budgets: MonthlyBudget[],
  categories: Category[],
  transactions: Transaction[],
): MonthSummary {
  const budget = getBudgetForMonth(budgets, month);
  const monthTx = transactionsInMonth(transactions, month);
  const total = budget?.total ?? 0;

  const spentByCategory: Record<string, number> = {};
  let spentTotal = 0;
  for (const t of monthTx) {
    spentByCategory[t.categoryId] = (spentByCategory[t.categoryId] ?? 0) + t.amount;
    spentTotal += t.amount;
  }

  const visibleCategoryIds = new Set([
    ...Object.keys(spentByCategory),
    ...Object.keys(budget?.categories ?? {}).filter(
      (categoryId) => (budget?.categories?.[categoryId] ?? 0) > 0,
    ),
  ]);
  const visibleCategories = activeCategoriesForMonth(
    categories,
    month,
    Array.from(visibleCategoryIds),
  );

  const rows: CategorySpendRow[] = visibleCategories.map((cat) => {
    const catBudget = budget?.categories?.[cat.id] ?? 0;
    const catSpent = spentByCategory[cat.id] ?? 0;
    const remaining = catBudget - catSpent;
    const percentUsed = catBudget > 0 ? (catSpent / catBudget) * 100 : catSpent > 0 ? 100 : 0;
    const status: CategorySpendRow["status"] =
      catBudget > 0 && catSpent > catBudget
        ? "over"
        : catBudget > 0 && percentUsed >= 80
          ? "warn"
          : "normal";
    return {
      category: cat,
      budget: catBudget,
      spent: catSpent,
      remaining,
      percentUsed,
      status,
    };
  });

  return {
    month,
    total,
    spent: spentTotal,
    remaining: total - spentTotal,
    percentUsed: total > 0 ? (spentTotal / total) * 100 : 0,
    rows,
  };
}

// -----------------------------------------------------------------------------
// Budget editing rules
// -----------------------------------------------------------------------------
export function sumCategoryBudgets(categories: Record<string, number>): number {
  return Object.values(categories).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

export function categoryBudgetsExceedTotal(budget: MonthlyBudget): boolean {
  return sumCategoryBudgets(budget.categories) > budget.total + 0.001;
}

// Push any "unused" portion of the total budget into the "Other" category.
// This keeps category totals === total budget, preventing unallocated slack.
export function allocateSlackToOther(
  budget: MonthlyBudget,
  otherCategoryId: string,
): MonthlyBudget {
  const sum = sumCategoryBudgets(budget.categories);
  if (Math.abs(sum - budget.total) < 0.01) return budget;
  const slack = Math.max(0, budget.total - sum);
  const nextCats = { ...budget.categories };
  const current = nextCats[otherCategoryId] ?? 0;
  nextCats[otherCategoryId] = Math.max(0, current + slack);
  return { ...budget, categories: nextCats };
}

// -----------------------------------------------------------------------------
// Prior-month comparison for the "underspent/overspent last month" banner
// -----------------------------------------------------------------------------
export function compareToPriorMonth(
  month: MonthKey,
  budgets: MonthlyBudget[],
  transactions: Transaction[],
): { priorMonth: MonthKey; spent: number; budget: number; delta: number } | null {
  const priorMonth = addMonths(month, -1);
  const priorBudget = getBudgetForMonth(budgets, priorMonth);
  if (!priorBudget) return null;
  const spent = totalSpentInMonth(transactions, priorMonth);
  return {
    priorMonth,
    spent,
    budget: priorBudget.total,
    delta: spent - priorBudget.total, // negative = underspent
  };
}
