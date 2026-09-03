/**
 * One-person late-RSVP invite.
 *
 * RSVP is closed (`RSVP_CLOSED` in letter.ts) and stays closed. The single
 * carve-out: a private link like `/?open=rsvp&invite=<token>` where the token
 * matches the LATE_RSVP_INVITE_TOKEN env var. The client stashes the token in
 * sessionStorage (so it survives the Stripe checkout round-trip in the same
 * tab) and sends it with /api/rsvp and /api/rsvp/photo, where the server
 * checks it against the env var — the real gate. Delete the env var and the
 * link dies; the token never appears in the code.
 */

const KEY = "late-rsvp-invite";

/** Same shape as the letter_invites tokens — unguessable, URL-safe. */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * The invite token for this tab, if any: reads `?invite=` from the URL first
 * (stashing it), then falls back to the stash. Returns null for everyone
 * without the link — which keeps the RSVP window on its closed notice.
 */
export function getInviteToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    // Read `invite`, but also `amp;invite`: many email clients HTML-encode the
    // `&` in a link, so `?open=rsvp&invite=X` arrives as `?open=rsvp&amp;invite=X`
    // and the real param name becomes `amp;invite`. Rescue that too.
    const fromUrl = params.get("invite") ?? params.get("amp;invite");
    if (fromUrl && TOKEN_RE.test(fromUrl)) {
      sessionStorage.setItem(KEY, fromUrl);
      return fromUrl;
    }
    const stored = sessionStorage.getItem(KEY);
    return stored && TOKEN_RE.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Param names the invite token can arrive under — the second is the
 * HTML-encoded-ampersand variant. Used to strip them from the URL. */
export const INVITE_PARAMS = ["invite", "amp;invite"] as const;
