"use client";

import React, { useState } from "react";
import { PiggyBank, Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { SavingsGoalCard } from "@/components/savings/SavingsGoalCard";

import { useBudget } from "@/lib/BudgetContext";
import type { SavingsGoalType } from "@/types";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";

export default function SavingsPage() {
  const {
    savingsGoals,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    hydrated,
  } = useBudget();
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<SavingsGoalType>("named");
  const [target, setTarget] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const totalSaved = savingsGoals.reduce((s, g) => s + g.savedAmount, 0);
  const totalTarget = savingsGoals.reduce((s, g) => s + g.targetAmount, 0);

  function handleCreate() {
    if (!name.trim() || !parseFloat(target)) return;
    addSavingsGoal({
      name: name.trim(),
      type,
      targetAmount: parseFloat(target),
      savedAmount: 0,
      targetDate: targetDate
        ? new Date(targetDate + "T12:00:00").toISOString()
        : undefined,
    });
    toast.success("Goal created", name.trim());
    setName("");
    setType("named");
    setTarget("");
    setTargetDate("");
    setShowForm(false);
  }

  if (!hydrated) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader
          title="Savings Goals"
          subtitle="Set money aside each month or work toward something specific."
          action={
            <Button
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowForm((s) => !s)}
            >
              New Goal
            </Button>
          }
        />

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-gray-50 dark:bg-neutral-950 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total saved</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-700 dark:text-brand-400">
              {formatCurrency(totalSaved)}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-neutral-950 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Across goals</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {savingsGoals.length}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-neutral-950 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Toward a target of</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCurrency(totalTarget)}
            </p>
          </div>
        </div>

        {showForm && (
          <div className="mt-5 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 bg-gray-50 dark:bg-neutral-950 animate-fade-in">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Create a new goal
            </h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Name"
                placeholder="e.g. New Laptop"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Select
                label="Type"
                options={[
                  { value: "named", label: "Named Goal" },
                  { value: "monthly", label: "Monthly Savings" },
                ]}
                value={type}
                onChange={(e) => setType(e.target.value as SavingsGoalType)}
              />
              <Input
                label="Target amount"
                type="number"
                min="0"
                step="1"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                leftAdornment={<span>$</span>}
              />
              <Input
                label="Target date (optional)"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!name.trim() || !parseFloat(target)}
              >
                Create Goal
              </Button>
            </div>
          </div>
        )}
      </Card>

      {savingsGoals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PiggyBank className="w-6 h-6" />}
            title="No savings goals yet."
            description="Start with a single monthly target like 'Save $50 each month' or a named goal like 'Spring Break Trip'."
            action={
              <Button
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setShowForm(true)}
              >
                New Goal
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {savingsGoals.map((g, i) => (
            <div
              key={g.id}
              className="animate-fade-in"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <SavingsGoalCard
                goal={g}
                onContribute={(delta) => {
                  const next = Math.max(
                    0,
                    Math.round((g.savedAmount + delta) * 100) / 100,
                  );
                  updateSavingsGoal(g.id, { savedAmount: next });
                  if (delta > 0) {
                    toast.success(`+${formatCurrency(delta)} to ${g.name}`);
                  } else if (delta < 0) {
                    toast.info(`${formatCurrency(delta)} from ${g.name}`);
                  }
                }}
                onEdit={(patch) => {
                  updateSavingsGoal(g.id, patch);
                  toast.success("Goal updated");
                }}
                onDelete={() => {
                  deleteSavingsGoal(g.id);
                  toast.info("Goal deleted");
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
