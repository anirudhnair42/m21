"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Compute the transform that places a fullscreen layer over the launching
 * icon's rect, so the open animation can zoom out from the icon and the close
 * animation can zoom back into it. */
function rectTransform(rect: DOMRect | null): string {
  if (typeof window === "undefined" || !rect) return "scale(0.92)";
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const s = Math.max(rect.width / vw, 0.08);
  const tx = rect.left + rect.width / 2 - vw / 2;
  const ty = rect.top + rect.height / 2 - vh / 2;
  return `translate(${tx}px, ${ty}px) scale(${s})`;
}

type Props = {
  launchRect: DOMRect | null;
  /** When true, plays the reverse (zoom-into-icon) animation then onClosed. */
  closing: boolean;
  onClosed: () => void;
  children: ReactNode;
};

/**
 * Fullscreen host for an app. Plays the iOS icon-zoom open animation from the
 * tapped icon's rect, and the reverse on close. Provides a status-bar-height
 * top spacer so each app's own chrome clears the notch; the app supplies its
 * own toolbar/banner below.
 */
export function AppFrame({ launchRect, closing, onClosed, children }: Props) {
  const [style, setStyle] = useState<CSSProperties>(() => ({
    transform: rectTransform(launchRect),
    opacity: 0,
  }));
  const closedRef = useRef(false);

  // Open: next frame, transition to identity.
  useEffect(() => {
    const r = requestAnimationFrame(() =>
      requestAnimationFrame(() => setStyle({ transform: "none", opacity: 1 })),
    );
    return () => cancelAnimationFrame(r);
  }, []);

  // Close: transition back into the icon, then unmount.
  useEffect(() => {
    if (!closing) return;
    setStyle({ transform: rectTransform(launchRect), opacity: 0 });
    const t = setTimeout(() => {
      if (closedRef.current) return;
      closedRef.current = true;
      onClosed();
    }, 320);
    return () => clearTimeout(t);
  }, [closing, launchRect, onClosed]);

  return (
    <div className="ios-appframe" style={style}>
      <div className="ios-appframe-spacer" />
      <div className="ios-appframe-body">{children}</div>
    </div>
  );
}
