/**
 * Backend setup check: run `node scripts/check-setup.mjs` after editing
 * .env.local. Verifies the Supabase secret key works, both tables exist,
 * the photos bucket exists, and whether Stripe keys are present (and which
 * mode). Read-only — writes nothing.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Minimal .env.local loader (no dependency on dotenv).
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  }
} catch {
  console.log("✗ .env.local not found");
  process.exit(1);
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const stripeKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

let failed = false;
const ok = (msg) => console.log(`✓ ${msg}`);
const bad = (msg) => {
  console.log(`✗ ${msg}`);
  failed = true;
};

if (!url) bad("Supabase URL missing (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL)");
else ok(`Supabase URL set (${new URL(url).hostname})`);

if (!key) {
  bad(
    "Supabase SECRET key missing — set SUPABASE_SERVICE_ROLE_KEY (dashboard: Project Settings → API keys → 'secret' key, sb_secret_…). The publishable key won't work.",
  );
} else if (key.startsWith("sb_publishable_")) {
  bad("You've set the PUBLISHABLE key as the secret — swap in the sb_secret_… key.");
} else {
  ok("Supabase secret key set");
}

if (url && key && !key.startsWith("sb_publishable_")) {
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  for (const table of ["rsvps", "aid_requests"]) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true });
    if (error) bad(`table '${table}' not reachable: ${error.message}`);
    else ok(`table '${table}' reachable (${count} rows)`);
  }
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) bad(`storage not reachable: ${bErr.message}`);
  else if (!buckets?.some((b) => b.name === "photos"))
    bad("bucket 'photos' missing — create it (public) or run the setup SQL insert");
  else ok("bucket 'photos' exists");
}

if (!stripeKey) bad("STRIPE_SECRET_KEY missing — checkout will 503 until set");
else if (stripeKey.startsWith("sk_test_")) ok("Stripe key set (TEST mode)");
else if (stripeKey.startsWith("sk_live_")) ok("Stripe key set (LIVE mode — real money)");
else ok("Stripe key set (unrecognized prefix — double-check it)");

if (!webhookSecret)
  console.log("• STRIPE_WEBHOOK_SECRET not set — fine until you add the webhook after deploying");
else ok("Stripe webhook secret set");

process.exit(failed ? 1 : 0);
