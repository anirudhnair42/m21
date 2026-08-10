/**
 * The final-call letter: deadline facts and shared types.
 *
 * NOTE ON THE DEADLINE: the site says 11:00 PM everywhere, with no exceptions.
 * The "11:07" joke (ALF only counted an extension if you submitted after the
 * 7th minute) lives ONLY in the outgoing email, deliberately. Please don't
 * "fix" one to match the other.
 */

/** Tuesday, August 11, 2026 at 11:00 PM Pacific (PDT, UTC-7). */
export const RSVP_DEADLINE = new Date("2026-08-11T23:00:00-07:00");

/** Deadline as shown to guests. */
export const RSVP_DEADLINE_LABEL = "Tuesday, August 11 · 11:00 PM PT";

/** Short form for tight spaces (CTA badges). */
export const RSVP_DEADLINE_SHORT = "RSVP closes Tue, Aug 11 · 11:00 PM PT";

/**
 * Sits under the deadline. The site holds the hard line — which is exactly
 * what makes the email's "actually it's 11:07, ALF only counted an extension
 * after the 7th minute" land as a wink rather than a contradiction.
 */
export const RSVP_DEADLINE_NOTE = "No extensions.";

/** The reunion itself. */
export const REUNION_DATES = "September 11–13, 2026";
export const REUNION_PLACE = "San Francisco";

export function isRsvpClosed(now: Date = new Date()): boolean {
  return now.getTime() > RSVP_DEADLINE.getTime();
}

export type LetterInvite = {
  token: string;
  name: string;
  email: string;
  /** 'unfinished' = started checkout but never paid; the ask is "finish". */
  variant: "default" | "unfinished";
};

/** First name for the greeting. Falls back to the whole string if there's no space. */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
