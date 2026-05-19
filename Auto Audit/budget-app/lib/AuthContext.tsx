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
import { CURRENT_STORAGE_VERSION, LEGACY_STORAGE_VERSIONS } from "./storage";
import type {
  AuthFormError,
  AuthMode,
  AuthUser,
  SignUpResult,
} from "@/types/auth";

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
  ) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<AuthFormError | null>;
  updatePassword: (newPassword: string) => Promise<AuthFormError | null>;

  enterDemoMode: () => Promise<void>;
  exitDemoMode: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type SupabaseUserShape = {
  id: string;
  email?: string;
  user_metadata?: { name?: string };
  created_at?: string;
  identities?: { id: string }[] | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

function userFromSupabase(u: SupabaseUserShape | null): AuthUser | null {
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
    let unsubscribe: (() => void) | null = null;

    (async () => {
      // Demo flag from localStorage
      if (typeof window !== "undefined") {
        const flag = window.localStorage.getItem(DEMO_FLAG_KEY);
        if (flag === "1") setIsDemo(true);
      }

      const sb = getSupabaseClient();
      if (sb) {
        const { data } = await sb.auth.getSession();
        // Only treat as authenticated if there is a real session (i.e. email
        // confirmation isn't pending). data.session is null until confirmed.
        if (data.session?.user) {
          setUser(userFromSupabase(data.session.user as SupabaseUserShape));
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(DEMO_FLAG_KEY);
            document.cookie = "auto-audit-demo=; path=/; max-age=0; SameSite=Lax";
          }
          setIsDemo(false);
        }

        // Listen for changes (login, logout, refresh, email confirmation)
        const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
          // Same rule: a user is "authenticated" only when a session exists.
          if (session?.user) {
            setUser(userFromSupabase(session.user as SupabaseUserShape));
            if (typeof window !== "undefined") {
              window.localStorage.removeItem(DEMO_FLAG_KEY);
              document.cookie = "auto-audit-demo=; path=/; max-age=0; SameSite=Lax";
            }
            setIsDemo(false);
          } else {
            setUser(null);
          }
        });
        unsubscribe = () => sub.subscription.unsubscribe();
      }
      setIsLoading(false);
    })();

    return () => {
      unsubscribe?.();
    };
  }, []);

  const enterDemoMode = useCallback(async () => {
    // If currently signed in, sign out FIRST so the user lands in clean
    // demo state (Alex Carter's data) rather than their own real data.
    const sb = getSupabaseClient();
    if (sb) {
      try {
        await sb.auth.signOut();
      } catch {
        // best effort — keep going
      }
    }
    setUser(null);
    if (typeof window !== "undefined") {
      for (const version of [CURRENT_STORAGE_VERSION, ...LEGACY_STORAGE_VERSIONS]) {
        window.localStorage.removeItem(`auto-audit:${version}:demo`);
      }
      window.localStorage.setItem(DEMO_FLAG_KEY, "1");
      document.cookie = "auto-audit-demo=1; path=/; SameSite=Lax";
    }
    setIsDemo(true);
  }, []);

  const exitDemoMode = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DEMO_FLAG_KEY);
      document.cookie = "auto-audit-demo=; path=/; max-age=0; SameSite=Lax";
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
      const { data, error } = await sb.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        // Surface a friendlier message for the most common confirmation case.
        if (/email not confirmed/i.test(error.message)) {
          return {
            message:
              "Please confirm your email first. Check your inbox for a verification link.",
          };
        }
        return { message: error.message };
      }
      setUser(userFromSupabase((data.user as SupabaseUserShape) ?? null));
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DEMO_FLAG_KEY);
        document.cookie = "auto-audit-demo=; path=/; max-age=0; SameSite=Lax";
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
    ): Promise<SignUpResult> => {
      const sb = getSupabaseClient();
      if (!sb) {
        return {
          message:
            "Sign-up isn't available without a Supabase connection. Try the demo to explore the app.",
        };
      }
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : undefined;
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { name }, emailRedirectTo },
      });
      if (error) {
        if (/rate limit/i.test(error.message)) {
          return {
            message:
              "Too many confirmation emails have been requested. Please wait a few minutes and try again.",
          };
        }
        return { message: error.message };
      }

      // Supabase signals "email already registered" by returning a user object
      // with an empty identities array (a quirk of how it avoids leaking which
      // emails are taken to anonymous callers). Catch and surface clearly.
      const supaUser = data.user as SupabaseUserShape | null;
      if (supaUser && Array.isArray(supaUser.identities) && supaUser.identities.length === 0) {
        return {
          message:
            "An account with this email already exists. Try signing in instead.",
        };
      }

      // If a session came back, email confirmation is OFF in this Supabase
      // project — the user is signed in immediately.
      if (data.session) {
        setUser(userFromSupabase(supaUser));
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(DEMO_FLAG_KEY);
          document.cookie = "auto-audit-demo=; path=/; max-age=0; SameSite=Lax";
        }
        setIsDemo(false);
        return null;
      }

      // No session = email confirmation required. Don't set user.
      return { needsConfirmation: true, email };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const sb = getSupabaseClient();
    if (sb) await sb.auth.signOut();
    setUser(null);
    if (typeof window !== "undefined") {
      document.cookie = "auto-audit-demo=; path=/; max-age=0; SameSite=Lax";
    }
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
