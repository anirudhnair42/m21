/** Sidebar glyphs from the ALF, plus a few the phone needs. */

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function HomeIcon() {
  return (
    <svg {...base}>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
export function BookIcon() {
  return (
    <svg {...base}>
      <path d="M4 5a2 2 0 0 1 2-2h12v17H6a2 2 0 0 0-2 2V5z" />
      <line x1="8" y1="7" x2="14" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}
export function ListIcon() {
  return (
    <svg {...base}>
      <line x1="8" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="8" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </svg>
  );
}
export function PeopleIcon() {
  return (
    <svg {...base}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14.5a5 5 0 0 1 6 5" />
    </svg>
  );
}
export function CameraIcon() {
  return (
    <svg {...base}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
export function PinIcon() {
  return (
    <svg {...base} width="14" height="14">
      <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}
export function ShareIcon() {
  return (
    <svg {...base} width="15" height="15">
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v8h14v-8" />
    </svg>
  );
}
export function PaperclipIcon() {
  return (
    <svg {...base} width="16" height="16" stroke="#1f7ad6">
      <path d="M21 10l-9.5 9.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 1 1 5 5l-9 9a2 2 0 1 1-3-3l8-8" />
    </svg>
  );
}
export function LockIcon() {
  return (
    <svg {...base} width="14" height="14">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
export function MapIcon() {
  return (
    <svg {...base}>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}
export function MailIcon() {
  return (
    <svg {...base}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

/** The Shift 3 heart. Filled once you've given one. */
export function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg {...base} fill={filled ? "currentColor" : "none"} aria-hidden="true">
      <path d="M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.6 12 20 12 20z" />
    </svg>
  );
}
