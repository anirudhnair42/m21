import { getSupabaseAdmin } from "@/lib/supabase-server";

/** Assignment ids that accept submissions today. */
const OPEN_ASSIGNMENTS = new Set(["a11"]);

/**
 * Assignment submissions (e.g. 1.1 "opening line" — the who-are-you-excited-
 * to-see reflection that shapes Questival groups). One row per (rsvp,
 * assignment); resubmitting updates in place. Only joined RSVPs (paid or
 * payment in flight) may submit.
 */
export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ submission: null }, { status: 503 });

  const params = new URL(request.url).searchParams;
  const rsvpId = params.get("rsvp_id");
  const assignment = params.get("assignment") ?? "a11";
  if (!rsvpId || !/^[0-9a-f-]{36}$/i.test(rsvpId)) {
    return Response.json({ error: "bad rsvp_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("submissions")
    .select("body, updated_at")
    .eq("rsvp_id", rsvpId)
    .eq("assignment", assignment)
    .maybeSingle();
  if (error) {
    console.error("submission query failed:", error.message);
    return Response.json({ submission: null }, { status: 500 });
  }
  return Response.json(
    { submission: data ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json({ error: "Backend not configured." }, { status: 503 });
  }

  let payload: { rsvp_id?: string; assignment?: string; body?: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }

  const rsvpId = payload.rsvp_id ?? "";
  const assignment = payload.assignment ?? "a11";
  const body = (payload.body ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(rsvpId)) {
    return Response.json({ error: "bad rsvp_id" }, { status: 400 });
  }
  if (!OPEN_ASSIGNMENTS.has(assignment)) {
    return Response.json({ error: "This assignment isn't open." }, { status: 400 });
  }
  if (!body) {
    return Response.json({ error: "Write something first." }, { status: 400 });
  }
  if (body.length > 5000) {
    return Response.json({ error: "A little shorter, please (5000 chars max)." }, { status: 400 });
  }

  // Only members of the class can submit.
  const { data: rsvp } = await supabase
    .from("rsvps")
    .select("status")
    .eq("id", rsvpId)
    .maybeSingle();
  if (!rsvp || (rsvp.status !== "paid" && rsvp.status !== "processing")) {
    return Response.json({ error: "RSVP first — then this unlocks." }, { status: 403 });
  }

  const { error } = await supabase.from("submissions").upsert(
    {
      rsvp_id: rsvpId,
      assignment,
      body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "rsvp_id,assignment" },
  );
  if (error) {
    console.error("submission upsert failed:", error.message);
    return Response.json({ error: "Couldn't save — try again." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
