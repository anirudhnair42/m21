"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playMailChime } from "@/lib/sound";
import type { AlfView } from "@/components/apps/ALF";

/** Shared timings for the scripted intro, used by both the desktop and the
 * iOS mobile shell so the two stay in lockstep. */
export const REUNION_TIMINGS = {
  /** After "Turn back time", how long before the Calendar launches. */
  introLaunchDelay: 250,
  /** After the rewind completes, how long before the Calendar closes. */
  calendarCloseDelay: 1200,
  /** After the rewind completes, how long before the Mail notification drops. */
  notifShowDelay: 1900,
  /** Mail-notification slide-off duration — must match the CSS animation. */
  notifSlideMs: 420,
} as const;

/**
 * The reunion intro state machine, shell-agnostic. Owns the data + timing of
 * the scripted sequence (rsvp counter, live clock, mail notification, the
 * Calendar→Mail handoff, the ALF deep-link target, and the "Turn back time"
 * gate). It deliberately does NOT manage how apps are *presented* — the
 * desktop opens windows, the mobile shell opens fullscreen app frames — so
 * each shell wires those bits itself and calls into these actions.
 */
export function useReunionFlow(opts?: {
  /** Mount with the intro already skipped (e.g. returning from checkout —
   * replaying the rewind at someone who just paid would be rude). */
  skipIntro?: boolean;
}) {
  const [now, setNow] = useState<Date>(() => new Date());
  /** Live count from the rsvps table; null until loaded (or unconfigured),
   * which hides the counter UI rather than showing a fake number. */
  const [rsvpCount, setRsvpCount] = useState<number | null>(null);
  const [mailUnread, setMailUnread] = useState(0);
  const [showNotification, setShowNotification] = useState(false);
  const [notifClosing, setNotifClosing] = useState(false);
  const [alfInitialView, setAlfInitialView] = useState<AlfView | undefined>(
    undefined,
  );
  /** "idle" until the cold-open dialog is dismissed. "scripted" plays the
   * Calendar-rewind intro; "skipped" goes straight to the desktop. */
  const [introMode, setIntroMode] = useState<"idle" | "scripted" | "skipped">(
    () => (opts?.skipIntro ? "skipped" : "idle"),
  );
  const started = introMode !== "idle";
  const handedOffRef = useRef(false);

  // Tick the clock every 30s, and keep the live RSVP count fresh on the
  // same cadence (it reads the rsvps table via /api/participants).
  useEffect(() => {
    let cancelled = false;
    const loadCount = async () => {
      try {
        const res = await fetch("/api/participants");
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && typeof body.count === "number") {
          setRsvpCount(body.count);
        }
      } catch {
        // Offline / unconfigured — leave the counter hidden.
      }
    };
    loadCount();
    const clockTick = setInterval(() => {
      setNow(new Date());
      loadCount();
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(clockTick);
    };
  }, []);

  const start = useCallback(
    () => setIntroMode((m) => (m === "idle" ? "scripted" : m)),
    [],
  );

  /** Land on the desktop with no scripted intro (e.g. back from checkout). */
  const skipIntro = useCallback(() => setIntroMode("skipped"), []);

  const dismissNotification = useCallback(() => {
    setNotifClosing((closing) => {
      if (closing) return closing;
      setTimeout(() => {
        setShowNotification(false);
        setNotifClosing(false);
      }, REUNION_TIMINGS.notifSlideMs);
      return true;
    });
  }, []);

  const showMailNotification = useCallback(() => {
    playMailChime();
    setMailUnread(1);
    setNotifClosing(false);
    setShowNotification(true);
  }, []);

  /** Run once when the Calendar rewind finishes: close the Calendar (shell
   * decides how), then drop the Mail notification + badge a beat later. */
  const runCalendarHandoff = useCallback(
    (onCloseCalendar: () => void) => {
      if (handedOffRef.current) return;
      handedOffRef.current = true;
      setTimeout(onCloseCalendar, REUNION_TIMINGS.calendarCloseDelay);
      setTimeout(showMailNotification, REUNION_TIMINGS.notifShowDelay);
    },
    [showMailNotification],
  );

  const clearMailUnread = useCallback(() => setMailUnread(0), []);

  /** Optimistic nudge while the next refetch is in flight — called when
   * someone lands back from checkout. */
  const bumpRsvp = useCallback(
    () => setRsvpCount((c) => (c == null ? c : c + 1)),
    [],
  );

  return {
    // state
    now,
    rsvpCount,
    mailUnread,
    showNotification,
    notifClosing,
    alfInitialView,
    started,
    introMode,
    // actions
    start,
    skipIntro,
    setAlfInitialView,
    dismissNotification,
    showMailNotification,
    runCalendarHandoff,
    clearMailUnread,
    bumpRsvp,
  };
}

export type ReunionFlow = ReturnType<typeof useReunionFlow>;
