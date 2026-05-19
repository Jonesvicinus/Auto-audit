"use client";

import React, { useState } from "react";
import { Pencil, Trash2, Check, X, Plus, Minus } from "lucide-react";
import type { SavingsGoal } from "@/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";

export function SavingsGoalCard({
  goal,
  onContribute,
  onEdit,
  onDelete,
}: {
  goal: SavingsGoal;
  onContribute: (delta: number) => void;
  onEdit: (patch: Partial<SavingsGoal>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(goal.name);
  const [target, setTarget] = useState(String(goal.targetAmount));
  const [targetDate, setTargetDate] = useState(goal.targetDate?.slice(0, 10) ?? "");

  const pct = goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0;
  const complete = goal.savedAmount >= goal.targetAmount && goal.targetAmount > 0;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-card transition-shadow hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-base font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          ) : (
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {goal.name}
            </h3>
          )}
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <Badge tone={goal.type === "monthly" ? "brand" : "neutral"}>
              {goal.type === "monthly" ? "Monthly" : "Named Goal"}
            </Badge>
            {goal.targetDate && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Target: {formatDate(goal.targetDate)}
              </span>
            )}
            {complete && <Badge tone="brand">Complete</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {editing ? (
            <>
              <button
                onClick={() => {
                  const tv = parseFloat(target);
                  const safeTarget = Number.isFinite(tv) && tv >= 0 ? tv : goal.targetAmount;
                  onEdit({
                    name: name.trim() || goal.name,
                    targetAmount: safeTarget,
                    targetDate: targetDate
                      ? new Date(targetDate + "T12:00:00").toISOString()
                      : undefined,
                  });
                  setEditing(false);
                }}
                className="p-1.5 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-700/15 rounded-lg"
                aria-label="Save"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditing(false)}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg"
                aria-label="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg"
                aria-label="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Delete goal "${goal.name}"?`)) onDelete();
                }}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-700/20 rounded-lg"
                aria-label="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
          {formatCurrency(goal.savedAmount)}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          of {formatCurrency(editing ? (Number.isFinite(parseFloat(target)) && parseFloat(target) >= 0 ? parseFloat(target) : goal.targetAmount) : goal.targetAmount)}
        </span>
      </div>
      <div className="mt-3">
        <ProgressBar value={pct} status="normal" />
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          {Math.round(pct)}% saved
        </p>
      </div>

      {editing && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Target
            </label>
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Target date
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Minus className="w-4 h-4" />}
          className="text-sm"
          onClick={() => onContribute(-10)}
        >
          $10
        </Button>
        <Button
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          className="text-sm"
          onClick={() => onContribute(10)}
        >
          $10
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const raw = window.prompt(
              "Add a custom amount (use a negative number to withdraw):",
            );
            if (raw === null) return;
            const n = parseFloat(raw);
            if (!Number.isFinite(n) || n === 0) return;
            onContribute(n);
          }}
        >
          Custom
        </Button>
      </div>
    </div>
  );
}
