import type { ReactNode } from "react";
import { MinervaLogo } from "@/components/MinervaLogo";

/**
 * CSS/SVG recreations of the iOS 11 springboard icons. The PNG art the
 * config originally pointed at never landed, so each tile draws its own
 * glyph instead of degrading to a flat color swatch.
 */

function CalendarGlyph() {
  return (
    <span className="iosg iosg-calendar">
      <span className="iosg-cal-wd">WED</span>
      <span className="iosg-cal-day">17</span>
    </span>
  );
}

function ForumGlyph() {
  return (
    <span className="iosg iosg-forum">
      <MinervaLogo size={34} invert />
    </span>
  );
}

/** The Photos pinwheel: 8 translucent petals fanned around the center. */
function PhotosGlyph() {
  const petals = [
    "#fbd43f",
    "#f7a936",
    "#ee6d55",
    "#e94f9d",
    "#a76ede",
    "#5087f5",
    "#4fb6f0",
    "#7ecf58",
  ];
  return (
    <span className="iosg iosg-photos">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {petals.map((c, i) => (
          <ellipse
            key={i}
            cx="50"
            cy="29"
            rx="11.5"
            ry="21"
            fill={c}
            opacity="0.82"
            transform={`rotate(${i * 45} 50 50)`}
          />
        ))}
      </svg>
    </span>
  );
}

function NotesGlyph() {
  return (
    <span className="iosg iosg-notes">
      <span className="iosg-notes-strip" />
      <span className="iosg-notes-lines">
        <span />
        <span />
        <span />
      </span>
    </span>
  );
}

function MapsGlyph() {
  return (
    <span className="iosg iosg-maps">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <rect width="100" height="100" fill="#e8efdd" />
        <path d="M0 62 Q 30 50 48 58 T 100 46 V 100 H 0 Z" fill="#cfe3f7" />
        <path
          d="M-4 30 Q 34 40 52 24 T 104 30"
          fill="none"
          stroke="#f6c945"
          strokeWidth="9"
        />
        <path
          d="M30 -4 Q 40 42 24 70 T 36 104"
          fill="none"
          stroke="#fdfdfb"
          strokeWidth="7"
        />
        <circle cx="63" cy="63" r="7.5" fill="#4a89f3" stroke="#fff" strokeWidth="3" />
      </svg>
    </span>
  );
}

function SettingsGlyph() {
  const teeth = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <span className="iosg iosg-settings">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <radialGradient id="iosg-set-bg" cx="50%" cy="38%" r="75%">
            <stop offset="0%" stopColor="#d8d9dd" />
            <stop offset="100%" stopColor="#9a9aa2" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill="url(#iosg-set-bg)" />
        <g fill="#5f6066">
          {teeth.map((a) => (
            <rect
              key={a}
              x="46.5"
              y="14"
              width="7"
              height="12"
              rx="2"
              transform={`rotate(${a} 50 50)`}
            />
          ))}
          <circle cx="50" cy="50" r="27" />
        </g>
        <circle cx="50" cy="50" r="12" fill="#c7c8cd" />
      </svg>
    </span>
  );
}

/** Glyphs keyed by the springboard label. */
export const IOS_GLYPHS: Record<string, ReactNode> = {
  Calendar: <CalendarGlyph />,
  Forum: <ForumGlyph />,
  Photos: <PhotosGlyph />,
  Notes: <NotesGlyph />,
  Maps: <MapsGlyph />,
  Settings: <SettingsGlyph />,
};
