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

const CHAIN_PATTERNS: { key: string; pattern: RegExp }[] = [
  { key: "publix", pattern: /\bpublix\b/i },
  { key: "lyft", pattern: /\blyft\b/i },
  { key: "uber eats", pattern: /\buber\s*eats\b/i },
  { key: "uber", pattern: /\buber\b/i },
  { key: "walmart", pattern: /\bwalmart\b/i },
  { key: "target", pattern: /\btarget\b/i },
  { key: "starbucks", pattern: /\bstarbucks\b/i },
  { key: "chipotle", pattern: /\bchipotle\b/i },
  { key: "dominos", pattern: /\bdomino'?s?\b/i },
  { key: "cvs pharmacy", pattern: /\bcvs\b|\bcvs\s*pharmacy\b/i },
  { key: "walgreens", pattern: /\bwalgreens\b/i },
  { key: "shell", pattern: /\bshell\b/i },
  { key: "exxon", pattern: /\bexxon\b/i },
  { key: "buc ees", pattern: /\bbuc[\s-]*ee'?s?\b/i },
];

const STATE_CODES = new Set([
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "ia",
  "id", "il", "in", "ks", "ky", "la", "ma", "md", "me", "mi", "mn", "mo",
  "ms", "mt", "nc", "nd", "ne", "nh", "nj", "nm", "nv", "ny", "oh", "ok",
  "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "va", "vt", "wa", "wi",
  "wv", "wy",
]);

const NOISE_WORDS = new Set([
  "card",
  "debit",
  "purchase",
  "pos",
  "auth",
  "pending",
  "online",
  "store",
  "location",
  "payment",
  "mobile",
]);

function isLikelyLocationToken(token: string): boolean {
  if (STATE_CODES.has(token)) return true;
  if (token.length > 7 && STATE_CODES.has(token.slice(-2))) return true;
  return false;
}

// Groups close merchant/location variants under one key for categorization.
// Examples: "PUBLIX #1095COLUMBIASC" → "publix", "LYFT *RIDE" → "lyft".
export function merchantFamilyKey(name: string): string {
  const raw = name.trim();
  for (const chain of CHAIN_PATTERNS) {
    if (chain.pattern.test(raw)) return chain.key;
  }

  const normalized = normalizeMerchant(raw.replace(/([0-9])([a-z])/gi, "$1 $2"));
  if (!normalized) return "";

  const tokens = normalized
    .split(" ")
    .filter((token, index) => {
      if (!token) return false;
      if (NOISE_WORDS.has(token)) return false;
      if (/\d/.test(token) && index > 0) return false;
      return true;
    });

  while (tokens.length > 1 && isLikelyLocationToken(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.slice(0, 3).join(" ") || normalized;
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
