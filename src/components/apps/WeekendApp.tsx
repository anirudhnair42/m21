"use client";

import { useState } from "react";
import { DAYS, activitiesFor, getActivity, type Day } from "@/lib/weekend";
import { WeekendView, ActivityView } from "@/components/forum/ForumMobile";
import { useForumStore } from "@/components/forum/ForumStore";

/**
 * Calendar — the weekend as a High Sierra Calendar window: September mini
 * month in the sidebar, the three sessions as days, the run of show on the
 * right. Same views as the phone, hosted in the desktop chrome.
 */
export function WeekendApp({ initialActivity }: { initialActivity?: string }) {
  const { setToast } = useForumStore();
  const [day, setDay] = useState<Day>(() => (initialActivity ? getActivity(initialActivity)?.day ?? "fri" : "fri"));
  const [activity, setActivity] = useState<string | null>(initialActivity ?? null);

  const d = DAYS.find((x) => x.id === day)!;
  const first = new Date(2026, 8, 1).getDay(); // Sept 2026 starts on a Tuesday
  const cells = [...Array(first).fill(null), ...Array.from({ length: 30 }, (_, i) => i + 1)];

  const share = async (title: string, text: string) => {
    try {
      await navigator.clipboard.writeText(`${text} ${window.location.origin}/weekend`);
      setToast("Link copied");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="wk-app">
      <aside className="wk-side">
        <div className="wk-side-h">September 2026</div>
        <div className="wk-mini">
          {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => <span key={i} className="wk-mini-dow">{w}</span>)}
          {cells.map((n, i) => {
            const onDay = n === 11 ? "fri" : n === 12 ? "sat" : n === 13 ? "sun" : null;
            return (
              <span
                key={i}
                className={`wk-mini-d${n == null ? " muted" : ""}${onDay === day ? " on" : onDay ? " range" : ""}`}
                onClick={() => onDay && (setDay(onDay), setActivity(null))}
                style={onDay ? { cursor: "pointer" } : undefined}
              >
                {n ?? ""}
              </span>
            );
          })}
        </div>
        <div className="wk-side-h">RU26 · Sessions</div>
        {DAYS.map((x) => (
          <button key={x.id} className={`wk-day-btn${x.id === day ? " on" : ""}`} onClick={() => { setDay(x.id); setActivity(null); }}>
            <span className="wk-dot" />
            <span>
              {x.label} · Session {x.session}
              <div style={{ fontSize: 11, color: "#8a8a8a", fontWeight: 400 }}>{activitiesFor(x.id).length} items</div>
            </span>
          </button>
        ))}
        <div className="wk-side-h" style={{ marginTop: 14 }}>Calendars</div>
        <div className="wk-day-btn"><span className="wk-dot" style={{ background: "#1463b0" }} />Everyone</div>
        <div className="wk-day-btn"><span className="wk-dot" style={{ background: "#8a8680" }} />Optional</div>
        <div className="wk-day-btn"><span className="wk-dot" style={{ background: "#8b4789" }} />Peer-led</div>
      </aside>
      <div className="wk-main">
        <div className="wk-head">
          <span className="wk-head-title">{activity ? getActivity(activity)?.title : d.date}</span>
          <span className="wk-head-sub">{activity ? `${d.label} · ${getActivity(activity)?.time}` : `Session ${d.session} · ${d.title}`}</span>
          {activity && (
            <button className="fm-link-btn" style={{ marginLeft: "auto" }} onClick={() => setActivity(null)}>‹ {d.label} run of show</button>
          )}
        </div>
        <div className="fm fm-embed wk-embed-top">
          <main className="fm-main">
            {activity ? (
              <ActivityView activity={getActivity(activity)!} onShare={share} />
            ) : (
              <WeekendView day={day} onDay={(x) => { setDay(x); setActivity(null); }} onOpen={setActivity} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
