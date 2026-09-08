"use client";

import { DAYS, activitiesFor, directionsUrl, type Day } from "@/lib/weekend";
import { useForumStore } from "@/components/forum/ForumStore";
import { Faces } from "@/components/forum/ForumMobile";
import { PinIcon } from "@/components/forum/icons";

/**
 * The weekend at a glance: one card per day with the anchors, the side
 * sessions you can sign up for, and how much of it you've said yes to.
 * Shared by the phone Home and the desktop ALF home.
 */
export function HowItWorks({ onOpenDay, onOpenClass }: { onOpenDay: (d: Day) => void; onOpenClass: () => void }) {
  const { intents, questivalOpen } = useForumStore();
  const said = Object.values(intents).filter(Boolean).length;
  return (
    <section className="alf-card fm-how">
      <h2 className="alf-card-h">How the weekend works</h2>
      <ol className="fm-steps">
        <li>
          <b>Say what you&apos;re coming to.</b> Open a day, tap <span className="fm-kbd">I&apos;m going</span> on anything. That&apos;s the head count for food and tables.
          {said > 0 && <span className="fm-step-done"> ✓ {said} so far</span>}
        </li>
        <li>
          <b>Plan it with people.</b> On any activity, <span className="fm-kbd">Plan it</span> and pick who with; they get an invitation. Or <button className="fm-link-btn" onClick={onOpenClass}>request a one-on-one catch-up</button> from the class list.
        </li>
        <li>
          <b>Saturday is Assignment 3: Questival.</b> {questivalOpen ? "Quests, points, and a 5:00 PM deadline before the bonfire. Open the Questival tab." : "The brief unlocks this week. Bring walking shoes."}
        </li>
      </ol>
      <div className="fm-btn-row" style={{ marginTop: 8 }}>
        <button className="fm-btn fm-btn-blue" onClick={() => onOpenDay("fri")}>Start with Friday →</button>
      </div>
    </section>
  );
}

export function DayCards({ onOpenDay, onOpenActivity }: { onOpenDay: (d: Day) => void; onOpenActivity: (id: string) => void }) {
  const { intents, who, setIntent } = useForumStore();
  return (
    <>
      {DAYS.map((d) => {
        const all = activitiesFor(d.id);
        const anchors = all.filter((a) => a.kind === "anchor");
        // Chronological: anchors and optional items interleave by start time.
        const timed = all
          .filter((a) => a.kind !== "peer")
          .sort((a, b) => (a.start ? Date.parse(a.start) : Infinity) - (b.start ? Date.parse(b.start) : Infinity));
        const peer = all.filter((a) => a.kind === "peer");
        const mine = all.filter((a) => intents[a.id]).length;
        const [mon, dd] = d.date.split(", ")[1].split(" ");
        return (
          <section key={d.id} className="alf-card fm-daycard">
            <div className="fm-daycard-head" onClick={() => onOpenDay(d.id)}>
              <div className="fm-datechip"><div className="fm-datechip-day">{dd}</div><div className="fm-datechip-mon">{mon.slice(0, 3)}</div></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fm-eyebrow" style={{ margin: 0 }}>{d.label === "Fri" ? "Friday" : d.label === "Sat" ? "Saturday" : "Sunday"} · Session {d.session}</div>
                <h3 className="fm-daycard-title">{d.title}</h3>
                <div className="fm-muted">{d.sub}</div>
              </div>
              <span className="fm-daycard-count">{mine ? `${mine} ✓` : ""}</span>
            </div>

            <ul className="fm-daycard-list">
              {timed.map((a) => {
                const anchor = a.kind === "anchor";
                const going = who[a.id]?.going ?? [];
                return (
                  <li key={a.id} className={`fm-daycard-row${anchor ? "" : " fm-daycard-opt"}`} onClick={() => onOpenActivity(a.id)}>
                    <span className="fm-daycard-time">{a.time}</span>
                    <span className="fm-daycard-main">
                      <span className="fm-daycard-name">{a.title}</span>
                      <span className="fm-daycard-venue">{a.venue ?? "optional"}{anchor ? " · everyone" : ""}</span>
                    </span>
                    <Faces people={going} max={3} extra={intents[a.id] === "going" && !going.length ? 1 : 0} />
                    <button className={`fm-mini${intents[a.id] === "going" ? " fm-mini-on" : ""}`} onClick={(e) => { e.stopPropagation(); setIntent(a.id, "going"); }}>
                      {intents[a.id] === "going" ? "Going ✓" : intents[a.id] === "interested" ? "Interested" : "I'm going"}
                    </button>
                  </li>
                );
              })}
            </ul>

            {peer.length > 0 && (
              <div className="fm-daycard-side">
                <p className="fm-eyebrow">Side quests · peer-led, sign up if you&apos;re in</p>
                {peer.map((a) => (
                  <div key={a.id} className="fm-daycard-row" onClick={() => onOpenActivity(a.id)}>
                    <span className="fm-daycard-time">{a.time}</span>
                    <span className="fm-daycard-main">
                      <span className="fm-daycard-name">{a.title}</span>
                      <span className="fm-daycard-venue">{a.host ? `${a.host}'s going` : ""}{a.venue ? ` · ${a.venue}` : ""}</span>
                    </span>
                    <Faces people={who[a.id]?.going ?? []} max={3} />
                    <button className={`fm-mini${intents[a.id] === "going" ? " fm-mini-on" : ""}`} onClick={(e) => { e.stopPropagation(); setIntent(a.id, "going"); }}>
                      {intents[a.id] === "going" ? "In ✓" : "I'm in"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="fm-daycard-foot">
              <button className="fm-link-btn" onClick={() => onOpenDay(d.id)}>Full run of show →</button>
              {anchors[0]?.address && (
                <a className="fm-link-btn" href={directionsUrl(anchors[0].address)} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <PinIcon /> First stop
                </a>
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}
