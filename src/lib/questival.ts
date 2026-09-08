/**
 * Questival — Assignment 2. The quest catalog and the pure rules (deadline
 * windows, points). No React, no Supabase: this file is testable on its own
 * and shared by the phone, the desktop ALF, and the API.
 *
 * Points are DRAFT until the cohosts approve the catalog.
 */

export type Evidence = "photo" | "video" | "photo-pair" | "text-photo" | "screenshot";

export type Quest = {
  id: string;
  title: string;
  prompt: string;
  points: number;
  evidence: Evidence;
  /** Place-bound quests carry a venue; "anywhere" quests don't. */
  venue?: string;
  address?: string;
  area?: string;
  /** How many distinct instances can score (parks, rotation cities). */
  repeat?: number;
  bonus?: string;
  tip?: string;
  lat?: number;
  lng?: number;
};

export const QUESTS: Quest[] = [
  // ------------------------------------------------------------ at a place
  { id: "851", title: "Selfie at 851", prompt: "A selfie at the doorstep or in the lobby of 851 California.", points: 15, evidence: "photo", venue: "851 California", address: "851 California St, San Francisco, CA 94108", area: "Nob Hill", lat: 37.792, lng: -122.4092 },
  { id: "grace", title: "Grace Cathedral steps", prompt: "Recreate a Grace Cathedral photo — the steps, the labyrinth, or the doors.", points: 15, evidence: "photo", venue: "Grace Cathedral", address: "1100 California St, San Francisco, CA 94108", area: "Nob Hill", lat: 37.7919, lng: -122.413 },
  { id: "coolbrith", title: "Ina Coolbrith Park", prompt: "The view from the top. You know the one.", points: 10, evidence: "photo", venue: "Ina Coolbrith Park", address: "Vallejo St & Taylor St, San Francisco, CA 94133", area: "Nob Hill", lat: 37.7975, lng: -122.4133 },
  { id: "1412", title: "1412 Market", prompt: "Selfie outside or in the lobby of 1412 Market Street.", points: 15, evidence: "photo", venue: "1412 Market Street", address: "1412 Market St, San Francisco, CA 94102", area: "Civic Center", lat: 37.7758, lng: -122.4174 },
  { id: "all-star", title: "All Star next door", prompt: "Grab something at All Star next to 1412, like it's a Tuesday in 2018.", points: 10, evidence: "photo", venue: "All Star, next to 1412", area: "Civic Center", tip: "Name of the spot to confirm.", lat: 37.7756, lng: -122.418 },
  { id: "old-hq", title: "Professor charades at old HQ", prompt: "Outside the old Minerva HQ: one of you acts out a professor, the rest guess. Film the round.", points: 20, evidence: "video", venue: "Old Minerva HQ", area: "Civic Center", tip: "Address to confirm.", lat: 37.7767, lng: -122.4162 },
  { id: "saigon", title: "Saigon Sandwich", prompt: "Get a bánh mì from Saigon Sandwich. Prove it.", points: 10, evidence: "photo", venue: "Saigon Sandwich", address: "560 Larkin St, San Francisco, CA 94102", area: "Tenderloin", lat: 37.7833, lng: -122.4178 },
  { id: "bobs-eat", title: "Eat a Bob's donut", prompt: "One donut, one photo.", points: 10, evidence: "photo", venue: "Bob's Donuts", address: "1621 Polk St, San Francisco, CA 94109", area: "Polk", lat: 37.7918, lng: -122.4215 },
  { id: "bobs-challenge", title: "The Bob's Donuts challenge", prompt: "The giant donut. On camera. Timed.", points: 20, evidence: "video", venue: "Bob's Donuts", address: "1621 Polk St, San Francisco, CA 94109", area: "Polk", tip: "Rules to confirm with Amal.", lat: 37.7918, lng: -122.4215 },
  { id: "res-hall", title: "Selfie with a current Minervan", prompt: "At 2550 Van Ness, a selfie with someone who isn't M21.", points: 10, evidence: "photo", venue: "2550 Van Ness", address: "2550 Van Ness Ave, San Francisco, CA 94109", area: "Van Ness", lat: 37.7975, lng: -122.4241 },
  { id: "palace", title: "Shout at the Palace", prompt: "Stand in a circle at the Palace of Fine Arts and shout something. Together.", points: 15, evidence: "video", venue: "Palace of Fine Arts", address: "3601 Lyon St, San Francisco, CA 94123", area: "Marina", lat: 37.8021, lng: -122.4488 },
  { id: "ferry", title: "Ferry Building market", prompt: "Saturday farmers market at the Ferry Building — a photo with something you bought.", points: 10, evidence: "photo", venue: "Ferry Building", address: "1 Ferry Building, San Francisco, CA 94111", area: "Embarcadero", tip: "Market ends at 2 PM.", lat: 37.7955, lng: -122.3937 },
  { id: "corona", title: "A note from Corona Heights", prompt: "From the top of Corona Heights, write a note to someone who couldn't make it. Photograph the note and the view.", points: 20, evidence: "text-photo", venue: "Corona Heights", address: "Corona Heights Park, San Francisco, CA 94114", area: "Castro", tip: "We'll pass the notes on after the weekend.", lat: 37.7651, lng: -122.4384 },
  { id: "landmark", title: "A legacy landmark", prompt: "Crissy Field, Coit Tower, the Painted Ladies, Twin Peaks… a photo at one of the places you took every visitor.", points: 15, evidence: "photo", repeat: 3 },
  { id: "parks", title: "An SF park", prompt: "A park you haven't been to today. Five points each, up to five.", points: 5, evidence: "photo", repeat: 5 },
  // -------------------------------------------------------------- anywhere
  { id: "recreate", title: "Recreate a first-year photo", prompt: "Find a photo from first year. Recreate it, same people if you can. Upload both.", points: 30, evidence: "photo-pair" },
  { id: "professor", title: "Call your favorite professor", prompt: "Video-call the professor who changed something for you. Screenshot the call.", points: 25, evidence: "screenshot", tip: "We'll warn a few faculty in advance." },
  { id: "absent-call", title: "Call someone who isn't here", prompt: "Video-call a classmate who couldn't come, and get them to do something for the camera.", points: 20, evidence: "screenshot" },
  { id: "sports", title: "Challenge another crew", prompt: "Any sport, any crew. Film the decisive moment.", points: 20, evidence: "video" },
  { id: "new-hc", title: "Make a new HC", prompt: "Name it, define it in one line, photograph the moment it applies.", points: 15, evidence: "text-photo" },
  { id: "legacy-selfie", title: "Selfie with your legacy", prompt: "A selfie with your legacy.", points: 15, evidence: "photo", tip: "Definition of \"legacy\" to confirm." },
  { id: "soylent", title: "Soylent with Oscar", prompt: "Drink a Soylent (or a Huel) while holding up a photo of Oscar Englebrektsen.", points: 15, evidence: "photo", tip: "Soylent or Huel — cohosts to settle it." },
  { id: "rather-be", title: "Sing “Rather Be”", prompt: "Somewhere public. Full chorus.", points: 15, evidence: "video", bonus: "+15 if strangers sing along." },
  { id: "rotation-photo", title: "A rotation city, in one photo", prompt: "Something that says Seoul, Hyderabad, Berlin, Buenos Aires, London or Taipei. One per city.", points: 10, evidence: "photo", repeat: 6 },
  { id: "rotation-food", title: "Eat a rotation city", prompt: "Korean, Indian, German, Argentine, British, Taiwanese. One per city.", points: 10, evidence: "photo", repeat: 6 },
  { id: "rule", title: "A rule you broke in college", prompt: "Recreate it. Safely. We mean it.", points: 20, evidence: "photo", tip: "Wording under review." },
  { id: "of-course", title: "“I'm a Minervan, of course I…”", prompt: "Film the video with your crew. Thirty seconds, tops.", points: 25, evidence: "video" },
  { id: "rice-cooker", title: "A rice-cooker meal", prompt: "Make a meal in a rice cooker. Plate it like you mean it.", points: 20, evidence: "photo" },
  { id: "karaoke", title: "Karaoke at Pandora", prompt: "One song at Pandora Karaoke. Film the chorus.", points: 20, evidence: "video", venue: "Pandora Karaoke", address: "50 Mason St, San Francisco, CA 94102", area: "Union Square", lat: 37.7842, lng: -122.4093 },
  { id: "hc-advice", title: "Unsolicited HC advice", prompt: "Give a stranger a piece of HC advice. Film their face.", points: 20, evidence: "video" },
  { id: "reel", title: "The crew's Reel", prompt: "Cut a Reel of your day. Under a minute.", points: 25, evidence: "video" },
];

export function getQuest(id: string): Quest | undefined {
  return QUESTS.find((q) => q.id === id);
}

export const PLACE_QUESTS = QUESTS.filter((q) => q.venue);
export const ANYWHERE_QUESTS = QUESTS.filter((q) => !q.venue);

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  photo: "Photo",
  video: "Video",
  "photo-pair": "Two photos",
  "text-photo": "Photo + a line",
  screenshot: "Screenshot",
};

// ------------------------------------------------------------- the deadline

/** Saturday Sept 12, San Francisco time. */
export const QUESTIVAL = {
  opensAt: Date.parse("2026-09-12T10:00:00-07:00"),
  dueAt: Date.parse("2026-09-12T17:00:00-07:00"),
  /** The 7th minute: after this it counts as an extension. */
  extensionUntil: Date.parse("2026-09-12T17:07:00-07:00"),
  resultsAt: Date.parse("2026-09-12T20:30:00-07:00"),
  dueLabel: "Sat, Sep 12 · 5:00 PM PT",
} as const;

export type Window = "before" | "open" | "extension" | "closed";

export function questivalWindow(now: number): Window {
  if (now < QUESTIVAL.opensAt) return "before";
  if (now < QUESTIVAL.dueAt) return "open";
  if (now < QUESTIVAL.extensionUntil) return "extension";
  return "closed";
}

/** "2h 14m left" style countdown to the due time. */
export function timeLeft(now: number): string {
  const ms = QUESTIVAL.dueAt - now;
  if (ms <= 0) return "Due now";
  const m = Math.floor(ms / 60_000);
  const h = Math.floor(m / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  return h > 0 ? `${h}h ${m % 60}m left` : `${m}m left`;
}

// ------------------------------------------------------------------ points

export type Proof = {
  questId: string;
  /** Distinct instance for repeatable quests; 1 otherwise. */
  instance: number;
  status: "draft" | "approved" | "rejected";
  pointsOverride?: number | null;
};

/** What one approved proof is worth. Everyone tagged gets this. */
export function proofPoints(p: Proof): number {
  if (p.status !== "approved") return 0;
  if (typeof p.pointsOverride === "number") return p.pointsOverride;
  return getQuest(p.questId)?.points ?? 0;
}

/**
 * A person's total: best proof per (quest, instance), instances capped by
 * the quest's `repeat`. Derived, never stored.
 */
export function totalPoints(proofs: Proof[]): number {
  const best = new Map<string, number>();
  for (const p of proofs) {
    const q = getQuest(p.questId);
    if (!q) continue;
    const cap = q.repeat ?? 1;
    if (p.instance < 1 || p.instance > cap) continue;
    const key = `${p.questId}#${p.instance}`;
    best.set(key, Math.max(best.get(key) ?? 0, proofPoints(p)));
  }
  let sum = 0;
  for (const v of best.values()) sum += v;
  return sum;
}

