import { describe, it, expect } from "vitest";
import {
  normalizeMerchant,
  merchantFamilyKey,
  similarity,
  bestMatch,
} from "../fuzzyMatch";

describe("normalizeMerchant", () => {
  it("lowercases and trims", () => {
    expect(normalizeMerchant("  STARBUCKS  ")).toBe("starbucks");
  });
  it("replaces non-alphanumeric characters with spaces", () => {
    expect(normalizeMerchant("McDonald's")).toBe("mcdonald s");
  });
  it("collapses multiple spaces", () => {
    expect(normalizeMerchant("CHICK  FIL  A")).toBe("chick fil a");
  });
  it("returns empty string for blank input", () => {
    expect(normalizeMerchant("   ")).toBe("");
  });
});

describe("merchantFamilyKey — chain patterns", () => {
  it("maps Uber Eats variants to 'uber eats'", () => {
    expect(merchantFamilyKey("Uber Eats")).toBe("uber eats");
    expect(merchantFamilyKey("UBEREATS")).toBe("uber eats");
    expect(merchantFamilyKey("UBER EATS DELIVERY")).toBe("uber eats");
  });
  it("maps plain Uber to 'uber' (not 'uber eats')", () => {
    expect(merchantFamilyKey("UBER *TRIP")).toBe("uber");
    expect(merchantFamilyKey("Uber")).toBe("uber");
    // asterisk separator means the Uber Eats regex doesn't fire; treated as plain Uber
    expect(merchantFamilyKey("UBER* EATS")).toBe("uber");
  });
  it("maps Lyft to 'lyft'", () => {
    expect(merchantFamilyKey("LYFT *RIDE SAN FRANCISCO")).toBe("lyft");
  });
  it("maps Publix with store number and state smash to 'publix'", () => {
    expect(merchantFamilyKey("PUBLIX #1095COLUMBIASC")).toBe("publix");
  });
  it("maps Starbucks to 'starbucks'", () => {
    expect(merchantFamilyKey("STARBUCKS #12345 SEATTLE WA")).toBe("starbucks");
  });
  it("strips noise words and location tokens from unknown merchants", () => {
    const key = merchantFamilyKey("SOME STORE PURCHASE ONLINE GA");
    expect(key).not.toContain("purchase");
    expect(key).not.toContain("online");
    expect(key).not.toContain("store");
  });
  it("returns empty string for empty input", () => {
    expect(merchantFamilyKey("")).toBe("");
  });
});

describe("similarity", () => {
  it("returns 1 for identical strings", () => {
    expect(similarity("starbucks", "starbucks")).toBe(1);
  });
  it("returns 1 for identical strings after normalization", () => {
    expect(similarity("STARBUCKS", "starbucks")).toBe(1);
  });
  it("returns < 1 for different strings", () => {
    expect(similarity("starbucks", "shell")).toBeLessThan(1);
  });
  it("returns 1 for two empty strings", () => {
    expect(similarity("", "")).toBe(1);
  });
  it("is commutative", () => {
    const ab = similarity("walmart", "walmrt");
    const ba = similarity("walmrt", "walmart");
    expect(ab).toBeCloseTo(ba);
  });
});

describe("bestMatch", () => {
  const items = [
    { key: "starbucks", id: "a" },
    { key: "shell", id: "b" },
    { key: "walmart", id: "c" },
  ];
  const getKey = (item: { key: string }) => item.key;

  it("returns null for empty items list", () => {
    expect(bestMatch("starbucks", [], getKey)).toBeNull();
  });
  it("returns null for empty query", () => {
    expect(bestMatch("", items, getKey)).toBeNull();
  });
  it("finds exact match with score 1", () => {
    const result = bestMatch("starbucks", items, getKey);
    expect(result?.item.id).toBe("a");
    expect(result?.exact).toBe(true);
    expect(result?.score).toBe(1);
  });
  it("returns best fuzzy match for a typo", () => {
    const result = bestMatch("starbcks", items, getKey);
    expect(result?.item.id).toBe("a");
    expect(result?.exact).toBe(false);
  });
  it("marks substring containment correctly", () => {
    const result = bestMatch("walmart supercenter", items, getKey);
    expect(result?.item.id).toBe("c");
    expect(result?.substring).toBe(true);
  });
});
