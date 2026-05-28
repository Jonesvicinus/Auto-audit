import React from "react";

type Option = { value: string; label: string };

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: Option[];
  hint?: string;
  error?: string;
};

export function Select({ label, options, hint, error, id, className = "", ...props }: SelectProps) {
  const selectId = id ?? props.name;
  const hintId = selectId ? `${selectId}-hint` : undefined;
  const errorId = selectId ? `${selectId}-error` : undefined;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
        className={`w-full px-3 py-2 text-sm border bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${
          error
            ? "border-danger-400 focus:ring-danger-500"
            : "border-gray-300 dark:border-neutral-700"
        } ${className}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && !error && (
        <p id={hintId} className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger-600 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
