import { describe, it, expect } from "vitest";
import {
  isStableBillsCategory,
  roundBudgetAmount,
  getLastCompletedMonths,
  buildBudgetRecommendation,
  describeRecommendationWindow,
} from "../recommendedBudget";
import type { Category, Transaction } from "@/types";

function makeCategory(name: string, opts: Partial<Category> = {}): Category {
  return { id: `cat-${name.toLowerCase().replace(/\s+/g, "-")}`, name, color: "#000", ...opts };
}

describe("isStableBillsCategory", () => {
  it.each([
    "Bills & Subscriptions",
    "Rent",
    "Mortgage",
    "Utilities",
    "Insurance",
    "Loan Payment",
    "Gym Membership",
    "Recurring Expenses",
  ])("detects '%s' as stable", (name) => {
    expect(isStableBillsCategory(makeCategory(name))).toBe(true);
  });

  it.each(["Food", "Fun Money", "Transportation", "Shopping"])(
    "does not mark '%s' as stable",
    (name) => {
      expect(isStableBillsCategory(makeCategory(name))).toBe(false);
    },
  );

  it("returns false for the isOther category", () => {
    expect(isStableBillsCategory(makeCategory("Other", { isOther: true }))).toBe(false);
  });
});

describe("roundBudgetAmount", () => {
  it("rounds to nearest $5 for amounts under $100", () => {
    expect(roundBudgetAmount(43)).toBe(45);
    expect(roundBudgetAmount(47)).toBe(45);
    expect(roundBudgetAmount(51)).toBe(50);
    expect(roundBudgetAmount(52)).toBe(50);
    expect(roundBudgetAmount(53)).toBe(55);
  });
  it("rounds to nearest $10 for amounts $100 and above", () => {
    expect(roundBudgetAmount(143)).toBe(140);
    expect(roundBudgetAmount(256)).toBe(260);
    expect(roundBudgetAmount(105)).toBe(110);
  });
  it("returns 0 for zero or negative", () => {
    expect(roundBudgetAmount(0)).toBe(0);
    expect(roundBudgetAmount(-10)).toBe(0);
  });
});

describe("getLastCompletedMonths", () => {
  it("returns N months before the given month (oldest first)", () => {
    expect(getLastCompletedMonths(3, "2025-04")).toEqual(["2025-01", "2025-02", "2025-03"]);
  });
  it("rolls back across year boundaries", () => {
    expect(getLastCompletedMonths(3, "2025-02")).toEqual(["2024-11", "2024-12", "2025-01"]);
  });
});

describe("buildBudgetRecommendation", () => {
  const food = makeCategory("Food");
  const bills = makeCategory("Bills & Subscriptions");

  const txs: Transaction[] = [
    { id: "t1", amount: 300, merchant: "G", date: "2025-01-15", categoryId: food.id },
    { id: "t2", amount: 400, merchant: "G", date: "2025-02-15", categoryId: food.id },
    { id: "t3", amount: 350, merchant: "G", date: "2025-03-15", categoryId: food.id },
    { id: "t4", amount: 100, merchant: "N", date: "2025-01-01", categoryId: bills.id },
    { id: "t5", amount: 100, merchant: "N", date: "2025-02-01", categoryId: bills.id },
    { id: "t6", amount: 100, merchant: "N", date: "2025-03-01", categoryId: bills.id },
  ];

  it("computes average correctly across 3 months", () => {
    const rec = buildBudgetRecommendation({
      categories: [food, bills],
      transactions: txs,
      fromMonth: "2025-04",
    });
    const foodRec = rec.categoryRecommendations.find((r) => r.category.id === food.id)!;
    expect(foodRec.averageMonthlySpend).toBeCloseTo(350, 1); // (300+400+350)/3
  });

  it("applies smaller cushion to stable bills categories", () => {
    const rec = buildBudgetRecommendation({
      categories: [food, bills],
      transactions: txs,
      fromMonth: "2025-04",
    });
    const foodRec = rec.categoryRecommendations.find((r) => r.category.id === food.id)!;
    const billsRec = rec.categoryRecommendations.find((r) => r.category.id === bills.id)!;
    expect(foodRec.cushionRate).toBeGreaterThan(billsRec.cushionRate);
  });

  it("correctly attributes March 1st transactions to March (no UTC offset bug)", () => {
    const rec = buildBudgetRecommendation({
      categories: [food],
      transactions: [{ id: "tx", amount: 50, merchant: "G", date: "2025-03-01", categoryId: food.id }],
      fromMonth: "2025-04",
      monthCount: 1,
    });
    expect(rec.availableMonths).toContain("2025-03");
  });

  it("reports missing months when no spending data exists for them", () => {
    const rec = buildBudgetRecommendation({
      categories: [food],
      transactions: [{ id: "tx", amount: 50, merchant: "G", date: "2025-01-15", categoryId: food.id }],
      fromMonth: "2025-04",
      monthCount: 3, // looks at Jan, Feb, Mar — only Jan has data
    });
    expect(rec.missingMonths).toContain("2025-02");
    expect(rec.missingMonths).toContain("2025-03");
  });
});

describe("describeRecommendationWindow", () => {
  function makeRec(total: number, available: number) {
    const months = Array.from({ length: total }, (_, i) => `2025-0${i + 1}`);
    const availableMonths = months.slice(0, available);
    return {
      months,
      availableMonths,
      missingMonths: months.slice(available),
      categoryRecommendations: [],
      totalRecommended: 0,
    };
  }

  it("uses singular 'month' when total = 1 and no data", () => {
    const text = describeRecommendationWindow(makeRec(1, 0));
    expect(text).toContain("1 completed month");
    expect(text).not.toMatch(/1 completed months/);
  });

  it("uses plural 'months' when total > 1", () => {
    const text = describeRecommendationWindow(makeRec(3, 0));
    expect(text).toContain("3 completed months");
  });

  it("includes month labels when all months have data", () => {
    const text = describeRecommendationWindow(makeRec(3, 3));
    expect(text).toContain("Jan");
  });
});
