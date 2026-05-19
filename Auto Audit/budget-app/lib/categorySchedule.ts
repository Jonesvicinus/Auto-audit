import type { Category, CategorySchedule, MonthKey } from "@/types";
import { currentMonthKey, formatMonth, parseMonthKey } from "./months";

export const MONTH_CHOICES = [
  { value: 1, short: "Jan", label: "January" },
  { value: 2, short: "Feb", label: "February" },
  { value: 3, short: "Mar", label: "March" },
  { value: 4, short: "Apr", label: "April" },
  { value: 5, short: "May", label: "May" },
  { value: 6, short: "Jun", label: "June" },
  { value: 7, short: "Jul", label: "July" },
  { value: 8, short: "Aug", label: "August" },
  { value: 9, short: "Sep", label: "September" },
  { value: 10, short: "Oct", label: "October" },
  { value: 11, short: "Nov", label: "November" },
  { value: 12, short: "Dec", label: "December" },
];

export function monthNumberFromKey(month: MonthKey): number {
  return parseMonthKey(month).getMonth() + 1;
}

export function normalizeCategorySchedule(
  schedule: CategorySchedule | undefined,
  fallbackMonth: MonthKey,
): CategorySchedule {
  if (!schedule || schedule.kind === "monthly") return { kind: "monthly" };
  if (schedule.kind === "one-time") {
    return { kind: "one-time", month: schedule.month ?? fallbackMonth };
  }
  const months = Array.from(
    new Set(
      (schedule.months ?? [])
        .map((month) => Math.round(month))
        .filter((month) => month >= 1 && month <= 12),
    ),
  ).sort((a, b) => a - b);
  return months.length > 0 ? { kind: "selected-months", months } : { kind: "monthly" };
}

export function isScheduleActiveInMonth(schedule: CategorySchedule, month: MonthKey): boolean {
  const ns = normalizeCategorySchedule(schedule, month);
  if (ns.kind === "monthly") return true;
  if (ns.kind === "one-time") return ns.month === month;
  return (ns.months ?? []).includes(monthNumberFromKey(month));
}

export function isCategoryActiveInMonth(category: Category, month: MonthKey): boolean {
  return isScheduleActiveInMonth(category.schedule ?? { kind: "monthly" }, month);
}

export function activeCategoriesForMonth(
  categories: Category[],
  month: MonthKey,
  includeIds: string[] = [],
): Category[] {
  const include = new Set(includeIds);
  return categories.filter(
    (category) => include.has(category.id) || isCategoryActiveInMonth(category, month),
  );
}

export function categoryScheduleLabel(
  category: Category,
  viewMonth?: MonthKey,
): string {
  const fallback = viewMonth ?? currentMonthKey();
  const schedule = normalizeCategorySchedule(category.schedule, fallback);
  if (schedule.kind === "monthly") return "Every month";
  if (schedule.kind === "one-time") {
    return schedule.month ? `${formatMonth(schedule.month)} only` : "One month only";
  }
  const labels = (schedule.months ?? [])
    .map((m) => MONTH_CHOICES.find((choice) => choice.value === m)?.short)
    .filter(Boolean);
  return labels.length > 0 ? labels.join(", ") : "Every month";
}
