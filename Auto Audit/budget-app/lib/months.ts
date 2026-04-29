import type { MonthKey } from "@/types";

// All month helpers use the local timezone on purpose — a user typing
// "March 3" wants March 3 regardless of UTC offset.

export function monthKeyOf(date: Date): MonthKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function parseMonthKey(key: MonthKey): Date {
  const [y, m] = key.split("-").map((s) => parseInt(s, 10));
  return new Date(y, m - 1, 1);
}

export function formatMonth(key: MonthKey, style: "long" | "short" = "long"): string {
  const d = parseMonthKey(key);
  return d.toLocaleDateString("en-US", {
    month: style === "long" ? "long" : "short",
    year: "numeric",
  });
}

export function addMonths(key: MonthKey, delta: number): MonthKey {
  const d = parseMonthKey(key);
  d.setMonth(d.getMonth() + delta);
  return monthKeyOf(d);
}

export function currentMonthKey(): MonthKey {
  return monthKeyOf(new Date());
}

// Return the previous N month keys (oldest first), ending at and including key.
export function trailingMonths(key: MonthKey, count: number): MonthKey[] {
  const keys: MonthKey[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(addMonths(key, -i));
  }
  return keys;
}

export function isSameMonth(iso: string, key: MonthKey) {
  const d = new Date(iso);
  return monthKeyOf(d) === key;
}
