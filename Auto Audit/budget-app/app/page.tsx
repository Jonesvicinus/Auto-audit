"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wallet,
  LayoutDashboard,
  CheckCircle2,
  PiggyBank,
  LineChart,
  FileText,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuth } from "@/lib/AuthContext";

export default function LandingPage() {
  const router = useRouter();
  const { enterDemoMode, supabaseConfigured, isAuthenticated } = useAuth();

  async function startDemo() {
    await enterDemoMode();
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100">
      {/* Top bar */}
      <header className="border-b border-gray-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-brand-600 text-white grid place-items-center shadow-sm">
              <Wallet className="w-4 h-4" />
            </span>
            <span className="font-semibold">Auto Audit</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="sm">Open dashboard</Button>
              </Link>
            ) : (
              <>
                <button
                  onClick={startDemo}
                  className="hidden sm:inline-flex text-sm font-medium px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-900"
                >
                  Try the demo
                </button>
                {supabaseConfigured ? (
                  <>
                    <Link href="/login" className="hidden sm:inline-flex">
                      <Button variant="ghost" size="sm">Sign in</Button>
                    </Link>
                    <Link href="/signup">
                      <Button size="sm">Get started</Button>
                    </Link>
                  </>
                ) : (
                  <button
                    onClick={startDemo}
                    className="sm:hidden inline-flex"
                  >
                    <Button size="sm">Open demo</Button>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/60 via-white to-white dark:from-brand-700/10 dark:via-neutral-950 dark:to-neutral-950" />
        <div className="max-w-6xl mx-auto px-6 lg:px-8 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-200 dark:border-brand-700/40 bg-brand-50 dark:bg-brand-700/15 text-brand-700 dark:text-brand-300 text-xs font-medium mb-6 animate-fade-in">
            <ShieldCheck className="w-3.5 h-3.5" />
            Built for students &amp; young adults
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight max-w-4xl mx-auto">
            A budget you'll actually stick to.
          </h1>
          <p className="mt-5 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Auto Audit turns everyday spending into simple categories so you always know where
            your money is going — and where you can stop the bleed.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {supabaseConfigured ? (
              <Link href="/signup">
                <Button size="lg" rightIcon={<ArrowRight className="w-5 h-5" />}>
                  Get started
                </Button>
              </Link>
            ) : (
              <button onClick={startDemo}>
                <Button size="lg" rightIcon={<ArrowRight className="w-5 h-5" />}>
                  Open the app
                </Button>
              </button>
            )}
            <button onClick={startDemo}>
              <Button
                size="lg"
                variant="outline"
                leftIcon={<Sparkles className="w-5 h-5" />}
              >
                Try the demo
              </Button>
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
            Demo includes 12 months of realistic student spending. No signup needed.
          </p>

          {/* Mock dashboard preview */}
          <div className="mt-14 mx-auto max-w-4xl rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-pop overflow-hidden animate-fade-in">
            <div className="h-10 bg-gray-50 dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-1.5 px-4">
              <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-300" />
              <span className="ml-3 text-xs text-gray-500 dark:text-gray-400">
                Auto Audit · Dashboard
              </span>
            </div>
            <div className="p-6 grid grid-cols-3 gap-4 text-left">
              <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Monthly Budget</p>
                <p className="text-2xl font-semibold">$900</p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Spent</p>
                <p className="text-2xl font-semibold text-brand-700 dark:text-brand-400">
                  $612
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
                <p className="text-2xl font-semibold">$288</p>
              </div>
              <div className="col-span-3 rounded-xl border border-gray-200 dark:border-neutral-800 p-4 space-y-3">
                {[
                  { name: "Food", pct: 72, color: "#10b981" },
                  { name: "Fun Money", pct: 88, color: "#a855f7" },
                  { name: "Transportation", pct: 44, color: "#3b82f6" },
                ].map((r) => (
                  <div key={r.name}>
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <span>{r.name}</span>
                      <span>{r.pct}% used</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full transition-[width] duration-500"
                        style={{ width: `${r.pct}%`, backgroundColor: r.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-gray-100 dark:border-neutral-900">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-semibold">
              Everything you need. Nothing you don't.
            </h2>
            <p className="mt-3 text-gray-600 dark:text-gray-400">
              A clean, simple budgeting app designed for real life on a student budget.
            </p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                title: "Simple budgeting",
                body:
                  "Set one monthly total, split it into categories, and see every dollar at a glance.",
                icon: <Wallet className="w-5 h-5" />,
              },
              {
                title: "Clear category tracking",
                body:
                  "Progress bars show exactly how close you are to your limits — green, yellow, red.",
                icon: <LineChart className="w-5 h-5" />,
              },
              {
                title: "Student-friendly money",
                body:
                  "Default categories that fit real student life: food, gas, subscriptions, fun.",
                icon: <PiggyBank className="w-5 h-5" />,
              },
              {
                title: "Merchant memory",
                body:
                  "Type 'Starbucks' once, and we'll remember it's Food next time. Fuzzy matches too.",
                icon: <CheckCircle2 className="w-5 h-5" />,
              },
              {
                title: "12-month trends",
                body:
                  "Flip to trend view and see how your habits have shifted over the last year.",
                icon: <LineChart className="w-5 h-5" />,
              },
              {
                title: "Print-friendly reports",
                body:
                  "One-click printable summary for your own records or a parent/advisor.",
                icon: <FileText className="w-5 h-5" />,
              },
            ].map((f, i) => (
              <div
                key={f.title}
                className="rounded-2xl border border-gray-200 dark:border-neutral-800 p-6 bg-white dark:bg-neutral-900 hover:shadow-card transition-shadow animate-fade-in"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-700/15 text-brand-700 dark:text-brand-300 grid place-items-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {f.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 border-t border-gray-100 dark:border-neutral-900 bg-gray-50 dark:bg-neutral-950">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-semibold">Three steps. That's it.</h2>
            <p className="mt-3 text-gray-600 dark:text-gray-400">
              No spreadsheets. No jargon. No judgement.
            </p>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              {
                n: "01",
                title: "Set your budget",
                body:
                  "Pick a monthly number and split it across the categories that matter to you.",
              },
              {
                n: "02",
                title: "Log what you spend",
                body:
                  "Add an expense in seconds. Auto Audit remembers your merchants and categories.",
              },
              {
                n: "03",
                title: "Stay on track",
                body:
                  "Watch progress bars fill up and get simple, neutral alerts when you're close to limits.",
              },
            ].map((s) => (
              <div
                key={s.n}
                className="rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-6 shadow-card"
              >
                <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 tracking-wide">
                  STEP {s.n}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-gray-100 dark:border-neutral-900">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-semibold">
            Take a minute today. Thank yourself later.
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            Open the demo to explore — sign up to keep your data when you're ready.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {supabaseConfigured && (
              <Link href="/signup">
                <Button size="lg">Create your account</Button>
              </Link>
            )}
            <button onClick={startDemo}>
              <Button size="lg" variant="outline" leftIcon={<LayoutDashboard className="w-5 h-5" />}>
                Try the demo
              </Button>
            </button>
          </div>
        </div>
      </section>

      <footer className="py-10 border-t border-gray-100 dark:border-neutral-900">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-500">
          <p>© {new Date().getFullYear()} Auto Audit — v1.2</p>
          <p>Demo data is local to your browser. Sign up to sync across devices.</p>
        </div>
      </footer>
    </div>
  );
}
