"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient";
import type { AuthFormError, AuthMode, AuthUser } from "@/types/auth";

const DEMO_FLAG_KEY = "auto-audit:demo-mode";

interface AuthContextValue {
  user: AuthUser | null;
  mode: AuthMode;
  isDemo: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  supabaseConfigured: boolean;

  signIn: (email: string, password: string) => Promise<AuthFormError | null>;
  signUp: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<AuthFormError | null>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<AuthFormError | null>;
  updatePassword: (newPassword: string) => Promise<AuthFormError | null>;

  enterDemoMode: () => void;
  exitDemoMode: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function userFromSupabase(u: { id: string; email?: string; user_metadata?: { name?: string }; created_at?: string } | null): AuthUser | null {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? "",
    name: u.user_metadata?.name,
    createdAt: u.created_at,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const supabaseConfigured = isSupabaseConfigured();
  const didInit = useRef(false);

  // Initial bootstrap: read demo flag, then check Supabase session if configured.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    (async () => {
      // Demo flag from localStorage
      if (typeof window !== "undefined") {
        const flag = window.localStorage.getItem(DEMO_FLAG_KEY);
        if (flag === "1") setIsDemo(true);
      }

      const sb = getSupabaseClient();
      if (sb) {
        const { data } = await sb.auth.getSession();
        const su = data.session?.user;
        if (su) {
          setUser(userFromSupabase(su as never));
          // If the user was in demo mode but is now logged in, exit demo.
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(DEMO_FLAG_KEY);
          }
          setIsDemo(false);
        }

        // Listen for changes (login, logout, refresh)
        const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
          setUser(userFromSupabase((session?.user as never) ?? null));
        });
        // Cleanup is fine; this effect only runs once.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _unsub = () => sub.subscription.unsubscribe();
      }
      setIsLoading(false);
    })();
  }, []);

  const enterDemoMode = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEMO_FLAG_KEY, "1");
    }
    setIsDemo(true);
  }, []);

  const exitDemoMode = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DEMO_FLAG_KEY);
    }
    setIsDemo(false);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthFormError | null> => {
      const sb = getSupabaseClient();
      if (!sb) {
        return {
          message:
            "Sign-in isn't available without a Supabase connection. Try the demo to explore the app.",
        };
      }
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return { message: error.message };
      setUser(userFromSupabase((data.user as never) ?? null));
      // Leaving demo mode silently if they had it on
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DEMO_FLAG_KEY);
      }
      setIsDemo(false);
      return null;
    },
    [],
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      name?: string,
    ): Promise<AuthFormError | null> => {
      const sb = getSupabaseClient();
      if (!sb) {
        return {
          message:
            "Sign-up isn't available without a Supabase connection. Try the demo to explore the app.",
        };
      }
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) return { message: error.message };
      // If email confirmation is disabled, session is returned right away
      setUser(userFromSupabase((data.user as never) ?? null));
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DEMO_FLAG_KEY);
      }
      setIsDemo(false);
      return null;
    },
    [],
  );

  const signOut = useCallback(async () => {
    const sb = getSupabaseClient();
    if (sb) await sb.auth.signOut();
    setUser(null);
  }, []);

  const requestPasswordReset = useCallback(
    async (email: string): Promise<AuthFormError | null> => {
      const sb = getSupabaseClient();
      if (!sb) {
        return {
          message:
            "Password reset isn't available without a Supabase connection.",
        };
      }
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined;
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) return { message: error.message };
      return null;
    },
    [],
  );

  const updatePassword = useCallback(
    async (newPassword: string): Promise<AuthFormError | null> => {
      const sb = getSupabaseClient();
      if (!sb) {
        return {
          message:
            "Password update isn't available without a Supabase connection.",
        };
      }
      const { error } = await sb.auth.updateUser({ password: newPassword });
      if (error) return { message: error.message };
      return null;
    },
    [],
  );

  const mode: AuthMode = useMemo(() => {
    if (isLoading) return "loading";
    if (user) return "supabase";
    if (isDemo) return "demo";
    return "anonymous";
  }, [user, isDemo, isLoading]);

  const value: AuthContextValue = {
    user,
    mode,
    isDemo,
    isAuthenticated: Boolean(user),
    isLoading,
    supabaseConfigured,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
    enterDemoMode,
    exitDemoMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
