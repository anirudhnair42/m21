"use client";

import { useCallback, useEffect, useState } from "react";
import { useReunionFlow, REUNION_TIMINGS } from "@/lib/useReunionFlow";
import { IntroDialog } from "@/components/IntroDialog";
import { StatusBar } from "@/components/mobile/StatusBar";
import { Springboard } from "@/components/mobile/Springboard";
import { AppFrame } from "@/components/mobile/AppFrame";
import { HomeIndicator } from "@/components/mobile/HomeIndicator";
import { NotificationBanner } from "@/components/mobile/NotificationBanner";
import type { IosAppId } from "@/components/mobile/iosApps";
import { ALF } from "@/components/apps/ALF";
import { Inbox } from "@/components/apps/Inbox";
import { CalendarApp } from "@/components/apps/CalendarApp";
import { BrowserApp } from "@/components/apps/BrowserApp";
import { RSVPApp } from "@/components/apps/RSVPApp";
import {
  readPaymentReturn,
  clearPaymentReturn,
  type PaymentReturn,
} from "@/lib/payments";

/**
 * The iOS 11 mobile experience: Springboard + fullscreen apps, driven by the
 * same scripted intro as the desktop (via useReunionFlow). Launches Calendar
 * after "Turn back time", hands off to the Mail banner, then Safari, then ALF.
 */
export function MobileShell() {
  // Back from Stripe? Mount with the intro skipped and RSVP already open in
  // the matching state (success or cancelled).
  const [paymentReturn] = useState<PaymentReturn | null>(() =>
    readPaymentReturn(),
  );
  const [authReturn] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("auth") === "alf",
  );
  useEffect(() => {
    // Strip the return params so a reload doesn't replay the state.
    if (paymentReturn) clearPaymentReturn();
    if (authReturn) {
      // Keep url.hash + the ?code param — Supabase may still be reading them.
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  }, [paymentReturn, authReturn]);

  const flow = useReunionFlow({
    skipIntro: paymentReturn !== null || authReturn,
  });
  const { now, started, showNotification, notifClosing, mailUnread } = flow;

  const [openAppId, setOpenAppId] = useState<IosAppId | null>(
    paymentReturn ? "rsvp" : authReturn ? "alf" : null,
  );
  const [launchRect, setLaunchRect] = useState<DOMRect | null>(null);
  const [closing, setClosing] = useState(false);

  const openApp = useCallback((id: IosAppId, rect: DOMRect | null = null) => {
    setLaunchRect(rect);
    setClosing(false);
    setOpenAppId(id);
  }, []);

  // Begin the close animation. Harmless if no app is open (AppFrame isn't
  // mounted); openApp() resets `closing` before the next launch.
  const closeToHome = useCallback(() => {
    setClosing(true);
  }, []);

  const handleAppClosed = useCallback(() => {
    setOpenAppId(null);
    setClosing(false);
    setLaunchRect(null);
  }, []);

  // "Turn back time" → after a beat, launch Calendar fullscreen. Skipped
  // intros (checkout returns) go straight to the springboard.
  useEffect(() => {
    if (flow.introMode !== "scripted") return;
    const t = setTimeout(() => openApp("calendar"), REUNION_TIMINGS.introLaunchDelay);
    return () => clearTimeout(t);
  }, [flow.introMode, openApp]);

  const openMail = useCallback(() => {
    flow.clearMailUnread();
    if (showNotification && !notifClosing) flow.dismissNotification();
    openApp("mail");
  }, [flow, showNotification, notifClosing, openApp]);

  const renderApp = (id: IosAppId) => {
    switch (id) {
      case "calendar":
        return (
          <CalendarApp onComplete={() => flow.runCalendarHandoff(closeToHome)} />
        );
      case "mail":
        return <Inbox onOpenDecision={() => openApp("browser")} />;
      case "browser":
        return (
          <BrowserApp
            onProceed={() => {
              flow.setAlfInitialView("syllabus");
              openApp("alf");
            }}
          />
        );
      case "alf":
        return (
          <ALF
            onOpenRSVP={() => openApp("rsvp")}
            rsvpCount={flow.rsvpCount}
            initialView={flow.alfInitialView}
          />
        );
      case "rsvp":
        return (
          <RSVPApp
            initialReturn={paymentReturn}
            onOpenALF={() => {
              flow.setAlfInitialView("home");
              openApp("alf");
            }}
          />
        );
    }
  };

  const onSpringboard = openAppId === null;

  return (
    <div className="ios-shell">
      {/* Home screen is always present underneath; an open app covers it. */}
      <Springboard
        mailUnread={mailUnread}
        onLaunch={(id, rect) => openApp(id, rect)}
      />

      {openAppId && (
        <AppFrame
          key={openAppId}
          launchRect={launchRect}
          closing={closing}
          onClosed={handleAppClosed}
        >
          {renderApp(openAppId)}
        </AppFrame>
      )}

      <StatusBar now={now} dark={onSpringboard} />
      <HomeIndicator onHome={closeToHome} dark={onSpringboard} />

      {showNotification && (
        <NotificationBanner
          closing={notifClosing}
          onOpen={openMail}
          onDismiss={flow.dismissNotification}
        />
      )}

      {!started && (
        <IntroDialog
          variant="ios"
          onStart={flow.start}
          onSkip={() => {
            flow.skipIntro();
            flow.setAlfInitialView("home");
            openApp("alf");
          }}
        />
      )}
    </div>
  );
}
