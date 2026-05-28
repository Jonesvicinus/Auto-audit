"use client";

import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { CategorySpendRow } from "@/lib/budgetCalc";
import { formatCurrency } from "@/lib/format";

const PIE_CENTER_X = "50%";
const PIE_CENTER_Y = 110;
const PIE_OUTER_RADIUS = 95;
const PIE_OUTLINE_WIDTH = 3;

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
    <ResponsiveContainer className="theme-chart" width="100%" height={280}>
        <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx={PIE_CENTER_X}
          cy={PIE_CENTER_Y}
          innerRadius={PIE_OUTER_RADIUS}
          outerRadius={PIE_OUTER_RADIUS + PIE_OUTLINE_WIDTH}
          paddingAngle={0}
          stroke="none"
          strokeWidth={0}
          fill="var(--foreground)"
          isAnimationActive={false}
          legendType="none"
          tooltipType="none"
        >
          {data.map((_, i) => (
            <Cell key={i} fill="var(--foreground)" />
          ))}
        </Pie>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx={PIE_CENTER_X}
          cy={PIE_CENTER_Y}
          innerRadius={55}
          outerRadius={PIE_OUTER_RADIUS}
          paddingAngle={0}
          stroke="none"
          strokeWidth={0}
          animationBegin={0}
          animationDuration={500}
          animationEasing="ease-in-out"
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{
            borderRadius: 10,
            border: "1px solid var(--border)",
            backgroundColor: "var(--chart-tooltip-bg)",
            color: "var(--foreground)",
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
