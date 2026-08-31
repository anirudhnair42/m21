"use client";

import { useEffect, useState } from "react";
import { track } from "@vercel/analytics";
import { APPS, DOCK_ORDER, type AppId } from "@/lib/apps";
import { Window } from "@/components/Window";
import { MenuBar } from "@/components/MenuBar";
import { DockIcon } from "@/components/DockIcon";
import { DesktopIcon } from "@/components/DesktopIcon";
import {
  AppIconVisual,
  FinderIconGlyph,
  TrashIconGlyph,
} from "@/components/AppIconVisual";
import { ALF, type AlfView } from "@/components/apps/ALF";
import { Inbox } from "@/components/apps/Inbox";
import { CalendarApp } from "@/components/apps/CalendarApp";
import { BrowserApp } from "@/components/apps/BrowserApp";
import { RSVPApp } from "@/components/apps/RSVPApp";
import { AidApp } from "@/components/apps/AidApp";
import { HotelApp } from "@/components/apps/HotelApp";
import { AppStub } from "@/components/apps/AppStub";
import { IntroDialog } from "@/components/IntroDialog";
import { useReunionFlow, REUNION_TIMINGS } from "@/lib/useReunionFlow";
import {
  readPaymentReturn,
  clearPaymentReturn,
  type PaymentReturn,
} from "@/lib/payments";
import { clearHotelReturn, readHotelReturn, type HotelReturn } from "@/lib/hotel";

type WindowState = {
  open: boolean;
  minimized: boolean;
  zIndex: number;
  openTick: number;
};

type WindowsMap = Record<AppId, WindowState>;

function emptyWindows(): WindowsMap {
  const map = {} as WindowsMap;
  (Object.keys(APPS) as AppId[]).forEach((id) => {
    map[id] = { open: false, minimized: false, zIndex: 1, openTick: 0 };
  });
  return map;
}

export function Desktop() {
  // Defer mount until window exists — APPS.defaultRect() reads window.innerWidth.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Back from Stripe (or Google sign-in)? Mount with the intro skipped and
  // the right window already open.
  const [paymentReturn] = useState<PaymentReturn | null>(() =>
    readPaymentReturn(),
  );
  const [authReturn] = useState<AppId | null>(() => {
    if (typeof window === "undefined") return null;
    const value = new URLSearchParams(window.location.search).get("auth");
    return value === "alf" || value === "stay" ? value : null;
  });
  const [hotelReturn] = useState<HotelReturn | null>(() => readHotelReturn());
  // Deep link from the emailed letter: `/?open=rsvp` skips the intro and opens
  // that window straight away. Without this the CTA would replay the whole
  // scripted sequence and never surface the RSVP form.
  const [deepLink] = useState<AppId | null>(() => {
    if (typeof window === "undefined") return null;
    const value = new URLSearchParams(window.location.search).get("open");
    return value && value in APPS ? (value as AppId) : null;
  });
  useEffect(() => {
    // Strip the return params so a reload doesn't replay the state.
    if (paymentReturn) clearPaymentReturn();
    if (hotelReturn) clearHotelReturn();
    if (deepLink) {
      if (deepLink === "stay") track("housing_deeplink_opened", { surface: "desktop" });
      const url = new URL(window.location.href);
      url.searchParams.delete("open");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
    if (authReturn) {
      // Keep url.hash + the ?code param — Supabase may still be reading them.
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  }, [paymentReturn, hotelReturn, authReturn, deepLink]);

  const [windows, setWindows] = useState<WindowsMap>(() => {
    const map = emptyWindows();
    const initial: AppId | null = paymentReturn
      ? "rsvp"
      : hotelReturn
        ? "stay"
      : deepLink
        ? deepLink
        : authReturn
          ? authReturn
          : null;
    if (initial) {
      map[initial] = { open: true, minimized: false, zIndex: 2, openTick: Date.now() };
    }
    return map;
  });
  const [topZ, setTopZ] = useState(
    paymentReturn || hotelReturn || authReturn || deepLink ? 2 : 1,
  );
  const [activeId, setActiveId] = useState<AppId | null>(
    paymentReturn ? "rsvp" : hotelReturn ? "stay" : deepLink ? deepLink : authReturn,
  );

  // Shared scripted-intro state machine (clock, rsvp, notification, deep-link,
  // and the "Turn back time" gate).
  const flow = useReunionFlow({
    skipIntro:
      paymentReturn !== null ||
      hotelReturn !== null ||
      authReturn !== null ||
      deepLink !== null,
  });
  const {
    now,
    rsvpCount,
    mailUnread,
    showNotification,
    notifClosing,
    alfInitialView,
    started,
    introMode,
  } = flow;

  // Once "Turn back time" is pressed, open Calendar so the rewind intro
  // plays. Skipped intros (checkout returns) go straight to the desktop.
  useEffect(() => {
    if (introMode !== "scripted") return;
    const t = setTimeout(() => {
      setTopZ((z) => {
        const nextZ = z + 1;
        setWindows((w) => ({
          ...w,
          calendar: {
            open: true,
            minimized: false,
            zIndex: nextZ,
            openTick: Date.now(),
          },
        }));
        return nextZ;
      });
      setActiveId("calendar");
    }, REUNION_TIMINGS.introLaunchDelay);
    return () => clearTimeout(t);
  }, [introMode]);

  const openApp = (id: AppId, opts?: { freshMount?: boolean }) => {
    setTopZ((z) => {
      const nextZ = z + 1;
      setWindows((w) => ({
        ...w,
        [id]: {
          open: true,
          minimized: false,
          zIndex: nextZ,
          openTick:
            opts?.freshMount || !w[id]?.openTick ? Date.now() : w[id].openTick,
        },
      }));
      return nextZ;
    });
    setActiveId(id);
  };

  /** Open ALF, deep-linking to a specific view (home / syllabus). Always
   * forces a fresh mount so the new initialView takes effect. */
  const openAlfAt = (view: AlfView | undefined) => {
    flow.setAlfInitialView(view);
    openApp("alf", { freshMount: true });
  };

  const focusApp = (id: AppId) => {
    if (activeId === id && !windows[id]?.minimized) return;
    setTopZ((z) => {
      const nextZ = z + 1;
      setWindows((w) => ({
        ...w,
        [id]: { ...w[id], minimized: false, zIndex: nextZ },
      }));
      return nextZ;
    });
    setActiveId(id);
  };

  const closeApp = (id: AppId) => {
    setWindows((w) => ({
      ...w,
      [id]: { ...w[id], open: false, minimized: false },
    }));
    if (activeId === id) setActiveId(null);
  };

  const minimizeApp = (id: AppId) => {
    setWindows((w) => ({ ...w, [id]: { ...w[id], minimized: true } }));
    if (activeId === id) setActiveId(null);
  };

  // Open Mail and, if the notification is currently visible, slide it off.
  // Always clears the unread badge.
  const openMail = () => {
    flow.clearMailUnread();
    if (showNotification && !notifClosing) flow.dismissNotification();
    openApp("mail");
  };

  // Calendar finished its rewind → pause, close it, then drop the notif +
  // badge. Mail does NOT auto-open; the user clicks the notification or the
  // dock icon.
  const handleCalendarDone = () => {
    flow.runCalendarHandoff(() => closeApp("calendar"));
  };

  if (!mounted) {
    // Render the stage backdrop only — apps depend on window dimensions.
    return (
      <div className="stage">
        <div className="wallpaper" />
      </div>
    );
  }

  const activeApp = activeId ? APPS[activeId] : null;
  const menuAppName = activeApp ? activeApp.name : "Finder";

  return (
    <div className="stage">
      <div className="wallpaper" />

      <MenuBar
        appName={menuAppName}
        rsvpCount={rsvpCount}
        currentTime={now}
      />

      <div className="desktop-icons">
        <DesktopIcon kind="folder" label="Applications" />
      </div>

      {(Object.keys(APPS) as AppId[]).map((id) => {
        const w = windows[id];
        const app = APPS[id];
        if (!w?.open || w.minimized) return null;
        const rect = app.defaultRect();
        const isActive = activeId === id;
        return (
          <Window
            key={`${id}-${w.openTick}`}
            title={app.title}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            zIndex={w.zIndex}
            isActive={isActive}
            onFocus={() => focusApp(id)}
            onClose={() => closeApp(id)}
            onMinimize={() => minimizeApp(id)}
          >
            {id === "alf" ? (
              <ALF
                onOpenRSVP={() => openApp("rsvp")}
                rsvpCount={rsvpCount}
                initialView={alfInitialView}
              />
            ) : id === "mail" ? (
              <Inbox onOpenDecision={() => openApp("browser")} />
            ) : id === "calendar" ? (
              <CalendarApp onComplete={handleCalendarDone} />
            ) : id === "browser" ? (
              <BrowserApp
                onProceed={() => {
                  closeApp("browser");
                  // Deep-link straight to the syllabus grader (the warm
                  // letter + grades & comments view).
                  openAlfAt("syllabus");
                }}
              />
            ) : id === "rsvp" ? (
              <RSVPApp
                initialReturn={paymentReturn}
                onOpenALF={() => openAlfAt("home")}
                onClose={() => closeApp("rsvp")}
              />
            ) : id === "stay" ? (
              <HotelApp initialReturn={hotelReturn} />
            ) : id === "aid" ? (
              <AidApp />
            ) : (
              <AppStub app={app} />
            )}
          </Window>
        );
      })}

      <div className="dock-wrap">
        <div className="dock">
          <DockIcon icon={<FinderIconGlyph />} label="Finder" />
          {DOCK_ORDER.map((id) => {
            const app = APPS[id];
            const w = windows[id];
            return (
              <DockIcon
                key={id}
                icon={<AppIconVisual app={app} size={48} />}
                label={app.name}
                onClick={() => {
                  if (id === "mail") openMail();
                  else if (id === "alf") openAlfAt("home");
                  else openApp(id);
                }}
                hasWindow={w?.open && !w?.minimized}
                badge={id === "mail" ? mailUnread : 0}
              />
            );
          })}
          <div className="dock-divider" />
          <DockIcon icon={<TrashIconGlyph />} label="Trash" />
        </div>
      </div>

      {showNotification && (
        <div
          className={`mail-notif ${notifClosing ? "mail-notif-out" : ""}`}
          onClick={() => {
            if (notifClosing) return;
            openMail();
          }}
        >
          <div className="mail-notif-icon">
            <AppIconVisual app={APPS.mail} size={36} />
          </div>
          <div className="mail-notif-body">
            <div className="mail-notif-row">
              <span className="mail-notif-app">Mail</span>
              <span className="mail-notif-time">now</span>
            </div>
            <div className="mail-notif-from">Minerva Schools at KGI</div>
            <div className="mail-notif-subj">Your admissions decision</div>
          </div>
          <button
            className="mail-notif-close"
            onClick={(e) => {
              e.stopPropagation();
              flow.dismissNotification();
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {!started && (
        <IntroDialog
          variant="macos"
          onStart={flow.start}
          onSkip={() => {
            flow.skipIntro();
            openAlfAt("home");
          }}
        />
      )}
    </div>
  );
}
