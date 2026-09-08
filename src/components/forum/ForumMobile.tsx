"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { CATCHUP_SLOTS, DAYS, activitiesFor, dayOf, directionsUrl, getActivity, nowNext, type Activity, type Day } from "@/lib/weekend";
import { QUESTIVAL, getQuest, questivalWindow } from "@/lib/questival";
import { QuestivalHub, QuestView, MyQuestival, LiveView, TagPicker, Feed, useLive } from "@/components/forum/Questival";
import { AdminView } from "@/components/forum/AdminView";
import { DayCards } from "@/components/forum/DayCards";
import { GuideView } from "@/components/forum/Guide";
import { MapView } from "@/components/forum/MapView";
import { useAuth, getAccessToken } from "@/lib/auth";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { SnackbarProvider } from "@/lib/snackbar";
import { BookIcon, HomeIcon, ListIcon, LockIcon, MailIcon, MapIcon, PaperclipIcon, PinIcon, ShareIcon } from "@/components/forum/icons";
import { ME, ME_ID, firstName, readNowOffset, timeShort, type PlanIntent } from "@/components/forum/store";
import { ForumStoreProvider, ForumToast, useForumStore } from "@/components/forum/ForumStore";
import type { CatchupDTO, PersonDTO, PlanDTO } from "@/lib/questival-api";

export type Tab = "home" | "weekend" | "map" | "questival" | "inbox";

type View =
  | { kind: "tab" }
  | { kind: "activity"; id: string }
  | { kind: "quest"; id: string }
  | { kind: "me" }
  | { kind: "live" }
  | { kind: "class" }
  | { kind: "admin" }
  | { kind: "guide" };

const noop = () => () => {};
const TABS: Tab[] = ["home", "weekend", "map", "questival", "inbox"];

/**
 * The Forum on a phone. Same course, same sessions, same assignment
 * language as the desktop ALF — the sidebar folds into a tab bar.
 */
export function ForumMobile({ initialTab }: { initialTab: Tab }) {
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

/** Cohost preview gate. Real Google sign-in; the server decides. */
function ForumGate({ initialTab }: { initialTab: Tab }) {
  const { user, configured, signInTo, signOut, blockedEmail } = useAuth();
  const [access, setAccess] = useState<Access>({ state: "loading" });

  useEffect(() => {
    getSupabaseBrowser();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!configured) {
      const t = setTimeout(() => setAccess({ state: "allowed", name: ME.name, photoUrl: null }), 0);
      return () => clearTimeout(t);
    }
    (async () => {
      const probe = await fetch("/api/forum/access").catch(() => null);
      if (cancelled) return;
      if (probe?.ok) {
        const b = await probe.json().catch(() => ({}));
        if (b.allowed) {
          setAccess({ state: "allowed", name: b.name ?? ME.name, photoUrl: b.photoUrl ?? null });
          return;
        }
      }
      let token = await getAccessToken();
      if (cancelled) return;
      if (!token) {
        await new Promise((r) => setTimeout(r, user ? 0 : 600));
        token = await getAccessToken();
        if (cancelled) return;
        if (!token) {
          setAccess({ state: "anon" });
          return;
        }
      }
      const res = await fetch("/api/forum/access", { headers: { Authorization: `Bearer ${token}` } });
      if (cancelled) return;
      if (res.status === 401) {
        setAccess({ state: "anon" });
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (body.allowed) setAccess({ state: "allowed", name: body.name ?? ME.name, photoUrl: body.photoUrl ?? null });
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
                <p className="fm-gate-sub">The weekend, the map, and Assignment 3 open here on Thursday. Cohosts: sign in to preview.</p>
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

function ForumApp({ initialTab, signedIn, onSignOut }: { initialTab: Tab; signedIn: boolean; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>(() => {
    const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    return t && TABS.includes(t) ? t : initialTab;
  });
  const [view, setView] = useState<View>(() => (new URLSearchParams(window.location.search).get("view") === "admin" ? { kind: "admin" } : { kind: "tab" }));
  const [day, setDay] = useState<Day>(() => dayOf(new Date(Date.now() + readNowOffset())) ?? "fri");
  const store = useForumStore();
  const { now, me, people, unanswered, mode, localReason, organizer, setToast, questivalOpen } = store;
  // Questival views are organizer-only until it launches.
  const shownView: View = !questivalOpen && (view.kind === "quest" || view.kind === "me" || view.kind === "live") ? { kind: "tab" } : view;

  const scrollTop = () => document.querySelector(".fm-main")?.scrollTo({ top: 0 });
  const goTab = (t: Tab) => { setTab(t); setView({ kind: "tab" }); scrollTop(); };
  const goDay = (d: Day) => { setDay(d); goTab("weekend"); };
  const open = (v: View) => { setView(v); scrollTop(); };
  const back = () => setView({ kind: "tab" });
  const openActivity = (id: string) => open({ kind: "activity", id });
  const openQuest = (id: string) => open({ kind: "quest", id });

  const share = async (title: string, text: string) => {
    const url = window.location.href;
    try {
      if (navigator.share) return void (await navigator.share({ title, text, url }));
      await navigator.clipboard.writeText(`${text} ${url}`);
      setToast("Link copied");
    } catch {
      /* dismissed */
    }
  };

  const banner = bannerFor(shownView, tab, day, now, people.length, me.name);
  const isMap = shownView.kind === "tab" && tab === "map";

  return (
    <div className="fm">
      {mode === "local" && (
        <div className="fm-preview-strip">
          {localReason === "no-rsvp" ? "This account has no RSVP — browsing only, nothing saves" : "Not connected yet — nothing you tap is saved"}
        </div>
      )}

      <header className="alf-fb">
        {shownView.kind === "tab" ? (
          <div className="alf-fb-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/minerva-wordmark.png" alt="Minerva University" className="alf-fb-brand-img" />
          </div>
        ) : (
          <button className="fm-back" onClick={back} aria-label="Back">‹</button>
        )}
        <div className="alf-fb-inner">
          <h1 className="alf-fb-title">{banner.title}</h1>
          {banner.sub && <p className="alf-fb-sub">{banner.sub}</p>}
        </div>
        <div className="alf-fb-user">
          {signedIn ? (
            <button className="alf-fb-avatar-btn" onClick={onSignOut} aria-label="Sign out">
              {me.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="fm-avatar" src={me.photo_url} alt="" />
              ) : (
                <span className="alf-fb-avatar">{me.name.charAt(0)}</span>
              )}
            </button>
          ) : (
            <span className="alf-fb-avatar">{me.name.charAt(0)}</span>
          )}
        </div>
      </header>

      <main className={`fm-main${isMap ? " fm-main-map" : ""}`}>
        {shownView.kind === "activity" && <ActivityView activity={getActivity(shownView.id)!} onShare={share} />}
        {shownView.kind === "quest" && <QuestView questId={shownView.id} onOpenMe={() => open({ kind: "me" })} />}
        {shownView.kind === "me" && <MyQuestival onOpenQuest={openQuest} onOpenActivity={openActivity} />}
        {shownView.kind === "live" && <LiveView />}
        {shownView.kind === "class" && <ClassView />}
        {shownView.kind === "admin" && <AdminView />}
        {shownView.kind === "guide" && <GuideView onOpenDay={goDay} onOpenClass={() => open({ kind: "class" })} onOpenMap={() => goTab("map")} onOpenInbox={() => goTab("inbox")} />}

        {shownView.kind === "tab" && tab === "home" && (
          <HomeView
            onOpenActivity={openActivity}
            onOpenQuestival={() => goTab("questival")}
            onOpenMe={() => open({ kind: "me" })}
            onOpenWeekend={() => goTab("weekend")}
            onOpenInbox={() => goTab("inbox")}
            onOpenClass={() => open({ kind: "class" })}
            onOpenLive={() => open({ kind: "live" })}
            onOpenAdmin={() => open({ kind: "admin" })}
            onOpenDay={goDay}
            onOpenGuide={() => open({ kind: "guide" })}
          />
        )}
        {shownView.kind === "tab" && tab === "weekend" && <WeekendView day={day} onDay={setDay} onOpen={openActivity} />}
        {isMap && <MapView onOpenActivity={openActivity} onOpenQuest={openQuest} />}
        {shownView.kind === "tab" && tab === "questival" && (
          store.questivalOpen ? (
            <QuestivalHub onOpenQuest={openQuest} onOpenMe={() => open({ kind: "me" })} onOpenLive={() => open({ kind: "live" })} />
          ) : (
            <QuestivalLocked />
          )
        )}
        {shownView.kind === "tab" && tab === "inbox" && <InboxView onOpenQuest={openQuest} onOpenActivity={openActivity} onOpenClass={() => open({ kind: "class" })} />}
      </main>

      <ForumToast />

      <nav className="fm-tabbar fm-tabbar-5">
        <TabButton on={tab === "home"} label="Home" onClick={() => goTab("home")}><HomeIcon /></TabButton>
        <TabButton on={tab === "weekend"} label="Weekend" onClick={() => goTab("weekend")}><BookIcon /></TabButton>
        <TabButton on={tab === "map"} label="Map" onClick={() => goTab("map")}><MapIcon /></TabButton>
        <TabButton on={tab === "questival"} label="Questival" onClick={() => goTab("questival")}><ListIcon /></TabButton>
        <TabButton on={tab === "inbox"} label="Inbox" badge={unanswered} onClick={() => goTab("inbox")}><MailIcon /></TabButton>
      </nav>
      {organizer && shownView.kind !== "admin" && (
        <button className="fm-admin-fab" onClick={() => open({ kind: "admin" })} aria-label="Organizers">⚙</button>
      )}
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
  if (view.kind === "quest") return { title: "RU26 – Assignment 3: Questival", sub: "One quest, one proof" };
  if (view.kind === "me") return { title: "RU26 – Assignment 3: My Questival", sub: `Due ${QUESTIVAL.dueLabel}` };
  if (view.kind === "live") return { title: "RU26 – The class, live", sub: "Everyone's proofs, as they land" };
  if (view.kind === "class") return { title: "RU26 – The Class of 2021", sub: count ? `${count} confirmed · tap a face to request a catch-up` : "" };
  if (view.kind === "admin") return { title: "RU26 – Organizers", sub: "Quests, proofs, the clock, the class" };
  if (view.kind === "guide") return { title: "RU26 – How it all works", sub: "The weekend, in six steps" };
  if (tab === "weekend") {
    const d = DAYS.find((x) => x.id === day)!;
    return { title: `RU26 Session ${d.session} – ${d.title}`, sub: d.sub };
  }
  if (tab === "map") return { title: "RU26 – The map", sub: "Where we meet, where the points are, who's going" };
  if (tab === "questival") return { title: "RU26 – Assignment 3: Questival", sub: `Due ${QUESTIVAL.dueLabel} · Weight 2x` };
  if (tab === "inbox") return { title: "Inbox", sub: "Who wants to do what with you" };
  const { now: cur, next } = nowNext(new Date(now));
  const sub = cur
    ? `Now: ${cur.title}${next ? ` · Next: ${next.title}, ${next.time}` : ""}`
    : next && dayOf(new Date(now))
      ? `Next: ${next.title}, ${next.time}`
      : "One course this fall — RU26 starts Fri, Sep 11 in San Francisco.";
  return { title: me === ME.name ? "Welcome back" : `Welcome, ${firstName(me)}`, sub };
}

// ----- HOME ------------------------------------------------------------------

export function HomeView({
  onOpenActivity, onOpenQuestival, onOpenMe, onOpenWeekend, onOpenInbox, onOpenClass, onOpenLive, onOpenAdmin, onOpenDay, onOpenGuide,
}: {
  onOpenActivity: (id: string) => void; onOpenQuestival: () => void; onOpenMe: () => void; onOpenWeekend: () => void;
  onOpenInbox: () => void; onOpenClass: () => void; onOpenLive: () => void; onOpenAdmin: () => void; onOpenDay: (d: Day) => void; onOpenGuide: () => void;
}) {
  const { now, submissions, final, unanswered, settings, catchups, me, questivalOpen } = useForumStore();
  void onOpenAdmin;
  void onOpenWeekend;
  const { items } = useLive();
  const { now: cur, next } = nowNext(new Date(now));
  const today = dayOf(new Date(now));
  const w = questivalWindow(now);
  const daysOut = Math.max(0, Math.ceil((Date.parse("2026-09-11T18:00:00-07:00") - now) / 86_400_000));
  const accepted = catchups.filter((c) => c.status === "accepted");

  const a3 = final
    ? { result: final.extension_used ? "Submitted · Extension used" : "Submitted", done: true }
    : submissions.length
      ? { result: `In progress · ${submissions.length} saved`, done: false }
      : w === "before" ? { result: "Opens Sat 10:00", done: false } : w === "closed" ? { result: "Closed", done: false } : { result: "Open", done: false };

  const focus = cur ?? next;

  return (
    <>
      {today ? (
        <div className="fm-now">
          <div className="fm-now-eyebrow">{cur ? "Happening now" : "Up next"}</div>
          <div className="fm-now-title">{focus?.title ?? "See you tomorrow"}</div>
          <div className="fm-now-sub">{focus?.time} · {focus?.venue ?? "San Francisco"}</div>
          {cur && next && <div className="fm-now-next">Next: {next.title} · {next.time}{next.venue ? ` · ${next.venue}` : ""}</div>}
          <div className="fm-now-actions">
            {focus?.address && <a className="fm-btn" href={directionsUrl(focus.address)} target="_blank" rel="noreferrer"><PinIcon /> Directions</a>}
            {focus && <button className="fm-btn" onClick={() => onOpenActivity(focus.id)}>Details</button>}
            <button className="fm-btn" onClick={onOpenGuide}>✦ Guide</button>
          </div>
        </div>
      ) : (
        <div className="fm-now">
          <div className="fm-now-eyebrow">Welcome to the weekend</div>
          <div className="fm-now-title">Fri Sep 11 – Sun Sep 13 · San Francisco</div>
          <div className="fm-now-sub">Three sessions. Dinner Friday at six, Questival Saturday, the picnic Sunday.</div>
          <div className="fm-now-next">{daysOut} {daysOut === 1 ? "day" : "days"} to go. Tap <b>I&apos;m going</b> on anything below.</div>
          <button className="fm-shiny" onClick={onOpenGuide}>✦ How it all works</button>
        </div>
      )}

      {settings.announcement && <div className="fm-announce"><b>From the cohosts:</b> {settings.announcement}</div>}


      {unanswered > 0 && (
        <div className="alf-next-card" style={{ marginTop: 0, marginBottom: 14 }}>
          <div className="alf-next-card-text">
            <span className="alf-next-card-eyebrow">Inbox</span>
            <span className="alf-next-card-title">{unanswered} {unanswered === 1 ? "classmate wants" : "classmates want"} to do something with you</span>
            <span className="alf-next-card-sub">Say you&apos;re in, and it lands on your list and the map.</span>
          </div>
          <div className="alf-next-card-actions"><button className="alf-next-card-btn" onClick={onOpenInbox}>Open inbox</button></div>
        </div>
      )}

      {accepted.length > 0 && (
        <section className="alf-card">
          <h2 className="alf-card-h">Your catch-ups</h2>
          <ul className="fm-quests">
            {accepted.map((c) => {
              const other = c.from.id === me.id ? c.to : c.from;
              const slot = CATCHUP_SLOTS.find((s) => s.id === c.slot);
              return (
                <li key={c.id} className="fm-quest" style={{ cursor: "default", gridTemplateColumns: "28px 1fr" }}>
                  <Face p={other} size={26} />
                  <span><div className="fm-quest-title">{other.name}</div><div className="fm-quest-meta">{slot?.label ?? c.slot}{c.note ? ` · “${c.note}”` : ""}</div></span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <DayCards onOpenDay={onOpenDay} onOpenActivity={onOpenActivity} />

      <section className="alf-card">
        <h2 className="alf-card-h">Assignments Due</h2>
        <table className="fm-due">
          <tbody>
            <tr className="fm-due-done">
              <td className="fm-due-icon"><span className="fm-check">✓</span></td>
              <td><span className="fm-due-title">RU26 — Assignment 1: opening-line reflection</span><span className="fm-due-sub">Who are you most excited to see?</span></td>
              <td className="fm-due-result">Submitted · Editable</td>
            </tr>
            {questivalOpen ? (
              <tr className={a3.done ? "fm-due-done" : ""} onClick={final || submissions.length ? onOpenMe : onOpenQuestival}>
                <td className="fm-due-icon">{a3.done ? <span className="fm-check">✓</span> : <PaperclipIcon />}</td>
                <td><span className="fm-due-title">RU26 — Assignment 3: Questival</span><span className="fm-due-sub">Due {QUESTIVAL.dueLabel}</span></td>
                <td className="fm-due-result">{a3.result}</td>
              </tr>
            ) : (
              <tr className="fm-due-locked">
                <td className="fm-due-icon"><LockIcon /></td>
                <td><span className="fm-due-title">RU26 — Assignment 3: Questival</span><span className="fm-due-sub">Saturday · the brief drops here this week</span></td>
                <td className="fm-due-result">Locked</td>
              </tr>
            )}
            <tr className="fm-due-locked">
              <td className="fm-due-icon"><LockIcon /></td>
              <td><span className="fm-due-title">RU26 — Assignment 4: closing line</span><span className="fm-due-sub">Unlocks Sunday at the closing moment</span></td>
              <td className="fm-due-result">Locked</td>
            </tr>
          </tbody>
        </table>
      </section>


      {questivalOpen && (
        <section className="alf-card">
          <div className="fm-assign-head"><h2 className="alf-card-h" style={{ margin: 0 }}>Latest from the class</h2><button className="fm-link-btn" style={{ marginLeft: "auto" }} onClick={onOpenLive}>The feed →</button></div>
          <div style={{ marginTop: 10 }}><Feed items={items} limit={3} /></div>
        </section>
      )}

      <section className="alf-card">
        <h2 className="alf-card-h">The Class of 2021</h2>
        <p className="fm-muted">Everyone who&apos;s confirmed. Tap a face to request a catch-up.</p>
        <button className="fm-link-btn" onClick={onOpenClass}>Open the class list →</button>
        <button className="fm-link-btn" style={{ marginLeft: 14 }} onClick={() => window.open("/?open=stay", "_blank")}>Housing at the Res Hall →</button>
      </section>
    </>
  );
}

// ----- WEEKEND ---------------------------------------------------------------

export function WeekendView({ day, onDay, onOpen }: { day: Day; onDay: (d: Day) => void; onOpen: (id: string) => void }) {
  const d = DAYS.find((x) => x.id === day)!;
  const [mon, dd] = d.date.split(", ")[1].split(" ");
  const main = activitiesFor(day).filter((a) => a.kind !== "peer");
  const side = activitiesFor(day).filter((a) => a.kind === "peer");

  return (
    <>
      <div className="fm-seg">
        {DAYS.map((x) => (
          <button key={x.id} className={`fm-seg-btn${x.id === day ? " fm-seg-on" : ""}`} onClick={() => onDay(x.id)}><b>{x.label}</b><span>Session {x.session}</span></button>
        ))}
      </div>
      <div className="fm-session-head">
        <div>
          <h2 className="fm-session-title">RU26 Session {d.session} – {d.title}</h2>
          <div className="fm-muted">Class starts {d.date} · {d.sub}</div>
        </div>
        <div className="fm-datechip"><div className="fm-datechip-day">{dd}</div><div className="fm-datechip-mon">{mon.slice(0, 3)}</div></div>
      </div>
      <section className="alf-card">
        <h3 className="alf-card-h">Run of show</h3>
        <ul className="alf-agenda">{main.map((a) => <AgendaRow key={a.id} a={a} onOpen={onOpen} />)}</ul>
      </section>
      {side.length > 0 && (
        <section className="alf-card">
          <h3 className="alf-card-h">Side sessions</h3>
          <p className="fm-muted" style={{ marginBottom: 8 }}>Peer-led and proposed. Say you&apos;re interested and the host will rally people.</p>
          <ul className="alf-agenda">{side.map((a) => <AgendaRow key={a.id} a={a} onOpen={onOpen} />)}</ul>
        </section>
      )}
    </>
  );
}

function AgendaRow({ a, onOpen }: { a: Activity; onOpen: (id: string) => void }) {
  const { who, intents } = useForumStore();
  const intent = intents[a.id];
  const going = who[a.id]?.going ?? [];
  const more = (who[a.id]?.going_count ?? going.length) - going.length;
  return (
    <li className={`alf-agenda-item${a.kind === "optional" ? " alf-agenda-optional" : ""}`} onClick={() => onOpen(a.id)}>
      <div className="alf-agenda-time">{a.time}</div>
      <div className="alf-agenda-content">
        <div className="alf-agenda-title">{a.title}{a.venue && <span className="alf-agenda-loc">{a.venue}</span>}</div>
        <div className="alf-agenda-body"><p>{a.body}</p></div>
        <div className="fm-row-foot">
          <span className={`fm-kind fm-kind-${a.kind}`}>{a.kind === "anchor" ? "Everyone" : a.kind === "optional" ? "Optional" : "Peer-led"}</span>
          <Faces people={going} extra={Math.max(0, more)} />
          {intent && <span className="fm-row-going">{intent === "going" ? "You're going" : "Interested"}</span>}
        </div>
      </div>
    </li>
  );
}

export function Face({ p, size = 24 }: { p: PersonDTO; size?: number }) {
  return p.photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="fm-face" src={p.photo_url} alt="" loading="lazy" style={{ width: size, height: size, margin: 0 }} />
  ) : (
    <span className="fm-face" style={{ width: size, height: size, margin: 0, background: p.id === ME_ID ? "#2e9e5b" : undefined }} />
  );
}

export function Faces({ people, extra = 0, max = 5 }: { people: PersonDTO[]; extra?: number; max?: number }) {
  const shown = people.slice(0, max);
  const more = people.length - shown.length + extra;
  if (shown.length === 0 && more === 0) return null;
  return (
    <span className="fm-faces">
      {shown.map((p, i) =>
        p.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id + i} className="fm-face" src={p.photo_url} alt="" loading="lazy" />
        ) : (
          <span key={p.id + i} className="fm-face" />
        ),
      )}
      {more > 0 && <span className="fm-face-more">+{more}</span>}
    </span>
  );
}

// ----- ACTIVITY --------------------------------------------------------------

export function ActivityView({ activity: a, onShare }: { activity: Activity; onShare: (title: string, text: string) => void }) {
  const { who, intents, setIntent, plans, addPlan, removePlan, people, me } = useForumStore();
  const d = DAYS.find((x) => x.id === a.day)!;
  const intent = intents[a.id];
  const w = who[a.id];
  const going = w?.going ?? [];
  const plan = plans.find((p) => p.kind === "activity" && p.target_id === a.id);

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
          {a.link && <a className="fm-btn fm-btn-primary" href={a.link.url} target="_blank" rel="noreferrer">{a.link.label} ↗</a>}
          {a.address && <a className="fm-btn fm-btn-blue" href={directionsUrl(a.address)} target="_blank" rel="noreferrer"><PinIcon /> Directions</a>}
          <button className="fm-btn" onClick={() => onShare(a.title, `${a.title} · ${d.label} ${a.time}${a.venue ? ` · ${a.venue}` : ""}`)}><ShareIcon /> Share</button>
        </div>
      </section>

      <section className="alf-card">
        <h3 className="alf-card-h">Who&apos;s going</h3>
        <div className="fm-btn-row" style={{ marginTop: 0, marginBottom: 12 }}>
          <button className={`fm-btn${intent === "going" ? " fm-btn-going" : ""}`} onClick={() => setIntent(a.id, "going")}>{intent === "going" ? "✓ I'm going" : "I'm going"}</button>
          <button className={`fm-btn${intent === "interested" ? " fm-btn-blue" : ""}`} onClick={() => setIntent(a.id, "interested")}>{intent === "interested" ? "✓ Interested" : "Interested"}</button>
        </div>
        <p className="fm-muted">{(w?.going_count ?? going.length) + (intent === "going" && !going.some((p) => p.id === me.id) ? 1 : 0)} going · {(w?.interested_count ?? 0) + (intent === "interested" ? 1 : 0)} interested</p>
        <div className="fm-who">
          {intent === "going" && !going.some((p) => p.id === me.id) && <span className="fm-who-item"><span className="fm-face" style={{ margin: 0, width: 22, height: 22, background: "#2e9e5b" }} />You</span>}
          {going.map((p) => (
            <span key={p.id} className="fm-who-item"><Face p={p} size={22} />{firstName(p.name)}</span>
          ))}
        </div>
      </section>

      <PlanIt kind="activity" plan={plan} people={people.filter((p) => p.id !== me.id)} me={me} onPlan={(ids) => addPlan("activity", a.id, ids)} onUnplan={removePlan} />
    </>
  );
}

/** "I want to do this, with these people." Shared by quests and activities. */
export function PlanIt({ kind, plan, people, me, onPlan, onUnplan }: { kind: "quest" | "activity"; plan?: PlanDTO; people: PersonDTO[]; me: PersonDTO; onPlan: (withIds: string[]) => void; onUnplan: (id: string) => void }) {
  const [tags, setTags] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  if (plan) {
    const withPeople = plan.with.filter((p) => p.id !== me.id);
    const ins = withPeople.filter((p) => plan.replies[p.id] === "in");
    return (
      <section className="alf-card">
        <div className="fm-plan">
          <div className="fm-plan-title">✓ Planned{withPeople.length ? ` · with ${withPeople.map((p) => firstName(p.name)).join(", ")}` : ""}</div>
          <div className="fm-plan-sub">
            {withPeople.length ? `They got an invitation in their inbox.${ins.length ? ` In: ${ins.map((p) => firstName(p.name)).join(", ")}.` : ""} ` : ""}This is on your list and the map. Not a submission.
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
      <p className="fm-muted" style={{ marginBottom: 10 }}>Save it as something you intend to do{kind === "quest" ? " — no proof needed yet" : ""}. Pick who with and they get a note in their inbox.</p>
      {!open ? (
        <button className="fm-btn fm-btn-block" onClick={() => setOpen(true)}>I want to do this</button>
      ) : (
        <>
          <p className="fm-eyebrow">With</p>
          <TagPicker people={people} tags={tags} onChange={setTags} />
          <div className="fm-btn-row">
            <button className="fm-btn fm-btn-blue" onClick={() => onPlan(tags)}>
              {tags.length ? `Plan with ${tags.map((id) => firstName(people.find((p) => p.id === id)?.name ?? "")).join(", ")}` : "Plan it, just me for now"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ----- INBOX -----------------------------------------------------------------

export function InboxView({ onOpenQuest, onOpenActivity, onOpenClass }: { onOpenQuest: (id: string) => void; onOpenActivity: (id: string) => void; onOpenClass: () => void }) {
  const { invites, replyPlan, plans, catchups, replyCatchup, me, settings } = useForumStore();
  const label = (kind: "quest" | "activity", id: string) => (kind === "quest" ? getQuest(id)?.title : getActivity(id)?.title) ?? id;
  const openTarget = (kind: "quest" | "activity", id: string) => (kind === "quest" ? onOpenQuest(id) : onOpenActivity(id));
  const sent = plans.filter((p) => p.with.some((x) => x.id !== me.id));
  const incoming = catchups.filter((c) => c.to.id === me.id);
  const outgoing = catchups.filter((c) => c.from.id === me.id);
  const myReply = (p: PlanDTO) => p.replies[me.id] ?? p.replies[ME_ID];

  return (
    <>
      <section className="alf-card">
        <h2 className="alf-card-h">Invitations</h2>
        {invites.length === 0 && incoming.length === 0 ? (
          <p className="fm-empty">Quiet for now.</p>
        ) : (
          <ul className="fm-inbox">
            {incoming.map((c) => <CatchupRow key={c.id} c={c} onReply={replyCatchup} />)}
            {invites.map((inv) => {
              const r = myReply(inv);
              const others = inv.with.filter((p) => p.id !== me.id && p.id !== ME_ID);
              return (
                <li key={inv.id} className="fm-inv">
                  <Face p={inv.owner} size={36} />
                  <div>
                    <div className="fm-inv-text">
                      <b>{firstName(inv.owner.name)}</b> wants to do <b className="alf-link" onClick={() => openTarget(inv.kind, inv.target_id)}>{label(inv.kind, inv.target_id)}</b> with you{others.length ? ` and ${others.map((p) => firstName(p.name)).join(", ")}` : ""}.
                    </div>
                    <div className="fm-inv-meta">{timeShort(inv.created_at)} · {inv.kind === "quest" ? `${getQuest(inv.target_id)?.points ?? ""} pts` : "Saturday"}</div>
                    {r ? (
                      <div className="fm-inv-done">{r === "in" ? "✓ You're in — it's on your list and the map." : "Maybe — we'll remind you when they're nearby."}</div>
                    ) : (
                      <div className="fm-inv-actions">
                        <button className="fm-btn fm-btn-going" onClick={() => replyPlan(inv.id, "in")}>I&apos;m in</button>
                        <button className="fm-btn" onClick={() => replyPlan(inv.id, "maybe")}>Maybe</button>
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
        {sent.length === 0 && outgoing.length === 0 ? (
          <p className="fm-empty">Plan a quest with someone, or <button className="fm-link-btn" onClick={onOpenClass}>request a catch-up</button>, and it shows up here.</p>
        ) : (
          <ul className="fm-inbox">
            {outgoing.map((c) => (
              <li key={c.id} className="fm-inv">
                <span className="fm-tag-ph" style={{ background: "#2e9e5b" }}>{me.name.charAt(0)}</span>
                <div>
                  <div className="fm-inv-text">You asked <b>{firstName(c.to.name)}</b> for a catch-up · {CATCHUP_SLOTS.find((s) => s.id === c.slot)?.label ?? c.slot}</div>
                  <div className="fm-inv-meta">{c.status === "pending" ? "waiting" : c.status}</div>
                </div>
              </li>
            ))}
            {sent.map((p) => (
              <li key={p.id} className="fm-inv" onClick={() => openTarget(p.kind, p.target_id)}>
                <span className="fm-tag-ph" style={{ background: "#2e9e5b" }}>{me.name.charAt(0)}</span>
                <div>
                  <div className="fm-inv-text">You invited <b>{p.with.filter((x) => x.id !== me.id).map((x) => firstName(x.name)).join(", ")}</b> to <b>{label(p.kind, p.target_id)}</b>.</div>
                  <div className="fm-inv-meta">{timeShort(p.created_at)} · {Object.values(p.replies).filter((r) => r === "in").length} in</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {settings.announcement && (
        <section className="alf-card">
          <h3 className="alf-card-h">From the cohosts</h3>
          <ul className="fm-inbox">
            <li className="fm-inv">
              <span className="fm-tag-ph" style={{ background: "#1a2530" }}>M</span>
              <div><div className="fm-inv-text">{settings.announcement}</div></div>
            </li>
          </ul>
        </section>
      )}
    </>
  );
}

function CatchupRow({ c, onReply }: { c: CatchupDTO; onReply: (id: string, s: "accepted" | "declined") => void }) {
  const slot = CATCHUP_SLOTS.find((s) => s.id === c.slot);
  return (
    <li className="fm-inv">
      <Face p={c.from} size={36} />
      <div>
        <div className="fm-inv-text"><b>{firstName(c.from.name)}</b> wants to catch up · <b>{slot?.label ?? c.slot}</b>{c.note ? <><br />“{c.note}”</> : null}</div>
        <div className="fm-inv-meta">{timeShort(c.created_at)} · one on one</div>
        {c.status === "pending" ? (
          <div className="fm-inv-actions">
            <button className="fm-btn fm-btn-going" onClick={() => onReply(c.id, "accepted")}>Let&apos;s do it</button>
            <button className="fm-btn" onClick={() => onReply(c.id, "declined")}>Can&apos;t</button>
          </div>
        ) : (
          <div className="fm-inv-done">{c.status === "accepted" ? "✓ On both your calendars." : "Declined."}</div>
        )}
      </div>
    </li>
  );
}

// ----- CLASS + catch-up request ---------------------------------------------

export function ClassView() {
  const { people, me, requestCatchup, catchups } = useForumStore();
  const [pick, setPick] = useState<PersonDTO | null>(null);
  const [slot, setSlot] = useState(CATCHUP_SLOTS[0].id);
  const [note, setNote] = useState("");
  const sorted = [...people].reverse();
  const already = (p: PersonDTO) => catchups.find((c) => (c.from.id === me.id && c.to.id === p.id) || (c.to.id === me.id && c.from.id === p.id));

  return (
    <>
      {pick && (
        <section className="alf-card">
          <div className="fm-assign-head"><Face p={pick} size={34} /><h3 className="alf-card-h" style={{ margin: 0 }}>Catch up with {firstName(pick.name)}</h3></div>
          {already(pick) ? (
            <p className="fm-muted" style={{ marginTop: 8 }}>Already {already(pick)!.status === "accepted" ? "on your calendars" : already(pick)!.status === "pending" ? "asked — waiting on a reply" : "declined"}.</p>
          ) : (
            <>
              <p className="fm-muted" style={{ margin: "6px 0 10px" }}>One on one, in one of the weekend&apos;s open windows. They get it in their inbox.</p>
              <select className="fm-input" value={slot} onChange={(e) => setSlot(e.target.value)}>
                {CATCHUP_SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <input className="fm-input" placeholder="A line (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ marginTop: 8 }} />
              <div className="fm-btn-row">
                <button className="fm-btn fm-btn-blue" onClick={() => { requestCatchup(pick.id, slot, note.trim()); setPick(null); setNote(""); }}>Request</button>
                <button className="fm-btn" onClick={() => setPick(null)}>Cancel</button>
              </div>
            </>
          )}
        </section>
      )}
      <section className="alf-card">
        <h2 className="alf-card-h">The Class of 2021 {people.length ? `· ${people.length}` : ""}</h2>
        {sorted.length === 0 ? (
          <p className="fm-empty">Class hasn&apos;t filled in yet.</p>
        ) : (
          <div className="fm-class">
            {sorted.map((p) => (
              <div key={p.id} className="fm-class-item" onClick={() => p.id !== me.id && setPick(p)} style={{ cursor: p.id === me.id ? "default" : "pointer" }}>
                {p.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo_url} alt="" loading="lazy" />
                ) : (
                  <span className="fm-tag-ph">{p.name.charAt(0)}</span>
                )}
                <span>{firstName(p.name)}{already(p)?.status === "accepted" ? " ☕" : ""}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export { PlanIntent };

/** Assignment 3 before launch: the ALF lock, nothing about the quests. */
function QuestivalLocked() {
  return (
    <section className="alf-card">
      <div className="fm-gate">
        <p className="fm-eyebrow">Sat, Sep 12 · 10:00 → 17:00</p>
        <h2 className="fm-gate-title">Will be unlocked later</h2>
        <p className="fm-gate-sub">Assignment 3 is a pick-your-own-adventure through the city with the people you came for. The brief, the map pins, and the scoring drop here this week. Bring shoes you can walk in.</p>
      </div>
    </section>
  );
}
