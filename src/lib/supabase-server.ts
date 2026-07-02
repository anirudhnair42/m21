// Build-time guard: importing this file from any client component fails the
// build instead of risking the secret key in a browser bundle.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key. RLS stays enabled
 * with no public policies — API routes are the only thing that reads or
 * writes the `rsvps` table and `photos` bucket.
 *
 * Returns null when env isn't configured so routes can fail with a clear
 * "not configured" message instead of a crash.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  // URL may come from the dashboard quickstart's NEXT_PUBLIC_ name — same value.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Must be the SECRET (service-role) key — new dashboards call it "secret key"
  // (sb_secret_…). The publishable key can't touch the RLS-locked tables.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
