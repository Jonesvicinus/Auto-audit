"use client";

// Browser-side PDF parsing for credit-card / bank statements.
// Optimized for Capital One Quicksilver "Transactions" pages, but the row
// pattern is generic enough that other "Trans Date | Post Date | Description |
// Amount"-style statements are likely to work too.

import type { ParsedCsvRow } from "./csvImport";

// pdf.js requires a worker URL. We dynamically import the library client-side
// only and pin the worker to unpkg at the same version we have installed, so
// there are no manual config steps.
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function getPdfJs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

// ---------------------------------------------------------------------------
// Text extraction — pull lines (with positional reconstruction) out of a PDF.
// ---------------------------------------------------------------------------

interface PdfTextItem {
  str: string;
  // pdf.js returns a transform matrix; position is at indices [4]=x, [5]=y.
  transform: number[];
}

// Group items by Y coord, then sort each group left-to-right. Returns lines
// top-to-bottom (PDF Y origin is bottom-left, so we sort descending).
function reconstructLines(items: PdfTextItem[]): string[] {
  const buckets = new Map<number, { x: number; str: string }[]>();
  for (const item of items) {
    if (!item.str) continue;
    // Bucket by Y rounded to nearest 2 points (typical line spacing tolerance).
    const yKey = Math.round(item.transform[5] / 2) * 2;
    let arr = buckets.get(yKey);
    if (!arr) {
      arr = [];
      buckets.set(yKey, arr);
    }
    arr.push({ x: item.transform[4], str: item.str });
  }
  const ys = Array.from(buckets.keys()).sort((a, b) => b - a);
  return ys.map((y) => {
    const row = buckets.get(y)!;
    row.sort((a, b) => a.x - b.x);
    // Join with single space; double-spaces caller-side are squeezed.
    return row
      .map((r) => r.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  });
}

export interface PdfExtractionResult {
  lines: string[];
  // pulled from "Mar 14, 2026 - Apr 12, 2026" style header
  cycleStart?: { year: number; month: number; day: number };
  cycleEnd?: { year: number; month: number; day: number };
}

export async function extractPdfText(file: File): Promise<PdfExtractionResult> {
  const pdfjs = await getPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const pageLines = reconstructLines(tc.items as unknown as PdfTextItem[]);
    lines.push(...pageLines);
  }
  return { lines, ...detectCycleDates(lines) };
}

// ---------------------------------------------------------------------------
// Billing-cycle date detection — used to attach years to "Mar 12" rows.
// Matches: "Mar 14, 2026 - Apr 12, 2026" (tolerant of whitespace + dash).
// ---------------------------------------------------------------------------

const CYCLE_RE = new RegExp(
  String.raw`(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),\s*(\d{4})\s*[-–—]\s*` +
    String.raw`(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),\s*(\d{4})`,
  "i",
);

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function detectCycleDates(lines: string[]): {
  cycleStart?: { year: number; month: number; day: number };
  cycleEnd?: { year: number; month: number; day: number };
} {
  for (const line of lines) {
    const m = CYCLE_RE.exec(line);
    if (!m) continue;
    const startMonth = MONTHS[m[1].toLowerCase()];
    const endMonth = MONTHS[m[4].toLowerCase()];
    if (!startMonth || !endMonth) continue;
    return {
      cycleStart: { year: parseInt(m[3], 10), month: startMonth, day: parseInt(m[2], 10) },
      cycleEnd: { year: parseInt(m[6], 10), month: endMonth, day: parseInt(m[5], 10) },
    };
  }
  return {};
}

// Pick the right year for a transaction "Mar 12" given the billing cycle.
// If the cycle doesn't cross a year boundary, both years are equal.
// If it crosses (e.g. Dec 2025 - Jan 2026): months >= cycleStart.month → start year, else end year.
function inferYear(
  txMonth: number,
  cycleStart?: PdfExtractionResult["cycleStart"],
  cycleEnd?: PdfExtractionResult["cycleEnd"],
): number {
  const fallback = new Date().getFullYear();
  if (!cycleStart || !cycleEnd) return fallback;
  if (cycleStart.year === cycleEnd.year) return cycleStart.year;
  return txMonth >= cycleStart.month ? cycleStart.year : cycleEnd.year;
}

// ---------------------------------------------------------------------------
// Capital One purchase-row extraction
// ---------------------------------------------------------------------------

// Matches: "Mar 12 Mar 14 BUC-EE'S #0063BRUNSWICKGA $8.44"
// Allows optional leading "-" before "$" for credits, but the section state
// machine should keep us out of the credits block — we still defensively
// reject negatives.
const TX_LINE_RE = new RegExp(
  String.raw`^\s*` +
    String.raw`(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+` + // trans date
    String.raw`(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+` + // post date
    String.raw`(.+?)\s+` +                                                          // description
    String.raw`(-\s*)?\$\s*([\d,]+\.\d{2})\s*$`,                                     // amount
  "i",
);

// Headings for the Capital One transaction sections.
const PURCHASES_HEADING_RE = /:\s*Transactions\s*$/i;
const CREDITS_HEADING_RE = /:\s*Payments,?\s*Credits\s*and\s*Adjustments\s*$/i;
const ENDING_HEADING_RE =
  /(Total\s*Transactions\s*for\s*This\s*Period|Total\s*Fees\s*for\s*This\s*Period|Interest\s*Charged|Interest\s*Charge\s*Calculation|Account\s*Notifications)/i;
// "Trans Date Post Date Description Amount" header row inside each section.
const TABLE_HEADER_RE = /Trans\s*Date\s+Post\s*Date\s+Description\s+Amount/i;

interface ExtractedTx {
  transMonth: number;
  transDay: number;
  description: string;
  amount: number;
}

// Walk reconstructed lines and pull out the purchase rows. Skips the
// "Payments, Credits and Adjustments" section entirely.
export function extractCapitalOneTransactions(
  lines: string[],
): ExtractedTx[] {
  const out: ExtractedTx[] = [];

  // Section state: "off" → before any heading; "credits" → inside credits;
  // "purchases" → inside transactions; resets to "off" on ending headings.
  type Section = "off" | "credits" | "purchases";
  let section: Section = "off";

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;

    if (CREDITS_HEADING_RE.test(line)) {
      section = "credits";
      continue;
    }
    if (PURCHASES_HEADING_RE.test(line)) {
      section = "purchases";
      continue;
    }
    if (ENDING_HEADING_RE.test(line)) {
      section = "off";
      continue;
    }
    if (TABLE_HEADER_RE.test(line)) continue;

    if (section !== "purchases") continue;

    const m = TX_LINE_RE.exec(line);
    if (!m) continue;

    const transMonth = MONTHS[m[1].toLowerCase()];
    const transDay = parseInt(m[2], 10);
    const description = m[5].trim();
    const isNegative = Boolean(m[6]);
    const amount = parseFloat(m[7].replace(/,/g, ""));

    if (!Number.isFinite(amount) || amount <= 0 || isNegative) continue;

    out.push({ transMonth, transDay, description, amount });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Public: parse a statement PDF → ParsedCsvRow[] reusing the CSV review path.
// ---------------------------------------------------------------------------

export interface PdfImportResult {
  rows: ParsedCsvRow[];
  /** True if the parser thinks this looked like a Capital One statement. */
  recognized: boolean;
  /** Source filename for downstream UI. */
  fileName: string;
  cycleLabel?: string;
}

export async function parseStatementPdf(file: File): Promise<PdfImportResult> {
  const { lines, cycleStart, cycleEnd } = await extractPdfText(file);
  const txs = extractCapitalOneTransactions(lines);

  const cycleLabel = cycleStart && cycleEnd
    ? `${cycleStart.year}-${pad(cycleStart.month)}-${pad(cycleStart.day)} → ${cycleEnd.year}-${pad(cycleEnd.month)}-${pad(cycleEnd.day)}`
    : undefined;

  // Recognized = we found the Capital One section markers AND at least one row.
  const recognized = txs.length > 0;

  const rows: ParsedCsvRow[] = txs.map((tx, i) => {
    const year = inferYear(tx.transMonth, cycleStart, cycleEnd);
    const date = `${year}-${pad(tx.transMonth)}-${pad(tx.transDay)}`;
    return {
      id: `pdf-${i}-${Math.random().toString(36).slice(2, 7)}`,
      sourceRow: i + 1,
      date,
      merchant: tx.description,
      amount: Math.round(tx.amount * 100) / 100,
    };
  });

  return { rows, recognized, fileName: file.name, cycleLabel };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
