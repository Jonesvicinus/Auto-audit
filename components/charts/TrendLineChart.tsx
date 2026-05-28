"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/format";

export interface TrendPoint {
  monthLabel: string;
  spent: number;
  budget: number;
}

export function TrendLineChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer className="theme-chart" width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis
          dataKey="monthLabel"
          tick={{ fontSize: 12, fill: "var(--chart-axis)" }}
          axisLine={{ stroke: "var(--chart-axis)" }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "var(--chart-axis)" }}
          axisLine={{ stroke: "var(--chart-axis)" }}
          tickFormatter={(v) => `$${v}`}
          width={55}
        />
        <Tooltip
          formatter={(value: number, name: string) => [formatCurrency(value), name]}
          contentStyle={{
            borderRadius: 10,
            border: "1px solid var(--border)",
            backgroundColor: "var(--chart-tooltip-bg)",
            color: "var(--foreground)",
            fontSize: 12,
          }}
        />
        <ReferenceLine y={0} stroke="var(--chart-axis)" />
        <Line
          type="monotone"
          dataKey="budget"
          name="Budget"
          stroke="#9ca3af"
          strokeDasharray="5 5"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="spent"
          name="Spent"
          stroke="#10b981"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
