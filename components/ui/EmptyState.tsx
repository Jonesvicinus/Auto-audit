import React from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "md",
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const pad = size === "sm" ? "py-8 px-4" : size === "lg" ? "py-16 px-8" : "py-12 px-6";
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${pad} animate-fade-in`}
    >
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 grid place-items-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
