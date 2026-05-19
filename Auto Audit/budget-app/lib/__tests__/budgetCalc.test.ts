import { describe, it, expect } from "vitest";
import {
  transactionsInMonth,
  totalSpentInMonth,
  allocateSlackToOther,
  sumCategoryBudgets,
  getBudgetForMonth,
  categoryBudgetsExceedTotal,
} from "../budgetCalc";
import type { Transaction, MonthlyBudget } from "@/types";

function makeTx(date: string, amount = 100, categoryId = "cat-a"): Transaction {
  return { id: `tx-${date}-${amount}`, amount, merchant: "Test", date, categoryId };
}

function makeBudget(month: string, total: number, cats: Record<string, number>): MonthlyBudget {
  return { month, total, categories: cats };
}

describe("transactionsInMonth", () => {
  it("includes a transaction on the first of the month", () => {
    const txs = [makeTx("2025-03-01"), makeTx("2025-02-28"), makeTx("2025-04-01")];
    const result = transactionsInMonth(txs, "2025-03");
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2025-03-01");
  });
  it("includes a transaction on the last day of the month", () => {
    const txs = [makeTx("2025-03-31"), makeTx("2025-04-01")];
    expect(transactionsInMonth(txs, "2025-03")).toHaveLength(1);
  });
  it("returns empty array when no transactions match", () => {
    expect(transactionsInMonth([makeTx("2025-02-01")], "2025-03")).toHaveLength(0);
  });
  it("handles an empty transaction list", () => {
    expect(transactionsInMonth([], "2025-03")).toHaveLength(0);
  });
  it("includes all transactions in a month", () => {
    const txs = [makeTx("2025-03-01"), makeTx("2025-03-15"), makeTx("2025-03-31")];
    expect(transactionsInMonth(txs, "2025-03")).toHaveLength(3);
  });
});

describe("totalSpentInMonth", () => {
  it("sums amounts for the correct month only", () => {
    const txs = [makeTx("2025-03-01", 50), makeTx("2025-03-15", 30), makeTx("2025-02-01", 999)];
    expect(totalSpentInMonth(txs, "2025-03")).toBe(80);
  });
  it("returns 0 when no transactions in month", () => {
    expect(totalSpentInMonth([makeTx("2025-02-01", 500)], "2025-03")).toBe(0);
  });
});

describe("sumCategoryBudgets", () => {
  it("sums all category values", () => {
    expect(sumCategoryBudgets({ a: 100, b: 50, c: 25 })).toBe(175);
  });
  it("ignores non-finite values", () => {
    expect(sumCategoryBudgets({ a: 100, b: NaN })).toBe(100);
  });
});

describe("getBudgetForMonth", () => {
  it("returns the direct match", () => {
    const budgets = [makeBudget("2025-03", 1000, {})];
    expect(getBudgetForMonth(budgets, "2025-03")?.total).toBe(1000);
  });
  it("returns null when no budgets exist", () => {
    expect(getBudgetForMonth([], "2025-03")).toBeNull();
  });
  it("copies forward from most recent prior month", () => {
    const budgets = [makeBudget("2025-01", 500, { a: 500 }), makeBudget("2025-02", 700, { a: 700 })];
    const result = getBudgetForMonth(budgets, "2025-04");
    expect(result?.total).toBe(700); // most recent prior
    expect(result?.month).toBe("2025-04"); // but month is set to requested
  });
});

describe("categoryBudgetsExceedTotal", () => {
  it("returns true when categories exceed total", () => {
    expect(categoryBudgetsExceedTotal(makeBudget("2025-03", 100, { a: 80, b: 30 }))).toBe(true);
  });
  it("returns false when categories equal total", () => {
    expect(categoryBudgetsExceedTotal(makeBudget("2025-03", 100, { a: 80, b: 20 }))).toBe(false);
  });
});

describe("allocateSlackToOther", () => {
  it("pushes unallocated slack into Other", () => {
    const budget = makeBudget("2025-03", 100, { "cat-a": 80, "cat-other": 0 });
    const result = allocateSlackToOther(budget, "cat-other");
    expect(result.categories["cat-other"]).toBe(20);
  });

  it("zeros Other when non-Other categories already exceed total", () => {
    const budget = makeBudget("2025-03", 100, { "cat-a": 80, "cat-b": 40, "cat-other": 30 });
    const result = allocateSlackToOther(budget, "cat-other");
    expect(result.categories["cat-other"]).toBe(0);
  });

  it("reduces Other when previously over-allocated", () => {
    const budget = makeBudget("2025-03", 100, { "cat-a": 80, "cat-other": 50 });
    // non-Other sum = 80, slack = 20, Other should become 20 (reduced from 50)
    const result = allocateSlackToOther(budget, "cat-other");
    expect(result.categories["cat-other"]).toBe(20);
  });

  it("returns the same object reference when already balanced", () => {
    const budget = makeBudget("2025-03", 100, { "cat-a": 80, "cat-other": 20 });
    expect(allocateSlackToOther(budget, "cat-other")).toBe(budget);
  });

  it("creates Other key if not present and slack exists", () => {
    const budget = makeBudget("2025-03", 100, { "cat-a": 60 });
    const result = allocateSlackToOther(budget, "cat-other");
    expect(result.categories["cat-other"]).toBe(40);
  });
});
