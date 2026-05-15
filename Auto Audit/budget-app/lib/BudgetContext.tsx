"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AppState,
  Category,
  MonthlyBudget,
  SavingsGoal,
  Transaction,
} from "@/types";
import {
  buildDemoState,
  buildEmptyAuthenticatedState,
  buildInitialState,
  LocalStorageAdapter,
  StorageAdapter,
  SupabaseStorageAdapter,
} from "./storage";
import { upsertMemory } from "./merchantMemory";
import { merchantFamilyKey } from "./fuzzyMatch";
import { allocateSlackToOther, ensureBudgetForMonth } from "./budgetCalc";
import { currentMonthKey } from "./months";
import { useAuth } from "./AuthContext";
import { useToast } from "@/components/ui/Toast";

interface BudgetContextValue extends AppState {
  // state mutations
  addTransaction: (tx: Omit<Transaction, "id">) => Transaction;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
  deleteTransaction: (id: string) => void;
  clearTransactionsForMonth: (month: string) => void;

  addCategory: (cat: Omit<Category, "id">) => Category;
  updateCategory: (id: string, patch: Partial<Omit<Category, "id">>) => void;
  deleteCategory: (id: string) => void;

  upsertBudget: (budget: MonthlyBudget) => void;

  addSavingsGoal: (goal: Omit<SavingsGoal, "id" | "createdAt">) => SavingsGoal;
  updateSavingsGoal: (id: string, patch: Partial<SavingsGoal>) => void;
  deleteSavingsGoal: (id: string) => void;

  rememberMerchant: (merchant: string, categoryId: string, remember: boolean) => void;

  setAdvancedMode: (v: boolean) => void;
  resetDemo: () => void;
  reseedDemoData: () => void;

  // derived / convenience
  hydrated: boolean;
  otherCategoryId: string;
  /** True when we're running with no transactions and no real budget yet. */
  isEmptyAccount: boolean;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const { mode, user, isLoading: authLoading } = useAuth();
  const toast = useToast();

  // Start with built-in demo state so SSR and first render agree.
  // We replace it after auth resolves and the right adapter loads.
  const [state, setState] = useState<AppState>(() => buildInitialState());
  const [hydrated, setHydrated] = useState(false);
  const adapterRef = useRef<StorageAdapter | null>(null);
  const lastModeRef = useRef<string>("");
  const lastSaveErrorRef = useRef<string>("");

  // Pick the right adapter based on auth mode and (re)hydrate when it changes.
  useEffect(() => {
    if (authLoading) return;

    const modeKey = mode === "supabase" && user ? `sb:${user.id}` : mode;
    if (lastModeRef.current === modeKey && adapterRef.current) return;
    lastModeRef.current = modeKey;

    let cancelled = false;
    setHydrated(false);

    (async () => {
      let adapter: StorageAdapter;
      let nextState: AppState;

      if (mode === "supabase" && user) {
        adapter = new SupabaseStorageAdapter({
          id: user.id,
          name: user.name ?? user.email.split("@")[0],
          email: user.email,
          createdAt: user.createdAt ?? new Date().toISOString(),
        });
        const loaded = await adapter.load();
        if (loaded) {
          nextState = loaded;
        } else {
          nextState = buildEmptyAuthenticatedState({
            id: user.id,
            name: user.name ?? user.email.split("@")[0],
            email: user.email,
            createdAt: user.createdAt ?? new Date().toISOString(),
          });
          await adapter.save(nextState);
        }
      } else if (mode === "demo") {
        adapter = new LocalStorageAdapter("demo");
        const loaded = await adapter.load();
        if (loaded) {
          nextState = loaded;
        } else {
          nextState = buildDemoState();
          await adapter.save(nextState);
        }
      } else {
        // anonymous / loading: use a transient localStorage namespace just so
        // the components can render. Routes redirect anonymous users away.
        adapter = new LocalStorageAdapter("anonymous");
        nextState = buildDemoState();
      }

      // Always make sure the current month has a budget row to edit.
      nextState.budgets = ensureBudgetForMonth(nextState.budgets, currentMonthKey());

      if (cancelled) return;
      adapterRef.current = adapter;
      setState(nextState);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, user, authLoading]);

  // Persist on every state change after hydration. Supabase saves are async;
  // failures surface as a toast so the user knows their data didn't sync.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated || !adapterRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const adapter = adapterRef.current;
    saveTimer.current = setTimeout(() => {
      adapter.save(state).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        // De-dupe rapid-fire identical errors so the toast doesn't stack.
        if (msg === lastSaveErrorRef.current) return;
        lastSaveErrorRef.current = msg;
        // eslint-disable-next-line no-console
        console.error("[BudgetContext] save failed:", err);
        toast.danger("Couldn't save changes", "We'll retry on your next edit.");
      });
    }, 250);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, hydrated, toast]);

  const otherCategoryId = useMemo(
    () => state.categories.find((c) => c.isOther)?.id ?? state.categories[0]?.id ?? "",
    [state.categories],
  );

  const isEmptyAccount = useMemo(() => {
    const noTx = state.transactions.length === 0;
    const noBudget = !state.budgets.some((b) => b.total > 0);
    return noTx && noBudget;
  }, [state.transactions, state.budgets]);

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------
  const addTransaction = useCallback((tx: Omit<Transaction, "id">) => {
    const withId: Transaction = { ...tx, id: makeId("tx") };
    setState((s) => ({ ...s, transactions: [...s.transactions, withId] }));
    return withId;
  }, []);

  const updateTransaction = useCallback(
    (id: string, patch: Partial<Omit<Transaction, "id">>) => {
      setState((s) => {
        const original = s.transactions.find((t) => t.id === id);
        if (!original) return s;

        const categoryChanged =
          patch.categoryId !== undefined && patch.categoryId !== original.categoryId;
        if (!categoryChanged) {
          return {
            ...s,
            transactions: s.transactions.map((t) =>
              t.id === id ? { ...t, ...patch } : t,
            ),
          };
        }

        const nextCategoryId = patch.categoryId!;
        const targetMerchant = (patch.merchant ?? original.merchant).trim();
        const targetMerchantKey = merchantFamilyKey(targetMerchant);
        const transactions = s.transactions.map((t) => {
          if (t.id === id) return { ...t, ...patch };
          if (targetMerchantKey && merchantFamilyKey(t.merchant) === targetMerchantKey) {
            return { ...t, categoryId: nextCategoryId };
          }
          return t;
        });

        return {
          ...s,
          transactions,
          merchantMemory: targetMerchantKey
            ? upsertMemory(s.merchantMemory, targetMerchant, nextCategoryId, true)
            : s.merchantMemory,
        };
      });
    },
    [],
  );

  const deleteTransaction = useCallback((id: string) => {
    setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));
  }, []);

  const clearTransactionsForMonth = useCallback((month: string) => {
    setState((s) => {
      const transactions = s.transactions.filter((t) => {
        // Compare by string prefix to avoid UTC-vs-local timezone mismatch
        // when bare "YYYY-MM-DD" strings are parsed by new Date().
        return t.date.slice(0, 7) !== month;
      });
      return transactions.length === s.transactions.length ? s : { ...s, transactions };
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------
  const addCategory = useCallback((cat: Omit<Category, "id">) => {
    const withId: Category = { ...cat, id: makeId("cat") };
    setState((s) => ({ ...s, categories: [...s.categories, withId] }));
    return withId;
  }, []);

  const updateCategory = useCallback(
    (id: string, patch: Partial<Omit<Category, "id">>) => {
      setState((s) => ({
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }));
    },
    [],
  );

  const deleteCategory = useCallback((id: string) => {
    setState((s) => {
      const cat = s.categories.find((c) => c.id === id);
      if (!cat || s.categories.length <= 1) return s;
      const fallback = s.categories.find((c) => c.id !== id);
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

  // ---------------------------------------------------------------------------
  // Budgets
  // ---------------------------------------------------------------------------
  const upsertBudget = useCallback(
    (budget: MonthlyBudget) => {
      const withSlack = allocateSlackToOther(budget, otherCategoryId);
      setState((s) => {
        const exists = s.budgets.some((b) => b.month === withSlack.month);
        const budgets = exists
          ? s.budgets.map((b) => (b.month === withSlack.month ? withSlack : b))
          : [...s.budgets, withSlack];
        return { ...s, budgets };
      });
    },
    [otherCategoryId],
  );

  // ---------------------------------------------------------------------------
  // Savings goals
  // ---------------------------------------------------------------------------
  const addSavingsGoal = useCallback(
    (goal: Omit<SavingsGoal, "id" | "createdAt">) => {
      const withMeta: SavingsGoal = {
        ...goal,
        id: makeId("goal"),
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, savingsGoals: [...s.savingsGoals, withMeta] }));
      return withMeta;
    },
    [],
  );

  const updateSavingsGoal = useCallback(
    (id: string, patch: Partial<SavingsGoal>) => {
      setState((s) => ({
        ...s,
        savingsGoals: s.savingsGoals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      }));
    },
    [],
  );

  const deleteSavingsGoal = useCallback((id: string) => {
    setState((s) => ({ ...s, savingsGoals: s.savingsGoals.filter((g) => g.id !== id) }));
  }, []);

  // ---------------------------------------------------------------------------
  // Merchant memory + misc
  // ---------------------------------------------------------------------------
  const rememberMerchant = useCallback(
    (merchant: string, categoryId: string, remember: boolean) => {
      setState((s) => ({
        ...s,
        merchantMemory: upsertMemory(s.merchantMemory, merchant, categoryId, remember),
      }));
    },
    [],
  );

  const setAdvancedMode = useCallback((v: boolean) => {
    setState((s) => ({ ...s, advancedMode: v }));
  }, []);

  const resetDemo = useCallback(() => {
    void adapterRef.current?.reset();
    const fresh =
      mode === "supabase" && user
        ? buildEmptyAuthenticatedState({
            id: user.id,
            name: user.name ?? user.email.split("@")[0],
            email: user.email,
            createdAt: user.createdAt ?? new Date().toISOString(),
          })
        : buildDemoState();
    setState(fresh);
    void adapterRef.current?.save(fresh);
  }, [mode, user]);

  // Reseed demo data — useful from the demo banner "load fresh sample".
  const reseedDemoData = useCallback(() => {
    if (mode !== "demo") return;
    const fresh = buildDemoState();
    setState(fresh);
    void adapterRef.current?.save(fresh);
  }, [mode]);

  const value: BudgetContextValue = {
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
  };

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget(): BudgetContextValue {
  const ctx = useContext(BudgetContext);
  if (!ctx) {
    throw new Error("useBudget must be used inside <BudgetProvider>");
  }
  return ctx;
}
