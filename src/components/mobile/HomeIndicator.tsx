"use client";

import { useRef } from "react";

/** Bottom home-indicator pill. Tap or swipe up to go home. `dark` renders it
 * white-on-photo. */
export function HomeIndicator({
  onHome,
  dark = false,
}: {
  onHome: () => void;
  dark?: boolean;
}) {
  const startY = useRef<number | null>(null);

  return (
    <div
      className={`ios-home-indicator ${dark ? "dark" : ""}`}
      onClick={onHome}
      onTouchStart={(e) => {
        startY.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(e) => {
        const y0 = startY.current;
        const y1 = e.changedTouches[0]?.clientY ?? y0;
        if (y0 != null && y1 != null && y0 - y1 > 24) onHome();
        startY.current = null;
      }}
      role="button"
      aria-label="Go home"
    >
      <span className="ios-home-pill" />
    </div>
  );
}
