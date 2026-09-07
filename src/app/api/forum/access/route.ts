import { getSupabaseAdmin } from "@/lib/supabase-server";

/**
 * Who may see the weekend Forum (phone routes, and the Calendar / Maps /
 * Photos / Assignment 3 surfaces on the desktop) right now.
 *
 * Before launch: the cohost preview list. A cohost passes if
 *   - their Google email is in FORUM_TESTERS, or
 *   - their Google email is the email on an RSVP whose name is in
 *     FORUM_TESTER_NAMES, or
 *   - their Google profile name matches a name in FORUM_TESTER_NAMES
 *     (classmates sign in with a Gmail or a Minerva account interchangeably).
 * Launch: FORUM_OPEN=1 admits every confirmed RSVP.
 */
function norm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}
function firstLast(s: string): string {
  const parts = norm(s).split(" ");
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0] ?? "";
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ allowed: false, reason: "unconfigured" }, { status: 503 });

  // Local development only: FORUM_GATE=off lets the tunnel preview through
  // without Google. Ignored in production builds.
  if (process.env.FORUM_GATE === "off" && process.env.NODE_ENV !== "production") {
    return Response.json({ allowed: true, name: "You", photoUrl: null, tester: true, gate: "off" });
  }

  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ allowed: false, reason: "anon" }, { status: 401 });

  const { data: userData, error } = await supabase.auth.getUser(token);
  const email = userData?.user?.email?.toLowerCase();
  if (error || !email) return Response.json({ allowed: false, reason: "anon" }, { status: 401 });

  const split = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const testerEmails = split(process.env.FORUM_TESTERS).map((s) => s.toLowerCase());
  const testerNames = new Set(split(process.env.FORUM_TESTER_NAMES).map(firstLast));
  const open = process.env.FORUM_OPEN === "1";

  const { data: rsvp } = await supabase
    .from("rsvps")
    .select("id, name, photo_url, status")
    .eq("email", email)
    .in("status", ["paid", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const meta = userData.user?.user_metadata ?? {};
  const googleName =
    (typeof meta.full_name === "string" && meta.full_name) || (typeof meta.name === "string" && meta.name) || "";

  const isTester =
    testerEmails.includes(email) ||
    (rsvp?.name ? testerNames.has(firstLast(rsvp.name)) : false) ||
    (googleName ? testerNames.has(firstLast(googleName)) : false);
  const allowed = isTester || (open && rsvp !== null);

  // A tester signing in with their non-RSVP account still gets their RSVP
  // photo: look the row up by name.
  let photoUrl: string | null = rsvp?.photo_url ?? null;
  let name: string = rsvp?.name ?? googleName ?? email.split("@")[0];
  if (allowed && !rsvp && googleName) {
    const { data: byName } = await supabase
      .from("rsvps")
      .select("name, photo_url")
      .in("status", ["paid", "processing"])
      .ilike("name", `${googleName.split(" ")[0]}%`)
      .limit(5);
    const hit = (byName ?? []).find((r) => firstLast(r.name) === firstLast(googleName));
    if (hit) {
      photoUrl = hit.photo_url ?? null;
      name = hit.name;
    }
  }
  if (!photoUrl && typeof meta.avatar_url === "string") photoUrl = meta.avatar_url;

  return Response.json(
    {
      allowed,
      reason: allowed ? null : rsvp ? "not-yet" : "no-rsvp",
      email,
      name,
      photoUrl,
      rsvpId: rsvp?.id ?? null,
      tester: isTester,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
