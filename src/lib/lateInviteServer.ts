// Build-time guard: this reads the invite secret, so it must never end up in
// a browser bundle. The client half lives in lateInvite.ts.
import "server-only";

/**
 * The server side of the one-person late-RSVP invite (see lateInvite.ts).
 * A candidate matches only when it equals the LATE_RSVP_INVITE_TOKEN env var
 * exactly. Env var unset → nothing matches and the closed gate holds
 * unconditionally; delete the var to kill the link.
 */
export function isLateInviteToken(candidate: unknown): boolean {
  const expected = process.env.LATE_RSVP_INVITE_TOKEN;
  if (!expected || typeof candidate !== "string" || candidate.length === 0) {
    return false;
  }
  const ok = candidate === expected;
  if (!ok) {
    // Diagnostics for a mistyped/mangled link — never log the full values.
    console.warn(
      `late invite mismatch: got len=${candidate.length} prefix=${candidate.slice(0, 4)}, expected len=${expected.length}`,
    );
  }
  return ok;
}

/** True when a submitted form carries the matching `invite` field. */
export function hasLateInvite(form: FormData): boolean {
  return isLateInviteToken(form.get("invite"));
}
