"use client";

import { DAYS } from "@/lib/weekend";
import { QUESTIVAL } from "@/lib/questival";
import { useForumStore } from "@/components/forum/ForumStore";

/**
 * "How it all works": the one page that explains the weekend site. Opened
 * from the shiny button on Home (phone and desktop ALF).
 */
export function GuideView({ onOpenDay, onOpenClass, onOpenMap, onOpenInbox }: { onOpenDay: (d: "fri" | "sat" | "sun") => void; onOpenClass: () => void; onOpenMap?: () => void; onOpenInbox?: () => void }) {
  const { questivalOpen } = useForumStore();
  return (
    <>
      <section className="alf-card">
        <p className="fm-eyebrow">RU26 · Alumni Reunifications</p>
        <h2 className="alf-card-h" style={{ fontSize: 24 }}>How it all works</h2>
        <p className="alf-card-body">
          The reunion is a three-session course. This site is the Forum for it: the run of show, who&apos;s going where, the plans
          you make with people, and on Saturday, Assignment 3. Everything is optional. Nothing here is a ticket; it&apos;s how we
          find each other.
        </p>
      </section>

      <section className="alf-card">
        <h3 className="alf-card-h">1 · The three days</h3>
        <ul className="fm-quests">
          {DAYS.map((d) => (
            <li key={d.id} className="fm-quest" onClick={() => onOpenDay(d.id)}>
              <span className="fm-dot fm-dot-planned" />
              <span><div className="fm-quest-title">{d.label === "Fri" ? "Friday" : d.label === "Sat" ? "Saturday" : "Sunday"} · {d.title}</div><div className="fm-quest-meta">{d.sub}</div></span>
              <span className="fm-muted">→</span>
            </li>
          ))}
        </ul>
        <p className="fm-muted" style={{ marginTop: 8 }}>Rows marked <b>everyone</b> are the anchors. The rest is optional. Each has the address and a Directions button.</p>
      </section>

      <section className="alf-card">
        <h3 className="alf-card-h">2 · Say what you&apos;re coming to</h3>
        <p className="alf-card-body">
          Tap <span className="fm-kbd">I&apos;m going</span> on anything, straight from the day cards or inside an activity. That&apos;s the head count we use for food and tables, and your face joins the row so friends can see you&apos;ll be there. Tap again to undo. Side quests (Altın Gün on Friday, disc golf on Sunday) work the same way with <span className="fm-kbd">I&apos;m in</span>.
        </p>
      </section>

      <section className="alf-card">
        <h3 className="alf-card-h">3 · Plan it with people</h3>
        <p className="alf-card-body">
          Inside any activity, <span className="fm-kbd">Plan it</span> lets you pick who you want to do it with. They get an invitation in their <b>Inbox</b> and can say I&apos;m in or Maybe. Nothing is locked in; it&apos;s how &ldquo;let&apos;s do the Ferry Building together&rdquo; survives the group chat.
        </p>
        {onOpenInbox && <button className="fm-link-btn" onClick={onOpenInbox}>Open your inbox →</button>}
      </section>

      <section className="alf-card">
        <h3 className="alf-card-h">4 · Catch-ups, one on one</h3>
        <p className="alf-card-body">
          Five years is too long for a group hello. In the class list, tap a face and <span className="fm-kbd">Request a catch-up</span> in one of the weekend&apos;s open windows. If they accept, it lands on both your calendars with a spot to meet.
        </p>
        <button className="fm-link-btn" onClick={onOpenClass}>Open the class list →</button>
      </section>

      <section className="alf-card">
        <h3 className="alf-card-h">5 · The map</h3>
        <p className="alf-card-body">
          Every anchor and side quest is a pin with the time and the faces of who&apos;s going. On Saturday the quests appear as points. &ldquo;Find me&rdquo; uses your phone&apos;s location only when you ask.
        </p>
        {onOpenMap && <button className="fm-link-btn" onClick={onOpenMap}>Open the map →</button>}
      </section>

      <section className="alf-card">
        <h3 className="alf-card-h">6 · Saturday: Assignment 3, Questival</h3>
        <p className="alf-card-body">
          {questivalOpen
            ? `A catalog of quests across the city, each worth points. Take a photo or video, tag whoever did it with you (everyone tagged gets the points), and it lands on your list. Submit your final list by ${QUESTIVAL.dueLabel}, before the bonfire. Results at dinner.`
            : "A pick-your-own-adventure through nostalgic M21 stops, with whoever you want. The brief, the points, and the map pins unlock this week. Bring walking shoes."}
        </p>
      </section>

      <section className="alf-card">
        <h3 className="alf-card-h">Phone or computer</h3>
        <p className="alf-card-body">
          Same account, same data. On a phone this is the Forum with tabs. On a computer it&apos;s the desktop: Calendar is the weekend, Maps is the map, Mail holds your invitations, and ALF holds the assignments. Sign in with the Google account you RSVP&apos;d with.
        </p>
      </section>
    </>
  );
}
