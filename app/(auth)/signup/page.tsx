"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/Toast";

export default function SignupPage() {
  const router = useRouter();
  const { signUp, isAuthenticated, isLoading, supabaseConfigured } = useAuth();
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  // Redirect if already signed in
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, isLoading, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const result = await signUp(email.trim(), password, name.trim() || undefined);
    setSubmitting(false);

    if (result === null) {
      // Email confirmation off — user is signed in immediately
      toast.success("Welcome to Auto Audit", "Your account is ready.");
      router.replace("/dashboard");
      return;
    }
    if ("needsConfirmation" in result) {
      // Email confirmation on — show check-your-email state
      setPendingEmail(result.email);
      return;
    }
    // AuthFormError
    setError(result.message);
  }

  // Confirmation-pending success state — replaces the form when shown.
  if (pendingEmail) {
    return (
      <AuthFormShell
        title="Check your email"
        subtitle="One quick step before you can sign in."
        footer={
          <>
            Didn't get the email?{" "}
            <button
              onClick={() => setPendingEmail(null)}
              className="text-brand-700 dark:text-brand-300 font-medium hover:underline"
            >
              Try again
            </button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-700/15 text-brand-700 dark:text-brand-300 grid place-items-center mb-4">
            <MailCheck className="w-6 h-6" />
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            We sent a confirmation link to{" "}
            <span className="font-semibold">{pendingEmail}</span>.
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Click the link, then come back here to sign in.
          </p>
          <Link href="/login" className="mt-6 w-full">
            <Button className="w-full">Go to sign in</Button>
          </Link>
        </div>
      </AuthFormShell>
    );
  }

  return (
    <AuthFormShell
      title="Create your account"
      subtitle="Free to start. No credit card. Cancel anytime."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-brand-700 dark:text-brand-300 font-medium hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      {!supabaseConfigured && (
        <Alert level="warn" className="mb-4">
          Supabase isn't configured. Sign-up is disabled. You can still{" "}
          <Link href="/" className="font-medium underline">
            try the demo
          </Link>
          .
        </Alert>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Name (optional)"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alex Carter"
        />
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
          minLength={8}
          autoComplete="new-password"
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="Confirm password"
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <Alert level="danger">{error}</Alert>}
        <Button
          type="submit"
          className="w-full"
          loading={submitting}
          disabled={!supabaseConfigured}
        >
          Create account
        </Button>
      </form>
    </AuthFormShell>
  );
}
