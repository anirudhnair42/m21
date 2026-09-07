"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  DAYS,
  activitiesFor,
  dayOf,
  directionsUrl,
  getActivity,
  nowNext,
  type Activity,
  type Day,
} from "@/lib/weekend";
import { QUESTIVAL, getQuest, getTeam, questivalWindow } from "@/lib/questival";
import { QuestivalHub, QuestView, MyQuestival, LiveView, TagPicker } from "@/components/forum/Questival";
import { MapView } from "@/components/forum/MapView";
import { useAuth, getAccessToken } from "@/lib/auth";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { SnackbarProvider } from "@/lib/snackbar";
import {
  BookIcon,
  HomeIcon,
  ListIcon,
  LockIcon,
  MailIcon,
  MapIcon,
  PaperclipIcon,
  PinIcon,
  ShareIcon,
} from "@/components/forum/icons";
import {
  ME,
  firstName,
  readNowOffset,
  sample,
  teamFor,
  timeShort,
  type Final,
  type Invite,
  type Person,
  type Plan,
  type PlanIntent,
  type SavedProof,
} from "@/components/forum/store";
import { ForumStoreProvider, ForumToast, useForumStore } from "@/components/forum/ForumStore";

export type Tab = "home" | "weekend" | "map" | "questival" | "inbox";

type View =
  | { kind: "tab" }
  | { kind: "activity"; id: string }
  | { kind: "quest"; id: string }
  | { kind: "me" }
  | { kind: "live" }
  | { kind: "class" };

const noop = () => () => {};
const TABS: Tab[] = ["home", "weekend", "map", "questival", "inbox"];

/**
 * The Forum on a phone. Same course, same sessions, same assignment
 * language as the desktop ALF — the sidebar folds into a tab bar. This is
 * the preview build: state lives on the device, and sample plans/scores fill
 * in what the API will return next week.
 */
export function ForumMobile({ initialTab }: { initialTab: Tab }) {
  // Render nothing until mounted so device state never mismatches SSR.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) return <div className="fm" />;
  return (
    <SnackbarProvider>
      <ForumGate initialTab={initialTab} />
    </SnackbarProvider>
  );
}

type Access =
  | { state: "loading" }
  | { state: "anon" }
  | { state: "denied"; reason: string; name: string }
  | { state: "allowed"; name: string; photoUrl: string | null };

/**
 * Cohost preview gate. Real Google sign-in; the server decides who's on the
 * list (FORUM_TESTERS) or whether it's launched (FORUM_OPEN). Everyone else
 * sees the ALF "Will be unlocked later" card and nothing about the weekend.
 */
function ForumGate({ initialTab }: { initialTab: Tab }) {
  const { user, configured, signInTo, signOut, blockedEmail } = useAuth();
  const [access, setAccess] = useState<Access>({ state: "loading" });

  // Warm the client so a PKCE ?code= on this URL gets exchanged.
  useEffect(() => {
    getSupabaseBrowser();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!configured) {
      // No auth in this environment (local without env): open preview.
      const t = setTimeout(() => setAccess({ state: "allowed", name: ME, photoUrl: null }), 0);
      return () => clearTimeout(t);
    }
    (async () => {
      // Ask the server first: a local FORUM_GATE=off answers without a token.
      const probe = await fetch("/api/forum/access").catch(() => null);
      if (cancelled) return;
      if (probe?.ok) {
        const b = await probe.json().catch(() => ({}));
        if (b.allowed) {
          setAccess({ state: "allowed", name: b.name ?? ME, photoUrl: b.photoUrl ?? null });
          return;
        }
      }
      const token = await getAccessToken();
      if (cancelled) return;
      if (!token) {
        // Give the OAuth return a beat to land before calling it anonymous.
        await new Promise((r) => setTimeout(r, user ? 0 : 600));
        const again = await getAccessToken();
        if (cancelled) return;
        if (!again) {
          setAccess({ state: "anon" });
          return;
        }
      }
      const res = await fetch("/api/forum/access", { headers: { Authorization: `Bearer ${(await getAccessToken()) ?? ""}` } });
      if (cancelled) return;
      if (res.status === 401) {
        setAccess({ state: "anon" });
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (body.allowed) setAccess({ state: "allowed", name: body.name ?? ME, photoUrl: body.photoUrl ?? null });
      else setAccess({ state: "denied", reason: body.reason ?? "not-yet", name: body.name ?? "" });
    })().catch(() => !cancelled && setAccess({ state: "anon" }));
    return () => {
      cancelled = true;
    };
  }, [configured, user]);

  if (access.state === "allowed") {
    return (
      <ForumStoreProvider me={access.name} photoUrl={access.photoUrl} enabled>
        <ForumApp initialTab={initialTab} onSignOut={signOut} signedIn={!!user} />
      </ForumStoreProvider>
    );
  }

  return (
    <div className="fm">
      <header className="alf-fb">
        <div className="alf-fb-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/minerva-wordmark.png" alt="Minerva University" className="alf-fb-brand-img" />
        </div>
        <div className="alf-fb-inner">
          <h1 className="alf-fb-title">RU26 – Alumni Reunifications</h1>
          <p className="alf-fb-sub">Fall 2026 · San Francisco</p>
        </div>
        <div className="alf-fb-user" />
      </header>
      <main className="fm-main">
        <section className="alf-card">
          <div className="fm-gate">
            {access.state === "loading" ? (
              <p className="fm-gate-sub">Checking your enrollment…</p>
            ) : access.state === "denied" ? (
              <>
                <p className="fm-eyebrow">Signed in{access.name ? ` as ${access.name}` : ""}</p>
                <h2 className="fm-gate-title">Will be unlocked later</h2>
                <p className="fm-gate-sub">
                  {access.reason === "no-rsvp"
                    ? "This Google account isn't on the class list. Try the account you RSVP'd with."
                    : "The weekend opens to the whole class on Thursday. You're not on the preview list yet — ask Ani."}
                </p>
                <button className="fm-btn" onClick={signOut}>Use another account</button>
              </>
            ) : (
              <>
                <p className="fm-eyebrow">Session 1.1 starts Fri, Sep 11</p>
                <h2 className="fm-gate-title">Will be unlocked later</h2>
                <p className="fm-gate-sub">The weekend, the map, and Assignment 2 open here on Thursday. Cohosts: sign in to preview.</p>
                {blockedEmail && <p className="fm-note">{blockedEmail} isn&apos;t allowed here.</p>}
                <button className="fm-btn fm-btn-blue" onClick={() => signInTo("forum")}>
                  <span className="fm-gate-g">G</span> Sign in with Google
                </button>
                <p className="fm-muted">Use the Google account you RSVP&apos;d with. If it fails inside Instagram or Facebook, open this link in Safari or Chrome.</p>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function ForumApp({
  initialTab,
  signedIn,
  onSignOut,
}: {
  initialTab: Tab;
  signedIn: boolean;
  onSignOut: () => void;
}) {
  // `?tab=` overrides the route's default tab.
  const [tab, setTab] = useState<Tab>(() => {
    const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    return t && TABS.includes(t) ? t : initialTab;
  });
  const [view, setView] = useState<View>({ kind: "tab" });
  const [day, setDay] = useState<Day>(() => dayOf(new Date(Date.now() + readNowOffset())) ?? "fri");

  const store = useForumStore();
  const { now, me, photoUrl, people, intents, setIntent, plans, addPlan, removePlan, replies, reply, proofs, saveProof, removeProof, final, submitFinal, invites, unanswered, setToast } = store;

  const scrollTop = () => document.querySelector(".fm-main")?.scrollTo({ top: 0 });
  const goTab = (t: Tab) => {
    setTab(t);
    setView({ kind: "tab" });
    scrollTop();
  };
  const open = (v: View) => {
    setView(v);
    scrollTop();
  };
  const back = () => setView({ kind: "tab" });
  const openActivity = (id: string) => open({ kind: "activity", id });
  const openQuest = (id: string) => open({ kind: "quest", id });

  const share = async (title: string, text: string) => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setToast("Link copied");
    } catch {
      /* dismissed */
    }
  };

  const banner = bannerFor(view, tab, day, now, people.length, me);
  const isMap = view.kind === "tab" && tab === "map";

  return (
    <div className="fm">
      <div className="fm-preview-strip">
        Preview build · plans, invites and scores are sample data · your photos stay on this phone
      </div>

      <header className="alf-fb">
        {view.kind === "tab" ? (
          <div className="alf-fb-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/minerva-wordmark.png" alt="Minerva University" className="alf-fb-brand-img" />
          </div>
        ) : (
          <button className="fm-back" onClick={back} aria-label="Back">
            ‹
          </button>
        )}
        <div className="alf-fb-inner">
          <h1 className="alf-fb-title">{banner.title}</h1>
          {banner.sub && <p className="alf-fb-sub">{banner.sub}</p>}
        </div>
        <div className="alf-fb-user">
          {signedIn ? (
            <button className="alf-fb-avatar-btn" onClick={onSignOut} aria-label="Sign out">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="fm-avatar" src={photoUrl} alt="" />
              ) : (
                <span className="alf-fb-avatar">{me.charAt(0)}</span>
              )}
            </button>
          ) : (
            <span className="alf-fb-avatar">{me.charAt(0)}</span>
          )}
        </div>
      </header>

      <main className={`fm-main${isMap ? " fm-main-map" : ""}`}>
        {view.kind === "activity" && (
          <ActivityView
            activity={getActivity(view.id)!}
            people={people}
            intent={intents[view.id]}
            plan={plans.find((p) => p.kind === "activity" && p.targetId === view.id)}
            onIntent={(i) => setIntent(view.id, i)}
            onPlan={(w) => addPlan("activity", view.id, w)}
            onUnplan={removePlan}
            onShare={share}
          />
        )}
        {view.kind === "quest" && (
          <QuestView
            questId={view.id}
            people={people}
            proofs={proofs}
            plan={plans.find((p) => p.kind === "quest" && p.targetId === view.id)}
            now={now}
            onSave={saveProof}
            onPlan={(w) => addPlan("quest", view.id, w)}
            onUnplan={removePlan}
            onOpenMe={() => open({ kind: "me" })}
          />
        )}
        {view.kind === "me" && (
          <MyQuestival
            proofs={proofs}
            plans={plans}
            people={people}
            final={final}
            now={now}
            onRemove={removeProof}
            onSubmitFinal={submitFinal}
            onOpenQuest={openQuest}
            onOpenActivity={openActivity}
          />
        )}
        {view.kind === "live" && <LiveView proofs={proofs} people={people} now={now} />}
        {view.kind === "class" && <ClassView people={people} />}

        {view.kind === "tab" && tab === "home" && (
          <HomeView
            now={now}
            proofs={proofs}
            final={final}
            unanswered={unanswered}
            onOpenActivity={openActivity}
            onOpenQuestival={() => goTab("questival")}
            onOpenMe={() => open({ kind: "me" })}
            onOpenWeekend={() => goTab("weekend")}
            onOpenInbox={() => goTab("inbox")}
            onOpenClass={() => open({ kind: "class" })}
          />
        )}
        {view.kind === "tab" && tab === "weekend" && (
          <WeekendView day={day} onDay={setDay} people={people} intents={intents} onOpen={openActivity} />
        )}
        {isMap && <MapView people={people} plans={plans} onOpenActivity={openActivity} onOpenQuest={openQuest} />}
        {view.kind === "tab" && tab === "questival" && (
          <QuestivalHub
            proofs={proofs}
            plans={plans}
            people={people}
            final={final}
            now={now}
            onOpenQuest={openQuest}
            onOpenMe={() => open({ kind: "me" })}
            onOpenLive={() => open({ kind: "live" })}
          />
        )}
        {view.kind === "tab" && tab === "inbox" && (
          <InboxView
            invites={invites}
            replies={replies}
            plans={plans}
            people={people}
            now={now}
            onReply={reply}
            onOpenQuest={openQuest}
            onOpenActivity={openActivity}
          />
        )}
      </main>

      <ForumToast />

      <nav className="fm-tabbar fm-tabbar-5">
        <TabButton on={tab === "home"} label="Home" onClick={() => goTab("home")}><HomeIcon /></TabButton>
        <TabButton on={tab === "weekend"} label="Weekend" onClick={() => goTab("weekend")}><BookIcon /></TabButton>
        <TabButton on={tab === "map"} label="Map" onClick={() => goTab("map")}><MapIcon /></TabButton>
        <TabButton on={tab === "questival"} label="Questival" onClick={() => goTab("questival")}><ListIcon /></TabButton>
        <TabButton on={tab === "inbox"} label="Inbox" badge={unanswered} onClick={() => goTab("inbox")}><MailIcon /></TabButton>
      </nav>
    </div>
  );
}

function TabButton({ on, label, badge, onClick, children }: { on: boolean; label: string; badge?: number; onClick: () => void; children: ReactNode }) {
  return (
    <button className={`fm-tab${on ? " fm-tab-on" : ""}`} onClick={onClick}>
      {children}
      <span>{label}</span>
      {badge ? <span className="fm-badge">{badge}</span> : null}
    </button>
  );
}

function bannerFor(view: View, tab: Tab, day: Day, now: number, count: number, me: string): { title: string; sub: string } {
  if (view.kind === "activity") {
    const a = getActivity(view.id);
    const d = DAYS.find((x) => x.id === a?.day);
    return { title: `RU26 Session ${d?.session} – ${a?.title ?? ""}`, sub: a?.venue ?? "" };
  }
  if (view.kind === "quest") return { title: "RU26 – Assignment 2: Questival", sub: "One quest, one proof" };
  if (view.kind === "me") return { title: "RU26 – Assignment 2: My Questival", sub: `Due ${QUESTIVAL.dueLabel}` };
  if (view.kind === "live") return { title: "RU26 – The class, live", sub: "Teams, people, proofs" };
  if (view.kind === "class") return { title: "RU26 – The Class of 2021", sub: count ? `${count} confirmed` : "" };
  if (tab === "weekend") {
    const d = DAYS.find((x) => x.id === day)!;
    return { title: `RU26 Session ${d.session} – ${d.title}`, sub: d.sub };
  }
  if (tab === "map") return { title: "RU26 – The map", sub: "Where we meet, where the points are, who's going" };
  if (tab === "questival") return { title: "RU26 – Assignment 2: Questival", sub: `Due ${QUESTIVAL.dueLabel} · Weight 1x` };
  if (tab === "inbox") return { title: "Inbox", sub: "Who wants to do what with you" };
  const { now: cur, next } = nowNext(new Date(now));
  const sub = cur
    ? `Now: ${cur.title}${next ? ` · Next: ${next.title}, ${next.time}` : ""}`
    : next && dayOf(new Date(now))
      ? `Next: ${next.title}, ${next.time}`
      : "One course this fall — RU26 starts Fri, Sep 11 in San Francisco.";
  return { title: me === ME ? "Welcome back" : `Welcome, ${firstName(me)}`, sub };
}

// ----- HOME ------------------------------------------------------------------

export function HomeView({
  now,
  proofs,
  final,
  unanswered,
  onOpenActivity,
  onOpenQuestival,
  onOpenMe,
  onOpenWeekend,
  onOpenInbox,
  onOpenClass,
}: {
  now: number;
  proofs: SavedProof[];
  final: Final;
  unanswered: number;
  onOpenActivity: (id: string) => void;
  onOpenQuestival: () => void;
  onOpenMe: () => void;
  onOpenWeekend: () => void;
  onOpenInbox: () => void;
  onOpenClass: () => void;
}) {
  const { now: cur, next } = nowNext(new Date(now));
  const today = dayOf(new Date(now));
  const win = questivalWindow(now);
  const daysOut = Math.max(0, Math.ceil((Date.parse("2026-09-11T18:00:00-07:00") - now) / 86_400_000));
  const team = getTeam(teamFor(ME));

  const a2 = final
    ? { result: final.extension ? "Submitted · Extension used" : "Submitted", done: true }
    : proofs.length
      ? { result: `In progress · ${proofs.length} saved`, done: false }
      : win === "before"
        ? { result: "Opens Sat 10:00", done: false }
        : win === "closed"
          ? { result: "Closed", done: false }
          : { result: "Open", done: false };

  const focus = cur ?? next;

  return (
    <>
      {today ? (
        <div className="fm-now">
          <div className="fm-now-eyebrow">{cur ? "Happening now" : "Up next"}</div>
          <div className="fm-now-title">{focus?.title ?? "See you tomorrow"}</div>
          <div className="fm-now-sub">
            {focus?.time} · {focus?.venue ?? "San Francisco"}
          </div>
          {cur && next && (
            <div className="fm-now-next">
              Next: {next.title} · {next.time}
              {next.venue ? ` · ${next.venue}` : ""}
            </div>
          )}
          <div className="fm-now-actions">
            {focus?.address && (
              <a className="fm-btn" href={directionsUrl(focus.address)} target="_blank" rel="noreferrer">
                <PinIcon /> Directions
              </a>
            )}
            {focus && <button className="fm-btn" onClick={() => onOpenActivity(focus.id)}>Details</button>}
          </div>
        </div>
      ) : (
        <div className="fm-now">
          <div className="fm-now-eyebrow">Upcoming class</div>
          <div className="fm-now-title">RU26 Session 1.1 — Welcome night</div>
          <div className="fm-now-sub">Fri, Sep 11 · 6:00 PM · Southern Pacific Brewing</div>
          <div className="fm-now-next">
            {daysOut} {daysOut === 1 ? "day" : "days"} to go. Open on Friday for the live run of show.
          </div>
          <div className="fm-now-actions">
            <button className="fm-btn" onClick={onOpenWeekend}>The weekend</button>
          </div>
        </div>
      )}

      {today === "sat" && (
        <div className="fm-announce">
          <b>From the cohosts:</b> Common Space address is up — see Doors at 18:00. Bonfire pit is by Stairwell 17.
        </div>
      )}

      {unanswered > 0 && (
        <div className="alf-next-card" style={{ marginTop: 0, marginBottom: 14 }}>
          <div className="alf-next-card-text">
            <span className="alf-next-card-eyebrow">Inbox</span>
            <span className="alf-next-card-title">{unanswered} classmates want to do something with you</span>
            <span className="alf-next-card-sub">Say you&apos;re in, and it lands on your list and the map.</span>
          </div>
          <div className="alf-next-card-actions">
            <button className="alf-next-card-btn" onClick={onOpenInbox}>Open inbox</button>
          </div>
        </div>
      )}

      <section className="alf-card">
        <h2 className="alf-card-h">Assignments Due</h2>
        <table className="fm-due">
          <tbody>
            <tr className="fm-due-done">
              <td className="fm-due-icon"><span className="fm-check">✓</span></td>
              <td>
                <span className="fm-due-title">RU26 — Assignment 1: opening-line reflection</span>
                <span className="fm-due-sub">Who are you most excited to see?</span>
              </td>
              <td className="fm-due-result">Submitted · Editable</td>
            </tr>
            <tr className={a2.done ? "fm-due-done" : ""} onClick={final || proofs.length ? onOpenMe : onOpenQuestival}>
              <td className="fm-due-icon">{a2.done ? <span className="fm-check">✓</span> : <PaperclipIcon />}</td>
              <td>
                <span className="fm-due-title">RU26 — Assignment 2: Questival</span>
                <span className="fm-due-sub">Due {QUESTIVAL.dueLabel} · Team {team.name}</span>
              </td>
              <td className="fm-due-result">{a2.result}</td>
            </tr>
            <tr className="fm-due-locked">
              <td className="fm-due-icon"><LockIcon /></td>
              <td>
                <span className="fm-due-title">RU26 — Assignment 3: closing line</span>
                <span className="fm-due-sub">Unlocks Sunday at the closing moment</span>
              </td>
              <td className="fm-due-result">Locked</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="alf-card">
        <h2 className="alf-card-h">{today ? "Today" : "Friday"}</h2>
        <ul className="alf-agenda">
          {activitiesFor(today ?? "fri")
            .filter((a) => a.kind !== "peer")
            .map((a) => (
              <li key={a.id} className={`alf-agenda-item${a.kind === "optional" ? " alf-agenda-optional" : ""}`} onClick={() => onOpenActivity(a.id)}>
                <div className="alf-agenda-time">{a.time}</div>
                <div className="alf-agenda-content">
                  <div className="alf-agenda-title">
                    {a.title}
                    {a.venue && <span className="alf-agenda-loc">{a.venue}</span>}
                  </div>
                </div>
              </li>
            ))}
        </ul>
      </section>

      <section className="alf-card">
        <h2 className="alf-card-h">The Class of 2021</h2>
        <p className="fm-muted">Everyone who&apos;s confirmed, with the photo they took when they RSVP&apos;d.</p>
        <button className="fm-link-btn" onClick={onOpenClass}>Open the class list →</button>
      </section>
    </>
  );
}

// ----- WEEKEND ---------------------------------------------------------------

export function pctFor(a: Activity): number {
  return a.kind === "anchor" ? 62 : a.kind === "optional" ? 30 : 14;
}

export function WeekendView({
  day,
  onDay,
  people,
  intents,
  onOpen,
}: {
  day: Day;
  onDay: (d: Day) => void;
  people: Person[];
  intents: Record<string, PlanIntent | undefined>;
  onOpen: (id: string) => void;
}) {
  const d = DAYS.find((x) => x.id === day)!;
  const [mon, dd] = d.date.split(", ")[1].split(" ");
  const main = activitiesFor(day).filter((a) => a.kind !== "peer");
  const side = activitiesFor(day).filter((a) => a.kind === "peer");

  return (
    <>
      <div className="fm-seg">
        {DAYS.map((x) => (
          <button key={x.id} className={`fm-seg-btn${x.id === day ? " fm-seg-on" : ""}`} onClick={() => onDay(x.id)}>
            <b>{x.label}</b>
            <span>Session {x.session}</span>
          </button>
        ))}
      </div>

      <div className="fm-session-head">
        <div>
          <h2 className="fm-session-title">RU26 Session {d.session} – {d.title}</h2>
          <div className="fm-muted">Class starts {d.date} · {d.sub}</div>
        </div>
        <div className="fm-datechip">
          <div className="fm-datechip-day">{dd}</div>
          <div className="fm-datechip-mon">{mon.slice(0, 3)}</div>
        </div>
      </div>

      <section className="alf-card">
        <h3 className="alf-card-h">Run of show</h3>
        <ul className="alf-agenda">
          {main.map((a) => (
            <AgendaRow key={a.id} a={a} people={people} intent={intents[a.id]} onOpen={onOpen} />
          ))}
        </ul>
      </section>

      {side.length > 0 && (
        <section className="alf-card">
          <h3 className="alf-card-h">Side sessions</h3>
          <p className="fm-muted" style={{ marginBottom: 8 }}>
            Peer-led and proposed. Say you&apos;re interested and the host will rally people.
          </p>
          <ul className="alf-agenda">
            {side.map((a) => (
              <AgendaRow key={a.id} a={a} people={people} intent={intents[a.id]} onOpen={onOpen} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function AgendaRow({ a, people, intent, onOpen }: { a: Activity; people: Person[]; intent?: PlanIntent; onOpen: (id: string) => void }) {
  const going = sample(people, a.id, pctFor(a));
  return (
    <li className={`alf-agenda-item${a.kind === "optional" ? " alf-agenda-optional" : ""}`} onClick={() => onOpen(a.id)}>
      <div className="alf-agenda-time">{a.time}</div>
      <div className="alf-agenda-content">
        <div className="alf-agenda-title">
          {a.title}
          {a.venue && <span className="alf-agenda-loc">{a.venue}</span>}
        </div>
        <div className="alf-agenda-body"><p>{a.body}</p></div>
        <div className="fm-row-foot">
          <span className={`fm-kind fm-kind-${a.kind}`}>{a.kind === "anchor" ? "Everyone" : a.kind === "optional" ? "Optional" : "Peer-led"}</span>
          <Faces people={going} extra={intent === "going" ? 1 : 0} />
          {intent && <span className="fm-row-going">{intent === "going" ? "You're going" : "Interested"}</span>}
        </div>
      </div>
    </li>
  );
}

export function Faces({ people, extra = 0, max = 5 }: { people: Person[]; extra?: number; max?: number }) {
  const shown = people.slice(0, max);
  const more = people.length - shown.length + extra;
  if (shown.length === 0 && more === 0) return null;
  return (
    <span className="fm-faces">
      {shown.map((p, i) =>
        p.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} className="fm-face" src={p.photo_url} alt="" loading="lazy" />
        ) : (
          <span key={i} className="fm-face" />
        ),
      )}
      {more > 0 && <span className="fm-face-more">+{more}</span>}
    </span>
  );
}

// ----- ACTIVITY --------------------------------------------------------------

export function ActivityView({
  activity: a,
  people,
  intent,
  plan,
  onIntent,
  onPlan,
  onUnplan,
  onShare,
}: {
  activity: Activity;
  people: Person[];
  intent?: PlanIntent;
  plan?: Plan;
  onIntent: (i: PlanIntent) => void;
  onPlan: (withNames: string[]) => void;
  onUnplan: (id: string) => void;
  onShare: (title: string, text: string) => void;
}) {
  const d = DAYS.find((x) => x.id === a.day)!;
  const going = sample(people, a.id, pctFor(a));
  const interested = sample(people, a.id + ":i", 18).filter((p) => !going.includes(p));

  return (
    <>
      <section className="alf-card">
        <p className="fm-eyebrow">{d.label}, {a.time} · {a.kind === "anchor" ? "Everyone" : a.kind === "optional" ? "Optional" : "Peer-led"}</p>
        <h2 className="alf-card-h" style={{ fontSize: 22 }}>{a.title}</h2>
        <div className="fm-detail-meta">
          {a.venue && <span><b>Where</b> · {a.venue}{a.address ? `, ${a.address}` : ""}</span>}
          {a.host && <span><b>Host</b> · {a.host}</span>}
          {a.cost && <span><b>Cost</b> · {a.cost}</span>}
          {a.bring && <span><b>Bring</b> · {a.bring}</span>}
        </div>
        <p className="fm-detail-body">{a.body}</p>
        {a.pending && <p className="fm-note">{a.pending}</p>}
        <div className="fm-btn-row">
          {a.address && (
            <a className="fm-btn fm-btn-blue" href={directionsUrl(a.address)} target="_blank" rel="noreferrer">
              <PinIcon /> Directions
            </a>
          )}
          <button className="fm-btn" onClick={() => onShare(a.title, `${a.title} · ${d.label} ${a.time}${a.venue ? ` · ${a.venue}` : ""}`)}>
            <ShareIcon /> Share
          </button>
        </div>
      </section>

      <section className="alf-card">
        <h3 className="alf-card-h">Who&apos;s going</h3>
        <div className="fm-btn-row" style={{ marginTop: 0, marginBottom: 12 }}>
          <button className={`fm-btn${intent === "going" ? " fm-btn-going" : ""}`} onClick={() => onIntent("going")}>
            {intent === "going" ? "✓ I'm going" : "I'm going"}
          </button>
          <button className={`fm-btn${intent === "interested" ? " fm-btn-blue" : ""}`} onClick={() => onIntent("interested")}>
            {intent === "interested" ? "✓ Interested" : "Interested"}
          </button>
        </div>
        <p className="fm-muted">
          {going.length + (intent === "going" ? 1 : 0)} going · {interested.length + (intent === "interested" ? 1 : 0)} interested
        </p>
        <div className="fm-who">
          {intent === "going" && <span className="fm-who-item"><span className="fm-face" style={{ margin: 0, width: 22, height: 22, background: "#2e9e5b" }} />You</span>}
          {going.map((p) => (
            <span key={p.name} className="fm-who-item">
              {p.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photo_url} alt="" loading="lazy" />
              ) : (
                <span className="fm-face" style={{ margin: 0, width: 22, height: 22 }} />
              )}
              {firstName(p.name)}
            </span>
          ))}
        </div>
        {interested.length > 0 && (
          <p className="fm-muted" style={{ marginTop: 10 }}>
            Interested: {interested.map((p) => firstName(p.name)).join(", ")}
          </p>
        )}
      </section>

      <PlanIt kind="activity" plan={plan} people={people} onPlan={onPlan} onUnplan={onUnplan} />
    </>
  );
}

/** "I want to do this, with these people." Shared by quests and activities. */
export function PlanIt({
  kind,
  plan,
  people,
  onPlan,
  onUnplan,
  teamHint,
}: {
  kind: "quest" | "activity";
  plan?: Plan;
  people: Person[];
  onPlan: (withNames: string[]) => void;
  onUnplan: (id: string) => void;
  teamHint?: string;
}) {
  const [tags, setTags] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  if (plan) {
    const withPeople = plan.with.map((n) => people.find((p) => p.name === n) ?? { name: n, photo_url: null });
    return (
      <section className="alf-card">
        <div className="fm-plan">
          <div className="fm-plan-title">✓ Planned{withPeople.length ? ` · with ${withPeople.map((p) => firstName(p.name)).join(", ")}` : ""}</div>
          <div className="fm-plan-sub">
            {withPeople.length ? "They got an invitation in their inbox. " : ""}This is on your list and the map. Not a submission.
          </div>
          <div className="fm-row-foot" style={{ marginTop: 0 }}>
            <Faces people={withPeople} max={8} />
            <button className="fm-link-btn" style={{ marginLeft: "auto" }} onClick={() => onUnplan(plan.id)}>Unplan</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="alf-card">
      <h3 className="alf-card-h">Plan it</h3>
      <p className="fm-muted" style={{ marginBottom: 10 }}>
        Save it as something you intend to do{kind === "quest" ? " — no proof needed yet" : ""}. Pick who with and they get a note in their inbox.
      </p>
      {teamHint && <p className="fm-note" style={{ marginBottom: 10 }}>{teamHint}</p>}
      {!open ? (
        <button className="fm-btn fm-btn-block" onClick={() => setOpen(true)}>I want to do this</button>
      ) : (
        <>
          <p className="fm-eyebrow">With</p>
          <TagPicker people={people} tags={tags} onChange={setTags} />
          <div className="fm-btn-row">
            <button className="fm-btn fm-btn-blue" onClick={() => onPlan(tags)}>
              {tags.length ? `Plan with ${tags.map(firstName).join(", ")}` : "Plan it, just me for now"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ----- INBOX -----------------------------------------------------------------

export function InboxView({
  invites,
  replies,
  plans,
  people,
  now,
  onReply,
  onOpenQuest,
  onOpenActivity,
}: {
  invites: Invite[];
  replies: Record<string, "in" | "maybe">;
  plans: Plan[];
  people: Person[];
  now: number;
  onReply: (id: string, r: "in" | "maybe") => void;
  onOpenQuest: (id: string) => void;
  onOpenActivity: (id: string) => void;
}) {
  const label = (kind: "quest" | "activity", id: string) => (kind === "quest" ? getQuest(id)?.title : getActivity(id)?.title) ?? id;
  const openTarget = (kind: "quest" | "activity", id: string) => (kind === "quest" ? onOpenQuest(id) : onOpenActivity(id));
  const sent = plans.filter((p) => p.with.length);

  return (
    <>
      <section className="alf-card">
        <h2 className="alf-card-h">Invitations</h2>
        {invites.length === 0 ? (
          <p className="fm-empty">Quiet for now.</p>
        ) : (
          <ul className="fm-inbox">
            {invites.map((inv) => {
              const r = replies[inv.id];
              const others = sample(people, "co" + inv.id, 10).filter((p) => p !== inv.from).slice(0, 2);
              return (
                <li key={inv.id} className="fm-inv">
                  {inv.from.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={inv.from.photo_url} alt="" loading="lazy" />
                  ) : (
                    <span className="fm-tag-ph">{inv.from.name.charAt(0)}</span>
                  )}
                  <div>
                    <div className="fm-inv-text">
                      <b>{firstName(inv.from.name)}</b> wants to do <b className="alf-link" onClick={() => openTarget(inv.kind, inv.targetId)}>{label(inv.kind, inv.targetId)}</b> with you
                      {others.length ? ` and ${others.map((p) => firstName(p.name)).join(", ")}` : ""}.
                    </div>
                    <div className="fm-inv-meta">{timeShort(inv.at)} · {inv.kind === "quest" ? `${getQuest(inv.targetId)?.points ?? ""} pts` : "Saturday"}</div>
                    {r ? (
                      <div className="fm-inv-done">{r === "in" ? "✓ You're in — it's on your list and the map." : "Maybe — we'll remind you when they're nearby."}</div>
                    ) : (
                      <div className="fm-inv-actions">
                        <button className="fm-btn fm-btn-going" onClick={() => onReply(inv.id, "in")}>I&apos;m in</button>
                        <button className="fm-btn" onClick={() => onReply(inv.id, "maybe")}>Maybe</button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="alf-card">
        <h3 className="alf-card-h">Sent</h3>
        {sent.length === 0 ? (
          <p className="fm-empty">Plan a quest with someone and it shows up here.</p>
        ) : (
          <ul className="fm-inbox">
            {sent.map((p) => (
              <li key={p.id} className="fm-inv" onClick={() => openTarget(p.kind, p.targetId)}>
                <span className="fm-tag-ph" style={{ background: "#2e9e5b" }}>Y</span>
                <div>
                  <div className="fm-inv-text">You invited <b>{p.with.map(firstName).join(", ")}</b> to <b>{label(p.kind, p.targetId)}</b>.</div>
                  <div className="fm-inv-meta">{timeShort(p.at)} · waiting on replies</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="alf-card">
        <h3 className="alf-card-h">From the cohosts</h3>
        <ul className="fm-inbox">
          <li className="fm-inv">
            <span className="fm-tag-ph" style={{ background: "#1a2530" }}>M</span>
            <div>
              <div className="fm-inv-text">Teams are up. You&apos;re on <b>Team {getTeam(teamFor(ME)).name}</b> — see the Questival tab.</div>
              <div className="fm-inv-meta">{timeShort(now - 3 * 3600_000)}</div>
            </div>
          </li>
        </ul>
      </section>
    </>
  );
}

// ----- CLASS -----------------------------------------------------------------

export function ClassView({ people }: { people: Person[] }) {
  const sorted = [...people].reverse();
  return (
    <section className="alf-card">
      <h2 className="alf-card-h">The Class of 2021 {people.length ? `· ${people.length}` : ""}</h2>
      {sorted.length === 0 ? (
        <p className="fm-empty">Class hasn&apos;t filled in yet.</p>
      ) : (
        <div className="fm-class">
          {sorted.map((p, i) => {
            const t = getTeam(teamFor(p.name));
            return (
              <div key={`${p.name}-${i}`} className="fm-class-item">
                {p.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo_url} alt="" loading="lazy" style={{ boxShadow: `0 0 0 2px ${t.color}` }} />
                ) : (
                  <span className="fm-tag-ph" style={{ boxShadow: `0 0 0 2px ${t.color}` }}>{p.name.charAt(0)}</span>
                )}
                <span>{firstName(p.name)}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
