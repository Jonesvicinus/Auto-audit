// Thin app-facing aliases so pages don't import @supabase/* directly.
// Keeps the rest of the app decoupled from the auth provider.

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  createdAt?: string;
}

export type AuthMode = "demo" | "supabase" | "loading" | "anonymous";

export interface AuthFormError {
  message: string;
  field?: string;
}

// Sign-up can succeed in two ways:
//   - immediately authenticated (email confirmation off) → returns null
//   - awaiting email confirmation                         → returns { needsConfirmation: true }
// Anything else is a friendly error.
export type SignUpResult =
  | AuthFormError
  | { needsConfirmation: true; email: string }
  | null;
