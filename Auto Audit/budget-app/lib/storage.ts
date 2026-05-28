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
export const CURRENT_STORAGE_VERSION = "v1.4";
export const LEGACY_STORAGE_VERSIONS = ["v1.1", "v1.2", "v1.3"] as const;

export class LocalStorageAdapter implements StorageAdapter {
  private readonly namespace: string;
  private readonly readOnly: boolean;

  constructor(namespace: string = "demo", readOnly = false) {
    this.namespace = namespace;
    this.readOnly = readOnly;
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
      const raw = window.localStorage.getItem(this.currentKey);
      if (raw) return JSON.parse(raw) as AppState;

      // Migrate from legacy versions — newest first so we get the freshest data
      for (const version of [...LEGACY_STORAGE_VERSIONS].reverse()) {
        const legacyRaw = window.localStorage.getItem(this.legacyKey(version));
        if (legacyRaw) {
          window.localStorage.setItem(this.currentKey, legacyRaw);
          window.localStorage.removeItem(this.legacyKey(version));
          return JSON.parse(legacyRaw) as AppState;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  async save(state: AppState): Promise<void> {
    if (this.readOnly) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(this.currentKey, JSON.stringify(state));
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED")
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
    if (this.readOnly) return;
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(this.currentKey);
    for (const version of LEGACY_STORAGE_VERSIONS) {
      window.localStorage.removeItem(this.legacyKey(version));
    }
  }
}

function categoryIdForUser(userId: string, categoryId: string): string {
  return `${userId}-${categoryId}`;
}

function defaultCategoriesForUser(user: User) {
  return DEFAULT_CATEGORIES.map((category) => ({
    ...category,
    id: categoryIdForUser(user.id, category.id),
  }));
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

    // Throw on read errors so the caller doesn't accidentally treat "load
    // failed" as "fresh account, please reseed" and overwrite real data.
    const firstError =
      cats.error || txs.error || bgs.error || goals.error || mem.error || settings.error;
    if (firstError) throw new Error(`load failed: ${firstError.message}`);

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
    };
  }

  async save(state: AppState): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) return;
    const uid = this.user.id;

    // Safety guard: refuse to overwrite a different user's data if the
    // adapter was somehow invoked with a stale snapshot.
    if (state.user.id !== uid) {
      throw new Error(
        `save() called with state for user ${state.user.id} but adapter is for ${uid}`,
      );
    }

    // -------------------------------------------------------------------------
    // Categories — upsert first so any new transaction.category_id references
    // exist before we touch the transactions table.
    // -------------------------------------------------------------------------
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
    if (catRows.length > 0) {
      const { error } = await sb
        .from("categories")
        .upsert(catRows, { onConflict: "id" });
      if (error) throw new Error(`categories upsert: ${error.message}`);
    }

    // -------------------------------------------------------------------------
    // Transactions — upsert current rows, then prune any rows that no longer
    // exist in app state. We compute the diff explicitly (vs. the dangerous
    // string-interpolated `not.id.in.(...)` filter that used to live here)
    // because an empty IN list silently deletes everything.
    // -------------------------------------------------------------------------
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
      const { error } = await sb
        .from("transactions")
        .upsert(txRows, { onConflict: "id" });
      if (error) throw new Error(`transactions upsert: ${error.message}`);
    }
    await pruneDeleted(sb, "transactions", uid, state.transactions.map((t) => t.id));

    // Categories prune AFTER transactions, so FK constraints are satisfied.
    await pruneDeleted(sb, "categories", uid, state.categories.map((c) => c.id));

    // -------------------------------------------------------------------------
    // Budgets
    // -------------------------------------------------------------------------
    const bgRows = state.budgets.map((b) => ({
      user_id: uid,
      month_key: b.month,
      total: b.total,
      per_category: b.categories,
    }));
    if (bgRows.length > 0) {
      const { error } = await sb
        .from("monthly_budgets")
        .upsert(bgRows, { onConflict: "user_id,month_key" });
      if (error) throw new Error(`monthly_budgets upsert: ${error.message}`);
    }
    // Prune budget rows for months no longer in state.
    {
      const keepMonths = new Set(state.budgets.map((b) => b.month));
      const { data: existing, error: selErr } = await sb
        .from("monthly_budgets")
        .select("month_key")
        .eq("user_id", uid);
      if (selErr) throw new Error(`monthly_budgets prune select: ${selErr.message}`);
      const toDelete = (existing ?? [])
        .map((r) => (r as { month_key: string }).month_key)
        .filter((m) => !keepMonths.has(m));
      if (toDelete.length > 0) {
        const { error: delErr } = await sb
          .from("monthly_budgets")
          .delete()
          .eq("user_id", uid)
          .in("month_key", toDelete);
        if (delErr) throw new Error(`monthly_budgets prune delete: ${delErr.message}`);
      }
    }

    // -------------------------------------------------------------------------
    // Savings goals
    // -------------------------------------------------------------------------
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
      const { error } = await sb
        .from("savings_goals")
        .upsert(goalRows, { onConflict: "id" });
      if (error) throw new Error(`savings_goals upsert: ${error.message}`);
    }
    await pruneDeleted(sb, "savings_goals", uid, state.savingsGoals.map((g) => g.id));

    // -------------------------------------------------------------------------
    // Merchant memory — diff-based upsert (avoids delete-all gap).
    // -------------------------------------------------------------------------
    {
      const memRows = state.merchantMemory.map((m) => ({
        user_id: uid,
        normalized_merchant: m.key,
        display_name: m.displayName,
        category_id: m.categoryId,
        last_seen_at: new Date().toISOString(),
      }));
      if (memRows.length > 0) {
        const { error: upsErr } = await sb
          .from("merchant_memory")
          .upsert(memRows, { onConflict: "user_id,normalized_merchant" });
        if (upsErr) throw new Error(`merchant_memory upsert: ${upsErr.message}`);
      }
      // Prune keys no longer in app state.
      const keepKeys = new Set(state.merchantMemory.map((m) => m.key));
      const { data: existingMem, error: selErr } = await sb
        .from("merchant_memory")
        .select("normalized_merchant")
        .eq("user_id", uid);
      if (selErr) throw new Error(`merchant_memory prune select: ${selErr.message}`);
      const toDelete = (existingMem ?? [])
        .map((r) => (r as { normalized_merchant: string }).normalized_merchant)
        .filter((k) => !keepKeys.has(k));
      if (toDelete.length > 0) {
        const { error: delErr } = await sb
          .from("merchant_memory")
          .delete()
          .eq("user_id", uid)
          .in("normalized_merchant", toDelete);
        if (delErr) throw new Error(`merchant_memory prune delete: ${delErr.message}`);
      }
    }

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
// Helper: delete rows from `table` for `userId` whose ids aren't in keepIds.
// Computes the diff against the database to avoid the dangerous
// `not.id.in.(...)` empty-list edge case (which deletes everything).
// -----------------------------------------------------------------------------
async function pruneDeleted(
  sb: NonNullable<ReturnType<typeof getSupabaseClient>>,
  table: "categories" | "transactions" | "savings_goals",
  userId: string,
  keepIds: string[],
): Promise<void> {
  const { data, error } = await sb.from(table).select("id").eq("user_id", userId);
  if (error) throw new Error(`${table} prune select: ${error.message}`);
  const keepSet = new Set(keepIds);
  const toDelete = (data ?? [])
    .map((r) => (r as { id: string }).id)
    .filter((id) => !keepSet.has(id));
  if (toDelete.length === 0) return;
  const { error: delErr } = await sb
    .from(table)
    .delete()
    .eq("user_id", userId)
    .in("id", toDelete);
  if (delErr) throw new Error(`${table} prune delete: ${delErr.message}`);
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
  };
  state.budgets = ensureBudgetForMonth(state.budgets, currentMonthKey());
  return state;
}

// Authenticated empty state — for brand-new signups. Clean slate with default
// categories already seeded so the user can start budgeting right away.
export function buildEmptyAuthenticatedState(user: User): AppState {
  const categories = defaultCategoriesForUser(user);
  return {
    user,
    categories,
    transactions: [],
    budgets: [
      {
        month: currentMonthKey(),
        total: 0,
        categories: Object.fromEntries(categories.map((c) => [c.id, 0])),
      },
    ],
    savingsGoals: [],
    merchantMemory: [],
  };
}

