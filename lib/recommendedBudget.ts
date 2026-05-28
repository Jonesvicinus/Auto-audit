import type { Category, MonthKey, Transaction } from "@/types";
import { addMonths, currentMonthKey, formatMonth } from "./months";

export const DEFAULT_RECOMMENDATION_MONTHS = 3;
export const STANDARD_CUSHION_RATE = 0.1;
export const STABLE_BILLS_CUSHION_RATE = 0.05;

export interface CategoryBudgetRecommendation {
  category: Category;
  averageMonthlySpend: number;
  cushionRate: number;
  recommended: number;
  monthsWithSpending: number;
  monthlySpending: { month: MonthKey; spent: number }[];
}

export interface BudgetRecommendation {
  months: MonthKey[];
  availableMonths: MonthKey[];
  missingMonths: MonthKey[];
  categoryRecommendations: CategoryBudgetRecommendation[];
  totalRecommended: number;
}

export function getLastCompletedMonths(
  count = DEFAULT_RECOMMENDATION_MONTHS,
  fromMonth: MonthKey = currentMonthKey(),
): MonthKey[] {
  const months: MonthKey[] = [];
  for (let i = count; i >= 1; i--) {
    months.push(addMonths(fromMonth, -i));
  }
  return months;
}

export function isStableBillsCategory(category: Category): boolean {
  if (category.isOther) return false;
  const name = category.name.toLowerCase();
  return (
    name.includes("bill") ||
    name.includes("subscription") ||
    name.includes("recurring") ||
    name.includes("rent") ||
    name.includes("mortgage") ||
    name.includes("utility") ||
    name.includes("utilities") ||
    name.includes("insurance") ||
    name.includes("loan") ||
    name.includes("membership")
  );
}

export function roundBudgetAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const increment = amount >= 100 ? 10 : 5;
  return Math.round(amount / increment) * increment;
}

export function buildBudgetRecommendation({
  categories,
  transactions,
  monthCount = DEFAULT_RECOMMENDATION_MONTHS,
  fromMonth = currentMonthKey(),
}: {
  categories: Category[];
  transactions: Transaction[];
  monthCount?: number;
  fromMonth?: MonthKey;
}): BudgetRecommendation {
  const months = getLastCompletedMonths(monthCount, fromMonth);
  const monthSet = new Set(months);
  const spendingByMonthCategory: Record<string, Record<string, number>> = {};

  for (const tx of transactions) {
    const txMonth = tx.date.slice(0, 7);
    if (!monthSet.has(txMonth)) continue;
    spendingByMonthCategory[txMonth] ??= {};
    spendingByMonthCategory[txMonth][tx.categoryId] =
      (spendingByMonthCategory[txMonth][tx.categoryId] ?? 0) + tx.amount;
  }

  const availableMonths = months.filter((month) => {
    const spending = spendingByMonthCategory[month];
    return spending && Object.values(spending).some((amount) => amount > 0);
  });
  const missingMonths = months.filter((month) => !availableMonths.includes(month));
  const divisor = availableMonths.length;

  const categoryRecommendations = categories.map((category) => {
    const monthlySpending = months.map((month) => ({
      month,
      spent: spendingByMonthCategory[month]?.[category.id] ?? 0,
    }));
    const spendInAvailableMonths = availableMonths.reduce(
      (sum, month) => sum + (spendingByMonthCategory[month]?.[category.id] ?? 0),
      0,
    );
    const averageMonthlySpend = divisor > 0 ? spendInAvailableMonths / divisor : 0;
    const cushionRate = isStableBillsCategory(category)
      ? STABLE_BILLS_CUSHION_RATE
      : STANDARD_CUSHION_RATE;

    return {
      category,
      averageMonthlySpend,
      cushionRate,
      recommended: roundBudgetAmount(averageMonthlySpend * (1 + cushionRate)),
      monthsWithSpending: monthlySpending.filter((row) => row.spent > 0).length,
      monthlySpending,
    };
  });

  const totalRecommended = categoryRecommendations.reduce(
    (sum, row) => sum + row.recommended,
    0,
  );

  return {
    months,
    availableMonths,
    missingMonths,
    categoryRecommendations,
    totalRecommended,
  };
}

export function describeRecommendationWindow(
  recommendation: BudgetRecommendation,
): string {
  const total = recommendation.months.length;
  const monthWord = total === 1 ? "month" : "months";
  if (recommendation.availableMonths.length === 0) {
    return `No spending found in the last ${total} completed ${monthWord}.`;
  }
  if (recommendation.availableMonths.length === total) {
    return `Based on your average spending over the last ${total} ${monthWord}: ${recommendation.months
      .map((m) => formatMonth(m, "short"))
      .join(", ")}.`;
  }
  const available = recommendation.availableMonths.length;
  const availableWord = available === 1 ? "month" : "months";
  return `Based on available spending from ${recommendation.availableMonths
    .map((m) => formatMonth(m, "short"))
    .join(", ")} (${available} of ${total} ${availableWord}). This estimate may be less accurate.`;
}
