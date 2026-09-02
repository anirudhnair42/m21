// Build-time guard: this reads the invite secret, so it must never end up in
// a browser bundle. The client half lives in lateInvite.ts.
import "server-only";

/**
 * The server side of the one-person late-RSVP invite (see lateInvite.ts).
 * True only when the submitted form carries the exact token in the
 * LATE_RSVP_INVITE_TOKEN env var. Env var unset → nothing matches and the
 * closed gate holds unconditionally; delete the var to kill the link.
 */
export function hasLateInvite(form: FormData): boolean {
  const expected = process.env.LATE_RSVP_INVITE_TOKEN;
  const got = form.get("invite");
  return !!expected && typeof got === "string" && got === expected;
}
