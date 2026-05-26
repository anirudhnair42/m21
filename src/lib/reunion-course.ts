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

export type SessionStatus = "upcoming" | "past";

export type Session = {
  id: string;
  courseId: string;
  /** Session number — e.g. "1.1", "1.2". Shown in the breadcrumb and lists. */
  number: string;
  /** Display title — e.g. "Welcome night & opening dinner". */
  title: string;
  /** Human-readable date row — e.g. "Fri, Jun 12, 2026". */
  date: string;
  status: SessionStatus;
  /** Who's "leading" the session — last names in the Minerva tradition. */
  presenters: string;
  /** Location / time string for the header. */
  location?: string;
  /** Ordered list of sections rendered on the session page. */
  sections: SessionSection[];
};

export type AssignmentRow = {
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
  /** Term label — e.g. "Summer 2026". */
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
  date: "Fri, Jun 12, 2026",
  status: "upcoming",
  presenters: "Nair / Urdaneta / Muthukumarans / Torento / Graves",
  location: "San Francisco · 6:00 PM",
  sections: [
    {
      heading: "Before Class",
      body:
        "Land in San Francisco. Drop bags at the hotel. We meet at the venue at 6 — informal, no name tags.",
      resources: [
        { label: "Venue address & directions", note: "TBD" },
        { label: "Hotel check-in tips", note: "TBD" },
      ],
    },
    {
      heading: "Assessment",
      body:
        "No formal HC scoring tonight — but bring an opening line. We'll go around the room once.",
    },
    {
      heading: "Resources for Class",
      resources: [
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
  date: "Sat, Jun 13, 2026",
  status: "upcoming",
  presenters: "Nair / Urdaneta / Muthukumarans / Torento / Graves",
  location: "San Francisco · all day",
  sections: [
    {
      heading: "Before Class",
      body:
        "Saturday is mostly open — splinter into the groups that make sense. Two anchors: morning coffee at the venue (10 AM) and a group photo before dinner (6 PM).",
    },
    {
      heading: "Assessment",
      body: "Show up to the anchors. Eat together. That's the rubric.",
    },
    {
      heading: "Resources for Class",
      resources: [
        { label: "Walking-route suggestions (Mission / SOMA / Presidio)" },
        { label: "Photo wall — submit a print" },
      ],
    },
  ],
};

const SUN: Session = {
  id: "ru26-1-3",
  courseId: "RU26",
  number: "1.3",
  title: "Slow Sunday & goodbyes",
  date: "Sun, Jun 14, 2026",
  status: "upcoming",
  presenters: "Nair / Urdaneta / Muthukumarans / Torento / Graves",
  location: "San Francisco · brunch",
  sections: [
    {
      heading: "Before Class",
      body:
        "Late brunch, slow exit. Flights start at 4 PM — coordinate rides on the group chat.",
    },
    {
      heading: "Assessment",
      body:
        "Self-report only: write one line about what you're taking home from the weekend.",
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
    "Nair / Urdaneta / Muthukumarans / Torento / Graves · Fri/Sat/Sun",
  term: "Summer 2026",
  greeting:
    "You have one upcoming class: RU26 Session 1.1 on Fri, Jun 12 in San Francisco.",
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
    { title: "Session 1.1 reflection: opening line", weight: "1x", status: "Not started" },
    { title: "Session 1.2 photo wall submission", weight: "1x", status: "Not started" },
    { title: "Session 1.3 closing line", weight: "1x", status: "Not started" },
  ],
  participants: [
    { name: "B Nelly" },
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
