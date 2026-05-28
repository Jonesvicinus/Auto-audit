"use client";

import React, { useState } from "react";
import type { Transaction } from "@/types";
import { Input, TextArea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export function TransactionEditor({
  tx,
  categoryOptions,
  onSave,
  onCancel,
}: {
  tx: Transaction;
  categoryOptions: { value: string; label: string }[];
  onSave: (patch: Partial<Omit<Transaction, "id">>) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(String(tx.amount));
  const [merchant, setMerchant] = useState(tx.merchant);
  const [date, setDate] = useState(tx.date.slice(0, 10));
  const [categoryId, setCategoryId] = useState(tx.categoryId);
  const [note, setNote] = useState(tx.note ?? "");

  return (
    <div className="space-y-3 bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 animate-fade-in">
      <div className="grid sm:grid-cols-2 gap-3">
        <Input
          label="Amount"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          leftAdornment={<span>$</span>}
        />
        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <Input
        label="Merchant"
        value={merchant}
        onChange={(e) => setMerchant(e.target.value)}
      />
      <Select
        label="Category"
        options={categoryOptions}
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
      />
      <TextArea
        label="Note"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() =>
            onSave({
              amount: parseFloat(amount) || 0,
              merchant: merchant.trim(),
              date: new Date(date + "T12:00:00").toISOString(),
              categoryId,
              note: note.trim() || undefined,
            })
          }
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
