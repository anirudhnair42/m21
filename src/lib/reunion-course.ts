/**
 * Reunion-as-Class data model. Drives the Forum-style ALF UI.
 *
 * Edit this file to fill in real content for the three days. Every Session
 * renders the same `SessionPage` component, so you only need to write data,
 * not JSX — unless you want a richer component, in which case set
 * `sectionsRender` and ignore `sections`.
 */

import type { ReactNode } from "react";
import { DAYS, activitiesFor } from "@/lib/weekend";

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
  title: DAYS[0].title,
  date: "Fri, Sep 11, 2026",
  status: "upcoming",
  presenters: "Nair / Urdaneta / Mangos / Torento / Graves",
  location: DAYS[0].sub,
  agenda: activitiesFor("fri").map((a) => ({
    time: a.time,
    title: a.title,
    location: a.venue,
    body: a.body,
    optional: a.kind !== "anchor",
  })),
  sections: [
    {
      heading: "Before Class",
      body:
        "Land in San Francisco. Drop bags wherever you're staying. Dinner at 6 at Southern Pacific Brewing is the one thing on the books — informal, no name tags. Altın Gün plays the Regency at 8 if you're still going. Come think about your opening line: one sentence on where the last five years took you.",
    },
    {
      heading: "Assessment",
      body:
        "No formal HC scoring tonight — but bring that opening line. We'll go around the room once.",
    },
    {
      heading: "Resources for Class",
      resources: [
        { label: "Southern Pacific Brewing · 620 Treat Ave", url: "https://www.google.com/maps/search/?api=1&query=620+Treat+Ave+San+Francisco" },
        { label: "Altın Gün · tickets on AXS", url: "https://www.axs.com/events/1352783/altin-gun-tickets" },
        { label: "Playlist · Class of 2021 throwbacks", note: "Link goes here" },
      ],
    },
  ],
};

const SAT: Session = {
  id: "ru26-1-2",
  courseId: "RU26",
  number: "1.2",
  title: DAYS[1].title,
  date: "Sat, Sep 12, 2026",
  status: "upcoming",
  presenters: "Nair / Urdaneta / Mangos / Torento / Graves",
  location: DAYS[1].sub,
  agenda: activitiesFor("sat").map((a) => ({
    time: a.time,
    title: a.title,
    location: a.venue,
    body: a.body,
    optional: a.kind !== "anchor",
  })),
  sections: [
    {
      heading: "Before Class",
      body:
        "Questival day. Breakfast at Dahlia Dell, lunch at the Res Hall, the bonfire at Ocean Beach, dinner at Common Space are the anchors; everything in between is Assignment 3, with whoever you want.",
    },
    {
      heading: "Assignment 3 · Questival",
      body:
        "Pick your own adventure through nostalgic M21 stops. Capture as you go, tag whoever did it with you, submit your final list before the bonfire. Grades at dinner.",
    },
    {
      heading: "Resources for Class",
      resources: [
        { label: "The quest catalog", note: "Unlocks this week" },
        { label: "The map", url: "/?open=map" },
      ],
    },
  ],
};

const SUN: Session = {
  id: "ru26-1-3",
  courseId: "RU26",
  number: "1.3",
  title: DAYS[2].title,
  date: "Sun, Sep 13, 2026",
  status: "upcoming",
  presenters: "Nair / Urdaneta / Mangos / Torento / Graves",
  location: DAYS[2].sub,
  agenda: activitiesFor("sun").map((a) => ({
    time: a.time,
    title: a.title,
    location: a.venue,
    body: a.body,
    optional: a.kind !== "anchor",
  })),
  sections: [
    {
      heading: "Before Class",
      body:
        "Late brunch at Hellman Hollow, four tables booked, same spot as the graduation feast. Slow exit; coordinate rides in the group chat.",
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
    "Welcome to the weekend. Three sessions, Fri–Sun, in San Francisco.",
  syllabus: {
    eyebrow: "REUNION COURSE",
    courseHeader: "RU26: Alumni Reunifications",
    credit: 3,
    sections: [
      {
        heading: "Course Description",
        body:
          "Alumni Reunifications is a three-session intensive convening the Minerva University Class of 2021 five years after graduation. The course pairs structured anchors — a welcome dinner, a group photo, a closing brunch — with a full day of Questival — pick-your-own-adventure quests across the city — on the theory that the interval IS the argument.",
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
    { id: "a2q", title: "Assignment 3: Questival", weight: "2x", status: "Not started" },
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
