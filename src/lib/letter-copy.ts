/**
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  PLACEHOLDER PROSE — ANI IS WRITING THE REAL LETTER.                 │
 * │  Replace `LETTER_BODY` below before sending. Everything else on the  │
 * │  page (greeting, photos, event card, live count, CTA) is finished.   │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * The prose lives here, apart from the JSX, so it can be edited without
 * touching layout. Each block renders as one paragraph; `emphasis` blocks are
 * set italic and slightly larger, the way a raised voice reads on paper.
 */

export type LetterBlock = {
  text: string;
  style?: "normal" | "emphasis";
};

/** Shown above the greeting. */
export const LETTER_EYEBROW = "A last letter to the Class of 2021";

/** The body. REPLACE THIS. */
export const LETTER_BODY: LetterBlock[] = [
  {
    text: "[Ani's letter goes here. The email does the knocking; this is the room they step into once they open the door.]",
  },
  {
    text: "[Placeholder — not for sending.]",
    style: "emphasis",
  },
];

/** For the person who started checkout and never finished. */
export const UNFINISHED_NOTE =
  "You already started this once. Your spot is still half-held, and finishing takes about a minute.";

export const LETTER_SIGNOFF = "See you in September,";
export const LETTER_SIGNATURE = "Ani";

/** True when the placeholder is still in place — used to block a real send. */
export const LETTER_IS_PLACEHOLDER = LETTER_BODY.some((b) =>
  b.text.trimStart().startsWith("["),
);
