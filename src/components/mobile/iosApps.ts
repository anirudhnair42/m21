/**
 * Springboard config for the iOS shell. These are the four real apps plus a
 * few decorative (non-interactive) icons for authenticity. Icon art lives in
 * /public/assets/ios/ — swap the paths as the real PNGs land.
 */

export type IosAppId = "calendar" | "mail" | "browser" | "alf" | "rsvp";

export type IosApp = {
  id: IosAppId;
  label: string;
  /** Icon image path under /public (rendered as a tile background, so a
   * missing file degrades to the `tint` color rather than a broken image). */
  icon: string;
  /** Fallback tile color shown until the real PNG is dropped in. */
  tint: string;
  /** Where it lives on the home screen. */
  placement: "grid" | "dock";
};

export const IOS_APPS: IosApp[] = [
  { id: "calendar", label: "Calendar", icon: "/assets/ios/calendar.png", tint: "#ffffff", placement: "grid" },
  { id: "alf", label: "Forum", icon: "/assets/ios/alf.png", tint: "#111111", placement: "grid" },
  { id: "browser", label: "Safari", icon: "/assets/icon-safari.png", tint: "#1c8cff", placement: "dock" },
  { id: "mail", label: "Mail", icon: "/assets/icon-mail.png", tint: "#1f8bff", placement: "dock" },
];

/** Decorative, non-interactive icons that round out the home grid. Optional —
 * purely for the iOS look. Tapping them does nothing. */
export const IOS_DECOR: { label: string; icon: string; tint: string }[] = [
  { label: "Photos", icon: "/assets/ios/photos.png", tint: "#fdfdfd" },
  { label: "Notes", icon: "/assets/ios/notes.png", tint: "#fff7d6" },
  { label: "Maps", icon: "/assets/ios/maps.png", tint: "#dff0d8" },
  { label: "Settings", icon: "/assets/ios/settings.png", tint: "#8e8e93" },
];

/** Nav-bar title shown at the top of each fullscreen app. */
export const IOS_APP_TITLE: Record<IosAppId, string> = {
  calendar: "Calendar",
  mail: "Mail",
  browser: "Safari",
  alf: "Forum",
  rsvp: "RSVP",
};
