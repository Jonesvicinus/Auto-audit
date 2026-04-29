import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
};

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-300 dark:disabled:bg-brand-800/60 disabled:text-white/70",
  secondary:
    "bg-gray-900 text-white hover:bg-gray-800 shadow-sm disabled:bg-gray-400 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800",
  danger: "bg-danger-600 text-white hover:bg-danger-700 shadow-sm",
  outline:
    "bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 dark:bg-neutral-900 dark:text-gray-100 dark:border-neutral-700 dark:hover:bg-neutral-800",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2 text-sm rounded-lg",
  lg: "px-5 py-3 text-base rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {rightIcon}
    </button>
  );
}
