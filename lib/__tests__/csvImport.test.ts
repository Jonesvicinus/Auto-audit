import { describe, it, expect } from "vitest";
import { normalizeDate, normalizeAmount, isProbableDuplicate } from "../csvImport";

describe("normalizeDate", () => {
  it("handles ISO YYYY-MM-DD", () => {
    expect(normalizeDate("2025-03-15")).toBe("2025-03-15");
  });
  it("zero-pads single-digit ISO variants", () => {
    expect(normalizeDate("2025-3-5")).toBe("2025-03-05");
  });
  it("handles US M/D/YYYY", () => {
    expect(normalizeDate("3/15/2025")).toBe("2025-03-15");
  });
  it("handles US MM/DD/YYYY", () => {
    expect(normalizeDate("12/01/2025")).toBe("2025-12-01");
  });
  it("handles US MM/DD/YY two-digit year", () => {
    expect(normalizeDate("03/15/25")).toBe("2025-03-15");
  });
  it("handles European D.M.YYYY when day > 12", () => {
    expect(normalizeDate("31.01.2025")).toBe("2025-01-31");
  });
  it("handles month-name format 'Mar 15, 2025'", () => {
    expect(normalizeDate("Mar 15, 2025")).toBe("2025-03-15");
  });
  it("handles month-name format 'March 15, 2025'", () => {
    expect(normalizeDate("March 15, 2025")).toBe("2025-03-15");
  });
  it("handles month-name format '15 Mar 2025'", () => {
    expect(normalizeDate("15 Mar 2025")).toBe("2025-03-15");
  });
  it("returns empty string for garbage input", () => {
    expect(normalizeDate("not a date")).toBe("");
    expect(normalizeDate("")).toBe("");
  });
  it("never returns a date one day early due to UTC offset (the classic trap)", () => {
    // Must not use new Date("2025-03-01") which gives Feb 28 in UTC-5
    expect(normalizeDate("2025-03-01")).toBe("2025-03-01");
  });
});

describe("normalizeAmount", () => {
  it("parses plain numbers", () => {
    expect(normalizeAmount("42.50")).toBe(42.5);
    expect(normalizeAmount("1000")).toBe(1000);
  });
  it("strips USD dollar sign", () => {
    expect(normalizeAmount("$42.50")).toBe(42.5);
  });
  it("strips EUR sign", () => {
    expect(normalizeAmount("€42.50")).toBe(42.5);
  });
  it("strips GBP sign", () => {
    expect(normalizeAmount("£99.99")).toBe(99.99);
  });
  it("strips INR rupee sign", () => {
    expect(normalizeAmount("₹1500")).toBe(1500);
  });
  it("strips KRW won sign", () => {
    expect(normalizeAmount("₩5000")).toBe(5000);
  });
  it("strips RUB ruble sign", () => {
    expect(normalizeAmount("₽999")).toBe(999);
  });
  it("strips ILS shekel sign", () => {
    expect(normalizeAmount("₪150")).toBe(150);
  });
  it("handles parentheses as negative", () => {
    expect(normalizeAmount("(50.00)")).toBe(-50);
  });
  it("handles explicit negative sign", () => {
    expect(normalizeAmount("-25.00")).toBe(-25);
  });
  it("strips commas from large amounts", () => {
    expect(normalizeAmount("1,250.00")).toBe(1250);
  });
  it("returns null for bad input", () => {
    expect(normalizeAmount("abc")).toBeNull();
    expect(normalizeAmount("")).toBeNull();
  });
});

describe("isProbableDuplicate", () => {
  const existing = [
    { date: "2025-03-15", merchant: "Starbucks", amount: 5.50 },
    { date: "2025-03-16", merchant: "Target", amount: 42.00 },
  ];

  it("detects exact duplicate", () => {
    const row = { id: "r1", sourceRow: 2, date: "2025-03-15", merchant: "Starbucks", amount: 5.50 };
    expect(isProbableDuplicate(row, existing)).toBe(true);
  });

  it("returns false for different amount", () => {
    const row = { id: "r2", sourceRow: 3, date: "2025-03-15", merchant: "Starbucks", amount: 6.00 };
    expect(isProbableDuplicate(row, existing)).toBe(false);
  });

  it("returns false for different date", () => {
    const row = { id: "r3", sourceRow: 4, date: "2025-03-14", merchant: "Starbucks", amount: 5.50 };
    expect(isProbableDuplicate(row, existing)).toBe(false);
  });
});
