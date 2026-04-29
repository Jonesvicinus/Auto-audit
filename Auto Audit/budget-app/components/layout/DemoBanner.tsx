"use client";

import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export function DemoBanner() {
  const { isDemo, exitDemoMode, supabaseConfigured } = useAuth();
  if (!isDemo) return null;

  return (
    <div className="bg-brand-50 dark:bg-brand-700/15 border-b border-brand-200 dark:border-brand-700/40 text-brand-800 dark:text-brand-200">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-10 flex items-center justify-between gap-4 text-sm">
        <p className="flex items-center gap-2 truncate">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            You're in demo mode. Changes are local to this browser.
          </span>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {supabaseConfigured && (
            <Link
              href="/signup"
              className="px-3 py-1 rounded-md bg-brand-600 text-white text-xs font-medium hover:bg-brand-700"
            >
              Sign up to save
            </Link>
          )}
          <button
            onClick={exitDemoMode}
            aria-label="Exit demo mode"
            className="p-1 rounded-md hover:bg-brand-100 dark:hover:bg-brand-700/25"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
