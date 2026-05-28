import type { MerchantMemoryEntry } from "@/types";
import { bestMatch, merchantFamilyKey } from "./fuzzyMatch";

export interface MerchantSuggestion {
  categoryId: string;
  displayName: string;
  confidence: "exact" | "fuzzy";
  score: number;
}

const EXACT_THRESHOLD = 0.999;
const FUZZY_THRESHOLD = 0.78; // tuneable

export function suggestCategory(
  merchant: string,
  memory: MerchantMemoryEntry[],
): MerchantSuggestion | null {
  const remembered = memory.filter((m) => m.remember);
  if (remembered.length === 0) return null;
  const queryKey = merchantFamilyKey(merchant);
  const match = bestMatch(queryKey || merchant, remembered, (m) =>
    merchantFamilyKey(m.key) || m.key,
  );
  if (!match) return null;

  if (match.exact || match.score >= EXACT_THRESHOLD) {
    return {
      categoryId: match.item.categoryId,
      displayName: match.item.displayName,
      confidence: "exact",
      score: match.score,
    };
  }
  if (match.score >= FUZZY_THRESHOLD || match.substring) {
    return {
      categoryId: match.item.categoryId,
      displayName: match.item.displayName,
      confidence: "fuzzy",
      score: match.score,
    };
  }
  return null;
}

export function upsertMemory(
  memory: MerchantMemoryEntry[],
  merchant: string,
  categoryId: string,
  remember: boolean,
): MerchantMemoryEntry[] {
  const key = merchantFamilyKey(merchant);
  if (!key) return memory;
  const next = memory.slice();
  const idx = next.findIndex((m) => m.key === key);
  if (idx >= 0) {
    next[idx] = { ...next[idx], categoryId, remember };
  } else {
    next.push({ key, displayName: merchant.trim(), categoryId, remember });
  }
  return next;
}
