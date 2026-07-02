"use client";

import { useState } from "react";
import { MinervaLogo } from "@/components/MinervaLogo";

type Props = {
  variant: "macos" | "ios";
  /** Called after the dismiss animation; kicks off the scripted intro. */
  onStart: () => void;
  /** Returning visitors: skip the whole intro and land in ALF. */
  onSkip: () => void;
};

const TITLE = "Turn back time";
const BODY =
  "We're transporting you to your computer in 2017 — the night the news from Minerva arrived.";

/**
 * Cold-open gate shown over the wallpaper before anything animates. A
 * macOS High Sierra alert sheet on desktop, an iOS 11 alert card on phone.
 * "Take me back" plays the scripted intro; the muted action underneath
 * skips straight to ALF for people who've already lived it.
 */
export function IntroDialog({ variant, onStart, onSkip }: Props) {
  const [leaving, setLeaving] = useState(false);

  const dismiss = (after: () => void) => {
    if (leaving) return;
    setLeaving(true);
    // Let the fade play, then hand off.
    setTimeout(after, 360);
  };

  return (
    <div className={`introdlg introdlg-${variant} ${leaving ? "leaving" : ""}`}>
      <div className="introdlg-backdrop" />
      <div className="introdlg-card" role="dialog" aria-modal="true">
        <div className="introdlg-mark" aria-hidden="true">
          <MinervaLogo size={variant === "macos" ? 42 : 36} />
        </div>
        <div className="introdlg-title">{TITLE}</div>
        <div className="introdlg-body">{BODY}</div>
        <div className="introdlg-actions">
          <button
            className="introdlg-btn"
            onClick={() => dismiss(onStart)}
            autoFocus
          >
            Take me back
          </button>
          <button
            className="introdlg-btn-ghost"
            onClick={() => dismiss(onSkip)}
          >
            I&apos;ve relived it already — straight to the Forum
          </button>
        </div>
      </div>
    </div>
  );
}
