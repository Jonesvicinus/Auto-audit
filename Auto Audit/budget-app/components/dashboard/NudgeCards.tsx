"use client";

import React from "react";
import Link from "next/link";
import { Sliders, PlusCircle, Tags, ArrowRight } from "lucide-react";

interface NudgeCard {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
}

const nudges: NudgeCard[] = [
  {
    href: "/budget",
    icon: <Sliders className="w-5 h-5" />,
    title: "Set your monthly budget",
    body: "Pick one total for the month — we'll split the slack into Other automatically.",
    cta: "Set budget",
  },
  {
    href: "/add-expense",
    icon: <PlusCircle className="w-5 h-5" />,
    title: "Add your first expense",
    body: "Log a recent purchase. Merchants get remembered, so future entries are one tap.",
    cta: "Add expense",
  },
  {
    href: "/budget",
    icon: <Tags className="w-5 h-5" />,
    title: "Pick your categories",
    body: "Five defaults are ready. Rename, add, or remove to match how you spend.",
    cta: "Edit categories",
  },
];

export function NudgeCards() {
  return (
    <div className="space-y-4">
      <div className="text-center sm:text-left">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Welcome to Auto Audit. Let's set up your first month.
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Three quick steps to get going. You can come back to any of these later.
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        {nudges.map((n, i) => (
          <Link
            key={n.title}
            href={n.href}
            className="group rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-card transition-all animate-fade-in"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-700/15 text-brand-700 dark:text-brand-300 grid place-items-center">
                {n.icon}
              </span>
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                Step {i + 1}
              </span>
            </div>
            <h3 className="mt-4 font-semibold text-gray-900 dark:text-gray-100">
              {n.title}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{n.body}</p>
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 dark:text-brand-400 group-hover:gap-2 transition-all">
              {n.cta}
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
