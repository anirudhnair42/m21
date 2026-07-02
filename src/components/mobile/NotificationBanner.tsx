"use client";

import { useRef } from "react";

/** iOS-style notification banner that slides down from the top. Tap opens
 * Mail; swipe up or the timer dismisses it. */
export function NotificationBanner({
  closing,
  onOpen,
  onDismiss,
}: {
  closing: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const startY = useRef<number | null>(null);

  return (
    <div
      className={`ios-banner ${closing ? "ios-banner-out" : ""}`}
      onClick={() => {
        if (!closing) onOpen();
      }}
      onTouchStart={(e) => {
        startY.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(e) => {
        const y0 = startY.current;
        const y1 = e.changedTouches[0]?.clientY ?? y0;
        if (y0 != null && y1 != null && y0 - y1 > 20) onDismiss();
        startY.current = null;
      }}
    >
      <div
        className="ios-banner-icon"
        style={{
          backgroundColor: "#1f8bff",
          backgroundImage: 'url("/assets/icon-mail.png")',
        }}
      />
      <div className="ios-banner-body">
        <div className="ios-banner-row">
          <span className="ios-banner-app">MAIL</span>
          <span className="ios-banner-time">now</span>
        </div>
        <div className="ios-banner-from">Minerva Schools at KGI</div>
        <div className="ios-banner-subj">Your admissions decision</div>
      </div>
    </div>
  );
}
