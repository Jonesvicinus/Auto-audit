"use client";

import React from "react";
import { Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useBudget } from "@/lib/BudgetContext";
import { useToast } from "@/components/ui/Toast";

export default function SettingsPage() {
  const { merchantMemory, categories, deleteMerchantMemory } = useBudget();
  const toast = useToast();

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const sorted = [...merchantMemory].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );

  function handleDelete(key: string, displayName: string) {
    deleteMerchantMemory(key);
    toast.success("Removed", `"${displayName}" removed from merchant memory.`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your merchant category memory.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Merchant memory"
          subtitle="Auto Audit remembers which category you assigned to each merchant during CSV imports. Remove any entry to reset it."
        />

        {sorted.length === 0 ? (
          <EmptyState
            icon={null}
            title="No merchant memory yet"
            description="Import a CSV to start building merchant memory."
          />
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-neutral-800">
                  <th className="py-2 pr-3 font-medium">Merchant</th>
                  <th className="py-2 pr-3 font-medium">Category</th>
                  <th className="py-2 pr-2 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry) => (
                  <tr
                    key={entry.key}
                    className="border-b border-gray-100 dark:border-neutral-800/70 hover:bg-gray-50/50 dark:hover:bg-neutral-900/40"
                  >
                    <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                      {entry.displayName}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">
                      {categoryMap.get(entry.categoryId) ?? (
                        <span className="italic text-gray-400 dark:text-gray-600">
                          Deleted category
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <button
                        onClick={() => handleDelete(entry.key, entry.displayName)}
                        aria-label={`Remove ${entry.displayName} from merchant memory`}
                        className="p-1 text-gray-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-700/20 rounded-md"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
