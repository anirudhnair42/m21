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
};

export const DAYS: { id: Day; label: string; session: string; title: string; date: string; sub: string }[] = [
  { id: "fri", label: "Fri", session: "1.1", title: "Welcome night & opening dinner", date: "Fri, Sep 11, 2026", sub: "San Francisco · arrivals & evening" },
  { id: "sat", label: "Sat", session: "1.2", title: "Questival, then the beach", date: "Sat, Sep 12, 2026", sub: "San Francisco · all day" },
  { id: "sun", label: "Sun", session: "1.3", title: "Slow Sunday & goodbyes", date: "Sun, Sep 13, 2026", sub: "Golden Gate Park · picnic" },
];

const T = (day: "11" | "12" | "13", hhmm: string) => `2026-09-${day}T${hhmm}:00-07:00`;

export const ACTIVITIES: Activity[] = [
  // ---------------------------------------------------------------- Friday
  {
    id: "fri-lunch",
    lat: 37.8027,
    lng: -122.4655,
    day: "fri",
    start: T("11", "12:00"),
    time: "12:00",
    title: "Arrival lunch",
    kind: "optional",
    venue: "Presidio food trucks",
    address: "Presidio Tunnel Tops, San Francisco, CA 94129",
    host: "Nathan",
    body: "People trickle in. Grab lunch from the trucks and find the group on the lawn. Self-pay.",
    pending: "Spark Social vs. Presidio trucks — final pick by Friday.",
  },
  {
    id: "fri-wander",
    day: "fri",
    start: T("11", "14:00"),
    time: "14:00",
    title: "Neighborhood wander or a museum",
    kind: "optional",
    host: "Nathan",
    body: "Free-flow afternoon in small groups. Nathan is curating a short list of neighborhoods and museums.",
    pending: "Suggestions list lands here by Friday.",
  },
  {
    id: "fri-dinner",
    lat: 37.7606,
    lng: -122.4133,
    day: "fri",
    start: T("11", "18:00"),
    time: "18:00",
    title: "Welcome dinner & drinks",
    kind: "anchor",
    venue: "Southern Pacific Brewing",
    address: "620 Treat Ave, San Francisco, CA 94110",
    host: "Dulce + Anna",
    body: "The grand opening. Patio space for mingling, ~50 of us, no name tags. Come reconnect, and bring your opening line.",
    cost: "Dinner covered by your RSVP. Drinks on you.",
    pending: "Reservation being finalized.",
  },
  {
    id: "fri-bars",
    day: "fri",
    start: T("11", "21:00"),
    time: "21:00",
    title: "Bar hopping",
    kind: "optional",
    venue: "Mission bars, decided at dinner",
    host: "Nathan + Ani",
    body: "For those still going — we'll make our way around the neighborhood.",
  },
  {
    id: "fri-altin-gun",
    day: "fri",
    start: null,
    time: "Late",
    title: "Altın Gün show",
    kind: "peer",
    host: "Ani",
    body: "Turkish psych-funk, bangers only. If enough of us are in, we buy tickets as a block.",
    pending: "Date and tickets to confirm.",
  },
  // -------------------------------------------------------------- Saturday
  {
    id: "sat-breakfast",
    lat: 37.7719,
    lng: -122.46,
    day: "sat",
    start: T("12", "10:00"),
    time: "10:00",
    title: "Breakfast at Dahlia Dell",
    kind: "anchor",
    venue: "Dahlia Dell, Golden Gate Park",
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
    kind: "optional",
    venue: "Dahlia Dell lawn",
    host: "Everyone",
    body: "Volleyball, spikeball, frisbee, a relay race, and a whipped-cream war. Challenge another crew for Questival points.",
    pending: "Sheet says 23:30 — assuming 11:30 AM.",
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
    body: "Assignment 2. Pick your own adventure through nostalgic M21 stops. Capture as you go, tag whoever did it with you, submit your final list before the bonfire.",
  },
  {
    id: "sat-catchup",
    lat: 37.7764,
    lng: -122.4346,
    day: "sat",
    start: T("12", "13:30"),
    time: "13:30",
    title: "Speed catch-up",
    kind: "optional",
    venue: "Alamo Square",
    address: "Alamo Square, San Francisco, CA 94117",
    body: "Five minutes each, rotate, repeat. The fastest way to hear five years from twenty people.",
    pending: "Exact spot on the hill to confirm.",
  },
  {
    id: "sat-lunch",
    lat: 37.7975,
    lng: -122.4241,
    day: "sat",
    start: T("12", "15:00"),
    time: "15:00",
    title: "Lunch at the Res Hall",
    kind: "anchor",
    venue: "2550 Van Ness",
    address: "2550 Van Ness Ave, San Francisco, CA 94109",
    body: "Back to where it started. Lunch in the common room, a selfie with a current Minervan for points.",
    pending: "Entrance and host to confirm.",
  },
  {
    id: "sat-sidequests",
    day: "sat",
    start: T("12", "16:00"),
    time: "16:00",
    title: "Side quests — last push",
    kind: "optional",
    venue: "Multiple",
    body: "One more hour. Final lists are due at 5:00 PM, and yes, the 7-minute extension applies.",
  },
  {
    id: "sat-bonfire",
    lat: 37.7616,
    lng: -122.5107,
    day: "sat",
    start: T("12", "17:00"),
    time: "17:00",
    title: "Bonfire at Ocean Beach",
    kind: "anchor",
    venue: "Ocean Beach",
    address: "Ocean Beach, Great Highway, San Francisco, CA 94122",
    host: "Mau + Ani",
    body: "Questival closes. Sunset, sand, s'mores. Bring a layer — it will be cold.",
    bring: "A warm layer. Snacks and drinks welcome.",
    pending: "Stairwell / fire-pit number posted Saturday morning.",
  },
  {
    id: "sat-doors",
    day: "sat",
    start: T("12", "18:00"),
    time: "18:00",
    title: "Doors at Common Space",
    kind: "optional",
    venue: "Common Space",
    body: "Head over from the beach whenever you're ready. Drinks, music, dry clothes.",
    pending: "Address published here once the property is booked.",
  },
  {
    id: "sat-dinner",
    day: "sat",
    start: T("12", "19:00"),
    time: "19:00",
    title: "Dinner, trivia & Questival results",
    kind: "anchor",
    venue: "Common Space",
    host: "Mau + Ani",
    body: "Dinner served at 7. M21 trivia, a few performances, and grades released at 8:30 — prizes for the top crews.",
    cost: "Covered by your RSVP.",
  },
  {
    id: "sat-after",
    day: "sat",
    start: T("12", "22:00"),
    time: "22:00",
    title: "After party",
    kind: "optional",
    venue: "Chug Pub (to confirm)",
    host: "Mau",
    body: "Venue closes at 10. The night doesn't have to.",
    pending: "Bar to confirm.",
  },
  // ---------------------------------------------------------------- Sunday
  {
    id: "sun-brunch",
    lat: 37.77,
    lng: -122.488,
    day: "sun",
    start: T("13", "11:00"),
    time: "11:00",
    title: "Faculty brunch at Hellman Hollow",
    kind: "anchor",
    venue: "Hellman Hollow, Golden Gate Park",
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
    start: null,
    time: "TBD",
    title: "Closing moment",
    kind: "anchor",
    venue: "Hellman Hollow",
    body: "Closing remarks, the group photo, and Assignment 3 unlocks: one line about what you're taking home.",
    pending: "Time to confirm — around 2 PM.",
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

/** Sep 11 → "fri", etc. Outside the weekend returns null. */
export function dayOf(now: Date): Day | null {
  const pt = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  if (pt.getFullYear() !== 2026 || pt.getMonth() !== 8) return null;
  return ({ 11: "fri", 12: "sat", 13: "sun" } as Record<number, Day>)[pt.getDate()] ?? null;
}
