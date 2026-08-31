import { getSupabaseAdmin } from "@/lib/supabase-server";

/**
 * Confidential financial-aid requests → aid_requests table. Reviewed by the
 * organizing committee straight from the Supabase table editor.
 *
 * Intentionally NOT gated by RSVP_CLOSED. Registration and payments stay
 * closed, but aid requests remain open — reachable only through the unlisted
 * `?open=aid` deep link (no dock icon, no on-site link), so a classmate who
 * still needs help with the fee, housing, or travel can ask after the deadline.
 */
export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json(
      { error: "Not configured yet — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const barriers = Array.isArray(body.barriers)
    ? body.barriers.map((b) => String(b)).slice(0, 10)
    : [];
  if (!name || !email || barriers.length === 0) {
    return Response.json(
      { error: "Name, email, and at least one barrier are required." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("aid_requests").insert({
    name,
    email,
    barriers,
    amount: String(body.amount ?? "").trim() || null,
    would_attend: String(body.wouldAttend ?? "").trim() || null,
    reason: String(body.reason ?? "").trim() || null,
  });
  if (error) {
    console.error("aid insert failed:", error.message);
    return Response.json(
      { error: "Couldn't save your request — please try again." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
