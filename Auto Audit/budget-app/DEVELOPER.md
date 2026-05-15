# Auto Audit — Developer Guide

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
8. [Auth modes](#8-auth-modes)
9. [Category suggestion pipeline](#9-category-suggestion-pipeline)
10. [Statement import](#10-statement-import)
11. [Supabase schema](#11-supabase-schema)
12. [UI conventions](#12-ui-conventions)
13. [Adding a new page / feature](#13-adding-a-new-page--feature)

---

## 1. Stack & tooling

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| Charts | Recharts 2 |
| Animation | Framer Motion 11 |
| Icons | lucide-react |
| Backend / auth | Supabase (optional — app runs without it in demo mode) |
| CSV parsing | PapaParse |
| PDF parsing | pdfjs-dist |

No test runner is configured yet. `npm run lint` runs ESLint via `eslint-config-next`.

---

## 2. Project layout

```
app/
  (app)/              # Authenticated app shell (sidebar + header)
    dashboard/        # Home — charts, spending overview
    add-expense/      # Manual transaction entry
    transactions/     # Transaction list + statement import
    budget/           # Monthly budget editor
    savings/          # Savings goals
    summary/          # Monthly summary table
    report/           # Trend / category breakdown report
  (auth)/             # Unauthenticated shell (centered card layout)
    login/
    signup/
    forgot-password/
    reset-password/
  layout.tsx          # Root layout — wraps ThemeProvider + AuthProvider + BudgetProvider
  page.tsx            # Root redirect (/ → /dashboard or /login)

components/
  ui/                 # Primitive design-system components (Button, Input, Card, …)
  layout/             # AppShell, Sidebar, Header, ThemeToggle, DemoBanner
  charts/             # BudgetVsActualChart, CategoryPieChart, TrendLineChart, ChartSwitcher
  savings/            # SavingsGoalCard
  auth/               # AuthFormShell
  transactions/       # StatementImportPanel  ← in-progress

lib/
  BudgetContext.tsx   # Global app state + all mutations
  storage.ts          # StorageAdapter interface + Local / Supabase implementations
  AuthContext.tsx     # Auth state + mode detection
  ThemeContext.tsx    # Light/dark theme
  categoryHeuristics.ts  # Regex-based merchant → category fallback
  fuzzyMatch.ts       # Merchant family-key normalization
  merchantMemory.ts   # upsertMemory helper
  budgetCalc.ts       # ensureBudgetForMonth, allocateSlackToOther
  months.ts           # currentMonthKey(), monthKeyOf()
  format.ts           # Currency / date formatters
  alerts.ts           # Budget alert thresholds → BudgetAlert[]
  supabaseClient.ts   # Singleton Supabase client (returns null when env vars absent)

types/
  index.ts            # All shared TypeScript interfaces
  auth.ts             # Auth-specific types

data/
  demoUser.ts         # DEMO_USER + DEFAULT_CATEGORIES
  demoData.ts         # Demo transactions, budgets, savings goals, merchant memory
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

Apply the schema in §11 to that project first.

---

## 4. Architecture overview

```
Browser
  └── AuthContext  (mode: "demo" | "supabase" | "anonymous")
        └── BudgetContext  (AppState + all mutations)
              ├── LocalStorageAdapter   ← demo mode
              └── SupabaseStorageAdapter ← authenticated mode
```

- **`AuthContext`** detects whether Supabase env vars are present and the user is signed in. It exposes `mode` and `user`.
- **`BudgetContext`** picks the right `StorageAdapter` when `mode` or `user` changes, hydrates state from it, then debounces every state change into a `save()` call (250 ms).
- Components only ever call `useBudget()` — they are completely decoupled from the storage backend.

---

## 5. Data model

Defined in `types/index.ts`. All IDs are client-generated (`makeId(prefix)` in BudgetContext).

| Type | Key fields | Notes |
|---|---|---|
| `Transaction` | `id`, `amount`, `merchant`, `date` (ISO), `categoryId` | Positive amounts only in v1 |
| `Category` | `id`, `name`, `color`, `icon?`, `isOther?` | One category must have `isOther: true` — it is the fallback bucket |
| `MonthlyBudget` | `month` (YYYY-MM), `total`, `categories` (Record<id, limit>) | Auto-copied forward when the user enters a new month |
| `SavingsGoal` | `id`, `name`, `type` ("monthly"\|"named"), `targetAmount`, `savedAmount`, `targetDate?` | |
| `MerchantMemoryEntry` | `key` (normalized), `displayName`, `categoryId`, `remember` | Drives auto-fill on Add Expense |
| `AppState` | All of the above + `user` + `advancedMode` | The single serialized blob for LocalStorage; individual tables for Supabase |

**How to extend:** Add new fields to the relevant interface in `types/index.ts`. If the field needs to persist to Supabase, add the column to the relevant table and update the `load()` / `save()` mappings in `SupabaseStorageAdapter`.

---

## 6. State management

All mutable state lives in `BudgetContext` (`lib/BudgetContext.tsx`). Components consume it via `useBudget()`.

### Key design decisions

- **Single `AppState` atom** — the entire state is one object. Mutations use `setState(s => ({ ...s, ... }))` immutable updates.
- **Merchant propagation on category update** — `updateTransaction` re-categorizes all transactions from the same merchant family when the category changes, and writes the new mapping to `merchantMemory`.
- **`otherCategoryId`** — a memoized shortcut to the `isOther` category; used by `allocateSlackToOther` to absorb leftover budget slack.
- **`isEmptyAccount`** — derived flag (no transactions + no budget) used to show empty-state prompts.
- **Debounced save** — every state update schedules a 250 ms `adapter.save()`. Errors surface as a danger toast; identical consecutive errors are de-duped.

### Adding a new mutation

1. Add the operation to `BudgetContextValue` interface.
2. Implement it as a `useCallback` inside `BudgetProvider`.
3. Include it in the `value` object at the bottom of `BudgetProvider`.

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

- Key: `auto-audit:v1.1:<namespace>` (`demo` or `anonymous`).
- No migration logic — if the shape changes, the old blob is silently dropped and the app reseeds.
- Safe to call server-side (guards on `typeof window`).

### `SupabaseStorageAdapter`

- `load()` reads six tables in parallel. Returns `null` (new account) if the user has no categories, which triggers a seed in `BudgetContext`.
- `save()` upserts all tables. Upsert order matters: categories before transactions (FK), transactions before category prune.
- Deletes are computed via diff (`pruneDeleted`) to avoid the empty-IN-list footgun (which would delete all rows).
- Merchant memory uses a delete-then-insert strategy (small set, avoids stale key conflicts).

**How to extend:** To add a new persisted collection, add a new table, map it in `load()` and `save()`, and add a prune call if rows can be deleted by the user.

---

## 8. Auth modes

`AuthContext` (`lib/AuthContext.tsx`) sets one of three modes:

| Mode | When | Storage |
|---|---|---|
| `demo` | Supabase not configured, or user clicks "Try demo" | `LocalStorageAdapter("demo")` |
| `supabase` | Supabase configured + user signed in | `SupabaseStorageAdapter` |
| `anonymous` | Supabase configured but no session | Transient; `(app)` routes redirect to `/login` |

The `DemoBanner` component renders when `mode === "demo"` to make the distinction clear.

---

## 9. Category suggestion pipeline

When a user types a merchant name on the Add Expense page, the app suggests a category in three priority tiers:

```
1. Exact merchant memory match       (lib/merchantMemory.ts)
   ↓ miss
2. Fuzzy family-key match            (lib/fuzzyMatch.ts — strips numbers/punctuation)
   ↓ miss
3. Regex heuristics                  (lib/categoryHeuristics.ts)
   ↓ miss
→  No suggestion / user picks manually
```

- **`merchantFamilyKey(name)`** normalizes merchant names to a family key by lowercasing, stripping trailing numbers/location codes, and collapsing whitespace. `"STARBUCKS #1234 COLUMBIA SC"` and `"Starbucks"` resolve to the same key.
- **`suggestCategoryByHeuristic`** runs ordered regex buckets (`Food`, `Transportation`, `Bills`, `Fun`) and maps the bucket to the user's category list by name synonyms. It never invents categories the user doesn't have.

**How to extend:**
- New brand patterns → add a `RegExp` to the relevant bucket in `HEURISTICS`.
- New bucket → add to `HeuristicBucket`, add patterns + synonyms, add entry to `HEURISTICS` and `NAME_SYNONYMS`.

---

## 10. Statement import

**Files:** `lib/csvImport.ts`, `lib/pdfImport.ts`, `components/transactions/StatementImportPanel.tsx`

The import panel (in-progress as of v1.2.0) parses bank statements into `Transaction[]` and bulk-inserts them via `addTransaction`.

- **CSV** — PapaParse with header detection. Column names are normalized (lowercase, trim) before mapping to `{ date, amount, merchant }`.
- **PDF** — pdfjs-dist text extraction. Text is chunked into lines and matched against common bank statement layouts.

After parsing, each imported transaction runs through the full category suggestion pipeline (§9) so amounts arrive pre-categorized where possible.

**How to extend:** Add a new parser function that returns `ParsedTransaction[]` (see `lib/csvImport.ts` for the shape), then wire it into `StatementImportPanel`.

---

## 11. Supabase schema

```sql
-- Run once per project. Enable Row-Level Security on all tables.

create table categories (
  id           text primary key,
  user_id      uuid references auth.users not null,
  name         text not null,
  color        text not null,
  icon         text,
  sort_order   int default 0,
  is_default   boolean default false,
  is_other     boolean default false
);

create table transactions (
  id           text primary key,
  user_id      uuid references auth.users not null,
  amount       numeric not null,
  merchant     text not null,
  occurred_on  date not null,
  category_id  text references categories(id),
  note         text
);

create table monthly_budgets (
  user_id      uuid references auth.users not null,
  month_key    text not null,             -- format: YYYY-MM
  total        numeric not null default 0,
  per_category jsonb not null default '{}',
  primary key (user_id, month_key)
);

create table savings_goals (
  id            text primary key,
  user_id       uuid references auth.users not null,
  name          text not null,
  kind          text not null,            -- 'monthly' | 'named'
  target_amount numeric not null,
  saved_amount  numeric not null default 0,
  target_date   date,
  created_at    timestamptz default now()
);

create table merchant_memory (
  user_id             uuid references auth.users not null,
  normalized_merchant text not null,
  display_name        text,
  category_id         text references categories(id),
  primary key (user_id, normalized_merchant)
);

create table user_settings (
  user_id       uuid primary key references auth.users,
  advanced_mode boolean default false
);

-- RLS: each user can only see their own rows.
alter table categories      enable row level security;
alter table transactions     enable row level security;
alter table monthly_budgets  enable row level security;
alter table savings_goals    enable row level security;
alter table merchant_memory  enable row level security;
alter table user_settings    enable row level security;

create policy "own rows" on categories      for all using (auth.uid() = user_id);
create policy "own rows" on transactions     for all using (auth.uid() = user_id);
create policy "own rows" on monthly_budgets  for all using (auth.uid() = user_id);
create policy "own rows" on savings_goals    for all using (auth.uid() = user_id);
create policy "own rows" on merchant_memory  for all using (auth.uid() = user_id);
create policy "own rows" on user_settings    for all using (auth.uid() = user_id);
```

---

## 12. UI conventions

- **Primitive components** live in `components/ui/`. Always reach for one of these before writing inline JSX — `Button`, `Input`, `Select`, `Card`, `Badge`, `Alert`, `Toast`, `ProgressBar`, `Skeleton`, `EmptyState`, `Toggle`, `DatePicker`.
- **Theme** — dark/light via `ThemeContext`. Use Tailwind `dark:` variants; do not hard-code colors.
- **Toasts** — use `useToast()` from `components/ui/Toast`. Methods: `toast.success`, `toast.danger`, `toast.info`.
- **Page transitions** — wrap page content in `<PageTransition>` for consistent enter animations.
- **Loading skeletons** — check `hydrated` from `useBudget()` and render `<Skeleton>` placeholders until `true`.
- **Empty states** — use `<EmptyState>` with an icon, title, and optional action button.
- **Icons** — import directly from `lucide-react`. Pick the most semantically accurate icon; don't add icons purely for decoration.

---

## 13. Adding a new page / feature

1. **Create the route** — add `app/(app)/<name>/page.tsx`. The `(app)` group automatically wraps it in the sidebar + header shell.
2. **Add to the sidebar** — update `components/layout/Sidebar.tsx` with the new nav item (icon + label + href).
3. **Read state** — call `useBudget()` and destructure what you need. Do not duplicate state locally.
4. **Write state** — call the relevant mutation from `useBudget()` (`addTransaction`, `upsertBudget`, etc.). If no mutation exists, add one (§6).
5. **Persist new data shapes** — if the feature needs a new data type, update `types/index.ts`, `AppState`, both storage adapters, and demo data (§5, §7, §11).
6. **Suggest categories** — if the feature involves merchant input, pipe it through `suggestCategoryByHeuristic` then merchant memory for consistency (§9).
