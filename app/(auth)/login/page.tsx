"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/Toast";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, isAuthenticated, isLoading, supabaseConfigured } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, isLoading, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const err = await signIn(email.trim(), password);
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    toast.success("Welcome back");
    router.replace("/dashboard");
  }

  return (
    <AuthFormShell
      title="Welcome back"
      subtitle="Sign in to keep your budget in sync."
      footer={
        <>
          New to Auto Audit?{" "}
          <Link href="/signup" className="text-brand-700 dark:text-brand-300 font-medium hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {!supabaseConfigured && (
        <Alert level="warn" className="mb-4">
          Supabase isn't configured, so sign-in is disabled. You can still{" "}
          <Link href="/" className="font-medium underline">
            try the demo
          </Link>
          .
        </Alert>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex items-center justify-between text-sm">
          <Link
            href="/forgot-password"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          >
            Forgot password?
          </Link>
        </div>
        {error && <Alert level="danger">{error}</Alert>}
        <Button
          type="submit"
          className="w-full"
          loading={submitting}
          disabled={!supabaseConfigured}
        >
          Sign in
        </Button>
      </form>
    </AuthFormShell>
  );
}
