"use client";

import React, { useId } from "react";

export function Toggle({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  id?: string;
}) {
  const generatedId = useId();
  const tid = id ?? generatedId;
  return (
    <label
      htmlFor={tid}
      className="inline-flex items-center gap-3 cursor-pointer select-none"
    >
      <span className="relative inline-block w-10 h-6">
        <input
          id={tid}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="absolute inset-0 rounded-full bg-gray-200 dark:bg-neutral-700 peer-checked:bg-brand-500" />
        <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-neutral-100 rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
      </span>
      {label && (
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      )}
    </label>
  );
}
