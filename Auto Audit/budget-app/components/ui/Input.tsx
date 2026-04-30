import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  leftAdornment?: React.ReactNode;
};

const baseInputClasses =
  "w-full px-3 py-2 text-sm border bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500";

export function Input({
  label,
  hint,
  error,
  leftAdornment,
  className = "",
  id,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {label}
        </label>
      )}
      <div className={`relative ${leftAdornment ? "flex items-stretch" : ""}`}>
        {leftAdornment && (
          <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 dark:border-neutral-700 rounded-l-lg bg-gray-50 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 text-sm">
            {leftAdornment}
          </span>
        )}
        <input
          id={inputId}
          {...props}
          className={`${baseInputClasses} border-gray-300 dark:border-neutral-700 ${
            leftAdornment ? "rounded-r-lg" : "rounded-lg"
          } ${error ? "border-danger-400 focus:ring-danger-500" : ""} ${className}`}
        />
      </div>
      {hint && !error && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</p>
      )}
      {error && <p className="text-xs text-danger-600 mt-1">{error}</p>}
    </div>
  );
}

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
};
export function TextArea({ label, id, className = "", ...props }: TextAreaProps) {
  const textId = id ?? props.name;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={textId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {label}
        </label>
      )}
      <textarea
        id={textId}
        {...props}
        className={`${baseInputClasses} border-gray-300 dark:border-neutral-700 rounded-lg ${className}`}
      />
    </div>
  );
}
