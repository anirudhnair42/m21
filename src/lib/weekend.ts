/**
 * The weekend, as data. Single source for the desktop ALF session pages and
 * the mobile Forum. Times are San Francisco local (PDT, UTC-7) and stored as
 * ISO strings with the offset so an overseas browser never moves a meetup.
 *
 * `status` copy is honest: nothing here invents an address. Items that still
 * need a cohost answer say so and ship with a "confirmed by Friday" note.
 */

export type Day = "fri" | "sat" | "sun";

export type ActivityKind = "anchor" | "optional" | "peer";

export type Activity = {
  id: string;
  day: Day;
  /** ISO with -07:00 offset. Null when the time is genuinely TBD. */
  start: string | null;
  /** Display time, e.g. "10:00" or "TBD". */
  time: string;
  title: string;
  kind: ActivityKind;
  venue?: string;
  address?: string;
  host?: string;
  body: string;
  bring?: string;
  cost?: string;
  /** Unconfirmed detail, shown as a quiet note. */
  pending?: string;
  /** Map pin. Absent when the venue is still TBD. */
  lat?: number;
  lng?: number;
  /** External link, e.g. tickets. */
  link?: { label: string; url: string };
  /** Names shown as going even before anyone taps (the host, for one). */
  goingSeed?: string[];
  /** Everyone's expected: no I'm-going button, the whole class is going. */
  required?: boolean;
};

const T = (day: "11" | "12" | "13", hhmm: string) => `2026-09-${day}T${hhmm}:00-07:00`;

/**
 * A class. Days have one or two; the run of show is the session's
 * activities in order. Side quests hang off the session they follow.
 */
export type Session = {
  id: string;
  number: string; // "1.1", "2.1", "2.2", "3.1"
  day: Day;
  title: string;
  /** Header line under the title. */
  sub: string;
  /** Class start, ISO with offset. */
  start: string;
  time: string;
  location: string;
  /** Activities in the run of show, in order (anchor + optional). */
  activities: string[];
  /** Peer-led side quests attached to this class. */
  side: string[];
};

export const SESSIONS: Session[] = [
  {
    id: "s11", number: "1.1", day: "fri",
    title: "Arrivals & the welcome dinner",
    sub: "One thing on the books: dinner at six. Come reconnect.",
    start: T("11", "18:00"), time: "18:00",
    location: "Southern Pacific Brewing, 620 Treat Ave",
    activities: ["fri-dinner"],
    side: ["fri-bars"],
  },
  {
    id: "s21", number: "2.1", day: "sat",
    title: "Questival day",
    sub: "Breakfast in the park, then the city is the classroom.",
    start: T("12", "10:00"), time: "10:00",
    location: "Dahlia Dell, Golden Gate Park",
    activities: ["sat-breakfast", "sat-questival", "sat-sports", "sat-lunch", "sat-sidequests"],
    side: [],
  },
  {
    id: "s22", number: "2.2", day: "sat",
    title: "Dinner at The Loft, then Chug Pub",
    sub: "Finish your Questival together, then head straight to the Marina. Dinner, trivia, results, then drinks at Chug Pub.",
    start: T("12", "18:00"), time: "18:00",
    location: "The Loft, 3108B Fillmore St",
    activities: ["sat-dinner", "sat-after"],
    side: [],
  },
  {
    id: "s31", number: "3.1", day: "sun",
    title: "The picnic & goodbyes",
    sub: "Where we ended Minerva, to end this.",
    start: T("13", "11:00"), time: "11:00",
    location: "Hellman Hollow, Golden Gate Park",
    activities: ["sun-brunch", "sun-closing", "sun-park"],
    side: ["sun-disc-golf"],
  },
];

export function getSession(id: string): Session | undefined {
  return SESSIONS.find((s) => s.id === id);
}
export function sessionsFor(day: Day): Session[] {
  return SESSIONS.filter((s) => s.day === day);
}
export function sessionOf(activityId: string): Session | undefined {
  return SESSIONS.find((s) => s.activities.includes(activityId) || s.side.includes(activityId));
}
/**
 * When a class stops being "in progress": four hours after it starts, or an
 * hour after its last timed activity (run of show or side quest), whichever
 * is later. Saturday's Questival class runs 10:00 → 17:00, so lunch at the
 * Res Hall (15:00) is still Session 2.1, not "upcoming: dinner".
 */
export function sessionEndsAt(s: Session): number {
  const start = Date.parse(s.start);
  let last = start;
  for (const id of [...s.activities, ...s.side]) {
    const a = getActivity(id);
    if (a?.start) last = Math.max(last, Date.parse(a.start));
  }
  return Math.max(start + 4 * 3600_000, last + 3600_000);
}

/** The next class that hasn't started yet, or the one in progress (see sessionEndsAt). */
export function nextSession(now: Date): Session | null {
  const t = now.getTime();
  for (const s of SESSIONS) {
    if (t < sessionEndsAt(s)) return s;
  }
  return null;
}

export const DAYS: { id: Day; label: string; session: string; title: string; date: string; sub: string }[] = [
  // `session` is the day's first class, matching SESSIONS (2.1 for Saturday, not "1.2").
  { id: "fri", label: "Fri", session: "1.1", title: "Arrivals & the welcome dinner", date: "Fri, Sep 11, 2026", sub: "Presidio by day, the Mission by night" },
  { id: "sat", label: "Sat", session: "2.1", title: "Questival day, with a few anchors", date: "Sat, Sep 12, 2026", sub: "Golden Gate Park → the city → the Marina" },
  { id: "sun", label: "Sun", session: "3.1", title: "The picnic & goodbyes", date: "Sun, Sep 13, 2026", sub: "Hellman Hollow, Golden Gate Park" },
];

export const ACTIVITIES: Activity[] = [
  // ---------------------------------------------------------------- Friday
  {
    id: "fri-dinner",
    required: true,
    lat: 37.7606,
    lng: -122.4133,
    day: "fri",
    start: T("11", "18:00"),
    time: "18:00",
    title: "Welcome dinner & drinks",
    kind: "anchor",
    venue: "Southern Pacific Brewing",
    address: "620 Treat Ave, San Francisco, CA 94110",
    host: "Dulce, Amal, Mau, Nathan, Anna and Ani",
    body: "The grand opening. Patio space for mingling, ~50 of us, no name tags. Come reconnect, and bring your opening line.",
    cost: "Dinner covered by your RSVP. Drinks on you.",
    pending: "Reservation being finalized.",
  },
  {
    id: "fri-bars",
    day: "fri",
    start: T("11", "22:00"),
    time: "22:00",
    title: "Bar hopping with Nathan",
    kind: "peer",
    venue: "The Mission, from Southern Pacific",
    host: "Nathan",
    body: "After dinner, Nathan leads whoever's still going around the Mission. Bars decided on the spot. Say you're in and he knows how many to herd.",
    goingSeed: ["Nathan Torento"],
    lat: 37.7606,
    lng: -122.4133,
  },
  // -------------------------------------------------------------- Saturday
  {
    id: "sat-breakfast",
    required: true,
    lat: 37.7719,
    lng: -122.46,
    day: "sat",
    start: T("12", "10:00"),
    time: "10:00",
    title: "Breakfast at Dahlia Dell",
    kind: "anchor",
    venue: "Dahlia Dell",
    address: "Dahlia Dell, Golden Gate Park, San Francisco, CA 94118",
    host: "Anna",
    body: "Slow morning at our picnic table. Saint Frank coffee, Bob's Donuts, fruit. Questival opens the moment you sit down.",
  },
  {
    id: "sat-sports",
    lat: 37.7724,
    lng: -122.4612,
    day: "sat",
    start: T("12", "11:30"),
    time: "11:30",
    title: "Sports Palooza",
    kind: "anchor",
    venue: "Dahlia Dell lawn",
    host: "Mau",
    body: "Volleyball, spikeball, frisbee, a relay race, and a whipped-cream war. Challenge another crew for Questival points.",
  },
  {
    id: "sat-questival",
    day: "sat",
    start: T("12", "10:00"),
    time: "10:00 → 17:00",
    title: "Questival",
    kind: "anchor",
    venue: "All over the city",
    host: "Amal + Ani",
    body: "Assignment 3. Pick your own adventure through nostalgic M21 stops. Capture as you go, tag whoever did it with you, submit your final list before dinner.",
  },
  {
    id: "sat-lunch",
    required: true,
    lat: 37.7975,
    lng: -122.4241,
    day: "sat",
    start: T("12", "15:00"),
    time: "15:00",
    title: "Lunch & speed mingling at the Res Hall",
    kind: "anchor",
    venue: "2550 Van Ness",
    address: "2550 Van Ness Ave, San Francisco, CA 94109",
    body: "Back to where it started. Lunch in the common room with speed-mingling rounds — a few minutes each, rotate, repeat — then you're free to explore. A selfie with a current Minervan is worth points.",
  },
  {
    id: "sat-sidequests",
    day: "sat",
    start: T("12", "16:00"),
    time: "16:00",
    title: "Finish your Questival together",
    kind: "optional",
    venue: "Wherever you are",
    body: "The last stretch. Wrap up your list with your crew — final lists are due at 5:00 PM, and yes, the 7-minute extension applies — then head straight to the Marina.",
  },
  {
    id: "sat-dinner",
    required: true,
    day: "sat",
    lat: 37.7996,
    lng: -122.4363,
    start: T("12", "18:00"),
    time: "18:00",
    title: "Dinner, trivia & Questival results",
    kind: "anchor",
    venue: "The Loft, Marina",
    address: "3108B Fillmore St, San Francisco, CA 94123",
    host: "Mau + Ani",
    body: "Doors at 6 — come straight from your last quest. Dinner served at 7, then M21 trivia, a few performances, and grades released at 8:30 — prizes for the top three and the best recreation.",
    cost: "Covered by your RSVP.",
  },
  {
    id: "sat-after",
    day: "sat",
    lat: 37.7644,
    lng: -122.4784,
    start: T("12", "22:00"),
    time: "22:00",
    title: "Chug Pub",
    kind: "anchor",
    venue: "Chug Pub, Inner Sunset",
    address: "1849 Lincoln Way, San Francisco, CA 94122",
    host: "Mau",
    body: "After dinner, more drinks and the rest of the night's talking. It's across town from the Marina, so share rides from The Loft; we'll leave in waves from 10.",
  },
  // ---------------------------------------------------------------- Sunday
  {
    id: "sun-brunch",
    required: true,
    lat: 37.77,
    lng: -122.488,
    day: "sun",
    start: T("13", "11:00"),
    time: "11:00",
    title: "Faculty brunch at Hellman Hollow",
    kind: "anchor",
    venue: "Hellman Hollow",
    address: "Hellman Hollow, Golden Gate Park, San Francisco, CA 94122",
    host: "Mau",
    body: "We capped off Minerva with a feast here, so we end the reunion in the same place. Four tables booked. Frisbee, spikeball, cards, tea tasting, a few faculty dropping by. Come when you can, leave when you need to.",
    bring: "Locals: blankets, frisbees, drinks.",
    pending: "Bagels (likely Schlok's) pending.",
  },
  {
    id: "sun-closing",
    lat: 37.7702,
    lng: -122.4876,
    day: "sun",
    start: T("13", "12:30"),
    time: "12:30",
    title: "Closing moment",
    kind: "anchor",
    venue: "Hellman Hollow",
    body: "Closing remarks, the group photo, and Assignment 3 unlocks: one line about what you're taking home.",
  },
  {
    id: "sun-park",
    day: "sun",
    start: T("13", "14:00"),
    time: "Ongoing",
    title: "Open afternoon in the park",
    kind: "optional",
    venue: "Golden Gate Park",
    body: "Relaxed vibe around departures and flights. Coordinate rides in the group chat.",
  },
  {
    id: "sun-disc-golf",
    lat: 37.7719,
    lng: -122.499,
    day: "sun",
    start: null,
    time: "Late",
    title: "Disc golf",
    kind: "peer",
    host: "Mau",
    venue: "Golden Gate Park disc golf course",
    body: "For those staying Sunday night. Mau has discs.",
    pending: "Peer-led · proposed.",
  },
];

export function activitiesFor(day: Day): Activity[] {
  return ACTIVITIES.filter((a) => a.day === day);
}

export function getActivity(id: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}

/** Apple Maps on iOS, Google Maps elsewhere. Called at click time. */
export function directionsUrl(address: string): string {
  const q = encodeURIComponent(address);
  const ios =
    typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
  return ios
    ? `https://maps.apple.com/?q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** What's happening now and what's next, for the home banner. */
export function nowNext(now: Date): { now: Activity | null; next: Activity | null } {
  const timed = ACTIVITIES.filter((a) => a.start).sort(
    (a, b) => Date.parse(a.start!) - Date.parse(b.start!),
  );
  const t = now.getTime();
  let current: Activity | null = null;
  let next: Activity | null = null;
  for (const a of timed) {
    const s = Date.parse(a.start!);
    if (s <= t) current = a;
    else {
      next = a;
      break;
    }
  }
  // "Now" only holds for 3 hours; after that it's just "next".
  if (current && t - Date.parse(current.start!) > 3 * 3600_000) current = null;
  return { now: current, next };
}

const PT_DATE = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "numeric", day: "numeric" });

/** The San Francisco calendar date of an instant, whatever the browser's zone. */
export function ptDate(now: Date): { year: number; month: number; day: number } | null {
  if (!Number.isFinite(now.getTime())) return null;
  const parts = PT_DATE.formatToParts(now);
  const num = (type: "year" | "month" | "day") => Number(parts.find((p) => p.type === type)?.value);
  return { year: num("year"), month: num("month"), day: num("day") };
}

/** Sep 11 → "fri", etc. Outside the weekend returns null. */
export function dayOf(now: Date): Day | null {
  const pt = ptDate(now);
  if (!pt || pt.year !== 2026 || pt.month !== 9) return null;
  return ({ 11: "fri", 12: "sat", 13: "sun" } as Record<number, Day>)[pt.day] ?? null;
}

/** Open windows for a one-on-one catch-up (Mau's mini-Calendly). */
export const CATCHUP_SLOTS: { id: string; label: string; day: Day; start: string }[] = [
  { id: "fri-1600", label: "Fri 4:00–5:00 PM · a coffee in the Mission", day: "fri", start: T("11", "16:00") },
  { id: "fri-1700", label: "Fri 5:00–6:00 PM · Southern Pacific patio, before dinner", day: "fri", start: T("11", "17:00") },
  { id: "sat-1330", label: "Sat 1:30–2:30 PM · wherever your quests take you", day: "sat", start: T("12", "13:30") },
  { id: "sat-1600", label: "Sat 4:00–5:00 PM · finishing up, before dinner", day: "sat", start: T("12", "16:00") },
  { id: "sun-1200", label: "Sun 12:00–1:00 PM · Hellman Hollow", day: "sun", start: T("13", "12:00") },
  { id: "sun-1300", label: "Sun 1:00–2:00 PM · Hellman Hollow", day: "sun", start: T("13", "13:00") },
];
