import { describe, it, expect } from "vitest";
import { suggestCategoryByHeuristic } from "../categoryHeuristics";
import type { Category } from "@/types";

function makeCategory(id: string, name: string): Category {
  return { id, name, color: "#000000" };
}

const FOOD_CAT = makeCategory("cat-food", "Food");
const TRANSPORT_CAT = makeCategory("cat-transport", "Transportation");
const BILLS_CAT = makeCategory("cat-bills", "Bills");
const FUN_CAT = makeCategory("cat-fun", "Fun");
const ALL_CATS = [FOOD_CAT, TRANSPORT_CAT, BILLS_CAT, FUN_CAT];

describe("suggestCategoryByHeuristic — Food bucket", () => {
  it("matches Starbucks → Food", () => {
    const hit = suggestCategoryByHeuristic("STARBUCKS #12345", ALL_CATS);
    expect(hit?.categoryId).toBe(FOOD_CAT.id);
    expect(hit?.bucket).toBe("Food");
  });
  it("matches Chipotle → Food", () => {
    const hit = suggestCategoryByHeuristic("Chipotle Mexican Grill", ALL_CATS);
    expect(hit?.categoryId).toBe(FOOD_CAT.id);
  });
  it("matches Publix → Food", () => {
    const hit = suggestCategoryByHeuristic("PUBLIX #1095COLUMBIASC", ALL_CATS);
    expect(hit?.categoryId).toBe(FOOD_CAT.id);
  });
  it("matches 'Uber Eats' → Food (not Transportation)", () => {
    const hit = suggestCategoryByHeuristic("Uber Eats", ALL_CATS);
    expect(hit?.categoryId).toBe(FOOD_CAT.id);
    expect(hit?.bucket).toBe("Food");
  });
  it("matches pizza → Food", () => {
    const hit = suggestCategoryByHeuristic("LOCAL PIZZA CO", ALL_CATS);
    expect(hit?.categoryId).toBe(FOOD_CAT.id);
  });
  it("matches coffee → Food", () => {
    const hit = suggestCategoryByHeuristic("The Coffee Bean", ALL_CATS);
    expect(hit?.categoryId).toBe(FOOD_CAT.id);
  });
});

describe("suggestCategoryByHeuristic — Transportation bucket", () => {
  it("matches plain Uber → Transportation", () => {
    const hit = suggestCategoryByHeuristic("UBER *TRIP", ALL_CATS);
    expect(hit?.categoryId).toBe(TRANSPORT_CAT.id);
    expect(hit?.bucket).toBe("Transportation");
  });
  it("matches Lyft → Transportation", () => {
    const hit = suggestCategoryByHeuristic("LYFT *RIDE", ALL_CATS);
    expect(hit?.categoryId).toBe(TRANSPORT_CAT.id);
  });
  it("matches Shell gas → Transportation", () => {
    const hit = suggestCategoryByHeuristic("SHELL OIL 12345", ALL_CATS);
    expect(hit?.categoryId).toBe(TRANSPORT_CAT.id);
  });
  it("matches Buc-ee's → Transportation", () => {
    const hit = suggestCategoryByHeuristic("BUC-EE'S #35", ALL_CATS);
    expect(hit?.categoryId).toBe(TRANSPORT_CAT.id);
  });
  it("matches parking → Transportation", () => {
    const hit = suggestCategoryByHeuristic("CITY PARKING GARAGE", ALL_CATS);
    expect(hit?.categoryId).toBe(TRANSPORT_CAT.id);
  });
});

describe("suggestCategoryByHeuristic — edge cases", () => {
  it("returns null for unrecognized merchant", () => {
    const hit = suggestCategoryByHeuristic("UNKNOWN VENDOR XYZ", ALL_CATS);
    expect(hit).toBeNull();
  });
  it("returns null for empty merchant string", () => {
    const hit = suggestCategoryByHeuristic("", ALL_CATS);
    expect(hit).toBeNull();
  });
  it("returns null when user has no matching category for the bucket", () => {
    const noCats: Category[] = [];
    const hit = suggestCategoryByHeuristic("STARBUCKS", noCats);
    expect(hit).toBeNull();
  });
  it("case-insensitively matches category names (e.g. 'food' → Food bucket)", () => {
    const lowerCats = [makeCategory("cat-f", "food"), TRANSPORT_CAT];
    const hit = suggestCategoryByHeuristic("STARBUCKS", lowerCats);
    expect(hit?.categoryId).toBe("cat-f");
  });
  it("does not match 'Uber Eats' as Transportation", () => {
    const hit = suggestCategoryByHeuristic("Uber Eats", ALL_CATS);
    expect(hit?.bucket).not.toBe("Transportation");
  });
});
