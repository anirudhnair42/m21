/**
 * Reunion-as-Class data model. Drives the Forum-style ALF UI.
 *
 * Edit this file to fill in real content for the three days. Every Session
 * renders the same `SessionPage` component, so you only need to write data,
 * not JSX — unless you want a richer component, in which case set
 * `sectionsRender` and ignore `sections`.
 */

import type { ReactNode } from "react";
import { SESSIONS, getActivity } from "@/lib/weekend";

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
// RU26 — the Reunion as a class. Sessions come from the shared weekend data
// so the desktop ALF, Calendar and the phone never disagree.
// ---------------------------------------------------------------------------

const DAY_DATE = { fri: "Fri, Sep 11, 2026", sat: "Sat, Sep 12, 2026", sun: "Sun, Sep 13, 2026" } as const;

const SESSION_NOTES: Record<string, { before: string; assessment: string; resources: Resource[] }> = {
  s11: {
    before: "Land in San Francisco. Drop bags wherever you're staying. The only thing on the books is dinner at 6 — informal, no name tags. Come think about your opening line: one sentence on where the last five years took you.",
    assessment: "No formal HC scoring tonight — but bring that opening line. We'll go around the room once.",
    resources: [
      { label: "Southern Pacific Brewing", url: "https://maps.apple.com/?q=620%20Treat%20Ave%2C%20San%20Francisco" },
      { label: "Altın Gün at The Regency — tickets", url: "https://www.axs.com/events/1352783/altin-gun-tickets" },
    ],
  },
  s21: {
    before: "Breakfast at Dahlia Dell opens the day. From there the city is the classroom: quests, points, whoever you want. Final lists are due at 5:00 PM.",
    assessment: "Assignment 3. Capture as you go, tag who did it with you, submit before dinner.",
    resources: [{ label: "Dahlia Dell, Golden Gate Park", url: "https://maps.apple.com/?q=Dahlia%20Dell%2C%20Golden%20Gate%20Park" }],
  },
  s22: {
    before: "Finish your last quest with your crew, then head straight to the Marina. Doors at six, dinner at seven, Chug Pub from ten.",
    assessment: "Grades released at dinner, around 8:30. Trivia, a few performances, prizes.",
    resources: [
      { label: "The Loft, 3108B Fillmore St", url: "https://maps.apple.com/?q=3108B%20Fillmore%20St%2C%20San%20Francisco" },
      { label: "Chug Pub, 1849 Lincoln Way", url: "https://maps.apple.com/?q=1849%20Lincoln%20Way%2C%20San%20Francisco" },
    ],
  },
  s31: {
    before: "Late brunch, slow exit. Flights start in the afternoon — coordinate rides on the group chat.",
    assessment: "Assignment 4, the closing line, unlocks at the closing moment.",
    resources: [{ label: "Hellman Hollow, Golden Gate Park", url: "https://maps.apple.com/?q=Hellman%20Hollow%2C%20Golden%20Gate%20Park" }],
  },
};

const COURSE_SESSIONS: Session[] = SESSIONS.map((s) => {
  const notes = SESSION_NOTES[s.id];
  const rows = s.activities.map(getActivity).filter((a): a is NonNullable<typeof a> => !!a);
  const side = s.side.map(getActivity).filter((a): a is NonNullable<typeof a> => !!a);
  return {
    id: `ru26-${s.id}`,
    courseId: "RU26",
    number: s.number,
    title: s.title,
    date: DAY_DATE[s.day],
    status: "upcoming",
    presenters: "Nair / Urdaneta / Muthukumaran / Rivera / Torento / Graves",
    location: `${s.time} · ${s.location}`,
    agenda: rows.map((a) => ({
      time: a.time,
      title: a.title,
      location: a.venue,
      body: a.body,
      optional: a.kind !== "anchor",
    })),
    sections: [
      { heading: "Before Class", body: notes?.before ?? s.sub },
      { heading: "Assessment", body: notes?.assessment ?? "Show up; participate." },
      ...(side.length
        ? [{
            heading: "Side quests (optional, peer-led)",
            body: side.map((a) => `${a.time} — ${a.title}${a.host ? `, with ${a.host}` : ""}${a.venue ? ` · ${a.venue}` : ""}. ${a.body}`).join(" "),
            resources: side.filter((a) => a.link).map((a) => ({ label: a.link!.label, url: a.link!.url })),
          }]
        : []),
      ...(notes?.resources.length ? [{ heading: "Resources for Class", resources: notes.resources }] : []),
    ],
  };
});

export const REUNION_COURSE: Course = {
  id: "RU26",
  code: "RU26",
  title: "Alumni Reunifications",
  sectionTitle:
    "Nair / Urdaneta / Muthukumaran / Rivera / Torento / Graves · Fri/Sat/Sun",
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
  sessions: COURSE_SESSIONS,
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
