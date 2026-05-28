# Auto Audit — Developer Guide (v1.4.0)

> Keep this file up to date as features are added. Each major section has a "How to extend" note.

---

## Table of Contents

1. [Stack & tooling](#1-stack--tooling)
2. [Project layout](#2-project-layout)
3. [Running locally](#3-running-locally)
4. [Architecture overview](#4-architecture-overview)
5. [Data model](#5-data-model)
6. [State management](#6-state-management)
7. [Storage layer](#7-storage-layer)
8. [Auth modes & route protection](#8-auth-modes--route-protection)
9. [Category suggestion pipeline](#9-category-suggestion-pipeline)
10. [Statement import](#10-statement-import)
11. [Budget recommendations](#11-budget-recommendations)
12. [Category scheduling](#12-category-scheduling)
13. [Supabase schema](#13-supabase-schema)
14. [Security](#14-security)
15. [Testing](#15-testing)
16. [UI conventions](#16-ui-conventions)
17. [Adding a new page / feature](#17-adding-a-new-page--feature)

---

## 1. Stack & tooling

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 3 |
| Charts | Recharts 2 |
| Animation | Framer Motion 11 |
| Icons | lucide-react |
| Backend / auth | Supabase (optional — app runs without it in demo mode) |
| CSV parsing | PapaParse |
| PDF parsing | pdfjs-dist (worker served from `/public/pdf.worker.min.mjs`) |
| Test runner | Vitest 1.x + @testing-library/react + jsdom |

**Scripts:**

```bash
npm run dev           # Dev server at http://localhost:3000
npm run build         # Production build
npm run lint          # ESLint via eslint-config-next
npm run test          # Vitest watch mode
npm run test:run      # Vitest single run
npm run test:coverage # Coverage report
```

---

## 2. Project layout

```
middleware.ts           # Server-side auth guard (redirects unauthenticated requests)

app/
  (app)/                # Authenticated app shell (sidebar + header)
    dashboard/          # Home — charts, spending overview
    add-expense/        # Manual transaction entry
    transactions/       # Transaction list + statement import
    budget/             # Monthly budget editor
    savings/            # Savings goals
    summary/            # Monthly summary table
    report/             # Trend / category breakdown report
    layout.tsx          # App shell layout
  (auth)/               # Unauthenticated shell (centered card layout)
    login/
    signup/
    forgot-password/
    reset-password/
  layout.tsx            # Root layout — wraps ThemeProvider + AuthProvider + BudgetProvider
  page.tsx              # Landing page (demo mode entry point)

components/
  ui/                   # Primitive design-system components (Button, Input, Card, …)
  layout/               # AppShell, Sidebar, Header, ThemeToggle, DemoBanner
  charts/               # BudgetVsActualChart, CategoryPieChart, TrendLineChart, ChartSwitcher
  budget/               # MonthSelector
  savings/              # SavingsGoalCard
  auth/                 # AuthFormShell
  transactions/         # StatementImportPanel

lib/
  BudgetContext.tsx     # Global app state + all mutations
  storage.ts            # StorageAdapter interface + Local / Supabase implementations
  AuthContext.tsx       # Auth state + mode detection + demo cookie sync
  ThemeContext.tsx       # Light/dark theme
  budgetCalc.ts         # ensureBudgetForMonth, allocateSlackToOther, summarizeMonth
  months.ts             # currentMonthKey(), monthKeyOf(), isSameMonth() — all timezone-safe
  format.ts             # Currency / date formatters
  alerts.ts             # Budget alert thresholds → BudgetAlert[]
  categoryHeuristics.ts # Regex-based merchant → category fallback
  fuzzyMatch.ts         # Merchant family-key normalization
  merchantMemory.ts     # upsertMemory helper
  categorySchedule.ts   # CategorySchedule type helpers + activeCategoriesForMonth
  recommendedBudget.ts  # buildBudgetRecommendation — spending-history-based suggestions
  csvImport.ts          # CSV → ParsedCsvRow[] (timezone-safe date parsing)
  pdfImport.ts          # PDF → ParsedCsvRow[] via pdfjs-dist
  supabaseClient.ts     # Singleton Supabase browser client (null when env vars absent)

  __tests__/            # Vitest unit tests
    months.test.ts
    budgetCalc.test.ts
    csvImport.test.ts
    recommendedBudget.test.ts
    storage.test.ts

types/
  index.ts              # All shared TypeScript interfaces (Category, Transaction, …)
  auth.ts               # Auth-specific types

data/
  demoUser.ts           # DEMO_USER + DEFAULT_CATEGORIES
  demoData.ts           # Demo transactions, budgets, savings goals, merchant memory

public/
  pdf.worker.min.mjs    # PDF.js worker (copied from pdfjs-dist at install time — do not edit)
```

---

## 3. Running locally

```bash
cd "Auto Audit/budget-app"
npm install
npm run dev          # http://localhost:3000
```

The app works fully without Supabase — it falls back to **demo mode** (see §8).

To wire up a real Supabase project, create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Apply the schema in §13 to that project first, then run the app.

**Updating the PDF worker:** If you upgrade `pdfjs-dist`, copy the new worker to `public/`:
```bash
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/
```

---

## 4. Architecture overview

```
Next.js Middleware (middleware.ts)
  └── Server-side auth check before any (app)/* page renders
        ↓ passes through if: Supabase session OR auto-audit-demo cookie present

Browser
  └── AuthContext  (mode: "demo" | "supabase" | "anonymous")
        └── BudgetContext  (AppState + all mutations)
              ├── LocalStorageAdapter("demo")          ← demo mode
              ├── LocalStorageAdapter("anonymous",true) ← read-only, never persists
              └── SupabaseStorageAdapter               ← authenticated mode
```

- **`middleware.ts`** runs on the Edge before any `/(app)/` page renders. It checks for a Supabase session (via `@supabase/ssr`) or the `auto-audit-demo` cookie. Unauthenticated requests redirect to `/`.
- **`AuthContext`** detects auth mode and exposes `mode`, `user`, and auth actions. It syncs the demo flag to both `localStorage` and a cookie so the middleware can see it.
- **`BudgetContext`** picks the right `StorageAdapter` when `mode` or `user` changes, hydrates state from it, then debounces every state mutation into a `save()` call (250 ms). A save-concurrency mechanism serializes overlapping saves so the DB is never written out of order.
- Components only ever call `useBudget()` — they are completely decoupled from the storage backend.

---

## 5. Data model

Defined in `types/index.ts`. All client-generated IDs use `makeId(prefix)` which calls `crypto.randomUUID()` with a fallback for non-HTTPS environments.

| Type | Key fields | Notes |
|---|---|---|
| `Transaction` | `id`, `amount`, `merchant`, `date` (YYYY-MM-DD), `categoryId` | Positive amounts only. Date stored as bare ISO date string — never parse with `new Date(date)` (UTC trap); use `.slice(0, 7)` for month comparison. |
| `Category` | `id`, `name`, `color`, `isOther?`, `isDefault?`, `schedule?` | One category must have `isOther: true` — it is the fallback bucket and **cannot be deleted**. `schedule` controls which months the category is active. |
| `CategorySchedule` | `kind: "monthly" \| "one-time" \| "selected-months"` | Exported from `types/index.ts`. Use helpers in `lib/categorySchedule.ts`. |
| `MonthlyBudget` | `month` (YYYY-MM), `total`, `categories` (Record<id, limit>) | Auto-copied forward when the user enters a new month. |
| `SavingsGoal` | `id`, `name`, `type`, `targetAmount`, `savedAmount`, `targetDate?` | |
| `MerchantMemoryEntry` | `key` (normalized), `displayName`, `categoryId`, `remember` | Drives auto-fill on Add Expense. |
| `AppState` | All of the above + `user` + `advancedMode` | Single blob for localStorage; individual tables for Supabase. |

**How to extend:** Add new fields to the relevant interface in `types/index.ts`. If persisting to Supabase, add the column and update `load()` / `save()` in `SupabaseStorageAdapter`.

---

## 6. State management

All mutable state lives in `BudgetContext` (`lib/BudgetContext.tsx`). Components consume it via `useBudget()`.

### Key design decisions

- **Single `AppState` atom** — the entire state is one object. Mutations use `setState(s => ({ ...s, ... }))` immutable-update style.
- **Context value memoized** — the `value` object passed to `<BudgetContext.Provider>` is wrapped in `useMemo` with a full dependency array to prevent cascade re-renders across all consumers.
- **Debounced save with concurrency control** — every state change schedules a 250 ms `adapter.save()`. If a save is already in flight, the latest state is stashed in `pendingStateRef` and flushed when the in-flight save finishes. This serializes writes and prevents DB races.
- **Mode-switch safety** — each scheduled save captures a `saveKey` (the current `lastModeRef`). If the mode changes before the 250 ms fires, the save is silently aborted. The adapter is also nulled immediately when hydration starts, so stale saves can't slip through.
- **Merchant propagation on category change** — `updateTransaction` re-categorizes all transactions from the same merchant family when the category changes, and writes the new mapping to `merchantMemory`.
- **`otherCategoryId`** — a memoized shortcut to the `isOther` category id. Used by `allocateSlackToOther` and as the import fallback. The Other category cannot be deleted.
- **`isEmptyAccount`** — derived flag (no transactions + no real budget) used to show empty-state prompts.

### Adding a new mutation

1. Add the operation signature to the `BudgetContextValue` interface.
2. Implement it as a `useCallback` inside `BudgetProvider`.
3. Add it to the `value` `useMemo` object and its dependency array.

---

## 7. Storage layer

`lib/storage.ts` exports a `StorageAdapter` interface:

```ts
interface StorageAdapter {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
  reset(): Promise<void>;
}
```

### `LocalStorageAdapter`

- Current key: `auto-audit:v1.4:<namespace>` (`demo` or `anonymous`).
- **Migration:** on `load()`, checks legacy keys `v1.1` → `v1.3` (newest first), migrates data to the current key, and removes the old key.
- **Quota errors** are thrown (not swallowed), so the debounced save can surface them as a toast.
- The `anonymous` adapter is constructed with `readOnly: true` — its `save()` and `reset()` are no-ops, so transient sessions never write to localStorage.

**When bumping the storage version:**
1. Add the previous version string to `LEGACY_STORAGE_VERSIONS` in `storage.ts`.
2. Update `CURRENT_STORAGE_VERSION` to the new value.
3. If the data shape changed, add a transform inside the migration loop in `load()`.

### `SupabaseStorageAdapter`

- `load()` reads six tables in parallel via `Promise.all`. Throws on any read error (prevents "new account" false positive from overwriting real data). Returns `null` only when the user genuinely has no categories.
- `save()` upserts all tables. Order matters: categories before transactions (FK constraint), transactions before category prune. Includes a **user-id guard** at the top — throws immediately if `state.user.id !== this.user.id` to prevent cross-account writes from stale state.
- `pruneDeleted()` computes a diff against the DB and only deletes rows that are missing from the snapshot. Never uses `NOT IN` with an empty array (which would delete everything).
- **Merchant memory** uses a diff-based upsert (no more delete-all gap): upserts current rows on conflict `(user_id, normalized_merchant)`, then deletes only keys absent from the snapshot.

**How to extend:** Add a new table, map it in `load()` and `save()`, and add a `pruneDeleted` call if rows can be deleted.

---

## 8. Auth modes & route protection

### Modes

`AuthContext` (`lib/AuthContext.tsx`) resolves one of three modes:

| Mode | When | Storage |
|---|---|---|
| `demo` | "Try demo" clicked, or no Supabase configured | `LocalStorageAdapter("demo")` |
| `supabase` | Supabase configured + user signed in | `SupabaseStorageAdapter` |
| `anonymous` | Supabase configured, no session | `LocalStorageAdapter("anonymous", true)` — read-only |

### Server-side route protection (`middleware.ts`)

`middleware.ts` runs on the Next.js Edge Runtime before any `/(app)/` page renders. It:
1. Checks for the `auto-audit-demo=1` cookie → allows through
2. Creates a Supabase server client via `@supabase/ssr` and calls `auth.getUser()` → allows through if a valid session exists
3. Otherwise redirects to `/`

**Cookie sync:** `AuthContext` writes/clears the `auto-audit-demo` cookie alongside its `localStorage` flag whenever demo mode is entered or exited, or when a real sign-in/sign-out occurs.

The `DemoBanner` component renders when `mode === "demo"` to make the distinction clear to the user.

---

## 9. Category suggestion pipeline

When a user types a merchant name (Add Expense page or statement import), the app suggests a category in three priority tiers:

```
1. Exact merchant memory match       (lib/merchantMemory.ts)
   ↓ miss
2. Fuzzy family-key match            (lib/fuzzyMatch.ts)
   ↓ miss
3. Regex heuristics                  (lib/categoryHeuristics.ts)
   ↓ miss
→  Falls back to the "Other" category
```

- **`merchantFamilyKey(name)`** normalizes merchant names by lowercasing, stripping trailing numbers/location codes, and collapsing whitespace. `"STARBUCKS #1234 COLUMBIA SC"` → `"starbucks"`.
- **`suggestCategoryByHeuristic`** runs ordered regex buckets and maps to the user's actual category list by name synonyms. Never invents categories the user doesn't have.

**How to extend:** New brand → add to the relevant bucket in `HEURISTICS`. New bucket → add to `HeuristicBucket`, add patterns + synonyms.

---

## 10. Statement import

**Files:** `lib/csvImport.ts`, `lib/pdfImport.ts`, `components/transactions/StatementImportPanel.tsx`

### Date parsing (timezone-safe)

All dates from imports are stored as bare `YYYY-MM-DD` strings. **Never parse them with `new Date("YYYY-MM-DD")`** — this parses as UTC midnight, which shifts to the previous day in negative-offset timezones. Use string slicing instead:

```ts
// Correct month comparison:
date.slice(0, 7) === "2025-03"   // ✓
monthKeyOf(new Date(date)) === "2025-03"  // ✗ — UTC trap
```

### Row ID generation

CSV/PDF row IDs are generated by `nextCsvRowId()` in `csvImport.ts` — a module-level counter that guarantees uniqueness within a parse session with zero collision risk. Do not use `Math.random()` for IDs.

### PDF worker

The pdfjs-dist worker is served from `/public/pdf.worker.min.mjs` to avoid CDN dependencies. If you upgrade `pdfjs-dist`, copy the new worker file (see §3).

**How to extend:** Add a new parser function returning `ParsedCsvRow[]`, then wire it into `StatementImportPanel`.

---

## 11. Budget recommendations

**File:** `lib/recommendedBudget.ts`

`buildBudgetRecommendation({ categories, transactions, fromMonth, monthCount? })` analyzes the last N completed months of spending per category and returns a recommended budget with cushion:

- **Standard categories:** 10% cushion (`STANDARD_CUSHION_RATE`)
- **Stable bills** (rent, mortgage, insurance, subscriptions, loans, etc.): 5% cushion (`STABLE_BILLS_CUSHION_RATE`)
- Amounts are rounded to the nearest $5 (< $100) or $10 (≥ $100) via `roundBudgetAmount()`

`isStableBillsCategory(category)` detects stable-bills categories by keyword matching on the category name.

---

## 12. Category scheduling

**File:** `lib/categorySchedule.ts`

Categories support an optional `schedule?: CategorySchedule` field that controls which months they appear:

| Schedule kind | When active |
|---|---|
| `"monthly"` (default) | Every month |
| `"one-time"` | One specific month (`month: MonthKey`) |
| `"selected-months"` | Specific months of the year (`months: number[]`) |

**Key helpers:**
- `isCategoryActiveInMonth(category, month)` — returns `true` if the category should appear in a given month
- `activeCategoriesForMonth(categories, month, includeIds?)` — filters to active categories, always including `includeIds` regardless of schedule
- `categoryScheduleLabel(category, viewMonth?)` — human-readable schedule description; pass the viewed month so one-time labels are accurate

---

## 13. Supabase schema

The canonical schema lives in `supabase/schema.sql`. Run it once per project in the Supabase SQL editor. It creates all tables, indexes, RLS policies, and `updated_at` triggers.

**Tables:** `categories`, `transactions`, `monthly_budgets`, `savings_goals`, `merchant_memory`, `user_settings`

**RLS:** Every table has per-operation policies scoped to `auth.uid() = user_id`. The Supabase anon key is safe to expose client-side because RLS enforces row ownership.

**Pending migration (not yet applied):** A future migration should add a composite unique constraint on `categories(user_id, id)` and change the `transactions.category_id` FK to reference `(user_id, category_id)` for stronger cross-user referential integrity.

---

## 14. Security

### Headers

`next.config.js` sets the following security headers on every response:

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` (no iframing) |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Blocks camera, microphone, geolocation |
| `Content-Security-Policy` | `default-src 'self'`; Supabase origins allowed for `connect-src`; `worker-src 'self' blob:` for PDF.js |

### Input validation

All numeric inputs use `Number.isFinite(v) && v >= 0` — never bare `parseFloat(...) || 0`, which accepts `Infinity`, `NaN`, and negative values silently.

### Category colors

Inline `style={{ backgroundColor }}` for category colors is guarded by a `safeColor()` helper that rejects any value not matching `/^#[0-9a-f]{6}$/i`.

### ID generation

All entity IDs use `makeId(prefix)` → `crypto.randomUUID()` with a `Date.now + Math.random` fallback for non-HTTPS environments.

---

## 15. Testing

**Runner:** Vitest 1.x with `@testing-library/react`, `jsdom`, and `@testing-library/jest-dom`.

**Test files:** `lib/__tests__/*.test.ts`

| File | What it covers |
|---|---|
| `months.test.ts` | Timezone-safe date helpers, UTC midnight edge case |
| `budgetCalc.test.ts` | `transactionsInMonth`, `allocateSlackToOther`, `ensureBudgetForMonth` |
| `csvImport.test.ts` | `normalizeDate` (all formats), `normalizeAmount` (multi-currency) |
| `recommendedBudget.test.ts` | Cushion rates, rounding, actual recommended values, UTC parse |
| `storage.test.ts` | LocalStorage versioning and legacy migration |

**Running tests:**
```bash
npm run test:run      # single run — used in CI
npm run test          # watch mode
npm run test:coverage # coverage report
```

**When to add tests:** Every bug fix in `lib/` should have a test that fails before the fix and passes after. Tests live in `lib/__tests__/` alongside the source files.

---

## 16. UI conventions

- **Primitive components** live in `components/ui/`. Always use these before writing inline JSX — `Button`, `Input`, `Select`, `Card`, `Badge`, `Alert`, `Toast`, `ProgressBar`, `Skeleton`, `EmptyState`, `Toggle`, `DatePicker`.
- **Theme** — dark/light via `ThemeContext`. Use Tailwind `dark:` variants; do not hard-code colors.
- **Toasts** — use `useToast()` from `components/ui/Toast`. Methods: `toast.success`, `toast.info`, `toast.warn`, `toast.danger`.
- **Loading skeletons** — check `hydrated` from `useBudget()` and render a skeleton `<div>` until `true`. Do **not** return `null` — it causes a blank flash.
- **Empty states** — use `<EmptyState>` with an icon, title, and optional action button.
- **Destructive actions** — always require `window.confirm`. For bulk deletes, consider a toast with an undo action.
- **Icons** — import directly from `lucide-react`. Don't add icons purely for decoration.

---

## 17. Adding a new page / feature

1. **Create the route** — add `app/(app)/<name>/page.tsx`. The `(app)` group wraps it in the sidebar + header shell automatically.
2. **Protect the route** — it's automatically protected by `middleware.ts` since it's under `/(app)/`. No extra config needed.
3. **Add to the sidebar** — update `components/layout/Sidebar.tsx` with the new nav item.
4. **Read state** — call `useBudget()` and destructure what you need. Do not duplicate state locally.
5. **Write state** — call the relevant mutation from `useBudget()`. If no mutation exists, add one (§6).
6. **Handle loading** — guard on `hydrated` and render a skeleton instead of `null`.
7. **Persist new data shapes** — update `types/index.ts`, `AppState`, both storage adapters, and demo data (§5, §7, §13).
8. **Suggest categories** — if the feature involves merchant input, pipe it through `suggestCategoryByHeuristic` → merchant memory (§9).
9. **Write a test** — add a `lib/__tests__/<module>.test.ts` for any new `lib/` logic (§15).
