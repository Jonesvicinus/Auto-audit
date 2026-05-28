import React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

export function Card({ className = "", padded = true, children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-card ${
        padded ? "p-6" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
