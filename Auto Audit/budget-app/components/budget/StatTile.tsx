import React from "react";
import { Card } from "@/components/ui/Card";

export function StatTile({
  label,
  value,
  sub,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  tone?: "neutral" | "brand" | "danger" | "warn";
}) {
  const accent =
    tone === "brand"
      ? "text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-700/15"
      : tone === "danger"
        ? "text-danger-700 dark:text-danger-300 bg-danger-50 dark:bg-danger-700/15"
        : tone === "warn"
          ? "text-warn-700 dark:text-warn-300 bg-warn-50 dark:bg-warn-700/15"
          : "text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-neutral-800";
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</p>
          )}
        </div>
        {icon && (
          <div className={`w-10 h-10 rounded-xl grid place-items-center ${accent}`}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
