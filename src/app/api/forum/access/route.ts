import { gateOff, resolveCaller } from "@/lib/forum-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

/**
 * Who may see the weekend Forum (phone routes, and the Calendar / Maps /
 * Photos / Assignment 3 surfaces on the desktop) right now.
 *
 * The rules live in resolveCaller (src/lib/forum-server.ts), shared with
 * every bearer route: FORUM_TESTERS / FORUM_TESTER_NAMES before launch,
 * FORUM_OPEN=1 for every confirmed RSVP. `organizer` follows the same rule
 * as the admin routes (testers + ORGANIZER_EMAILS); `questival` is
 * QUESTIVAL_OPEN=1 or organizer.
 */
export async function GET(request: Request) {
  if (!getSupabaseAdmin()) return Response.json({ allowed: false, reason: "unconfigured" }, { status: 503 });

  // Local development only: FORUM_GATE=off lets the tunnel preview through
  // without Google. Ignored in production builds.
  if (gateOff()) {
    return Response.json({ allowed: true, name: "You", photoUrl: null, tester: true, organizer: true, questival: true, gate: "off" });
  }

  const r = await resolveCaller(request);
  if (!r.ok) return Response.json({ allowed: false, reason: r.reason }, { status: r.status });

  const c = r.caller;
  return Response.json(
    {
      allowed: c.allowed,
      reason: c.reason,
      email: c.email,
      name: c.name,
      photoUrl: c.photoUrl,
      rsvpId: c.rsvp?.id ?? null,
      tester: c.tester,
      organizer: c.organizer,
      // Questival opens to the class with QUESTIVAL_OPEN=1; organizers see it early.
      questival: process.env.QUESTIVAL_OPEN === "1" || c.organizer,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
