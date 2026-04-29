"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { DemoBanner } from "./DemoBanner";
import { PageTransition } from "./PageTransition";
import { useAuth } from "@/lib/AuthContext";

// Wrap all "in-app" routes. Right-side sidebar + clean top header + demo banner.
// Anonymous (signed out + not in demo) users get redirected to the landing page.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { mode, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    // If Supabase is configured but user is anonymous, kick them to the landing
    // page so they can pick "Try the demo" or sign up.
    if (mode === "anonymous") {
      router.replace("/");
    }
  }, [mode, isLoading, router]);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-neutral-950">
      <div className="flex-1 min-w-0 flex flex-col">
        <DemoBanner />
        <Header pathname={pathname} />
        <main className="flex-1 px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <Sidebar />
    </div>
  );
}
