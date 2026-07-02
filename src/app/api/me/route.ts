import { getSupabaseAdmin } from "@/lib/supabase-server";

/**
 * Who am I, according to my Google session? Verifies the bearer token with
 * Supabase Auth, then finds the caller's RSVP row by email (Stripe backfills
 * the email on payment; logged-in RSVPs are stamped at insert). This is what
 * makes an RSVP follow the person across devices.
 */
export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ user: null, rsvp: null }, { status: 503 });

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ user: null, rsvp: null }, { status: 401 });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const email = userData?.user?.email;
  if (userError || !email) {
    return Response.json({ user: null, rsvp: null }, { status: 401 });
  }

  const { data: rsvp } = await supabase
    .from("rsvps")
    .select("id, status, name, photo_url")
    .eq("email", email.toLowerCase())
    .neq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Response.json(
    { user: { email }, rsvp: rsvp ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Claim a guest RSVP for the signed-in account: the device that created the
 * row remembers its id; on sign-in we stamp the verified email onto it —
 * only if it isn't owned by anyone yet — making the link permanent across
 * devices no matter what email was typed into Stripe.
 */
export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ claimed: false }, { status: 503 });

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ claimed: false }, { status: 401 });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const email = userData?.user?.email?.toLowerCase();
  if (userError || !email) {
    return Response.json({ claimed: false }, { status: 401 });
  }

  let body: { rsvp_id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ claimed: false }, { status: 400 });
  }
  const rsvpId = body.rsvp_id ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(rsvpId)) {
    return Response.json({ claimed: false }, { status: 400 });
  }

  const { data: claimed } = await supabase
    .from("rsvps")
    .update({ email })
    .eq("id", rsvpId)
    .is("email", null)
    .select("id")
    .maybeSingle();

  return Response.json({ claimed: claimed !== null });
}
