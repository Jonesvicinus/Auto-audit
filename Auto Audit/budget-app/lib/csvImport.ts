import Papa from "papaparse";
import type { Category, MerchantMemoryEntry } from "@/types";
import { suggestCategory } from "./merchantMemory";
import { suggestCategoryByHeuristic } from "./categoryHeuristics";

// -----------------------------------------------------------------------------
// CSV import helpers — parsing, field mapping, normalization, categorization.
// All work happens in the browser; no backend.
// -----------------------------------------------------------------------------

export type CsvField = "date" | "merchant" | "amount" | "category" | "note";

// Common bank/credit-card header aliases. Lowercased + trimmed before lookup.
const HEADER_ALIASES: Record<CsvField, string[]> = {
  date: [
    "date",
    "transaction date",
    "transaction_date",
    "posted date",
    "posted_date",
    "post date",
    "trans date",
    "trans. date",
    "time",
  ],
  merchant: [
    "merchant",
    "description",
    "name",
    "details",
    "payee",
    "memo",
    "narrative",
    "transaction",
  ],
  amount: [
    "amount",
    "amt",
    "transaction amount",
    "transaction_amount",
    "debit",
    "charge",
    "spent",
    "withdrawal",
    "withdrawn",
  ],
  category: ["category", "type"],
  note: ["note", "notes", "comment", "comments", "tag"],
};

const CREDIT_HEADER_ALIASES = ["credit", "deposit", "income", "refund", "received"];

export interface CsvParseError {
  row: number;
  message: string;
  raw?: Record<string, string>;
}

export interface ParsedCsvRow {
  // Stable id within the parse session (used as React keys).
  id: string;
  // Position in the source file (1-based — header is row 1).
  sourceRow: number;
  date: string; // ISO yyyy-mm-dd
  merchant: string;
  amount: number; // always positive expense
  note?: string;
  rawCategory?: string;
}

export interface ParsedCsvResult {
  rows: ParsedCsvRow[];
  errors: CsvParseError[];
  mapping: Partial<Record<CsvField, string>>;
  unmappedHeaders: string[];
  detectedCreditColumn?: string;
}

export interface CsvCategorization {
  categoryId: string;
  // "exact"        — merchant memory is certain → silently applied
  // "fuzzy"        — merchant memory similar match → asks user to confirm
  // "heuristic"    — fallback brand match (e.g. "Starbucks" → Food) → review
  // "uncategorized"— no match, dropped into Other
  matchType: "exact" | "fuzzy" | "heuristic" | "uncategorized";
  matchedDisplayName?: string;
}

// ---------------------------------------------------------------------------
// Header auto-detection
// ---------------------------------------------------------------------------

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[\s_]+/g, " ");
}

export function detectMapping(
  headers: string[],
): { mapping: Partial<Record<CsvField, string>>; creditCol?: string; unmapped: string[] } {
  const norm = headers.map((h) => ({ original: h, normalized: normalizeHeader(h) }));
  const mapping: Partial<Record<CsvField, string>> = {};
  const used = new Set<string>();

  for (const field of Object.keys(HEADER_ALIASES) as CsvField[]) {
    const aliases = HEADER_ALIASES[field];
    const hit = norm.find(
      (h) => !used.has(h.original) && aliases.includes(h.normalized),
    );
    if (hit) {
      mapping[field] = hit.original;
      used.add(hit.original);
    }
  }

  let creditCol: string | undefined;
  const credit = norm.find(
    (h) => !used.has(h.original) && CREDIT_HEADER_ALIASES.includes(h.normalized),
  );
  if (credit) {
    creditCol = credit.original;
    used.add(credit.original);
  }

  const unmapped = norm.filter((h) => !used.has(h.original)).map((h) => h.original);
  return { mapping, creditCol, unmapped };
}

// ---------------------------------------------------------------------------
// Parsing entry points
// ---------------------------------------------------------------------------

export async function parseCsvFile(file: File): Promise<{
  headers: string[];
  rawRows: Record<string, string>[];
}> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h: string) => h.trim(),
      complete: (res) => {
        const headers = (res.meta.fields ?? []).slice();
        resolve({ headers, rawRows: res.data });
      },
      error: (err) => reject(err),
    });
  });
}

// ---------------------------------------------------------------------------
// Date / amount normalization
// ---------------------------------------------------------------------------

// Try a handful of common formats. Returns "" if it can't make sense of it.
export function normalizeDate(input: string): string {
  if (!input) return "";
  const s = input.trim();
  // ISO already (YYYY-MM-DD)
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // M/D/YYYY or MM/DD/YYYY (US)
  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(s);
  if (us) {
    let [, m, d, y] = us;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Last resort: let Date parse it
  const t = new Date(s);
  if (!Number.isNaN(t.getTime())) {
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const d = String(t.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

// Strips currency symbols, parens (negative), commas. Returns null on bad input.
export function normalizeAmount(input: string): number | null {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.+\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[\$£€¥,]/g, "").trim();
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  if (s.startsWith("+")) s = s.slice(1);
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

// ---------------------------------------------------------------------------
// Row → ParsedCsvRow normalization
// ---------------------------------------------------------------------------

export interface NormalizeOptions {
  mapping: Partial<Record<CsvField, string>>;
  creditCol?: string;
  // Some banks use POSITIVE numbers for charges, others NEGATIVE. If the user
  // (or auto-detect) flips this, we treat negative as expense.
  amountSignForExpense?: "positive" | "negative" | "auto";
}

// Returns ParsedCsvRow[] for spending only, plus errors for rows we couldn't
// use (income, refunds, malformed dates/amounts, missing required fields).
export function normalizeRows(
  rawRows: Record<string, string>[],
  opts: NormalizeOptions,
): { rows: ParsedCsvRow[]; errors: CsvParseError[] } {
  const { mapping, creditCol } = opts;
  const sign = opts.amountSignForExpense ?? "auto";
  const rows: ParsedCsvRow[] = [];
  const errors: CsvParseError[] = [];

  // If sign === "auto", infer by looking at the most common sign in the data.
  let autoSign: "positive" | "negative" = "positive";
  if (sign === "auto" && mapping.amount) {
    let pos = 0,
      neg = 0;
    for (const r of rawRows) {
      const a = normalizeAmount(r[mapping.amount] ?? "");
      if (a == null) continue;
      if (a > 0) pos++;
      else if (a < 0) neg++;
    }
    // If most rows are negative, they're charges in many bank exports.
    autoSign = neg > pos ? "negative" : "positive";
  }
  const expenseSign: "positive" | "negative" =
    sign === "auto" ? autoSign : sign;

  rawRows.forEach((raw, i) => {
    const sourceRow = i + 2; // header is row 1, first data row is row 2
    const merchantRaw = mapping.merchant ? raw[mapping.merchant] : "";
    const amountRaw = mapping.amount ? raw[mapping.amount] : "";
    const dateRaw = mapping.date ? raw[mapping.date] : "";
    const noteRaw = mapping.note ? raw[mapping.note] : "";
    const categoryRaw = mapping.category ? raw[mapping.category] : "";

    if (!merchantRaw?.trim()) {
      errors.push({ row: sourceRow, message: "Missing merchant/description.", raw });
      return;
    }

    const date = normalizeDate(dateRaw ?? "");
    if (!date) {
      errors.push({ row: sourceRow, message: "Invalid or missing date.", raw });
      return;
    }

    let amt = normalizeAmount(amountRaw ?? "");
    // If there's a separate "credit" column, it usually means income/refund.
    // If that column has a value, this row is income — skip silently.
    if (creditCol) {
      const creditAmt = normalizeAmount(raw[creditCol] ?? "");
      if (creditAmt != null && creditAmt !== 0) {
        return; // not an expense, ignore quietly
      }
    }
    if (amt == null) {
      errors.push({ row: sourceRow, message: "Couldn't parse amount.", raw });
      return;
    }

    // Normalize sign so expenses are POSITIVE in app state.
    const expense =
      expenseSign === "negative" ? -amt /* charges came in as negative */ : amt;
    if (expense <= 0) {
      // refund / credit / income — skip in v1
      return;
    }

    rows.push({
      id: `csv-${sourceRow}-${Math.random().toString(36).slice(2, 7)}`,
      sourceRow,
      date,
      merchant: merchantRaw.trim(),
      amount: Math.round(expense * 100) / 100,
      note: noteRaw?.trim() || undefined,
      rawCategory: categoryRaw?.trim() || undefined,
    });
  });

  return { rows, errors };
}

// ---------------------------------------------------------------------------
// Categorization — reuses the existing merchant memory + fuzzy match.
// ---------------------------------------------------------------------------

export function categorizeRow(
  row: ParsedCsvRow,
  memory: MerchantMemoryEntry[],
  categories: Category[],
  otherCategoryId: string,
): CsvCategorization {
  // 1. Try memory (exact + fuzzy)
  const sug = suggestCategory(row.merchant, memory);
  if (sug?.confidence === "exact") {
    return {
      categoryId: sug.categoryId,
      matchType: "exact",
      matchedDisplayName: sug.displayName,
    };
  }
  if (sug?.confidence === "fuzzy") {
    return {
      categoryId: sug.categoryId,
      matchType: "fuzzy",
      matchedDisplayName: sug.displayName,
    };
  }

  // 2. If the CSV had a category column, try matching that to an existing
  //    category by name (case-insensitive).
  if (row.rawCategory) {
    const want = row.rawCategory.toLowerCase().trim();
    const hit = categories.find((c) => c.name.toLowerCase().trim() === want);
    if (hit) {
      return {
        categoryId: hit.id,
        matchType: "fuzzy",
        matchedDisplayName: hit.name,
      };
    }
  }

  // 3. Heuristic fallback (Starbucks → Food, Shell → Transportation, etc.)
  //    Only fires when the user actually has a matching category.
  const heur = suggestCategoryByHeuristic(row.merchant, categories);
  if (heur) {
    return {
      categoryId: heur.categoryId,
      matchType: "heuristic",
      matchedDisplayName: heur.bucket,
    };
  }

  // 4. Fall back to Other.
  return { categoryId: otherCategoryId, matchType: "uncategorized" };
}

// ---------------------------------------------------------------------------
// Duplicate detection — flag CSV rows that look like an existing transaction
// already in the user's account (same date + merchant + amount).
// ---------------------------------------------------------------------------

export function isProbableDuplicate(
  row: ParsedCsvRow,
  existing: { date: string; merchant: string; amount: number }[],
): boolean {
  // Existing tx.date is an ISO string with time; we compare yyyy-mm-dd only.
  const target = row.date;
  for (const t of existing) {
    if (
      t.date.slice(0, 10) === target &&
      t.merchant.trim().toLowerCase() === row.merchant.trim().toLowerCase() &&
      Math.abs(t.amount - row.amount) < 0.005
    ) {
      return true;
    }
  }
  return false;
}
