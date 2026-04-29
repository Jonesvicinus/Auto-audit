"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/Toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { updatePassword, supabaseConfigured } = useAuth();
  const toast = useToast();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    const err = await updatePassword(password);
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    toast.success("Password updated", "You're all set.");
    router.replace("/dashboard");
  }

  return (
    <AuthFormShell
      title="Set a new password"
      subtitle="Pick something you'll remember."
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
          Supabase isn't configured, so password updates aren't available.
        </Alert>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="New password"
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
          label="Confirm new password"
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
          Update password
        </Button>
      </form>
    </AuthFormShell>
  );
}
