import type { BudgetAlert } from "@/types";
import type { MonthSummary } from "./budgetCalc";
import { formatCurrency, formatPercent } from "./format";

// Neutral, direct tone per spec. No exclamation marks, no shame.
export function generateAlerts(summary: MonthSummary): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];

  if (summary.total > 0 && summary.spent > summary.total) {
    alerts.push({
      level: "danger",
      message: `You are ${formatCurrency(summary.spent - summary.total)} over your monthly budget.`,
    });
  }

  for (const row of summary.rows) {
    if (row.status === "over") {
      const amount = row.spent - row.budget;
      alerts.push({
        level: "danger",
        categoryId: row.category.id,
        message: `You are ${formatCurrency(amount)} over your ${row.category.name.toLowerCase()} budget.`,
      });
    } else if (row.status === "warn") {
      alerts.push({
        level: "warn",
        categoryId: row.category.id,
        message: `You have spent ${formatPercent(row.percentUsed)} of your ${row.category.name.toLowerCase()} budget.`,
      });
    }
  }

  return alerts;
}

// A simple insight line for Monthly Summary / Report views.
export function generateInsight(summary: MonthSummary): string {
  if (summary.total === 0) {
    return "Set a monthly budget to see insights for this month.";
  }
  const pct = Math.round(summary.percentUsed);
  const top = summary.rows
    .slice()
    .sort((a, b) => b.spent - a.spent)
    .find((r) => r.spent > 0);
  if (!top) return "No spending recorded yet for this month.";

  if (summary.spent > summary.total) {
    return `You spent ${formatCurrency(summary.spent - summary.total)} more than your budget. ${top.category.name} was your largest category at ${formatCurrency(top.spent)}.`;
  }
  if (pct >= 90) {
    return `You used ${pct}% of your budget. ${top.category.name} was your largest category at ${formatCurrency(top.spent)}.`;
  }
  return `You used ${pct}% of your budget. ${top.category.name} was your largest category at ${formatCurrency(top.spent)}.`;
}
