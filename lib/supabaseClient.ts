"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Browser-side Supabase client. Returns null if env vars are missing — the app
// falls back gracefully to demo-only mode in that case.
let _client: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (_client !== undefined) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    _client = null;
    return null;
  }
  _client = createBrowserClient(url, anon);
  return _client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
