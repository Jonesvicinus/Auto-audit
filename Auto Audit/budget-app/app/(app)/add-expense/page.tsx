"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { PlusCircle, CheckCircle2, LayoutDashboard } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, TextArea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

import { useBudget } from "@/lib/BudgetContext";
import { suggestCategory } from "@/lib/merchantMemory";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";

function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AddExpensePage() {
  const {
    categories,
    otherCategoryId,
    merchantMemory,
    addTransaction,
    rememberMerchant,
  } = useBudget();
  const toast = useToast();

  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState<string>(todayIsoDate());
  const [categoryId, setCategoryId] = useState<string>(otherCategoryId);
  const [note, setNote] = useState("");
  const [rememberChoice, setRememberChoice] = useState(true);
  const [userPickedCategory, setUserPickedCategory] = useState(false);
  const [justSaved, setJustSaved] = useState<null | { merchant: string; amount: number }>(null);

  const suggestion = useMemo(
    () => (merchant.trim() ? suggestCategory(merchant, merchantMemory) : null),
    [merchant, merchantMemory],
  );

  React.useEffect(() => {
    if (!suggestion) return;
    if (userPickedCategory) return;
    if (suggestion.confidence === "exact" || suggestion.confidence === "fuzzy") {
      setCategoryId(suggestion.categoryId);
    }
  }, [suggestion, userPickedCategory]);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );

  const amountValid = Number.isFinite(parseFloat(amount)) && parseFloat(amount) > 0;
  const merchantValid = merchant.trim().length > 0;
  const canSubmit = amountValid && merchantValid;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const amt = parseFloat(amount);
    const tx = addTransaction({
      amount: amt,
      merchant: merchant.trim(),
      date: new Date(date + "T12:00:00").toISOString(),
      categoryId,
      note: note.trim() || undefined,
    });
    if (rememberChoice) {
      rememberMerchant(tx.merchant, categoryId, true);
    }
    setJustSaved({ merchant: tx.merchant, amount: tx.amount });
    toast.success("Expense saved", `${formatCurrency(tx.amount)} at ${tx.merchant}`);
    setAmount("");
    setMerchant("");
    setDate(todayIsoDate());
    setCategoryId(otherCategoryId);
    setNote("");
    setRememberChoice(true);
    setUserPickedCategory(false);
  }

  function onAddAnother() {
    setJustSaved(null);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {justSaved ? (
        <Card>
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-700/15 text-brand-700 dark:text-brand-300 grid place-items-center mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Expense saved
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {formatCurrency(justSaved.amount)} at {justSaved.merchant}
            </p>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <Button onClick={onAddAnother} leftIcon={<PlusCircle className="w-4 h-4" />}>
                Add Another Entry
              </Button>
              <Link href="/dashboard">
                <Button
                  variant="outline"
                  leftIcon={<LayoutDashboard className="w-4 h-4" />}
                >
                  View Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Add an Expense"
            subtitle="Log one purchase. We'll remember the category for next time."
          />

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Amount"
                name="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                leftAdornment={<span>$</span>}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Input
                label="Date"
                name="date"
                type="date"
                value={date}
                max={todayIsoDate()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <Input
              label="Merchant"
              name="merchant"
              placeholder="e.g. Chipotle"
              value={merchant}
              onChange={(e) => {
                setMerchant(e.target.value);
                setUserPickedCategory(false);
              }}
            />

            {suggestion?.confidence === "fuzzy" && (
              <Alert level="warn">
                This looks similar to{" "}
                <span className="font-semibold">{suggestion.displayName}</span>.
                We've prefilled the same category — change it below if that's not right.
              </Alert>
            )}

            <Select
              label="Category"
              name="categoryId"
              options={categoryOptions}
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setUserPickedCategory(true);
              }}
            />

            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 select-none">
              <input
                type="checkbox"
                checked={rememberChoice}
                onChange={(e) => setRememberChoice(e.target.checked)}
                className="mt-0.5 accent-brand-600"
              />
              Use this category for this merchant in the future.
            </label>

            <TextArea
              label="Note (optional)"
              name="note"
              rows={3}
              placeholder="Lunch with friends, gas fill-up, etc."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <Link href="/dashboard">
                <Button variant="ghost" type="button">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={!canSubmit}>
                Save Expense
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
