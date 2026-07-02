"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client (publishable key — safe to expose). Used ONLY for
 * Google auth/session; all data reads and writes stay behind our API routes.
 * Null when the NEXT_PUBLIC_ env isn't configured, so the app degrades to
 * the guest experience instead of crashing.
 */
let cached: SupabaseClient | null | undefined;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  cached =
    url && key
      ? createClient(url, key, {
          auth: {
            // PKCE puts the auth code in the query string (?code=…) instead
            // of a #fragment, so it survives our own URL cleanup on return.
            flowType: "pkce",
            detectSessionInUrl: true,
            persistSession: true,
          },
        })
      : null;
  return cached;
}
