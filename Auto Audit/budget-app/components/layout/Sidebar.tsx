"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Sliders,
  ListOrdered,
  FileText,
  PiggyBank,
  Printer,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

type Item = { href: string; label: string; icon: React.ReactNode };

const items: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/add-expense", label: "Add Expense", icon: <PlusCircle className="w-4 h-4" /> },
  { href: "/budget", label: "Edit Budget", icon: <Sliders className="w-4 h-4" /> },
  { href: "/transactions", label: "Transactions", icon: <ListOrdered className="w-4 h-4" /> },
  { href: "/summary", label: "Monthly Summary", icon: <FileText className="w-4 h-4" /> },
  { href: "/savings", label: "Savings Goals", icon: <PiggyBank className="w-4 h-4" /> },
  { href: "/report", label: "Printable Report", icon: <Printer className="w-4 h-4" /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isDemo, isAuthenticated, user } = useAuth();

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 h-screen sticky top-0 border-l border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
      <div className="px-5 py-6 border-b border-gray-200 dark:border-neutral-800">
        <Link href="/" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-brand-600 text-white grid place-items-center shadow-sm">
            <Wallet className="w-4 h-4" />
          </span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            Auto Audit
          </span>
        </Link>
      </div>
      <nav className="p-3 flex-1 overflow-y-auto">
        <ul className="space-y-1">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                    active
                      ? "bg-[var(--nav-active-bg)] text-brand-700 dark:text-brand-300 font-medium"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-gray-200 dark:border-neutral-800">
        {isAuthenticated && user ? (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p className="font-medium text-gray-700 dark:text-gray-300 truncate">
              {user.email}
            </p>
            <p>Signed in</p>
          </div>
        ) : isDemo ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Demo · Local sample data
          </p>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Auto Audit · v1.2
          </p>
        )}
      </div>
    </aside>
  );
}
