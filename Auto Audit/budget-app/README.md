# Auto Audit — v1.1

A polished, desktop-first personal budgeting app for students and young adults. Built with Next.js (App Router), TypeScript, Tailwind CSS, and Recharts. v1.1 adds Supabase auth, a "try the demo" path, dark mode, polished empty states, page transitions, and a global toast system on top of the v1.0 prototype.

## Quick start

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Without any Supabase setup the app runs in **demo mode only** — sign-up / login screens render but tell you that auth isn't configured. The "Try the demo" button on the landing page works either way.

## Setting up Supabase (real auth)

1. Create a free project at [supabase.com](https://supabase.com).
2. Copy the project URL and the **anon** public key (Project Settings → API).
3. Add a `.env.local` at the repo root (use `.env.local.example` as a template):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Open the SQL editor in Supabase and paste/run the contents of `supabase/schema.sql`. This creates the tables and Row Level Security policies for transactions, budgets, categories, savings goals, merchant memory, and user settings.
5. (Optional but recommended) In **Authentication → Providers → Email**, decide whether email confirmation is required. For local development it's smoother to disable it; you can re-enable for production.
6. (Optional) In **Authentication → URL Configuration**, set the Redirect URL to `http://localhost:3000/reset-password` so password reset links land on the reset page.

Restart `npm run dev` and the landing page will now show "Get started" / "Sign in" buttons.

## v1.1 — what's new

- **Real authentication via Supabase** — signup, login, password reset, session persistence (`app/(auth)/`).
- **Demo mode** — "Try the demo" loads Alex Carter's 12 months locally without an account. A persistent banner offers signup at any time.
- **Dark mode** — system-preference default + manual toggle in the header. Pre-hydration script avoids the light-mode flash; theme persists in localStorage and (for signed-in users) `user_settings.theme`.
- **Polished empty states** — every "no data yet" surface uses the `EmptyState` component with icon, headline, description, and a clear CTA.
- **Page transitions + micro-interactions** — soft fade/slide on route changes via Framer Motion, staggered fade-ins on dashboard cards, animated progress bars, skeleton loaders for hydration, and a global toast system for action feedback (`components/ui/Toast.tsx`).
- **New-user nudge cards** — brand-new signups land on a friendly three-step setup (set budget / add expense / pick categories) instead of a barren dashboard.
- **`prefers-reduced-motion`** disables all animations and transitions in CSS and Framer Motion.

## Project structure

```
app/
  (auth)/                 - signup / login / forgot / reset (own minimal layout)
  (app)/                  - in-app pages wrapped by AppShell (sidebar + header)
    dashboard/
    add-expense/
    budget/
    transactions/
    summary/
    savings/
    report/
  layout.tsx              - root layout: ThemeProvider → AuthProvider → ToastProvider → BudgetProvider
  page.tsx                - marketing landing page
  globals.css             - Tailwind + dark mode tokens + print + reduced-motion

components/
  auth/                   - shared AuthFormShell
  budget/                 - StatTile, MonthSelector, CategoryProgress
  charts/                 - bars, pie, trend, switcher
  dashboard/              - NudgeCards (new-user)
  layout/                 - AppShell, Sidebar, Header, ThemeToggle, DemoBanner, PageTransition
  savings/                - SavingsGoalCard
  transactions/           - TransactionEditor
  ui/                     - Card, Button, Input, Select, Alert, Badge, Toggle,
                            EmptyState, ProgressBar, Skeleton, Toast

data/
  demoUser.ts             - DEMO_USER (Alex Carter), DEFAULT_CATEGORIES
  demoData.ts             - 12-month deterministic transaction/budget seed

lib/
  AuthContext.tsx         - signIn / signUp / signOut / reset / demo mode
  ThemeContext.tsx        - light / dark / system with manual override
  BudgetContext.tsx       - state mutations, hydrates via the active StorageAdapter
  storage.ts              - StorageAdapter (async) + Local + Supabase implementations
  supabaseClient.ts       - browser Supabase client factory
  budgetCalc.ts           - month summarization, slack allocation, prior-month compare
  alerts.ts               - alert + insight generation (neutral tone)
  fuzzyMatch.ts           - normalize + Levenshtein helpers
  merchantMemory.ts       - exact + fuzzy category suggestions
  months.ts               - month-key helpers
  format.ts               - currency / date / percent

types/
  index.ts                - core models
  auth.ts                 - thin auth-facing aliases

supabase/
  schema.sql              - tables, indexes, RLS policies, updated_at triggers
```

## How auth and storage swap

`BudgetProvider` watches `useAuth().mode` and reloads through the right adapter when it changes:

| Auth mode    | Adapter                  | Initial state                              |
| ------------ | ------------------------ | ------------------------------------------ |
| `loading`    | (none yet)               | demo state placeholder                     |
| `demo`       | `LocalStorageAdapter`    | demo state (Alex Carter)                   |
| `supabase`   | `SupabaseStorageAdapter` | empty authenticated state if no rows yet   |
| `anonymous`  | redirect to `/`          | -                                          |

Adapter calls are async and saves are debounced (~250ms). Supabase saves do per-table upserts/deletes scoped to `user_id`; RLS in Postgres guarantees one user can never read or write another user's rows.

## Adding Advanced Mode (later)

The Advanced Mode toggle in the header is wired to `state.advancedMode` (persisted to `user_settings.advanced_mode`) but doesn't change UI yet. To light it up:

1. In any page, call `useBudget().advancedMode` to know if it's on.
2. Add advanced sections that conditionally render (daily averages, projected month-end totals, raw counts, week-over-week deltas).
3. Optionally, extend `BudgetContext` with derived selectors (e.g. `dailyAverages`, `weekOverWeek`).

## Commands

```bash
npm run dev      # localhost:3000
npm run build    # production build
npm run start    # serve production build
npm run lint     # eslint
npx tsc --noEmit # typecheck only
```

## Notes

- All v1.0 functionality is preserved: merchant memory + fuzzy match, slack-to-Other allocation, carry-forward budgets, prior-month banner, and the printable report.
- The printable report always renders in light tones for paper, regardless of theme.
- Demo data lives in `data/demoData.ts` with a deterministic PRNG so reloads are stable.
- Feel free to remove `DEMO_USER` and the seed builders once you have your own data layer.
