"use client";

import { useEffect, useRef, useState } from "react";
import { APPS, DOCK_ORDER, type AppId } from "@/lib/apps";
import { playMailChime } from "@/lib/sound";
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
import { AppStub } from "@/components/apps/AppStub";

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

  const [windows, setWindows] = useState<WindowsMap>(() => emptyWindows());
  const [topZ, setTopZ] = useState(1);
  const [activeId, setActiveId] = useState<AppId | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [rsvpCount, setRsvpCount] = useState(47);
  const [showNotification, setShowNotification] = useState(false);
  const [notifClosing, setNotifClosing] = useState(false);
  const [mailUnread, setMailUnread] = useState(0);
  /** Deep-link target for the next ALF mount. Consumed on open. */
  const [alfInitialView, setAlfInitialView] = useState<AlfView | undefined>(undefined);
  const introHandedOffRef = useRef(false);

  // Tick the clock every 30s and fake-tick the RSVP counter occasionally.
  useEffect(() => {
    const clockTick = setInterval(() => setNow(new Date()), 30_000);
    const counterTick = setInterval(() => {
      if (Math.random() < 0.18) setRsvpCount((c) => c + 1);
    }, 5_000);
    return () => {
      clearInterval(clockTick);
      clearInterval(counterTick);
    };
  }, []);

  // After the page settles, open Calendar so the rewind intro plays.
  useEffect(() => {
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
    }, 800);
    return () => clearTimeout(t);
  }, []);

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
    setAlfInitialView(view);
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

  // Slide the mail notification off-screen, then unmount it. macOS-style:
  // glide right + fade. Match the duration to the .mail-notif-out CSS animation.
  const NOTIF_SLIDE_MS = 420;
  const dismissNotification = () => {
    setNotifClosing((closing) => {
      if (closing) return closing;
      setTimeout(() => {
        setShowNotification(false);
        setNotifClosing(false);
      }, NOTIF_SLIDE_MS);
      return true;
    });
  };

  // Open Mail and, if the notification is currently visible, slide it off.
  // Always clears the unread badge.
  const openMail = () => {
    setMailUnread(0);
    if (showNotification && !notifClosing) dismissNotification();
    openApp("mail");
  };

  // Calendar finished its rewind → pause, close it, then drop the notif +
  // badge. Mail does NOT auto-open; the user has to click the notification or
  // the dock icon. */
  const handleCalendarDone = () => {
    if (introHandedOffRef.current) return;
    introHandedOffRef.current = true;
    setTimeout(() => closeApp("calendar"), 1200);
    setTimeout(() => {
      playMailChime();
      setMailUnread(1);
      setNotifClosing(false);
      setShowNotification(true);
    }, 1900);
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
              dismissNotification();
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
