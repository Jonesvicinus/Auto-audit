"use client";

import React from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";

// Shared chrome for every auth page: minimal centered card with the brand mark
// at the top. Keeps signup/login/reset visually consistent.
export function AuthFormShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex flex-col">
      <header className="px-6 lg:px-8 py-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-brand-600 text-white grid place-items-center shadow-sm">
            <Wallet className="w-4 h-4" />
          </span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            Auto Audit
          </span>
        </Link>
      </header>
      <main className="flex-1 grid place-items-center px-6 pb-16">
        <div className="w-full max-w-md animate-fade-in">
          <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-card p-8">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {subtitle}
              </p>
            )}
            <div className="mt-6">{children}</div>
          </div>
          {footer && (
            <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
              {footer}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
