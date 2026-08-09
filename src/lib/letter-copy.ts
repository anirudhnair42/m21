/**
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  PLACEHOLDER PROSE — ANI IS WRITING THE REAL LETTER.                 │
 * │                                                                      │
 * │  The text below is stand-in copy at roughly the right length and     │
 * │  rhythm so the page can be judged as a finished thing. It is NOT     │
 * │  for sending. `LETTER_IS_PLACEHOLDER` stays true until the sentinel  │
 * │  line at the end of LETTER_BODY is removed, and the send script      │
 * │  refuses to run while it is true.                                    │
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

/** The body. REPLACE THIS — see the banner above. */
export const LETTER_BODY: LetterBlock[] = [
  {
    text: "There is a version of this weekend where you are there, and a version where you are not, and the difference between them is a form that takes about four minutes to fill out.",
  },
  {
    text: "I have thought about which photographs to put at the top of this page longer than I would like to admit. The ones above are from the beginning and from one of the good nights in the middle. What strikes me about them now is how ordinary they looked at the time. Nobody in those rooms knew they were living through the part they would keep.",
  },
  {
    text: "That is most of the reason I have spent my evenings building a fake operating system instead of sleeping. Not for the joke, though the joke is fun. Because it turns out the only way to get a hundred and something people who live on five continents into one room is to make the asking feel like something.",
  },
  {
    text: "September 11th to 13th. A dinner on Friday. A Saturday we are deliberately leaving mostly empty. A slow Sunday, and then everyone scatters again, probably for another five years.",
  },
  {
    text: "I would really like you to be there.",
    style: "emphasis",
  },
  {
    text: "[PLACEHOLDER — replace this whole file before sending.]",
  },
];

/** For the person who started checkout and never finished. */
export const UNFINISHED_NOTE =
  "You already started this once. Your spot is still half-held, and finishing takes about a minute.";

export const LETTER_SIGNOFF = "See you in September,";
export const LETTER_SIGNATURE = "Ani";

/** True while stand-in copy is still in place — the send script checks this. */
export const LETTER_IS_PLACEHOLDER = LETTER_BODY.some((b) =>
  b.text.includes("[PLACEHOLDER"),
);
