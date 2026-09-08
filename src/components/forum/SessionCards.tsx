"use client";

import { SESSIONS, getActivity, directionsUrl, nextSession, type Session } from "@/lib/weekend";
import { useForumStore } from "@/components/forum/ForumStore";
import { Faces } from "@/components/forum/ForumMobile";
import { PinIcon } from "@/components/forum/icons";

const DAY_LONG = { fri: "Friday", sat: "Saturday", sun: "Sunday" } as const;
const DAY_DATE = { fri: "Fri, Sep 11", sat: "Sat, Sep 12", sun: "Sun, Sep 13" } as const;

function firstAnchor(s: Session) {
  return s.activities.map(getActivity).find((a) => a?.kind === "anchor") ?? getActivity(s.activities[0]);
}

/**
 * The Forum home: the next class, then the rest of the course. Tapping a
 * class opens its full schedule for the day.
 */
export function SessionList({ onOpenSession }: { onOpenSession: (id: string) => void }) {
  const { now, who, intents, setIntent } = useForumStore();
  const next = nextSession(new Date(now)) ?? SESSIONS[0];
  const rest = SESSIONS.filter((s) => s.id !== next.id);
  const anchor = firstAnchor(next)!;
  const going = who[anchor.id]?.going ?? [];

  return (
    <>
      <section className="alf-card fm-nextclass" onClick={() => onOpenSession(next.id)}>
        <p className="fm-eyebrow">Upcoming class · {DAY_DATE[next.day]}</p>
        <h2 className="fm-nextclass-title">RU26 Session {next.number} – {next.title}</h2>
        <div className="fm-nextclass-meta">
          <span><b>{next.time}</b> · {next.location}</span>
        </div>
        <p className="fm-nextclass-sub">{next.sub}</p>
        <div className="fm-row-foot" style={{ marginTop: 10 }}>
          <Faces people={going} max={6} extra={Math.max(0, (who[anchor.id]?.going_count ?? 0) - going.length)} />
          <span className="fm-muted">{anchor.required ? `all ${going.length} of us` : going.length ? `${going.length} going` : "Be the first to say you're going"}</span>
        </div>
        <div className="fm-btn-row" onClick={(e) => e.stopPropagation()}>
          {anchor.required ? (
            <span className="fm-btn fm-required">Everyone · attendance required</span>
          ) : (
            <button className={`fm-btn${intents[anchor.id] === "going" ? " fm-btn-going" : " fm-btn-primary"}`} onClick={() => setIntent(anchor.id, "going")}>
              {intents[anchor.id] === "going" ? "✓ I'm going" : "I'm going"}
            </button>
          )}
          <button className="fm-btn" onClick={() => onOpenSession(next.id)}>Enter class →</button>
        </div>
      </section>

      <section className="alf-card">
        <h3 className="alf-card-h">RU26 · Alumni Reunifications</h3>
        <ul className="fm-quests">
          {rest.map((s) => {
            const a = firstAnchor(s)!;
            const g = who[a.id]?.going ?? [];
            return (
              <li key={s.id} className="fm-quest" style={{ gridTemplateColumns: "44px 1fr auto" }} onClick={() => onOpenSession(s.id)}>
                <span className="fm-datechip" style={{ width: 40 }}>
                  <span className="fm-datechip-day" style={{ fontSize: 17 }}>{DAY_DATE[s.day].split(" ")[2]}</span>
                  <span className="fm-datechip-mon">{DAY_DATE[s.day].split(",")[0]}</span>
                </span>
                <span>
                  <div className="fm-quest-title">Session {s.number} – {s.title}</div>
                  <div className="fm-quest-meta">{DAY_LONG[s.day]} {s.time} · {s.location}</div>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Faces people={g} max={3} />
                  {intents[a.id] === "going" && <span className="fm-check">✓</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

/** One class in full: its run of show with I'm going on every row, and its side quests. */
export function SessionCard({ session: s, onOpenActivity, compactHead }: { session: Session; onOpenActivity: (id: string) => void; compactHead?: boolean }) {
  const { intents, who, setIntent } = useForumStore();
  const rows = s.activities.map(getActivity).filter((a): a is NonNullable<typeof a> => !!a);
  const side = s.side.map(getActivity).filter((a): a is NonNullable<typeof a> => !!a);
  const anchor = firstAnchor(s);

  return (
    <section className="alf-card fm-daycard">
      {!compactHead && (
        <div className="fm-daycard-head" style={{ cursor: "default" }}>
          <div className="fm-datechip"><div className="fm-datechip-day">{DAY_DATE[s.day].split(" ")[2]}</div><div className="fm-datechip-mon">{DAY_DATE[s.day].split(",")[0]}</div></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="fm-eyebrow" style={{ margin: 0 }}>{DAY_LONG[s.day]} · Session {s.number}</div>
            <h3 className="fm-daycard-title">{s.title}</h3>
            <div className="fm-muted">{s.time} · {s.location}</div>
          </div>
        </div>
      )}
      <p className="fm-muted" style={{ margin: "8px 0 4px" }}>{s.sub}</p>

      <ul className="fm-daycard-list">
        {rows.map((a) => {
          const anchorRow = a.kind === "anchor";
          const going = who[a.id]?.going ?? [];
          return (
            <li key={a.id} className={`fm-daycard-row${anchorRow ? "" : " fm-daycard-opt"}`} onClick={() => onOpenActivity(a.id)}>
              <span className="fm-daycard-time">{a.time}</span>
              <span className="fm-daycard-main">
                <span className="fm-daycard-name">{a.title}</span>
                <span className="fm-daycard-venue">{a.venue ?? "optional"}{a.required ? " · everyone" : anchorRow ? " · main event" : ""}</span>
              </span>
              <Faces people={going} max={3} />
              {a.required ? (
                <span className="fm-mini fm-mini-req">Required</span>
              ) : (
                <button className={`fm-mini${intents[a.id] === "going" ? " fm-mini-on" : ""}`} onClick={(e) => { e.stopPropagation(); setIntent(a.id, "going"); }}>
                  {intents[a.id] === "going" ? "Going ✓" : "I'm going"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {side.length > 0 && (
        <div className="fm-daycard-side">
          <p className="fm-eyebrow">Side quests · peer-led, sign up if you&apos;re in</p>
          {side.map((a) => {
            const going = who[a.id]?.going ?? [];
            return (
              <div key={a.id} className="fm-daycard-row" onClick={() => onOpenActivity(a.id)}>
                <span className="fm-daycard-time">{a.time}</span>
                <span className="fm-daycard-main">
                  <span className="fm-daycard-name">{a.title}</span>
                  <span className="fm-daycard-venue">{a.host ? `${a.host}'s leading` : ""}{a.venue ? ` · ${a.venue}` : ""}</span>
                </span>
                <Faces people={going} max={3} />
                <button className={`fm-mini${intents[a.id] === "going" ? " fm-mini-on" : ""}`} onClick={(e) => { e.stopPropagation(); setIntent(a.id, "going"); }}>
                  {intents[a.id] === "going" ? "In ✓" : "I'm in"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {anchor?.address && (
        <div className="fm-daycard-foot">
          <a className="fm-link-btn" href={directionsUrl(anchor.address)} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <PinIcon /> Directions to {anchor.venue}
          </a>
        </div>
      )}
    </section>
  );
}
