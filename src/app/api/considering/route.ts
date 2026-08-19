import { getSupabaseAdmin } from "@/lib/supabase-server";
import { RSVP_CLOSED, RSVP_DEADLINE_LABEL } from "@/lib/letter";

/**
 * The "Considering" list: people who've signed in with Google but haven't
 * RSVP'd yet. Interest shows up here — with a name and a question mark instead
 * of a face — before any money changes hands, then graduates to Participants
 * once they actually RSVP.
 */

/**
 * Record the signed-in visitor as "considering". Requires a valid Google
 * token; the name comes from the verified account (never the client) so it
 * can't be spoofed. Idempotent — re-signing in just refreshes the row.
 */
export async function POST(request: Request) {
  if (RSVP_CLOSED) {
    return Response.json(
      { error: `The RSVP deadline ended on ${RSVP_DEADLINE_LABEL}.` },
      { status: 410 },
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ ok: false }, { status: 503 });

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  const { data: userData } = await supabase.auth.getUser(token);
  const user = userData?.user;
  const email = user?.email?.toLowerCase();
  if (!user || !email) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  const meta = user.user_metadata ?? {};
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    email.split("@")[0];

  const { error } = await supabase
    .from("considering")
    .upsert({ email, name }, { onConflict: "email" });
  if (error) {
    console.error("considering upsert failed:", error.message);
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}

/**
 * The list for the rail: names only (emails never leave the server), newest
 * first — every name, the UI scrolls. Anyone who's already RSVP'd has
 * graduated out of "considering" and is filtered out by email.
 */
export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ considering: [], count: null });

  const [considering, rsvps] = await Promise.all([
    supabase
      .from("considering")
      .select("name, email, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("rsvps")
      .select("email")
      .neq("status", "failed")
      .not("email", "is", null),
  ]);
  if (considering.error) {
    console.error("considering query failed:", considering.error.message);
    return Response.json({ considering: [], count: null });
  }

  const rsvped = new Set(
    (rsvps.data ?? [])
      .map((r) => (r.email as string | null)?.toLowerCase())
      .filter((e): e is string => !!e),
  );
  const pending = (considering.data ?? []).filter(
    (r) => !rsvped.has((r.email as string).toLowerCase()),
  );

  return Response.json(
    {
      considering: pending.map((r) => r.name as string),
      count: pending.length,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
