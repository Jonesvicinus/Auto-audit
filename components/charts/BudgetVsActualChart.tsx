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
} from "recharts";
import type { CategorySpendRow } from "@/lib/budgetCalc";
import { formatCurrency } from "@/lib/format";

type ChartRow = {
  name: string;
  budget: number;
  spent: number;
  max: number;
  status: CategorySpendRow["status"];
};

type BarShapeProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  payload?: ChartRow;
};

type BudgetSpentTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: ChartRow }>;
};

function toNumber(value: number | string | undefined) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function BudgetSpentBar(props: BarShapeProps) {
  const { payload } = props;

  if (!payload) {
    return null;
  }

  const x = toNumber(props.x) + 1;
  const y = toNumber(props.y);
  const width = Math.max(0, toNumber(props.width) - 1);
  const height = toNumber(props.height);
  const trackHeight = 14;
  const barY = y + (height - trackHeight) / 2;
  const radius = trackHeight / 2;
  const ratioBase = Math.max(payload.max, 1);
  const budgetWidth = width * (payload.budget / ratioBase);
  const spentWidth = width * (payload.spent / ratioBase);
  const isOver = payload.status === "over";
  const fillWidth = Math.max(0, Math.min(width, isOver ? budgetWidth : spentWidth));
  const fillColor = isOver
    ? "#e5e7eb"
    : payload.status === "warn"
      ? "#eab308"
      : "#10b981";

  return (
    <g>
      <rect
        x={x}
        y={barY}
        width={width}
        height={trackHeight}
        rx={radius}
        ry={radius}
        fill={isOver ? "#ef4444" : "#e5e7eb"}
      />
      {fillWidth > 0 && (
        <rect
          x={x}
          y={barY}
          width={fillWidth}
          height={trackHeight}
          rx={radius}
          ry={radius}
          fill={fillColor}
        />
      )}
    </g>
  );
}

function BudgetSpentTooltip({ active, payload }: BudgetSpentTooltipProps) {
  const row = payload?.[0]?.payload;

  if (!active || !row) {
    return null;
  }

  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid var(--border)",
        backgroundColor: "var(--chart-tooltip-bg)",
        color: "var(--foreground)",
        fontSize: 12,
        padding: "8px 10px",
      }}
    >
      <div className="font-medium">{row.name}</div>
      <div>Budget: {formatCurrency(row.budget)}</div>
      <div>Spent: {formatCurrency(row.spent)}</div>
    </div>
  );
}

// Horizontal bars are drawn as one layered track per category. Normal rows use
// a gray budget track with spent inside it; over-budget rows use red for the
// overspent total with the original budget shown inside in gray.
export function BudgetVsActualChart({ rows }: { rows: CategorySpendRow[] }) {
  const data: ChartRow[] = rows.map((r) => ({
    name: r.category.name,
    budget: r.budget,
    spent: r.spent,
    max: Math.max(r.budget, r.spent),
    status: r.status,
  }));

  return (
    <ResponsiveContainer
      className="theme-chart"
      width="100%"
      height={Math.max(220, data.length * 48)}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={false}
          stroke="var(--chart-grid)"
        />
        <XAxis
          type="number"
          tick={{ fontSize: 12, fill: "var(--chart-axis)" }}
          tickFormatter={(v) => `$${v}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 12, fill: "var(--chart-axis)" }}
        />
        <Tooltip content={<BudgetSpentTooltip />} />
        <Bar dataKey="max" shape={<BudgetSpentBar />} barSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
