import React from "react";

export function Skeleton({
  className = "",
  rounded = "rounded-lg",
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={`bg-gray-200 dark:bg-neutral-800 animate-skeleton-pulse ${rounded} ${className}`}
      aria-hidden
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function StatTileSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-card">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-32 mt-3" />
      <Skeleton className="h-3 w-28 mt-2" />
    </div>
  );
}
