"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useAuth } from "@/lib/AuthContext";

export default function ForgotPasswordPage() {
  const { requestPasswordReset, supabaseConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const err = await requestPasswordReset(email.trim());
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthFormShell
      title="Reset your password"
      subtitle="We'll email you a link to set a new one."
      footer={
        <>
          Back to{" "}
          <Link href="/login" className="text-brand-700 dark:text-brand-300 font-medium hover:underline">
            sign in
          </Link>
        </>
      }
    >
      {!supabaseConfigured && (
        <Alert level="warn" className="mb-4">
          Supabase isn't configured, so password reset isn't available.
        </Alert>
      )}
      {sent ? (
        <Alert level="info">
          Check your inbox for {email}. The link will expire in about an hour.
        </Alert>
      ) : (
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
          {error && <Alert level="danger">{error}</Alert>}
          <Button
            type="submit"
            className="w-full"
            loading={submitting}
            disabled={!supabaseConfigured}
          >
            Send reset link
          </Button>
        </form>
      )}
    </AuthFormShell>
  );
}
