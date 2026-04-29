// Shared types and interfaces for the Auto Audit budgeting app.
// Keep these clean so a future Supabase/Firebase backend can adopt them.

export type MonthKey = string; // format: "YYYY-MM"

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string; // ISO date
}

export interface Category {
  id: string;
  name: string;
  // Named colors map to the UI accents. Keep stable for charts.
  color: string;
  icon?: string; // lucide-react icon name, optional
  // "other" is a protected default bucket for uncategorized spending
  isDefault?: boolean;
  isOther?: boolean;
}

export interface Transaction {
  id: string;
  amount: number; // positive only in v1
  merchant: string;
  date: string; // ISO date
  categoryId: string;
  note?: string;
}

// A MonthlyBudget stores the total budget and per-category limits for one month.
// When the user advances to a new month with no budget, the app copies forward
// from the prior month (see lib/budgetCalc).
export interface MonthlyBudget {
  month: MonthKey;
  total: number;
  categories: Record<string, number>; // categoryId -> limit
}

export type SavingsGoalType = "monthly" | "named";

export interface SavingsGoal {
  id: string;
  name: string;
  type: SavingsGoalType;
  targetAmount: number;
  savedAmount: number;
  targetDate?: string; // ISO date, optional
  createdAt: string;
}

// Merchant memory lets the Add Expense page auto-fill category for recognized
// merchants. A user can opt in per-merchant.
export interface MerchantMemoryEntry {
  key: string; // normalized merchant name
  displayName: string; // original casing of first remembered entry
  categoryId: string;
  remember: boolean;
}

export interface AppState {
  user: User;
  categories: Category[];
  transactions: Transaction[];
  budgets: MonthlyBudget[];
  savingsGoals: SavingsGoal[];
  merchantMemory: MerchantMemoryEntry[];
  advancedMode: boolean;
}

export type AlertLevel = "info" | "warn" | "danger";

export interface BudgetAlert {
  level: AlertLevel;
  message: string;
  categoryId?: string;
}
