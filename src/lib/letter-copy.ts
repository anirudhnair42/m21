/**
 * The letter shown at /letter/[token].
 *
 * DRAFT — written from Ani's flow, in Ani's voice, awaiting his sign off.
 * `LETTER_APPROVED` below stays false until he says go, and the send script
 * refuses to run while it is false. Flip it there, not here in passing.
 *
 * Voice notes, so edits stay in key: plain words, habits rather than feelings,
 * and a joke immediately after anything sincere. No em dashes and no hyphens,
 * by Ani's instruction.
 *
 * The prose lives here, apart from the JSX, so it can be edited without
 * touching layout. Each block renders as one paragraph; `emphasis` blocks are
 * set italic and slightly larger, the way a raised voice reads on paper.
 *
 * What sits around it on the page, so none of this needs restating: six photos
 * directly above, then the event card (September 11 to 13, San Francisco), the
 * live attendee count, and the deadline. The letter is free to do the thing
 * only Ani can do.
 */

export type LetterBlock = {
  text: string;
  style?: "normal" | "emphasis";
};

/** Shown above the greeting, uppercase with wide letterspacing. Keep it short. */
export const LETTER_EYEBROW = "Minerva Class of 2021 · The Reunion";

export const LETTER_BODY: LetterBlock[] = [
  {
    text: "Since the day I put this website up, I wake up and go straight to it. I open the fake ALF, I look at the fake class list, and some mornings I am happy because there are new confirmed names. Then I scroll down to the considering list and find yours, and the next morning I hope that name has converted into an RSVP. I repeat this cycle obsessively. (No, not like the movie though.)",
  },
  {
    text: "A group of us, Amal, Dulce, Ani, Nathan, Mau and Anna, plus Branden and Eungjun from Minerva, have been giving our evenings and weekends to this for months. We have been working on it because we want this weekend to be worth your time and your flight.",
  },
  {
    text: "We also know San Francisco is not a cheap place to be summoned to, and that for some of you the money is the actual reason this has stayed in the considering column rather than moving out of it. That is a real reason, and we planned for it. Nobody is turned away for financial reasons. There is aid for the fee, for housing, and for travel, the request is confidential, there is no income check, and you do not owe anyone an explanation to ask for it.",
  },
  {
    text: "There will be dinners and games and a few things we are still keeping quiet about. But the structure is loose on purpose. Enough shape that you are never standing around wondering what happens next, and enough air that you and four other people can slip away and go find your old places in the city. So talk your friends into it. Make a group. Come together and take the city apart again.",
  },
  {
    text: "We are putting everyone up in a residence hall, the way we lived at Minerva. You show up with a suitcase, you knock on doors, you find out who is around and what they are doing that night. That was the whole method at eighteen and it still works. The difference is that you are all carrying five years of skill and access now, so whatever starts that weekend can actually go somewhere.",
  },
  {
    text: "We are still building this. We would very much like you to be in it.",
    style: "emphasis",
  },
];

/** For the person who started checkout and never finished. */
export const UNFINISHED_NOTE =
  "You already started this once. Your spot is still half held, and finishing takes about a minute.";

export const LETTER_SIGNOFF = "Hoping to see you all in September,";
export const LETTER_SIGNATURE = "Amal, Dulce, Ani, Nathan, Mau and Anna";

/**
 * Ani's sign off on the prose above. The mail merge refuses to send while this
 * is false, so a draft can be reviewed live on the page without any risk of it
 * going out to 63 people.
 */
export const LETTER_APPROVED = false;
