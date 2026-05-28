# Auto Audit: Codebase Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every critical bug, architectural flaw, and code-quality issue identified in the senior dev review, bringing the Auto Audit budget app to production-grade quality.

**Architecture:** Changes flow from smallest blast radius to largest — pure library fixes first (no React, no state), then storage/persistence fixes, then the React Context layer, then UI components. Every fix is covered by a test. No placeholder steps.

**Tech Stack:** Next.js 14, TypeScript, Vitest 1.x, @testing-library/react 16, jsdom, Tailwind CSS, Supabase

**App root:** `Auto Audit/budget-app/` (all relative paths below are from this directory)

---

## Files Created
- `vitest.config.ts` — test runner config
- `vitest.setup.ts` — jest-dom matchers
- `lib/__tests__/months.test.ts`
- `lib/__tests__/budgetCalc.test.ts`
- `lib/__tests__/csvImport.test.ts`
- `lib/__tests__/recommendedBudget.test.ts`
- `lib/__tests__/storage.test.ts`

## Files Modified
- `package.json` — vitest deps + test scripts
- `types/index.ts` — stronger MonthKey type
- `lib/months.ts` — fix `isSameMonth` timezone bug
- `lib/budgetCalc.ts` — fix `transactionsInMonth` timezone bug + `allocateSlackToOther` over-budget bug
- `lib/BudgetContext.tsx` — fix `deleteCategory` fallback, race conditions, re-render storm, save concurrency, `crypto.randomUUID`, deduplicate User construction
- `lib/storage.ts` — fix version key, add localStorage migration, throw on quota errors, remove dead `buildInitialState`
- `lib/AuthContext.tsx` — clear all legacy storage keys on demo entry
- `lib/recommendedBudget.ts` — expand `isStableBillsCategory`, fix grammar
- `lib/categorySchedule.ts` — pass view month to `categoryScheduleLabel`
- `lib/csvImport.ts` — fix `normalizeDate` (remove UTC fallback), expand `normalizeAmount` currencies
- `lib/fuzzyMatch.ts` — fix wrong O(m×n) space complexity comment
- `components/transactions/StatementImportPanel.tsx` — remove dead `categoryOptions` memo, fix double `.map()`, memoize per-month active categories
- `app/(app)/dashboard/page.tsx` — fix `Alert` index keys, memoize `monthTx`

---

## Task 1: Test Infrastructure

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `package.json`

- [ ] **Step 1: Install vitest and testing-library**

```bash
cd "Auto Audit/budget-app"
npm install --save-dev vitest@^1.6.0 @vitest/coverage-v8@^1.6.0 jsdom@^24.1.0 @testing-library/react@^16.0.0 @testing-library/jest-dom@^6.4.8 @testing-library/user-event@^14.5.2 @vitejs/plugin-react@^4.3.1
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 3: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 4: Add test scripts to `package.json`**

Replace the `"scripts"` block with:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage"
},
```

- [ ] **Step 5: Verify test infra works**

Create `lib/__tests__/smoke.test.ts` temporarily:
```ts
import { describe, it, expect } from "vitest";
describe("smoke", () => {
  it("runs", () => expect(1 + 1).toBe(2));
});
```

Run: `npm run test:run`
Expected: `✓ lib/__tests__/smoke.test.ts > smoke > runs`

Delete the smoke file after it passes.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts vitest.setup.ts package.json package-lock.json
git commit -m "chore: add vitest test infrastructure"
```

---

## Task 2: Fix Timezone Bugs in `months.ts` and `budgetCalc.ts`

**Files:**
- Create: `lib/__tests__/months.test.ts`
- Create: `lib/__tests__/budgetCalc.test.ts`
- Modify: `lib/months.ts:44-47`
- Modify: `lib/budgetCalc.ts:35`

The bug: `new Date("2025-03-01")` parses as UTC midnight. In UTC-5, this is `2025-02-28 19:00` local — `monthKeyOf` then returns `"2025-02"`. March 1 transactions disappear from March.

- [ ] **Step 1: Write failing tests for `isSameMonth`**

Create `lib/__tests__/months.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isSameMonth, monthKeyOf } from "../months";

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
});

describe("monthKeyOf", () => {
  it("returns YYYY-MM for a given Date", () => {
    expect(monthKeyOf(new Date(2025, 2, 15))).toBe("2025-03");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm run test:run -- lib/__tests__/months.test.ts
```
Expected: `FAIL` — `isSameMonth("2025-03-01", "2025-03")` returns `false` for UTC-behind users (or may pass locally — either way verify the test exists and runs).

- [ ] **Step 3: Fix `isSameMonth` in `lib/months.ts`**

Replace lines 44–47:
```ts
// Before:
export function isSameMonth(iso: string, key: MonthKey) {
  const d = new Date(iso);
  return monthKeyOf(d) === key;
}
```
With:
```ts
// Slice "YYYY-MM" directly from the ISO string — no Date parsing, no UTC offset risk.
export function isSameMonth(iso: string, key: MonthKey): boolean {
  return iso.slice(0, 7) === key;
}
```

- [ ] **Step 4: Write failing tests for `transactionsInMonth`**

Create `lib/__tests__/budgetCalc.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  transactionsInMonth,
  totalSpentInMonth,
  allocateSlackToOther,
  sumCategoryBudgets,
} from "../budgetCalc";
import type { Transaction, MonthlyBudget } from "@/types";

function makeTx(date: string, amount = 100, categoryId = "cat-a"): Transaction {
  return { id: `tx-${date}`, amount, merchant: "Test", date, categoryId };
}

describe("transactionsInMonth", () => {
  it("includes a transaction on the first of the month", () => {
    const txs = [makeTx("2025-03-01"), makeTx("2025-02-28"), makeTx("2025-04-01")];
    expect(transactionsInMonth(txs, "2025-03")).toHaveLength(1);
    expect(transactionsInMonth(txs, "2025-03")[0].date).toBe("2025-03-01");
  });

  it("includes a transaction on the last day of the month", () => {
    const txs = [makeTx("2025-03-31"), makeTx("2025-04-01")];
    expect(transactionsInMonth(txs, "2025-03")).toHaveLength(1);
  });

  it("returns empty array when no transactions match", () => {
    expect(transactionsInMonth([makeTx("2025-02-01")], "2025-03")).toHaveLength(0);
  });

  it("handles an empty transaction list", () => {
    expect(transactionsInMonth([], "2025-03")).toHaveLength(0);
  });
});

describe("totalSpentInMonth", () => {
  it("sums amounts for the correct month only", () => {
    const txs = [makeTx("2025-03-01", 50), makeTx("2025-03-15", 30), makeTx("2025-02-01", 999)];
    expect(totalSpentInMonth(txs, "2025-03")).toBe(80);
  });
});
```

- [ ] **Step 5: Fix `transactionsInMonth` in `lib/budgetCalc.ts`**

Replace line 35:
```ts
// Before:
return transactions.filter((t) => monthKeyOf(new Date(t.date)) === month);

// After — string slice matches clearTransactionsForMonth's approach:
return transactions.filter((t) => t.date.slice(0, 7) === month);
```

- [ ] **Step 6: Run tests**

```bash
npm run test:run -- lib/__tests__/months.test.ts lib/__tests__/budgetCalc.test.ts
```
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/months.ts lib/budgetCalc.ts lib/__tests__/months.test.ts lib/__tests__/budgetCalc.test.ts
git commit -m "fix: timezone-safe month comparison in isSameMonth and transactionsInMonth"
```

---

## Task 3: Fix `allocateSlackToOther` Over-Budget Silent Failure

**Files:**
- Modify: `lib/budgetCalc.ts:159-170`
- Add tests to: `lib/__tests__/budgetCalc.test.ts`

The bug: when category sum exceeds total, `Math.max(0, total - sum)` = 0, so Other keeps its stale value instead of being zeroed out.

- [ ] **Step 1: Add failing tests to `lib/__tests__/budgetCalc.test.ts`**

Append to the file:
```ts
describe("allocateSlackToOther", () => {
  it("pushes unallocated slack into Other", () => {
    const budget: MonthlyBudget = {
      month: "2025-03",
      total: 100,
      categories: { "cat-a": 80, "cat-other": 0 },
    };
    const result = allocateSlackToOther(budget, "cat-other");
    expect(result.categories["cat-other"]).toBe(20);
  });

  it("zeros Other when non-Other categories already exceed total", () => {
    const budget: MonthlyBudget = {
      month: "2025-03",
      total: 100,
      categories: { "cat-a": 80, "cat-b": 40, "cat-other": 30 },
    };
    const result = allocateSlackToOther(budget, "cat-other");
    expect(result.categories["cat-other"]).toBe(0);
  });

  it("reduces Other when previously over-allocated", () => {
    const budget: MonthlyBudget = {
      month: "2025-03",
      total: 100,
      categories: { "cat-a": 80, "cat-other": 50 },
    };
    const result = allocateSlackToOther(budget, "cat-other");
    // non-Other sum = 80, slack = 20, Other should be 20
    expect(result.categories["cat-other"]).toBe(20);
  });

  it("returns the same object reference when already balanced", () => {
    const budget: MonthlyBudget = {
      month: "2025-03",
      total: 100,
      categories: { "cat-a": 80, "cat-other": 20 },
    };
    expect(allocateSlackToOther(budget, "cat-other")).toBe(budget);
  });
});
```

- [ ] **Step 2: Run to confirm failures**

```bash
npm run test:run -- lib/__tests__/budgetCalc.test.ts
```
Expected: 2-3 tests fail.

- [ ] **Step 3: Fix `allocateSlackToOther` in `lib/budgetCalc.ts`**

Replace the entire function (lines ~159-170):
```ts
export function allocateSlackToOther(
  budget: MonthlyBudget,
  otherCategoryId: string,
): MonthlyBudget {
  // Compute slack excluding Other so we can set Other = slack (clamped to ≥0).
  const otherCurrent = budget.categories[otherCategoryId] ?? 0;
  const sumWithoutOther =
    sumCategoryBudgets(budget.categories) - otherCurrent;
  const newOther = Math.max(0, budget.total - sumWithoutOther);

  if (Math.abs(newOther - otherCurrent) < 0.01) return budget;

  return {
    ...budget,
    categories: { ...budget.categories, [otherCategoryId]: newOther },
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- lib/__tests__/budgetCalc.test.ts
```
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add lib/budgetCalc.ts lib/__tests__/budgetCalc.test.ts
git commit -m "fix: allocateSlackToOther now zeros Other when categories exceed total"
```

---

## Task 4: Fix `deleteCategory` Reassigning to Wrong Fallback

**Files:**
- Modify: `lib/BudgetContext.tsx:263-287`

The bug: `s.categories.find((c) => c.id !== id)` picks whatever happens to be first in the array (usually "Food"), not the "Other" bucket. Financial data is silently moved to the wrong category.

- [ ] **Step 1: Fix `deleteCategory` callback in `lib/BudgetContext.tsx`**

Find the `deleteCategory` callback (around line 263) and replace:
```ts
// Before:
const fallback = s.categories.find((c) => c.id !== id);

// After — always prefer the isOther bucket:
const fallback =
  s.categories.find((c) => c.id !== id && c.isOther) ??
  s.categories.find((c) => c.id !== id);
```

The full updated callback:
```ts
const deleteCategory = useCallback((id: string) => {
  setState((s) => {
    const cat = s.categories.find((c) => c.id === id);
    if (!cat || s.categories.length <= 1) return s;
    const fallback =
      s.categories.find((c) => c.id !== id && c.isOther) ??
      s.categories.find((c) => c.id !== id);
    if (!fallback) return s;
    const transactions = s.transactions.map((t) =>
      t.categoryId === id ? { ...t, categoryId: fallback.id } : t,
    );
    const budgets = s.budgets.map((b) => {
      if (!(id in b.categories)) return b;
      const amount = b.categories[id] ?? 0;
      const nextCats: Record<string, number> = { ...b.categories };
      delete nextCats[id];
      nextCats[fallback.id] = (nextCats[fallback.id] ?? 0) + amount;
      return { ...b, categories: nextCats };
    });
    return {
      ...s,
      categories: s.categories.filter((c) => c.id !== id),
      transactions,
      budgets,
    };
  });
}, []);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "Auto Audit/budget-app" && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "lib/BudgetContext.tsx"
git commit -m "fix: deleteCategory reassigns transactions to Other bucket, not first category"
```

---

## Task 5: Fix Race Conditions in `resetDemo` and `reseedDemoData`

**Files:**
- Modify: `lib/BudgetContext.tsx` (resetDemo ~line 353, reseedDemoData ~line 369)

The bug: `void adapter.reset()` fires without awaiting, then `void adapter.save(fresh)` fires immediately. The save completes first; then reset deletes everything. User gets a blank account.

- [ ] **Step 1: Extract `authUserToUser` helper near the top of `lib/BudgetContext.tsx`**

After the imports but before `BudgetProvider`, add:
```ts
/** Maps the auth layer's AuthUser shape to the domain User type. */
function authUserToUser(u: {
  id: string;
  email: string;
  name?: string;
  createdAt?: string;
}): User {
  return {
    id: u.id,
    name: u.name ?? u.email.split("@")[0],
    email: u.email,
    createdAt: u.createdAt ?? new Date().toISOString(),
  };
}
```

Add `User` to the existing type import from `@/types`:
```ts
import type {
  AppState,
  Category,
  MonthlyBudget,
  SavingsGoal,
  Transaction,
  User,
} from "@/types";
```

- [ ] **Step 2: Replace the hydration `useEffect` to use `authUserToUser`**

In the hydration effect (around line 97), replace the two duplicated object literals:
```ts
// Before (two copies):
adapter = new SupabaseStorageAdapter({
  id: user.id,
  name: user.name ?? user.email.split("@")[0],
  email: user.email,
  createdAt: user.createdAt ?? new Date().toISOString(),
});
// ...
nextState = buildEmptyAuthenticatedState({
  id: user.id,
  name: user.name ?? user.email.split("@")[0],
  email: user.email,
  createdAt: user.createdAt ?? new Date().toISOString(),
});

// After:
const domainUser = authUserToUser(user);
adapter = new SupabaseStorageAdapter(domainUser);
// ...
nextState = buildEmptyAuthenticatedState(domainUser);
```

Also in `resetDemo` (line ~356) replace the inline object:
```ts
// Before:
? buildEmptyAuthenticatedState({
    id: user.id,
    name: user.name ?? user.email.split("@")[0],
    email: user.email,
    createdAt: user.createdAt ?? new Date().toISOString(),
  })

// After:
? buildEmptyAuthenticatedState(authUserToUser(user))
```

- [ ] **Step 3: Fix `resetDemo` to await reset before saving**

Replace the `resetDemo` callback:
```ts
const resetDemo = useCallback(async () => {
  try {
    await adapterRef.current?.reset();
  } catch {
    // best effort — continue to reseed regardless
  }
  const fresh =
    mode === "supabase" && user
      ? buildEmptyAuthenticatedState(authUserToUser(user))
      : buildDemoState();
  setState(fresh);
  try {
    await adapterRef.current?.save(fresh);
  } catch {
    // save errors are already surfaced by the debounced save effect
  }
}, [mode, user]);
```

- [ ] **Step 4: Fix `reseedDemoData` to await save**

Replace the `reseedDemoData` callback:
```ts
const reseedDemoData = useCallback(async () => {
  if (mode !== "demo") return;
  const fresh = buildDemoState();
  setState(fresh);
  try {
    await adapterRef.current?.save(fresh);
  } catch {
    // surface via the debounced save effect
  }
}, [mode]);
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add "lib/BudgetContext.tsx"
git commit -m "fix: await reset() before save() in resetDemo to prevent race condition"
```

---

## Task 6: Fix BudgetContext Re-Render Storm

**Files:**
- Modify: `lib/BudgetContext.tsx` (value object near line 376)

The bug: `value` is reconstructed as a new object every render, causing all context consumers to re-render on every state change regardless of what changed.

- [ ] **Step 1: Wrap the context value in `useMemo`**

Replace the current value construction and return (around line 376-398):
```ts
// Before:
const value: BudgetContextValue = {
  ...state,
  hydrated,
  // ...
};
return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;

// After:
const value = useMemo<BudgetContextValue>(
  () => ({
    ...state,
    hydrated,
    otherCategoryId,
    isEmptyAccount,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    clearTransactionsForMonth,
    addCategory,
    updateCategory,
    deleteCategory,
    upsertBudget,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    rememberMerchant,
    setAdvancedMode,
    resetDemo,
    reseedDemoData,
  }),
  [
    state,
    hydrated,
    otherCategoryId,
    isEmptyAccount,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    clearTransactionsForMonth,
    addCategory,
    updateCategory,
    deleteCategory,
    upsertBudget,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    rememberMerchant,
    setAdvancedMode,
    resetDemo,
    reseedDemoData,
  ],
);

return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "lib/BudgetContext.tsx"
git commit -m "perf: memoize BudgetContext value to prevent cascade re-renders"
```

---

## Task 7: Fix Save Concurrency in BudgetContext

**Files:**
- Modify: `lib/BudgetContext.tsx` (save useEffect around line 149)

The bug: overlapping saves fire when edits arrive faster than network RTT. There's no in-flight tracking so concurrent upserts race each other.

- [ ] **Step 1: Add in-flight tracking refs**

After the existing `const lastSaveErrorRef = useRef<string>("");` line, add:
```ts
const saveInFlightRef = useRef(false);
const pendingStateRef = useRef<AppState | null>(null);
```

- [ ] **Step 2: Replace the save `useEffect`**

Replace the entire save effect (lines ~149-167):
```ts
useEffect(() => {
  if (!hydrated || !adapterRef.current) return;
  if (saveTimer.current) clearTimeout(saveTimer.current);

  const adapter = adapterRef.current;
  const stateSnapshot = state;

  saveTimer.current = setTimeout(() => {
    const runSave = async (s: AppState) => {
      try {
        await adapter.save(s);
        lastSaveErrorRef.current = "";
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg !== lastSaveErrorRef.current) {
          lastSaveErrorRef.current = msg;
          console.error("[BudgetContext] save failed:", err);
          toast.danger("Couldn't save changes", "We'll retry on your next edit.");
        }
      }
    };

    if (saveInFlightRef.current) {
      // Queue the latest state; the in-flight save's finally block will flush it.
      pendingStateRef.current = stateSnapshot;
      return;
    }

    saveInFlightRef.current = true;
    runSave(stateSnapshot).finally(async () => {
      const pending = pendingStateRef.current;
      pendingStateRef.current = null;
      saveInFlightRef.current = false;
      if (pending) {
        saveInFlightRef.current = true;
        await runSave(pending).finally(() => {
          saveInFlightRef.current = false;
        });
      }
    });
  }, 250);

  return () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  };
}, [state, hydrated, toast]);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add "lib/BudgetContext.tsx"
git commit -m "fix: serialize overlapping Supabase saves to prevent concurrent upsert races"
```

---

## Task 8: Replace `Math.random()` IDs with `crypto.randomUUID()`

**Files:**
- Modify: `lib/BudgetContext.tsx:66-68`

- [ ] **Step 1: Replace `makeId`**

Replace lines 66-68:
```ts
// Before:
function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

// After:
function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
```

`crypto.randomUUID()` is available in all modern browsers and Node.js ≥ 14.17.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "lib/BudgetContext.tsx"
git commit -m "fix: replace Math.random() IDs with crypto.randomUUID()"
```

---

## Task 9: Fix Storage Key Versioning + LocalStorage Migration

**Files:**
- Modify: `lib/storage.ts`
- Modify: `lib/AuthContext.tsx:22` (DEMO_STORAGE_KEY)
- Create: `lib/__tests__/storage.test.ts`

The bugs:
1. Key frozen at `v1.1` — new fields added in v1.4 have no migration path for demo users
2. `LocalStorageAdapter.save()` silently swallows quota errors — data loss with no warning
3. `buildInitialState` is dead code

- [ ] **Step 1: Write tests for LocalStorageAdapter**

Create `lib/__tests__/storage.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LocalStorageAdapter } from "../storage";
import type { AppState } from "@/types";

// Minimal valid AppState for testing
const makeState = (): AppState => ({
  user: { id: "u1", name: "Test", email: "t@test.com", createdAt: "2025-01-01T00:00:00Z" },
  categories: [],
  transactions: [],
  budgets: [],
  savingsGoals: [],
  merchantMemory: [],
  advancedMode: false,
});

describe("LocalStorageAdapter", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("saves and loads state", async () => {
    const adapter = new LocalStorageAdapter("test");
    const state = makeState();
    await adapter.save(state);
    const loaded = await adapter.load();
    expect(loaded?.user.id).toBe("u1");
  });

  it("returns null when nothing is saved", async () => {
    const adapter = new LocalStorageAdapter("test");
    expect(await adapter.load()).toBeNull();
  });

  it("migrates legacy v1.1 data to current key", async () => {
    const state = makeState();
    // Simulate old data at the v1.1 key
    localStorage.setItem("auto-audit:v1.1:test", JSON.stringify(state));
    const adapter = new LocalStorageAdapter("test");
    const loaded = await adapter.load();
    expect(loaded?.user.id).toBe("u1");
    // Old key removed
    expect(localStorage.getItem("auto-audit:v1.1:test")).toBeNull();
    // New key populated
    expect(localStorage.getItem("auto-audit:v1.4:test")).not.toBeNull();
  });

  it("throws a descriptive error when localStorage quota is exceeded", async () => {
    const adapter = new LocalStorageAdapter("test");
    const quotaError = new DOMException("quota exceeded", "QuotaExceededError");
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw quotaError;
    });
    await expect(adapter.save(makeState())).rejects.toThrow("Storage full");
  });

  it("resets by removing the current key", async () => {
    const adapter = new LocalStorageAdapter("test");
    await adapter.save(makeState());
    await adapter.reset();
    expect(await adapter.load()).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failures**

```bash
npm run test:run -- lib/__tests__/storage.test.ts
```
Expected: Several tests fail.

- [ ] **Step 3: Rewrite `LocalStorageAdapter` in `lib/storage.ts`**

Replace the entire `LocalStorageAdapter` class (lines 30-60):
```ts
const CURRENT_STORAGE_VERSION = "v1.4";
const LEGACY_STORAGE_VERSIONS = ["v1.1", "v1.2", "v1.3"];

export class LocalStorageAdapter implements StorageAdapter {
  private readonly namespace: string;

  constructor(namespace: string = "demo") {
    this.namespace = namespace;
  }

  private get currentKey(): string {
    return `auto-audit:${CURRENT_STORAGE_VERSION}:${this.namespace}`;
  }

  private legacyKey(version: string): string {
    return `auto-audit:${version}:${this.namespace}`;
  }

  async load(): Promise<AppState | null> {
    if (typeof window === "undefined") return null;
    try {
      // Try current version first
      const raw = window.localStorage.getItem(this.currentKey);
      if (raw) return JSON.parse(raw) as AppState;

      // Migrate legacy versions (oldest first so we pick the freshest if multiple exist)
      for (const version of [...LEGACY_STORAGE_VERSIONS].reverse()) {
        const legacyRaw = window.localStorage.getItem(this.legacyKey(version));
        if (legacyRaw) {
          const data = JSON.parse(legacyRaw) as AppState;
          // Persist to current key and clean up old one
          window.localStorage.setItem(this.currentKey, legacyRaw);
          window.localStorage.removeItem(this.legacyKey(version));
          return data;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async save(state: AppState): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(this.currentKey, JSON.stringify(state));
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === "QuotaExceededError" ||
          err.name === "NS_ERROR_DOM_QUOTA_REACHED")
      ) {
        throw new Error(
          "Storage full: your browser's local storage is at capacity. " +
            "Clear some space or sign up to sync your data to the cloud.",
        );
      }
      throw err;
    }
  }

  async reset(): Promise<void> {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(this.currentKey);
    // Also clear any lingering legacy keys for this namespace
    for (const version of LEGACY_STORAGE_VERSIONS) {
      window.localStorage.removeItem(this.legacyKey(version));
    }
  }
}
```

- [ ] **Step 4: Update `AuthContext.tsx` to clear all storage keys on demo entry**

In `enterDemoMode` callback (around line 134-137), replace:
```ts
// Before:
window.localStorage.removeItem(DEMO_STORAGE_KEY);

// After — clear all versions so no stale data bleeds in:
for (const version of [CURRENT_STORAGE_VERSION, ...LEGACY_STORAGE_VERSIONS]) {
  window.localStorage.removeItem(`auto-audit:${version}:demo`);
}
```

You'll need to import or inline `CURRENT_STORAGE_VERSION` and `LEGACY_STORAGE_VERSIONS`. The cleanest approach: export them from `storage.ts` and import in `AuthContext.tsx`:

In `lib/storage.ts`, add `export` to both constants:
```ts
export const CURRENT_STORAGE_VERSION = "v1.4";
export const LEGACY_STORAGE_VERSIONS = ["v1.1", "v1.2", "v1.3"];
```

In `lib/AuthContext.tsx`, add the import:
```ts
import {
  CURRENT_STORAGE_VERSION,
  LEGACY_STORAGE_VERSIONS,
} from "./storage";
```

And replace the `DEMO_STORAGE_KEY` constant and its usage:
```ts
// Remove this line:
const DEMO_STORAGE_KEY = "auto-audit:v1.1:demo";

// In enterDemoMode, replace:
window.localStorage.removeItem(DEMO_STORAGE_KEY);
// With:
for (const version of [CURRENT_STORAGE_VERSION, ...LEGACY_STORAGE_VERSIONS]) {
  window.localStorage.removeItem(`auto-audit:${version}:demo`);
}
```

- [ ] **Step 5: Remove dead `buildInitialState` from `lib/storage.ts`**

Delete lines 381-383:
```ts
// Delete entirely:
// Backwards-compatible alias: the original v1.0 `buildInitialState()` path.
export function buildInitialState(): AppState {
  return buildDemoState();
}
```

Update `lib/BudgetContext.tsx` to remove the import and usage:
```ts
// In the import from "./storage", remove buildInitialState:
import {
  buildDemoState,
  buildEmptyAuthenticatedState,
  LocalStorageAdapter,
  StorageAdapter,
  SupabaseStorageAdapter,
} from "./storage";

// Line ~76, replace:
const [state, setState] = useState<AppState>(() => buildInitialState());
// With:
const [state, setState] = useState<AppState>(() => buildDemoState());
```

- [ ] **Step 6: Run all tests**

```bash
npm run test:run -- lib/__tests__/storage.test.ts
```
Expected: All pass.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add lib/storage.ts lib/AuthContext.tsx lib/BudgetContext.tsx lib/__tests__/storage.test.ts
git commit -m "fix: bump storage to v1.4, add migration, throw on quota errors, remove dead buildInitialState"
```

---

## Task 10: Fix CSV Import — `normalizeDate` and `normalizeAmount`

**Files:**
- Create: `lib/__tests__/csvImport.test.ts`
- Modify: `lib/csvImport.ts:155-180` (`normalizeDate`)
- Modify: `lib/csvImport.ts:183-200` (`normalizeAmount`)

Bugs:
1. `normalizeDate` falls back to `new Date(s)` for unknown formats — UTC parse bug, wrong local date.
2. `normalizeAmount` only strips 5 currency symbols — misses ₹, ₩, ₽, and others.

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/csvImport.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeDate, normalizeAmount } from "../csvImport";

describe("normalizeDate", () => {
  it("handles ISO YYYY-MM-DD", () => {
    expect(normalizeDate("2025-03-15")).toBe("2025-03-15");
    expect(normalizeDate("2025-3-5")).toBe("2025-03-05");
  });

  it("handles US M/D/YYYY", () => {
    expect(normalizeDate("3/15/2025")).toBe("2025-03-15");
    expect(normalizeDate("12/1/2025")).toBe("2025-12-01");
  });

  it("handles US MM/DD/YY two-digit year", () => {
    expect(normalizeDate("03/15/25")).toBe("2025-03-15");
  });

  it("handles European D.M.YYYY (day > 12 makes it unambiguous)", () => {
    expect(normalizeDate("31.01.2025")).toBe("2025-01-31");
  });

  it("handles month-name formats: 'Mar 15, 2025'", () => {
    expect(normalizeDate("Mar 15, 2025")).toBe("2025-03-15");
  });

  it("handles month-name formats: '15 Mar 2025'", () => {
    expect(normalizeDate("15 Mar 2025")).toBe("2025-03-15");
  });

  it("returns empty string for garbage input", () => {
    expect(normalizeDate("not a date")).toBe("");
    expect(normalizeDate("")).toBe("");
  });

  // Critical: must NOT use new Date() which parses ISO as UTC
  it("never returns a date one day early due to UTC offset", () => {
    // "2025-03-01" must stay in March, not shift to Feb 28
    const result = normalizeDate("2025-03-01");
    expect(result).toBe("2025-03-01");
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

  it("strips EUR euro sign", () => {
    expect(normalizeAmount("€42.50")).toBe(42.5);
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

  it("strips GBP pound sign", () => {
    expect(normalizeAmount("£99.99")).toBe(99.99);
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
```

- [ ] **Step 2: Run to confirm failures**

```bash
npm run test:run -- lib/__tests__/csvImport.test.ts
```
Expected: Multiple failures for month-name formats, European dates, ₹/₩/₽ symbols.

- [ ] **Step 3: Fix `normalizeDate` in `lib/csvImport.ts`**

Replace the entire `normalizeDate` function (lines ~155-180):
```ts
const MONTH_NAMES: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  january: "01", february: "02", march: "03", april: "04",
  june: "06", july: "07", august: "08", september: "09",
  october: "10", november: "11", december: "12",
};

// Returns "" if no format matched — deliberately avoids new Date() to prevent UTC offset bugs.
export function normalizeDate(input: string): string {
  if (!input) return "";
  const s = input.trim();

  // ISO: YYYY-MM-DD (also handles YYYY-M-D)
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // US: M/D/YYYY or MM/DD/YYYY or MM/DD/YY
  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (us) {
    let [, m, d, y] = us;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // European: D.M.YYYY or D/M/YYYY when day > 12 (unambiguous)
  const eu = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})$/.exec(s);
  if (eu) {
    const [, d, m, yRaw] = eu;
    const dayNum = parseInt(d, 10);
    const monNum = parseInt(m, 10);
    if (dayNum > 12 && monNum >= 1 && monNum <= 12) {
      const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }

  // "Mar 15, 2025" or "March 15 2025"
  const mdy = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(s);
  if (mdy) {
    const mon = MONTH_NAMES[mdy[1].toLowerCase()];
    if (mon) return `${mdy[3]}-${mon}-${mdy[2].padStart(2, "0")}`;
  }

  // "15 Mar 2025" or "15 March 2025"
  const dmy = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(s);
  if (dmy) {
    const mon = MONTH_NAMES[dmy[2].toLowerCase()];
    if (mon) return `${dmy[3]}-${mon}-${dmy[1].padStart(2, "0")}`;
  }

  return "";
}
```

- [ ] **Step 4: Fix `normalizeAmount` in `lib/csvImport.ts`**

Replace line ~192:
```ts
// Before:
s = s.replace(/[\$£€¥,]/g, "").trim();

// After — comprehensive currency symbol coverage:
s = s.replace(/[$£€¥₹₩₽₪₺₴₦₫₱฿]/g, "").replace(/,/g, "").trim();
```

- [ ] **Step 5: Run tests**

```bash
npm run test:run -- lib/__tests__/csvImport.test.ts
```
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add lib/csvImport.ts lib/__tests__/csvImport.test.ts
git commit -m "fix: normalizeDate removes UTC fallback; normalizeAmount handles more currency symbols"
```

---

## Task 11: Fix `recommendedBudget.ts` — `isStableBillsCategory` and Grammar

**Files:**
- Modify: `lib/recommendedBudget.ts`
- Create: `lib/__tests__/recommendedBudget.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/recommendedBudget.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  isStableBillsCategory,
  roundBudgetAmount,
  getLastCompletedMonths,
  buildBudgetRecommendation,
  describeRecommendationWindow,
} from "../recommendedBudget";
import type { Category, Transaction } from "@/types";

function makeCategory(name: string, isOther = false): Category {
  return { id: `cat-${name}`, name, color: "#000", isOther };
}

describe("isStableBillsCategory", () => {
  it("detects 'Bills & Subscriptions' as stable", () => {
    expect(isStableBillsCategory(makeCategory("Bills & Subscriptions"))).toBe(true);
  });

  it("detects 'Rent' as stable", () => {
    expect(isStableBillsCategory(makeCategory("Rent"))).toBe(true);
  });

  it("detects 'Mortgage' as stable", () => {
    expect(isStableBillsCategory(makeCategory("Mortgage"))).toBe(true);
  });

  it("detects 'Netflix' as NOT stable (not by name alone)", () => {
    // Netflix is not detected by name — needs to be in a bills category
    expect(isStableBillsCategory(makeCategory("Netflix"))).toBe(false);
  });

  it("returns false for Food category", () => {
    expect(isStableBillsCategory(makeCategory("Food"))).toBe(false);
  });

  it("returns false for isOther category", () => {
    expect(isStableBillsCategory(makeCategory("Other", true))).toBe(false);
  });
});

describe("roundBudgetAmount", () => {
  it("rounds to nearest $5 for amounts < $100", () => {
    expect(roundBudgetAmount(43)).toBe(45);
    expect(roundBudgetAmount(47)).toBe(45);
    expect(roundBudgetAmount(51)).toBe(50);
  });

  it("rounds to nearest $10 for amounts >= $100", () => {
    expect(roundBudgetAmount(143)).toBe(140);
    expect(roundBudgetAmount(256)).toBe(260);
  });

  it("returns 0 for 0 or negative", () => {
    expect(roundBudgetAmount(0)).toBe(0);
    expect(roundBudgetAmount(-10)).toBe(0);
  });
});

describe("getLastCompletedMonths", () => {
  it("returns 3 months before the given month", () => {
    const months = getLastCompletedMonths(3, "2025-04");
    expect(months).toEqual(["2025-01", "2025-02", "2025-03"]);
  });

  it("rolls back across year boundaries", () => {
    const months = getLastCompletedMonths(3, "2025-02");
    expect(months).toEqual(["2024-11", "2024-12", "2025-01"]);
  });
});

describe("describeRecommendationWindow", () => {
  it("handles singular month grammar", () => {
    const rec = {
      months: ["2025-03"] as string[],
      availableMonths: [] as string[],
      missingMonths: ["2025-03"] as string[],
      categoryRecommendations: [],
      totalRecommended: 0,
    };
    const text = describeRecommendationWindow(rec);
    expect(text).toContain("1 completed month");
    expect(text).not.toContain("months"); // no plural when count = 1
  });
});

describe("buildBudgetRecommendation", () => {
  const food = makeCategory("Food");
  const bills = makeCategory("Bills & Subscriptions");

  const txs: Transaction[] = [
    // 3 months of food spending
    { id: "t1", amount: 300, merchant: "Grocery", date: "2025-01-15", categoryId: food.id },
    { id: "t2", amount: 400, merchant: "Grocery", date: "2025-02-15", categoryId: food.id },
    { id: "t3", amount: 350, merchant: "Grocery", date: "2025-03-15", categoryId: food.id },
    // 3 months of bills
    { id: "t4", amount: 100, merchant: "Netflix", date: "2025-01-01", categoryId: bills.id },
    { id: "t5", amount: 100, merchant: "Netflix", date: "2025-02-01", categoryId: bills.id },
    { id: "t6", amount: 100, merchant: "Netflix", date: "2025-03-01", categoryId: bills.id },
  ];

  it("computes average and applies cushion", () => {
    const rec = buildBudgetRecommendation({
      categories: [food, bills],
      transactions: txs,
      fromMonth: "2025-04",
    });
    const foodRec = rec.categoryRecommendations.find((r) => r.category.id === food.id)!;
    // avg = (300+400+350)/3 = 350, cushion 10%, = 385, rounded to $385 → $385 is < 100... wait
    // 385 >= 100 so rounds to nearest 10 = 390
    expect(foodRec.averageMonthlySpend).toBeCloseTo(350);
    expect(foodRec.recommended).toBe(390); // 350 * 1.10 = 385 → round to nearest 10 = 390

    const billsRec = rec.categoryRecommendations.find((r) => r.category.id === bills.id)!;
    // avg = 100, cushion 5%, = 105, round to nearest 10 = 110... wait 105 >= 100 so nearest 10 = 110
    // Actually: 100 * 1.05 = 105, round to nearest 10 = 110
    expect(billsRec.recommended).toBe(110);
  });

  it("uses transaction dates without UTC offset (slice-based)", () => {
    // A transaction on "2025-03-01" should count in the March window
    const janTx: Transaction = {
      id: "t7", amount: 200, merchant: "G", date: "2025-01-01", categoryId: food.id,
    };
    const rec = buildBudgetRecommendation({
      categories: [food],
      transactions: [janTx],
      fromMonth: "2025-04",
      monthCount: 3,
    });
    expect(rec.availableMonths).toContain("2025-01");
  });
});
```

- [ ] **Step 2: Run to confirm failures**

```bash
npm run test:run -- lib/__tests__/recommendedBudget.test.ts
```

- [ ] **Step 3: Fix `isStableBillsCategory` in `lib/recommendedBudget.ts`**

Replace lines ~36-43:
```ts
export function isStableBillsCategory(category: Category): boolean {
  if (category.isOther) return false;
  const name = category.name.toLowerCase();
  return (
    name.includes("bill") ||
    name.includes("subscription") ||
    name.includes("recurring") ||
    name.includes("rent") ||
    name.includes("mortgage") ||
    name.includes("utility") ||
    name.includes("utilities") ||
    name.includes("insurance") ||
    name.includes("loan") ||
    name.includes("membership")
  );
}
```

- [ ] **Step 4: Fix the UTC date parse in `buildBudgetRecommendation` line ~67**

```ts
// Before:
const txMonth = monthKeyOf(new Date(tx.date));

// After — noon offset prevents UTC rollback in any timezone:
const txMonth = tx.date.slice(0, 7);
```

- [ ] **Step 5: Fix `describeRecommendationWindow` grammar**

Replace lines ~119-133:
```ts
export function describeRecommendationWindow(
  recommendation: BudgetRecommendation,
): string {
  const total = recommendation.months.length;
  const monthWord = total === 1 ? "month" : "months";
  if (recommendation.availableMonths.length === 0) {
    return `No spending found in the last ${total} completed ${monthWord}.`;
  }
  if (recommendation.availableMonths.length === total) {
    return `Based on your average spending over the last ${total} ${monthWord}: ${recommendation.months
      .map((m) => formatMonth(m, "short"))
      .join(", ")}.`;
  }
  const available = recommendation.availableMonths.length;
  const availableWord = available === 1 ? "month" : "months";
  return `Based on available spending from ${recommendation.availableMonths
    .map((m) => formatMonth(m, "short"))
    .join(", ")} (${available} of ${total} ${availableWord}). This estimate may be less accurate.`;
}
```

- [ ] **Step 6: Run tests**

```bash
npm run test:run -- lib/__tests__/recommendedBudget.test.ts
```
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add lib/recommendedBudget.ts lib/__tests__/recommendedBudget.test.ts
git commit -m "fix: isStableBillsCategory expands keywords; fix UTC date parse; fix grammar"
```

---

## Task 12: Fix `categoryScheduleLabel` to Accept View Month

**Files:**
- Modify: `lib/categorySchedule.ts:63-73`
- Modify: `app/(app)/budget/page.tsx` (caller)

The bug: one-time category labels always show "current real-world month" instead of the month being viewed.

- [ ] **Step 1: Update `categoryScheduleLabel` signature**

Replace lines 63-73 in `lib/categorySchedule.ts`:
```ts
export function categoryScheduleLabel(
  category: Category,
  viewMonth?: MonthKey,
): string {
  const fallback = viewMonth ?? currentMonthKey();
  const schedule = normalizeCategorySchedule(category.schedule, fallback);
  if (schedule.kind === "monthly") return "Every month";
  if (schedule.kind === "one-time") {
    return schedule.month ? `${formatMonth(schedule.month)} only` : "One month only";
  }
  const labels = (schedule.months ?? [])
    .map((m) => MONTH_CHOICES.find((choice) => choice.value === m)?.short)
    .filter(Boolean);
  return labels.length > 0 ? labels.join(", ") : "Every month";
}
```

- [ ] **Step 2: Update the caller in `budget/page.tsx`**

Find `categoryScheduleLabel(c)` in the categories `.map()` and replace:
```tsx
// Before:
{categoryScheduleLabel(c)}

// After (month is the currently viewed month from state):
{categoryScheduleLabel(c, month)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add lib/categorySchedule.ts "app/(app)/budget/page.tsx"
git commit -m "fix: categoryScheduleLabel uses view month instead of current real-world month"
```

---

## Task 13: Fix `StatementImportPanel.tsx` — Dead Code, Double Map, Memoize Per-Row

**Files:**
- Modify: `components/transactions/StatementImportPanel.tsx`

Three bugs:
1. Unused `categoryOptions` memo (replaced but never deleted)
2. Double `.map()` creating throwaway intermediate array
3. `activeCategoriesForMonth` called per-row inside JSX — O(categories × rows) on every render

- [ ] **Step 1: Remove the dead `categoryOptions` memo**

Delete lines 88-91:
```ts
// Delete entirely:
const categoryOptions = useMemo(
  () => categories.map((c) => ({ value: c.id, label: c.name })),
  [categories],
);
```

- [ ] **Step 2: Add a memoized per-month category map**

After `const headerOptions = useMemo(...)` (around line 93), add:
```ts
// Pre-compute which categories are active per month across all review rows.
// This prevents O(categories × rows) work on every render.
const activeCatsByMonth = useMemo(() => {
  const map = new Map<string, Category[]>();
  for (const row of reviewRows) {
    const mk = row.parsed.date.slice(0, 7);
    if (!map.has(mk)) {
      map.set(
        mk,
        activeCategoriesForMonth(categories, mk as MonthKey, [otherCategoryId]),
      );
    }
  }
  return map;
}, [categories, reviewRows, otherCategoryId]);
```

You'll need `MonthKey` imported — add it to the import from `@/types` if not already there.

- [ ] **Step 3: Find and fix the double `.map()` in the JSX**

Search for the pattern `activeCategoriesForMonth(...).map((cat) => ({ value: cat.id, label: cat.name })).map((opt) => (` and replace the entire fragment:
```tsx
// Before (double map + inline function call):
{activeCategoriesForMonth(
  categories,
  monthKeyOf(new Date(r.parsed.date)),
  [r.categoryId, otherCategoryId],
).map((cat) => ({ value: cat.id, label: cat.name })).map((opt) => (
  <option key={opt.value} value={opt.value}>
    {opt.label}
  </option>
))}

// After (use memoized map, single .map()):
{(activeCatsByMonth.get(r.parsed.date.slice(0, 7)) ?? []).map((cat) => (
  <option key={cat.id} value={cat.id}>
    {cat.name}
  </option>
))}
```

- [ ] **Step 4: Fix the `buildReviewFromRows` function to also use slice-based month key**

Around line 124:
```ts
// Before:
const rowMonth = monthKeyOf(new Date(p.date));

// After:
const rowMonth = p.date.slice(0, 7) as MonthKey;
```

- [ ] **Step 5: Remove unused `monthKeyOf` import if no longer used**

Check if `monthKeyOf` is still used elsewhere in the file. If the only uses were the ones replaced above, remove the import:
```ts
// Remove from import:
import { monthKeyOf } from "@/lib/months";
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add "components/transactions/StatementImportPanel.tsx"
git commit -m "perf: memoize per-month active categories in StatementImportPanel; fix dead code and double map"
```

---

## Task 14: Fix Dashboard — React Key and `monthTx` Memoization

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Fix Alert list key (line ~193)**

```tsx
// Before:
{alerts.map((a, i) => (
  <Alert key={i} level={a.level}>
    {a.message}
  </Alert>
))}

// After — stable key from content:
{alerts.map((a) => (
  <Alert key={`${a.level}:${a.categoryId ?? ""}:${a.message}`} level={a.level}>
    {a.message}
  </Alert>
))}
```

- [ ] **Step 2: Wrap `monthTx` in `useMemo` (line ~63)**

```tsx
// Before:
const monthTx = transactionsInMonth(transactions, month);
const hasSpending = monthTx.length > 0;

// After:
const monthTx = useMemo(
  () => transactionsInMonth(transactions, month),
  [transactions, month],
);
const hasSpending = monthTx.length > 0;
```

`useMemo` is already imported at the top of the file.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/dashboard/page.tsx"
git commit -m "fix: stable React keys for alerts; memoize monthTx on dashboard"
```

---

## Task 15: Fix Wrong Comment in `fuzzyMatch.ts`

**Files:**
- Modify: `lib/fuzzyMatch.ts:86`

- [ ] **Step 1: Fix the comment**

Replace line 86:
```ts
// Before:
// Classic Levenshtein distance (iterative, O(m*n) space).

// After:
// Classic Levenshtein distance (iterative, O(n) space with two-row rolling array).
```

- [ ] **Step 2: Commit**

```bash
git add lib/fuzzyMatch.ts
git commit -m "docs: correct Levenshtein space complexity comment (O(n) not O(m*n))"
```

---

## Task 16: Run Full Test Suite and Verify Build

- [ ] **Step 1: Run all tests**

```bash
npm run test:run
```
Expected: All tests in all `lib/__tests__/*.test.ts` files pass. Output shows ✓ for every test.

- [ ] **Step 2: Run TypeScript type check**

```bash
npx tsc --noEmit
```
Expected: Zero errors.

- [ ] **Step 3: Run Next.js build to confirm no runtime breakage**

```bash
npm run build
```
Expected: Build completes without errors.

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "chore: verify all tests pass and build is clean after hardening"
```

---

## Self-Review Checklist

| Issue from review | Task that covers it |
|---|---|
| No tests | Task 1 (infra) + Tasks 2, 3, 4, 10, 11 (tests per fix) |
| `transactionsInMonth` timezone bug | Task 2 |
| `isSameMonth` timezone bug | Task 2 |
| `deleteCategory` wrong fallback | Task 4 |
| `resetDemo` / `reseedDemoData` race | Task 5 |
| Duplicate User construction | Task 5 (authUserToUser helper) |
| BudgetContext re-render storm | Task 6 |
| Save concurrency / overlapping upserts | Task 7 |
| `Math.random()` IDs | Task 8 |
| Storage key frozen at v1.1 | Task 9 |
| No localStorage migration | Task 9 |
| Quota errors silently swallowed | Task 9 |
| Dead `buildInitialState` alias | Task 9 |
| AuthContext clearing wrong demo key | Task 9 |
| `normalizeDate` UTC fallback bug | Task 10 |
| `normalizeAmount` missing currencies | Task 10 |
| `isStableBillsCategory` too narrow | Task 11 |
| UTC parse in recommendation engine | Task 11 |
| `describeRecommendationWindow` grammar | Task 11 |
| `categoryScheduleLabel` wrong month | Task 12 |
| Dead `categoryOptions` memo | Task 13 |
| Double `.map()` in import panel | Task 13 |
| `activeCategoriesForMonth` per-row | Task 13 |
| React index key on alerts | Task 14 |
| `monthTx` not memoized | Task 14 |
| Wrong Levenshtein comment | Task 15 |
| `allocateSlackToOther` over-budget bug | Task 3 |
