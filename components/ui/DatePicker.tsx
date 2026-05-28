"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

type DatePickerProps = {
  label?: string;
  name?: string;
  value: string;
  max?: string;
  onChange: (value: string) => void;
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function toIsoDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function formatDisplayDate(value: string) {
  const date = parseIsoDate(value);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${date.getFullYear()}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function DatePicker({ label, name, value, max, onChange }: DatePickerProps) {
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const maxDate = max ? parseIsoDate(max) : null;
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const focusedButtonRef = useRef<HTMLButtonElement | null>(null);
  const inputId = name ? `${name}-date-picker` : undefined;
  const popupId = name ? `${name}-date-picker-dialog` : undefined;

  // Sync view to selected date when opening; reset focused date on close.
  useEffect(() => {
    if (open) {
      setViewDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
      setFocusedDate(selectedDate);
    } else {
      setFocusedDate(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // When focusedDate crosses into a different month, update the view.
  useEffect(() => {
    if (!focusedDate || !open) return;
    if (
      focusedDate.getMonth() !== viewDate.getMonth() ||
      focusedDate.getFullYear() !== viewDate.getFullYear()
    ) {
      setViewDate(new Date(focusedDate.getFullYear(), focusedDate.getMonth(), 1));
    }
  }, [focusedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Move DOM focus to the currently keyboard-focused day button.
  useEffect(() => {
    if (focusedDate && open) {
      focusedButtonRef.current?.focus();
    }
  }, [focusedDate, open]);

  // Close on outside click.
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const monthDays = useMemo(() => {
    const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  }, [viewDate]);

  function changeMonth(delta: number) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function moveFocus(days: number) {
    setFocusedDate((current) => {
      const base = current ?? selectedDate;
      return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
    });
  }

  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="relative w-full" ref={rootRef}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {label}
        </label>
      )}
      <button
        id={inputId}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={popupId}
        onClick={() => setOpen((next) => !next)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.preventDefault();
            setOpen(false);
          }
        }}
        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 flex items-center justify-between gap-3"
      >
        <span className="tabular-nums">{formatDisplayDate(value)}</span>
        <Calendar className="w-4 h-4 text-gray-700 dark:text-gray-300" />
      </button>

      {open && (
        <div
          id={popupId}
          role="dialog"
          aria-label={`Choose date — ${monthLabel}`}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
            if (e.key === "ArrowLeft") { e.preventDefault(); moveFocus(-1); }
            if (e.key === "ArrowRight") { e.preventDefault(); moveFocus(1); }
            if (e.key === "ArrowUp") { e.preventDefault(); moveFocus(-7); }
            if (e.key === "ArrowDown") { e.preventDefault(); moveFocus(7); }
          }}
          className="absolute left-0 top-full z-50 mt-2 w-[21rem] rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-pop"
        >
          <div className="flex items-center justify-between">
            <p
              aria-live="polite"
              aria-atomic="true"
              className="text-sm font-semibold text-gray-900 dark:text-gray-100"
            >
              {monthLabel}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="grid h-8 w-8 place-items-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="grid h-8 w-8 place-items-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((day, index) => (
              <div
                key={`${day}-${index}`}
                aria-hidden="true"
                className="py-1 text-xs font-medium text-gray-500 dark:text-gray-400"
              >
                {day}
              </div>
            ))}
            {monthDays.map((date) => {
              const iso = toIsoDate(date);
              const outsideMonth = date.getMonth() !== viewDate.getMonth();
              const disabled = Boolean(maxDate && date > maxDate);
              const selected = isSameDay(date, selectedDate);
              const isFocused = Boolean(focusedDate && isSameDay(date, focusedDate));

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  tabIndex={isFocused ? 0 : -1}
                  ref={isFocused ? focusedButtonRef : undefined}
                  aria-selected={selected}
                  aria-label={date.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !disabled) {
                      e.preventDefault();
                      onChange(iso);
                      setOpen(false);
                    }
                  }}
                  className={`grid h-9 place-items-center rounded-lg text-sm tabular-nums ${
                    selected
                      ? "bg-brand-600 text-white font-semibold"
                      : outsideMonth
                        ? "text-gray-400 dark:text-gray-600"
                        : "text-gray-900 dark:text-gray-100 hover:bg-brand-50 dark:hover:bg-brand-700/15"
                  } ${disabled ? "cursor-not-allowed opacity-35 hover:bg-transparent dark:hover:bg-transparent" : ""}`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-gray-200 dark:border-neutral-800 pt-3">
            <button
              type="button"
              onClick={() => {
                const today = max ?? toIsoDate(new Date());
                onChange(today);
                setOpen(false);
              }}
              className="text-sm font-medium text-brand-700 dark:text-brand-300"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-gray-500 dark:text-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
