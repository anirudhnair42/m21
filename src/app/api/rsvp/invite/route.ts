import { isLateInviteToken } from "@/lib/lateInviteServer";

/**
 * Does this late-RSVP invite token actually open the door? The RSVP window
 * asks before showing the form, so a mangled or stale link says so up front
 * instead of failing at "Continue to payment". Reveals nothing beyond yes/no.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  return Response.json(
    { valid: isLateInviteToken(token) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
