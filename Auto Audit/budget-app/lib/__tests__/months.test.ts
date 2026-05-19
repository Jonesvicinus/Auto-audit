import { describe, it, expect } from "vitest";
import { isSameMonth, monthKeyOf, addMonths, trailingMonths, formatMonth, currentMonthKey } from "../months";

describe("isSameMonth", () => {
  it("treats the first of a month as belonging to that month", () => {
    expect(isSameMonth("2025-03-01", "2025-03")).toBe(true);
  });
  it("treats the last day of a month as belonging to that month", () => {
    expect(isSameMonth("2025-03-31", "2025-03")).toBe(true);
  });
  it("returns false for the prior month", () => {
    expect(isSameMonth("2025-02-28", "2025-03")).toBe(false);
  });
  it("returns false for the next month", () => {
    expect(isSameMonth("2025-04-01", "2025-03")).toBe(false);
  });
  it("works with ISO datetime strings", () => {
    expect(isSameMonth("2025-03-15T10:30:00.000Z", "2025-03")).toBe(true);
  });
  it("works with datetime strings at UTC midnight (the classic timezone trap)", () => {
    // "2025-03-01T00:00:00Z" is Feb 28 in UTC-5 local time — must still be March
    expect(isSameMonth("2025-03-01T00:00:00Z", "2025-03")).toBe(true);
  });
});

describe("monthKeyOf", () => {
  it("returns YYYY-MM format", () => {
    expect(monthKeyOf(new Date(2025, 2, 15))).toBe("2025-03"); // month is 0-indexed
  });
  it("zero-pads single-digit months", () => {
    expect(monthKeyOf(new Date(2025, 0, 1))).toBe("2025-01");
  });
});

describe("addMonths", () => {
  it("advances forward correctly", () => {
    expect(addMonths("2025-01", 1)).toBe("2025-02");
  });
  it("rolls over year boundary", () => {
    expect(addMonths("2025-12", 1)).toBe("2026-01");
  });
  it("goes backward correctly", () => {
    expect(addMonths("2025-03", -1)).toBe("2025-02");
  });
});

describe("trailingMonths", () => {
  it("returns count months ending at key (inclusive)", () => {
    expect(trailingMonths("2025-03", 3)).toEqual(["2025-01", "2025-02", "2025-03"]);
  });
});
