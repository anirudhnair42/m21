/**
 * Reunion-as-Class data model. Drives the Forum-style ALF UI.
 *
 * Edit this file to fill in real content for the three days. Every Session
 * renders the same `SessionPage` component, so you only need to write data,
 * not JSX — unless you want a richer component, in which case set
 * `sectionsRender` and ignore `sections`.
 */

import type { ReactNode } from "react";

export type Resource = {
  label: string;
  url?: string;
  note?: string;
};

/** A discrete section inside a session page. Order is preserved. */
export type SessionSection = {
  /** Heading shown above the section (e.g. "Before Class", "Assessment"). */
  heading: string;
  /** Optional intro paragraph(s) — can be string or rich React node. */
  body?: ReactNode;
  /** Optional resource link list rendered under the body. */
  resources?: Resource[];
};

/** A single timed entry in a day's run-of-show. Rendered as a timeline. */
export type AgendaItem = {
  /** Display time — e.g. "12:00", "6:00 PM". */
  time: string;
  /** Short event title — e.g. "Spark Social Lunch". */
  title: string;
  /** Optional place/area — e.g. "Presidio Parade Ground". */
  location?: string;
  /** Optional descriptive copy — string or rich React node. */
  body?: ReactNode;
  /** Optional flag for soft/optional anchors (rendered with a muted style). */
  optional?: boolean;
};

export type SessionStatus = "upcoming" | "past";

export type Session = {
  id: string;
  courseId: string;
  /** Session number — e.g. "1.1", "1.2". Shown in the breadcrumb and lists. */
  number: string;
  /** Display title — e.g. "Welcome night & opening dinner". */
  title: string;
  /** Human-readable date row — e.g. "Fri, Sep 11, 2026". */
  date: string;
  status: SessionStatus;
  /** Who's "leading" the session — last names in the Minerva tradition. */
  presenters: string;
  /** Location / time string for the header. */
  location?: string;
  /** Optional run-of-show: timed entries rendered as a timeline above the sections. */
  agenda?: AgendaItem[];
  /** Ordered list of sections rendered on the session page. */
  sections: SessionSection[];
};

export type AssignmentRow = {
  /** "a11" | "a12" | "a13" — drives the post-RSVP unlock behavior. */
  id: string;
  title: string;
  weight: string;
  status: string;
};

export type SyllabusSection = {
  heading: string;
  body: ReactNode;
};

export type Course = {
  id: string;
  /** Course code shown in lists — e.g. "RU26". */
  code: string;
  /** Long title — e.g. "Alumni Reunifications". */
  title: string;
  /** The "Section Title" string Minerva shows — presenters@time, city. */
  sectionTitle: string;
  /** Term label — e.g. "Fall 2026". */
  term: string;
  /** Banner subtitle on the welcome screen. */
  greeting: string;
  /** Course-description page (the restyled "letter"). */
  syllabus: {
    eyebrow: string; // "REUNION COURSE"
    courseHeader: string; // "RU26: Alumni Reunifications"
    credit?: number;
    sections: SyllabusSection[];
  };
  sessions: Session[];
  assignments?: AssignmentRow[];
  participants: { name: string; role?: string }[];
};

// ---------------------------------------------------------------------------
// RU26 — the Reunion as a class.
// Replace the stub `sections` content per day with real material.
// ---------------------------------------------------------------------------

const FRI: Session = {
  id: "ru26-1-1",
  courseId: "RU26",
  number: "1.1",
  title: "Welcome night & opening dinner",
  date: "Fri, Sep 11, 2026",
  status: "upcoming",
  presenters: "Nair / Urdaneta / Mangos / Torento / Graves",
  location: "San Francisco · arrivals & evening",
  agenda: [
    {
      time: "12:00",
      title: "Spark Social Lunch",
      location: "Presidio Parade Ground",
      body:
        "We'll be grabbing lunch from the food trucks and hanging out near the Presidio Parade Ground. If you're in the city early, come by.",
    },
    {
      time: "14:00",
      title: "Neighborhood exploration / museum visit",
      body:
        "Come join for some neighborhood exploration (which one is TBD) if you're here early.",
    },
    {
      time: "18:00",
      title: "Dinner & drinks",
      location: "Venue TBD",
      body:
        "We'll book a place for dinner and drinks for people to stream in. Patio space for mingling and catching up. Come reconnect.",
    },
    {
      time: "21:00",
      title: "Barhopping",
      optional: true,
      body: "For those still going — we'll make our way around the neighborhood.",
    },
  ],
  sections: [
    {
      heading: "Before Class",
      body:
        "Land in San Francisco. Drop bags wherever you're staying. The only thing on the books is dinner at 6 — informal, no name tags. Come think about your opening line: one sentence on where the last five years took you.",
    },
    {
      heading: "Assessment",
      body:
        "No formal HC scoring tonight — but bring that opening line. We'll go around the room once.",
    },
    {
      heading: "Resources for Class",
      resources: [
        { label: "Venue address & directions", note: "TBD" },
        { label: "Friday photo album (shared)", note: "Link goes here" },
        { label: "Playlist · Class of 2021 throwbacks", note: "Link goes here" },
      ],
    },
  ],
};

const SAT: Session = {
  id: "ru26-1-2",
  courseId: "RU26",
  number: "1.2",
  title: "An unscheduled day, with a few anchors",
  date: "Sat, Sep 12, 2026",
  status: "upcoming",
  presenters: "Nair / Urdaneta / Mangos / Torento / Graves",
  location: "San Francisco · all day",
  agenda: [
    {
      time: "10:00",
      title: "Breakfast at Fort Mason",
      location: "Fort Mason",
      body:
        "Start your day at Fort Mason with some iconic SF eats. We'll have breakfast bites and coffee from Saint Frank, Bob's Donuts, and more. Come hang out for a slow morning before the Questival begins.",
    },
    {
      time: "12:00",
      title: "Questival begins",
      location: "All around the city",
      body:
        "A pick-your-own-adventure scavenger hunt with nostalgic M21 stops. Pair up with friends and tackle the challenges like a team assignment — or just wander the city. Everything is optional; you earn points per challenge completed (plus video evidence). Prizes at night!",
    },
    {
      time: "18:00",
      title: "Dinner & beach bonfire",
      location: "Ocean Beach",
      body:
        "We'll end the scavenger hunt around sunset at Ocean Beach. Come take in the view — and don't forget some sand for the road. Bring snacks and drinks; we'll have a bonfire going. Then we'll head to a bar nearby at 8 for some M21 trivia and small gifts.",
    },
    {
      time: "22:00",
      title: "Optional afterparty",
      optional: true,
      body:
        "Afterparty in Corona Heights, stargazing back at Ocean Beach, or a good night's sleep — dealer's choice.",
    },
  ],
  sections: [
    {
      heading: "Before Class",
      body:
        "Saturday is mostly open — splinter into the groups that make sense. Everything is optional; the two anchors are breakfast at Fort Mason and the bonfire at Ocean Beach.",
    },
    {
      heading: "Assignment · Photo wall",
      body:
        "Recreate a favorite photo from your Minerva days somewhere in the city, and submit it to the photo wall. Best recreations get shown off at dinner.",
    },
    {
      heading: "Resources for Class",
      resources: [
        { label: "Questival challenge list", note: "Link goes here" },
        { label: "Nostalgic stops map (851, 1412, Corona Heights…)", note: "TBD" },
        { label: "Photo wall — submit your recreation" },
      ],
    },
  ],
};

const SUN: Session = {
  id: "ru26-1-3",
  courseId: "RU26",
  number: "1.3",
  title: "Slow Sunday & goodbyes",
  date: "Sun, Sep 13, 2026",
  status: "upcoming",
  presenters: "Nair / Urdaneta / Mangos / Torento / Graves",
  location: "Golden Gate Park · brunch",
  agenda: [
    {
      time: "11:00",
      title: "Faculty brunch in Golden Gate Park",
      location: "Hellman Hollow, GG Park",
      body:
        "We capped off our Minerva experience with a feast in Hellman Hollow — so to end this five-year reunion, we invite you back to the same place. A loosely organized picnic feast: frisbees, spikeball, card games, drinks, snacks, and maybe a few faculty and staff dropping by to say hi. Come in when you can, leave when you need to.",
    },
  ],
  sections: [
    {
      heading: "Before Class",
      body:
        "Late brunch, slow exit. Flights start in the afternoon — coordinate rides on the group chat.",
    },
    {
      heading: "Assignment · Closing line",
      body:
        "Self-report only: write one line about what you're taking home from the weekend. That's the final exercise.",
    },
    {
      heading: "Resources for Class",
      resources: [
        { label: "Shared rides spreadsheet" },
        { label: "Post-reunion feedback form" },
      ],
    },
  ],
};

export const REUNION_COURSE: Course = {
  id: "RU26",
  code: "RU26",
  title: "Alumni Reunifications",
  sectionTitle:
    "Nair / Urdaneta / Mangos / Torento / Graves · Fri/Sat/Sun",
  term: "Fall 2026",
  greeting:
    "You have one upcoming class: RU26 Session 1.1 on Fri, Sep 11 in San Francisco.",
  syllabus: {
    eyebrow: "REUNION COURSE",
    courseHeader: "RU26: Alumni Reunifications",
    credit: 3,
    sections: [
      {
        heading: "Course Description",
        body:
          "Alumni Reunifications is a three-session intensive convening the Minerva University Class of 2021 five years after graduation. The course pairs structured anchors — a welcome dinner, a group photo, a closing brunch — with deliberately unscheduled time, on the theory that the interval IS the argument.",
      },
      {
        heading: "Prerequisites & Working Knowledge",
        body:
          "Students must have completed at least three years of post-Minerva life. Working knowledge of at least one of: a job, a graduate program, a long-haul flight, an unanswered group text, a city you no longer live in. Strong skills in showing up.",
      },
      {
        heading: "Assignments",
        body:
          "There are three sessions, one per day. Each session has light pre-work (a question to think about), a low-stakes in-session assessment (show up; participate), and a post-session resource list. The final exercise is the closing reflection on Sunday.",
      },
    ],
  },
  sessions: [FRI, SAT, SUN],
  assignments: [
    { id: "a11", title: "Assignment 1: opening-line reflection", weight: "1x", status: "Not started" },
    { id: "a12", title: "Assignment 2: the class, live", weight: "1x", status: "Not started" },
    { id: "a13", title: "Assignment 3: closing line", weight: "1x", status: "Not started" },
  ],
  participants: [
    { name: "Anirudh Nair" },
    { name: "Mau Urdaneta" },
    { name: "Amal Muthukumaran" },
    { name: "Dulce Riviera" },
    { name: "Nathan Torento" },
    { name: "Anna Graves" },
  ],
};

/** Helper: look up a session by id. */
export function getSession(id: string): Session | undefined {
  return REUNION_COURSE.sessions.find((s) => s.id === id);
}
