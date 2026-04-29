"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { CategorySpendRow } from "@/lib/budgetCalc";
import { formatCurrency } from "@/lib/format";

// Horizontal bars: gray background bars represent the budget. Green fill bars
// overlay the portion actually spent. Overspend shows red.
export function BudgetVsActualChart({ rows }: { rows: CategorySpendRow[] }) {
  const data = rows.map((r) => ({
    name: r.category.name,
    budget: r.budget,
    spent: r.spent,
    over: r.status === "over" ? r.spent - r.budget : 0,
    status: r.status,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 48)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis
          type="number"
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickFormatter={(v) => `$${v}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 12, fill: "#374151" }}
        />
        <Tooltip
          formatter={(value: number, name: string) => [formatCurrency(value), name]}
          contentStyle={{
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            fontSize: 12,
          }}
        />
        <Bar dataKey="budget" fill="#e5e7eb" radius={[6, 6, 6, 6]} barSize={14} />
        <Bar dataKey="spent" radius={[6, 6, 6, 6]} barSize={14}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={
                d.status === "over"
                  ? "#ef4444"
                  : d.status === "warn"
                    ? "#eab308"
                    : "#10b981"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
