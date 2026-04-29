// Lightweight fuzzy match for merchant memory.
// - Exact normalized match is auto-applied (silent).
// - Strong fuzzy match prompts the user to confirm.

export function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

// Classic Levenshtein distance (iterative, O(m*n) space).
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array(b.length + 1)
    .fill(0)
    .map((_, i) => i);
  const curr = Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

// Similarity 0..1 based on normalized Levenshtein.
export function similarity(a: string, b: string): number {
  const na = normalizeMerchant(a);
  const nb = normalizeMerchant(b);
  if (!na.length && !nb.length) return 1;
  const dist = levenshtein(na, nb);
  const max = Math.max(na.length, nb.length);
  return 1 - dist / max;
}

export interface FuzzyResult<T> {
  item: T;
  score: number;
  exact: boolean;
  substring: boolean;
}

// Find the best candidate. Score ordering:
// 1) exact normalized match
// 2) one fully contains the other (e.g. "walmart" ⊂ "walmart supercenter")
// 3) high Levenshtein similarity
export function bestMatch<T>(
  query: string,
  items: T[],
  getKey: (item: T) => string,
): FuzzyResult<T> | null {
  if (!query.trim() || items.length === 0) return null;
  const q = normalizeMerchant(query);

  let best: FuzzyResult<T> | null = null;
  for (const item of items) {
    const k = normalizeMerchant(getKey(item));
    if (!k) continue;

    const exact = k === q;
    const substring = !exact && (k.includes(q) || q.includes(k));
    const sim = similarity(k, q);

    // Score lifts exact/substring matches so they rank above pure similarity.
    const score = exact ? 1 : substring ? 0.9 + sim * 0.1 : sim;

    if (!best || score > best.score) {
      best = { item, score, exact, substring };
    }
  }
  return best;
}
