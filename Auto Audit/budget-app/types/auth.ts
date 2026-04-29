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
