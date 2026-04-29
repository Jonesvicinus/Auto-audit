"use client";

import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { CategorySpendRow } from "@/lib/budgetCalc";
import { formatCurrency } from "@/lib/format";

export function CategoryPieChart({ rows }: { rows: CategorySpendRow[] }) {
  const data = rows
    .filter((r) => r.spent > 0)
    .map((r) => ({
      name: r.category.name,
      value: Math.round(r.spent * 100) / 100,
      color: r.category.color,
    }));

  if (data.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-sm text-gray-500">
        No spending to show yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={95}
          paddingAngle={2}
          stroke="#fff"
          strokeWidth={2}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
