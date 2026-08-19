import { getSupabaseAdmin } from "@/lib/supabase-server";
import { RSVP_CLOSED, RSVP_DEADLINE_LABEL } from "@/lib/letter";

/**
 * Confidential financial-aid requests → aid_requests table. Reviewed by the
 * organizing committee straight from the Supabase table editor.
 */
export async function POST(request: Request) {
  if (RSVP_CLOSED) {
    return Response.json(
      { error: `The RSVP deadline ended on ${RSVP_DEADLINE_LABEL}.` },
      { status: 410 },
    );
  }

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
