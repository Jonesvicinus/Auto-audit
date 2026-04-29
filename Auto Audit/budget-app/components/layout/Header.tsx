"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusCircle, Sparkles, LogOut, LogIn } from "lucide-react";
import { useBudget } from "@/lib/BudgetContext";
import { useAuth } from "@/lib/AuthContext";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "./ThemeToggle";
import { useToast } from "@/components/ui/Toast";

const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  "add-expense": "Add Expense",
  budget: "Edit Budget",
  transactions: "Transactions",
  summary: "Monthly Summary",
  savings: "Savings Goals",
  report: "Printable Report",
};

export function Header({ pathname }: { pathname: string }) {
  const { user, advancedMode, setAdvancedMode } = useBudget();
  const { isDemo, isAuthenticated, signOut, supabaseConfigured } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  const title = TITLES[seg] ?? "Auto Audit";
  const greeting = user.name?.split(" ")[0] ?? "there";

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-neutral-950/90 backdrop-blur border-b border-gray-200 dark:border-neutral-800">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isDemo ? "Demo · " : ""}Hello, {greeting}
          </p>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 cursor-pointer"
            title="Advanced Mode placeholder (coming soon)"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <Toggle
              checked={advancedMode}
              onChange={setAdvancedMode}
              label="Advanced Mode"
            />
          </div>
          <ThemeToggle />
          <Link href="/add-expense">
            <Button size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
              <span className="hidden sm:inline">Add Expense</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </Link>
          {isAuthenticated ? (
            <button
              onClick={handleSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-neutral-800"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            supabaseConfigured && (
              <Link href="/login">
                <Button size="sm" variant="outline" leftIcon={<LogIn className="w-4 h-4" />}>
                  <span className="hidden md:inline">Sign in</span>
                </Button>
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
}
