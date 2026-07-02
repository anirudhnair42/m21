"use client";

/** iPhone X–era status bar: clock in the left ear, signal/wifi/battery in the
 * right, notch in the middle. `dark` flips the glyphs to white over photos. */
export function StatusBar({ now, dark = false }: { now: Date; dark?: boolean }) {
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, "0");
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const time = `${h12}:${m}`;

  return (
    <div className={`ios-statusbar ${dark ? "dark" : ""}`}>
      <div className="ios-sb-time">{time}</div>
      <div className="ios-sb-notch" />
      <div className="ios-sb-right">
        {/* signal dots */}
        <svg width="17" height="11" viewBox="0 0 17 11" aria-hidden="true">
          <rect x="0" y="7" width="3" height="4" rx="1" fill="currentColor" />
          <rect x="4.5" y="5" width="3" height="6" rx="1" fill="currentColor" />
          <rect x="9" y="2.5" width="3" height="8.5" rx="1" fill="currentColor" />
          <rect x="13.5" y="0" width="3" height="11" rx="1" fill="currentColor" opacity="0.35" />
        </svg>
        {/* wifi */}
        <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true">
          <path d="M8 2.4c2.6 0 5 1 6.8 2.7l-1.3 1.4A7.6 7.6 0 0 0 8 4.3 7.6 7.6 0 0 0 2.5 6.5L1.2 5.1A9.6 9.6 0 0 1 8 2.4Z" fill="currentColor" />
          <path d="M8 5.6c1.6 0 3.1.6 4.2 1.7l-1.4 1.4A3.9 3.9 0 0 0 8 7.5c-1.1 0-2.1.4-2.8 1.2L3.8 7.3A5.9 5.9 0 0 1 8 5.6Z" fill="currentColor" />
          <path d="M8 8.7c.7 0 1.3.3 1.8.8L8 11.2 6.2 9.5c.5-.5 1.1-.8 1.8-.8Z" fill="currentColor" />
        </svg>
        {/* battery */}
        <div className="ios-sb-batt">
          <span className="ios-sb-batt-fill" />
        </div>
      </div>
    </div>
  );
}
