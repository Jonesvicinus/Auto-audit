import type {
  Transaction,
  MonthlyBudget,
  SavingsGoal,
  MerchantMemoryEntry,
} from "@/types";
import { DEFAULT_CATEGORIES } from "./demoUser";

// -----------------------------------------------------------------------------
// Deterministic PRNG so the demo dataset is stable across reloads.
// -----------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(98765);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) =>
  Math.round((min + rand() * (max - min)) * 100) / 100;

// -----------------------------------------------------------------------------
// Merchant catalog by category (realistic-feeling student spending).
// -----------------------------------------------------------------------------
const MERCHANTS: Record<string, { name: string; min: number; max: number }[]> = {
  "cat-food": [
    { name: "Chipotle", min: 9, max: 14 },
    { name: "Starbucks", min: 4, max: 8 },
    { name: "Trader Joe's", min: 18, max: 55 },
    { name: "Whole Foods", min: 22, max: 70 },
    { name: "Panera Bread", min: 10, max: 16 },
    { name: "Chick-fil-A", min: 8, max: 13 },
    { name: "Dunkin'", min: 3, max: 7 },
    { name: "Campus Dining", min: 6, max: 12 },
    { name: "Taco Bell", min: 6, max: 11 },
    { name: "Sweetgreen", min: 12, max: 17 },
  ],
  "cat-transport": [
    { name: "Shell Gas", min: 25, max: 55 },
    { name: "Uber", min: 8, max: 28 },
    { name: "Lyft", min: 9, max: 26 },
    { name: "Exxon", min: 28, max: 60 },
    { name: "MBTA", min: 2, max: 15 },
    { name: "Campus Parking", min: 5, max: 20 },
  ],
  "cat-fun": [
    { name: "AMC Theatres", min: 12, max: 22 },
    { name: "Steam", min: 10, max: 60 },
    { name: "Barnes & Noble", min: 8, max: 35 },
    { name: "Concert Tickets", min: 35, max: 120 },
    { name: "Topgolf", min: 20, max: 45 },
    { name: "Apple App Store", min: 2, max: 20 },
    { name: "Starbucks", min: 4, max: 8 },
  ],
  "cat-bills": [
    { name: "Spotify", min: 10.99, max: 10.99 },
    { name: "Netflix", min: 15.49, max: 15.49 },
    { name: "Phone Bill", min: 45, max: 45 },
    { name: "Internet", min: 35, max: 35 },
    { name: "Gym Membership", min: 24.99, max: 24.99 },
    { name: "ChatGPT Plus", min: 20, max: 20 },
  ],
  "cat-other": [
    { name: "Target", min: 18, max: 75 },
    { name: "CVS", min: 6, max: 30 },
    { name: "Amazon", min: 10, max: 85 },
    { name: "Walmart", min: 15, max: 60 },
    { name: "Textbooks", min: 40, max: 180 },
  ],
};

// Monthly spend targets per category, used to shape spending into realistic
// curves and to decide how many transactions to generate. These are approximate
// — some months will over/under-spend by design.
const SPEND_TARGETS: Record<string, { target: number; txCount: [number, number] }> = {
  "cat-food": { target: 320, txCount: [14, 22] },
  "cat-transport": { target: 140, txCount: [3, 7] },
  "cat-fun": { target: 120, txCount: [3, 8] },
  "cat-bills": { target: 140, txCount: [4, 6] }, // near-fixed
  "cat-other": { target: 110, txCount: [3, 6] },
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function monthKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function randomDayIso(year: number, monthIndex: number) {
  const d = Math.floor(rand() * daysInMonth(year, monthIndex)) + 1;
  const date = new Date(Date.UTC(year, monthIndex, d, 15, 0, 0));
  return date.toISOString();
}

let txCounter = 0;
const newId = () => `tx-${Date.now().toString(36)}-${(txCounter++).toString(36)}`;

// -----------------------------------------------------------------------------
// Build 12 months ending at currentMonth. Introduce overspend / underspend
// variation so the dashboard tells interesting stories.
// -----------------------------------------------------------------------------
function buildTransactionsForMonth(
  year: number,
  monthIndex: number,
  variation: number, // 1.0 = on target, 1.3 = 30% over, 0.75 = 25% under
): Transaction[] {
  const txs: Transaction[] = [];

  for (const cat of DEFAULT_CATEGORIES) {
    const target = SPEND_TARGETS[cat.id];
    if (!target) continue;

    const merchants = MERCHANTS[cat.id] ?? [];
    if (merchants.length === 0) continue;

    // Bills category uses fixed recurring charges per month.
    if (cat.id === "cat-bills") {
      // Most months keep all recurring. Occasionally drop one (canceled).
      const drop = rand() < 0.15 ? Math.floor(rand() * merchants.length) : -1;
      merchants.forEach((m, idx) => {
        if (idx === drop) return;
        const day = 1 + Math.floor(rand() * 5); // pay early in month
        const date = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
        txs.push({
          id: newId(),
          amount: between(m.min, m.max),
          merchant: m.name,
          date: date.toISOString(),
          categoryId: cat.id,
          note: "",
        });
      });
      continue;
    }

    const [minCount, maxCount] = target.txCount;
    const count =
      Math.round((minCount + rand() * (maxCount - minCount)) * variation) || 1;
    const avg = (target.target * variation) / count;

    for (let i = 0; i < count; i++) {
      const m = pick(merchants);
      // Pull amount toward the merchant's range but bias around per-tx avg.
      const base = between(m.min, m.max);
      const blended = Math.max(m.min, Math.min(m.max * 1.2, (base + avg) / 2));
      txs.push({
        id: newId(),
        amount: Math.round(blended * 100) / 100,
        merchant: m.name,
        date: randomDayIso(year, monthIndex),
        categoryId: cat.id,
        note: rand() < 0.1 ? sampleNote() : "",
      });
    }
  }

  return txs.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function sampleNote() {
  const notes = [
    "Study group",
    "Friend's birthday",
    "Forgot lunch",
    "Road trip",
    "Textbook for chem",
    "Date night",
    "Late-night coding fuel",
  ];
  return notes[Math.floor(rand() * notes.length)];
}

// Scripted variation per month index (0 = oldest). Mix of normal / over / under.
const VARIATIONS: number[] = [
  1.0, 0.85, 1.15, 1.35, 0.9, 1.0, 1.25, 0.8, 1.1, 1.4, 0.95, 1.05,
];

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function buildDemoTransactions(now: Date = new Date()): Transaction[] {
  const txs: Transaction[] = [];
  for (let i = 11; i >= 0; i--) {
    const monthDate = addMonths(now, -i);
    const variation = VARIATIONS[11 - i] ?? 1;
    txs.push(
      ...buildTransactionsForMonth(
        monthDate.getFullYear(),
        monthDate.getMonth(),
        variation,
      ),
    );
  }
  return txs;
}

// -----------------------------------------------------------------------------
// Default monthly budgets. Total ≈ $900/month. Categories must sum ≤ total.
// Any leftover slack auto-fills "Other" in the budget settings page.
// -----------------------------------------------------------------------------
const DEFAULT_BUDGET_CATEGORIES: Record<string, number> = {
  "cat-food": 350,
  "cat-transport": 150,
  "cat-fun": 120,
  "cat-bills": 150,
  "cat-other": 130,
};
const DEFAULT_TOTAL = 900;

export function buildDemoBudgets(now: Date = new Date()): MonthlyBudget[] {
  const months: MonthlyBudget[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = addMonths(now, -i);
    months.push({
      month: monthKey(d),
      total: DEFAULT_TOTAL,
      categories: { ...DEFAULT_BUDGET_CATEGORIES },
    });
  }
  return months;
}

// -----------------------------------------------------------------------------
// Savings goals
// -----------------------------------------------------------------------------
export const DEMO_SAVINGS_GOALS: SavingsGoal[] = [
  {
    id: "goal-monthly",
    name: "Monthly Savings",
    type: "monthly",
    targetAmount: 150,
    savedAmount: 95,
    createdAt: "2025-06-01T00:00:00.000Z",
  },
  {
    id: "goal-springbreak",
    name: "Spring Break Trip",
    type: "named",
    targetAmount: 600,
    savedAmount: 340,
    targetDate: "2026-03-15T00:00:00.000Z",
    createdAt: "2025-11-01T00:00:00.000Z",
  },
  {
    id: "goal-laptop",
    name: "New Laptop",
    type: "named",
    targetAmount: 1400,
    savedAmount: 520,
    targetDate: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-01-15T00:00:00.000Z",
  },
];

// -----------------------------------------------------------------------------
// Seed merchant memory — pretend the user already confirmed these mappings.
// -----------------------------------------------------------------------------
export const DEMO_MERCHANT_MEMORY: MerchantMemoryEntry[] = [
  { key: "chipotle", displayName: "Chipotle", categoryId: "cat-food", remember: true },
  { key: "starbucks", displayName: "Starbucks", categoryId: "cat-food", remember: true },
  { key: "spotify", displayName: "Spotify", categoryId: "cat-bills", remember: true },
  { key: "netflix", displayName: "Netflix", categoryId: "cat-bills", remember: true },
  { key: "shell gas", displayName: "Shell Gas", categoryId: "cat-transport", remember: true },
  { key: "uber", displayName: "Uber", categoryId: "cat-transport", remember: true },
  { key: "amazon", displayName: "Amazon", categoryId: "cat-other", remember: true },
  { key: "walmart", displayName: "Walmart", categoryId: "cat-other", remember: true },
];
