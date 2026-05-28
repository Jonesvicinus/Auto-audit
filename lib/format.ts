export function formatCurrency(amount: number, options: { signed?: boolean } = {}): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: abs >= 100 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  if (options.signed && amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
}

export function formatCurrencyCompact(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatPercent(pct: number): string {
  return `${Math.round(pct)}%`;
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...opts,
  });
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
