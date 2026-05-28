import React from "react";

type Status = "normal" | "warn" | "over";

export function ProgressBar({
  value,
  status = "normal",
  showLabel = false,
  animate = true,
}: {
  value: number; // 0..100 (can be >100 for over)
  status?: Status;
  showLabel?: boolean;
  animate?: boolean;
}) {
  const clamped = Math.max(0, Math.min(value, 100));
  const over = value > 100;
  const overflow = over ? Math.min(value - 100, 100) : 0;

  const fillColor =
    status === "over"
      ? "bg-danger-500"
      : status === "warn"
        ? "bg-warn-400"
        : "bg-brand-500";

  return (
    <div className="w-full">
      <div className="relative h-2 w-full rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full ${fillColor} ${animate ? "transition-[width] duration-500 ease-out" : ""}`}
          style={{ width: `${clamped}%` }}
        />
        {over && (
          <div
            className={`absolute right-0 top-0 h-full bg-danger-700 opacity-80 ${animate ? "transition-[width] duration-500 ease-out" : ""}`}
            style={{ width: `${overflow}%` }}
          />
        )}
      </div>
      {showLabel && (
        <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{Math.round(value)}% used</span>
        </div>
      )}
    </div>
  );
}
