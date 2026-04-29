import type { AppState, User } from "@/types";
import { DEMO_USER, DEFAULT_CATEGORIES } from "@/data/demoUser";
import {
  buildDemoTransactions,
  buildDemoBudgets,
  DEMO_SAVINGS_GOALS,
  DEMO_MERCHANT_MEMORY,
} from "@/data/demoData";
import { getSupabaseClient } from "./supabaseClient";
import { ensureBudgetForMonth } from "./budgetCalc";
import { currentMonthKey } from "./months";

// -----------------------------------------------------------------------------
// Storage abstraction. Pages and components stay decoupled from the adapter.
// LocalStorageAdapter is used for demo mode; SupabaseStorageAdapter is used
// for authenticated users when Supabase env vars are set.
// -----------------------------------------------------------------------------
export interface StorageAdapter {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
  reset(): Promise<void>;
}

// -----------------------------------------------------------------------------
// localStorage — used in demo mode (and for "no auth configured" fallbacks).
// Different namespaces let demo and authenticated state coexist without
// stomping on each other.
// -----------------------------------------------------------------------------
export class LocalStorageAdapter implements StorageAdapter {
  private key: string;
  constructor(namespace: string = "demo") {
    this.key = `auto-audit:v1.1:${namespace}`;
  }

  async load(): Promise<AppState | null> {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw) as AppState;
    } catch {
      return null;
    }
  }

  async save(state: AppState): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(this.key, JSON.stringify(state));
    } catch {
      // ignore quota errors for the prototype
    }
  }

  async reset(): Promise<void> {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(this.key);
  }
}

// -----------------------------------------------------------------------------
// Supabase adapter — used when a real user is signed in.
// load(): assembles AppState from per-user tables.
// save(): upserts the full AppState (small footprint for a personal budget).
// -----------------------------------------------------------------------------
export class SupabaseStorageAdapter implements StorageAdapter {
  constructor(private user: User) {}

  async load(): Promise<AppState | null> {
    const sb = getSupabaseClient();
    if (!sb) return null;
    const uid = this.user.id;

    const [cats, txs, bgs, goals, mem, settings] = await Promise.all([
      sb.from("categories").select("*").eq("user_id", uid).order("sort_order"),
      sb.from("transactions").select("*").eq("user_id", uid),
      sb.from("monthly_budgets").select("*").eq("user_id", uid),
      sb.from("savings_goals").select("*").eq("user_id", uid),
      sb.from("merchant_memory").select("*").eq("user_id", uid),
      sb.from("user_settings").select("*").eq("user_id", uid).maybeSingle(),
    ]);

    // If the user has no categories yet, this is a brand-new account and we
    // return null to signal "needs initial seed".
    if (!cats.data || cats.data.length === 0) return null;

    return {
      user: this.user,
      categories: cats.data.map((row) => ({
        id: row.id,
        name: row.name,
        color: row.color,
        icon: row.icon ?? undefined,
        isDefault: row.is_default ?? false,
        isOther: row.is_other ?? false,
      })),
      transactions: (txs.data ?? []).map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        merchant: row.merchant,
        date: row.occurred_on,
        categoryId: row.category_id,
        note: row.note ?? undefined,
      })),
      budgets: (bgs.data ?? []).map((row) => ({
        month: row.month_key,
        total: Number(row.total),
        categories: (row.per_category ?? {}) as Record<string, number>,
      })),
      savingsGoals: (goals.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        type: row.kind,
        targetAmount: Number(row.target_amount),
        savedAmount: Number(row.saved_amount),
        targetDate: row.target_date ?? undefined,
        createdAt: row.created_at,
      })),
      merchantMemory: (mem.data ?? []).map((row) => ({
        key: row.normalized_merchant,
        displayName: row.display_name ?? row.normalized_merchant,
        categoryId: row.category_id,
        remember: true,
      })),
      advancedMode: settings.data?.advanced_mode ?? false,
    };
  }

  async save(state: AppState): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) return;
    const uid = this.user.id;

    // Categories — upsert and prune deleted
    const catRows = state.categories.map((c, i) => ({
      id: c.id,
      user_id: uid,
      name: c.name,
      color: c.color,
      icon: c.icon ?? null,
      sort_order: i,
      is_default: c.isDefault ?? false,
      is_other: c.isOther ?? false,
    }));
    await sb.from("categories").upsert(catRows, { onConflict: "id" });
    await sb
      .from("categories")
      .delete()
      .eq("user_id", uid)
      .not("id", "in", `(${catRows.map((r) => `"${r.id}"`).join(",") || "null"})`);

    // Transactions
    const txRows = state.transactions.map((t) => ({
      id: t.id,
      user_id: uid,
      amount: t.amount,
      merchant: t.merchant,
      occurred_on: t.date,
      category_id: t.categoryId,
      note: t.note ?? null,
    }));
    if (txRows.length > 0) {
      await sb.from("transactions").upsert(txRows, { onConflict: "id" });
    }
    await sb
      .from("transactions")
      .delete()
      .eq("user_id", uid)
      .not("id", "in", `(${txRows.map((r) => `"${r.id}"`).join(",") || "null"})`);

    // Budgets
    const bgRows = state.budgets.map((b) => ({
      user_id: uid,
      month_key: b.month,
      total: b.total,
      per_category: b.categories,
    }));
    if (bgRows.length > 0) {
      await sb
        .from("monthly_budgets")
        .upsert(bgRows, { onConflict: "user_id,month_key" });
    }

    // Savings goals
    const goalRows = state.savingsGoals.map((g) => ({
      id: g.id,
      user_id: uid,
      name: g.name,
      kind: g.type,
      target_amount: g.targetAmount,
      saved_amount: g.savedAmount,
      target_date: g.targetDate ?? null,
      created_at: g.createdAt,
    }));
    if (goalRows.length > 0) {
      await sb.from("savings_goals").upsert(goalRows, { onConflict: "id" });
    }
    await sb
      .from("savings_goals")
      .delete()
      .eq("user_id", uid)
      .not("id", "in", `(${goalRows.map((r) => `"${r.id}"`).join(",") || "null"})`);

    // Merchant memory — replace strategy: delete then insert (small set)
    await sb.from("merchant_memory").delete().eq("user_id", uid);
    const memRows = state.merchantMemory.map((m) => ({
      user_id: uid,
      normalized_merchant: m.key,
      display_name: m.displayName,
      category_id: m.categoryId,
    }));
    if (memRows.length > 0) {
      await sb.from("merchant_memory").insert(memRows);
    }

    // User settings
    await sb
      .from("user_settings")
      .upsert(
        { user_id: uid, advanced_mode: state.advancedMode },
        { onConflict: "user_id" },
      );
  }

  async reset(): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) return;
    const uid = this.user.id;
    await Promise.all([
      sb.from("transactions").delete().eq("user_id", uid),
      sb.from("monthly_budgets").delete().eq("user_id", uid),
      sb.from("savings_goals").delete().eq("user_id", uid),
      sb.from("merchant_memory").delete().eq("user_id", uid),
      sb.from("categories").delete().eq("user_id", uid),
      sb.from("user_settings").delete().eq("user_id", uid),
    ]);
  }
}

// -----------------------------------------------------------------------------
// State builders
// -----------------------------------------------------------------------------

// Demo: full Alex Carter dataset for "Try the demo" mode.
export function buildDemoState(): AppState {
  const state: AppState = {
    user: DEMO_USER,
    categories: DEFAULT_CATEGORIES,
    transactions: buildDemoTransactions(),
    budgets: buildDemoBudgets(),
    savingsGoals: DEMO_SAVINGS_GOALS,
    merchantMemory: DEMO_MERCHANT_MEMORY,
    advancedMode: false,
  };
  state.budgets = ensureBudgetForMonth(state.budgets, currentMonthKey());
  return state;
}

// Authenticated empty state — for brand-new signups. Clean slate with default
// categories already seeded so the user can start budgeting right away.
export function buildEmptyAuthenticatedState(user: User): AppState {
  return {
    user,
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    transactions: [],
    budgets: [
      {
        month: currentMonthKey(),
        total: 0,
        categories: Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, 0])),
      },
    ],
    savingsGoals: [],
    merchantMemory: [],
    advancedMode: false,
  };
}

// Backwards-compatible alias: the original v1.0 `buildInitialState()` path.
export function buildInitialState(): AppState {
  return buildDemoState();
}
