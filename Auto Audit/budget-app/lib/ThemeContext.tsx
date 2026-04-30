"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
  toggle: () => void;
}

const STORAGE_KEY = "auto-audit:theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyHtmlClass(theme: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  return (window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null) ?? "system";
}

function resolvePreference(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? readSystemTheme() : preference;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolvePreference(readStoredPreference()),
  );

  // Hydrate from localStorage and apply once mounted.
  useEffect(() => {
    const initial = readStoredPreference();
    setPreferenceState(initial);
    const next = resolvePreference(initial);
    setResolved(next);
    applyHtmlClass(next);
  }, []);

  // React to system preference changes when in "system" mode.
  useEffect(() => {
    if (preference !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const next: ResolvedTheme = mq.matches ? "dark" : "light";
      setResolved(next);
      applyHtmlClass(next);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, p);
    }
    const next = resolvePreference(p);
    applyHtmlClass(next);
    setPreferenceState(p);
    setResolved(next);
  }, []);

  const toggle = useCallback(() => {
    // Clicking the button always commits to a manual choice.
    setPreference(resolved === "dark" ? "light" : "dark");
  }, [resolved, setPreference]);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
