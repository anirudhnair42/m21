export type AppId =
  | "alf"
  | "rsvp"
  | "itinerary"
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
  /** Either a single-character glyph or a named visual ("alf" | "calendar" | "mail" | "safari"). */
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
    title: "RSVP + Deposit",
    icon: "✉",
    color: "#F15923",
    description:
      "Stripe Checkout for a $100 deposit. Collects name, grad city, and a current photo for the wall.",
    defaultRect: () => ({ x: 220, y: 140, width: 560, height: 560 }),
  },
  itinerary: {
    id: "itinerary",
    name: "Itinerary",
    title: "Reunion · Itinerary",
    icon: "📅",
    color: "#5a98d3",
    description:
      "Day-by-day for the weekend. Course-doc styling, a nod to the ALF reading lists.",
    defaultRect: () => ({ x: 260, y: 160, width: 720, height: 560 }),
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
    name: "Stay",
    title: "Stay",
    icon: "🛏",
    color: "#6890c8",
    description:
      "Curated hotel options near the venue, with notes on price band and walkability.",
    defaultRect: () => ({ x: 300, y: 200, width: 640, height: 540 }),
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
    name: "Photo Wall",
    title: "Photo Wall",
    icon: "📷",
    color: "#8b4789",
    description:
      "Pre-reunion: RSVP photos + classmate posts. Post-reunion: memory archive. Same surface, two modes.",
    defaultRect: () => ({ x: 240, y: 110, width: 820, height: 580 }),
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

/** The dock only shows ALF, Mail, and Safari. Finder + Trash are rendered
 * separately by Desktop.tsx as bookends. The other apps still exist as types
 * and can be launched programmatically — they just don't get a dock icon. */
export const DOCK_ORDER: AppId[] = [
  "alf",
  "mail",
  "browser",
];
