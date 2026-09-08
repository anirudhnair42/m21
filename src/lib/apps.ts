export type AppId =
  | "alf"
  | "rsvp"
  | "aid"
  | "itinerary"
  | "map"
  | "travel"
  | "stay"
  | "checklist"
  | "photos"
  | "calendar"
  | "mail"
  | "browser";

export type AppRect = { x: number; y: number; width: number; height: number };

export type AppDef = {
  id: AppId;
  name: string;
  title: string;
  /** Either a single-character glyph or a named visual. */
  icon: string;
  color: string;
  description: string;
  defaultRect: () => AppRect;
};

const center = (W: number, H: number, yOffset = 0): AppRect => ({
  x: Math.max(16, Math.round((window.innerWidth - W) / 2)),
  y: Math.max(36, Math.round((window.innerHeight - H) / 2) + yOffset),
  width: W,
  height: H,
});

export const APPS: Record<AppId, AppDef> = {
  alf: {
    id: "alf",
    name: "ALF",
    title: "ALF — Active Learning Forum",
    icon: "alf",
    color: "#000",
    description:
      "The Active Learning Forum. Where the reunion is posted, peer-reviewed, and (hopefully) marked complete by you.",
    defaultRect: () => {
      const W = Math.min(1240, window.innerWidth - 32);
      const H = Math.min(760, window.innerHeight - 110);
      return center(W, H, -12);
    },
  },
  rsvp: {
    id: "rsvp",
    name: "RSVP",
    title: "RSVP — Closed",
    icon: "✉",
    color: "#F15923",
    description:
      "Registration closed after the August 12 deadline.",
    defaultRect: () => ({ x: 220, y: 140, width: 560, height: 560 }),
  },
  aid: {
    id: "aid",
    name: "Financial Aid",
    title: "Financial Aid Request",
    icon: "✚",
    color: "#1463b0",
    description:
      "Confidential financial-aid request. Unlisted — reachable only via the ?open=aid link, so registration stays closed for everyone else.",
    defaultRect: () => ({ x: 220, y: 120, width: 560, height: 640 }),
  },
  itinerary: {
    id: "itinerary",
    name: "Calendar",
    title: "Calendar — September 2026",
    icon: "calendar-sep",
    color: "#ffffff",
    description:
      "The weekend, day by day: Sessions 1.1–1.3, venues, who's going, what you've planned.",
    defaultRect: () => {
      const W = Math.min(1080, window.innerWidth - 60);
      const H = Math.min(700, window.innerHeight - 120);
      return center(W, H, -10);
    },
  },
  map: {
    id: "map",
    name: "Maps",
    title: "Maps — San Francisco",
    icon: "maps",
    color: "#ffffff",
    description:
      "Where we meet, where the points are, and who's planning to be there.",
    defaultRect: () => {
      const W = Math.min(1100, window.innerWidth - 60);
      const H = Math.min(720, window.innerHeight - 120);
      return center(W, H, -8);
    },
  },
  travel: {
    id: "travel",
    name: "Travel & Visas",
    title: "Travel & Visas",
    icon: "✈",
    color: "#4080cf",
    description:
      "Airports, transit from SFO/OAK, visa pathways for classmates coming from outside the US.",
    defaultRect: () => ({ x: 280, y: 180, width: 640, height: 540 }),
  },
  stay: {
    id: "stay",
    name: "Hotels",
    title: "Google Hotels — Reunion Stay",
    icon: "google-hotels",
    color: "#ffffff",
    description:
      "Book the subsidized Minerva Residence Hall for reunion weekend.",
    defaultRect: () => {
      const W = Math.min(1180, window.innerWidth - 48);
      const H = Math.min(720, window.innerHeight - 110);
      return center(W, H, -10);
    },
  },
  checklist: {
    id: "checklist",
    name: "Checklist",
    title: "Pre-Trip Checklist",
    icon: "☑",
    color: "#2e7d5b",
    description:
      "What attendees need to handle before showing up. Persistent, checkable, per-user.",
    defaultRect: () => ({ x: 320, y: 220, width: 540, height: 580 }),
  },
  photos: {
    id: "photos",
    name: "Photos",
    title: "Photos — The Class of 2021, Live",
    icon: "photos",
    color: "#ffffff",
    description:
      "Every Questival proof as it lands, the leaderboard, and after the weekend the memory archive.",
    defaultRect: () => {
      const W = Math.min(1040, window.innerWidth - 60);
      const H = Math.min(680, window.innerHeight - 120);
      return center(W, H, -6);
    },
  },
  calendar: {
    id: "calendar",
    name: "Calendar",
    title: "Calendar",
    icon: "calendar",
    color: "#ffffff",
    description: "Date — the day the email arrived.",
    defaultRect: () => {
      const W = Math.min(820, window.innerWidth - 80);
      const H = Math.min(520, window.innerHeight - 160);
      return center(W, H, -30);
    },
  },
  mail: {
    id: "mail",
    name: "Mail",
    title: "Inbox — All Inboxes",
    icon: "mail",
    color: "#3b8be3",
    description: "The 2017 mail client. Where the admissions email lives.",
    defaultRect: () => {
      const W = Math.min(1100, window.innerWidth - 60);
      const H = Math.min(700, window.innerHeight - 140);
      return {
        x: Math.max(40, Math.round((window.innerWidth - W) / 2) - 80),
        y: Math.max(40, Math.round((window.innerHeight - H) / 2)) - 20,
        width: W,
        height: H,
      };
    },
  },
  browser: {
    id: "browser",
    name: "Safari",
    title: "Minerva — Admissions Decision",
    icon: "safari",
    color: "#1a8aff",
    description:
      "The decision page. Loads the globe sequence and then the actual decision.",
    defaultRect: () => {
      const W = Math.min(1180, window.innerWidth - 40);
      const H = Math.min(740, window.innerHeight - 100);
      return center(W, H, -14);
    },
  },
};

/** The dock shows the live reunion apps. Finder + Trash are rendered
 * separately by Desktop.tsx as bookends. The other apps still exist as types
 * and can be launched programmatically — they just don't get a dock icon. */
export const DOCK_ORDER: AppId[] = [
  "alf",
  "itinerary",
  "map",
  "photos",
  "mail",
  "stay",
  "browser",
];
