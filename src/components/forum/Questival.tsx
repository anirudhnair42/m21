"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EVIDENCE_LABEL, QUESTIVAL, getQuest, questivalWindow, timeLeft, type Quest } from "@/lib/questival";
import { directionsUrl, getActivity } from "@/lib/weekend";
import { CameraIcon, PinIcon } from "@/components/forum/icons";
import { Faces, PlanIt } from "@/components/forum/ForumMobile";
import { useForumStore } from "@/components/forum/ForumStore";
import type { BoardResponse, FeedResponse, PersonDTO, SubmissionDTO } from "@/lib/questival-api";
import { ME_ID, djb2, firstName, timeShort } from "@/components/forum/store";
import { getAccessToken } from "@/lib/auth";

function myPoints(subs: SubmissionDTO[]): number {
  // Best proof per (quest, instance); everyone tagged is credited.
  const best = new Map<string, number>();
  for (const s of subs) {
    if (s.status !== "approved") continue;
    const k = `${s.quest_id}#${s.instance}`;
    best.set(k, Math.max(best.get(k) ?? 0, s.points));
  }
  let sum = 0;
  for (const v of best.values()) sum += v;
  return sum;
}

export function StatusChip({ final, now, count }: { final: { extension_used: boolean } | null; now: number; count: number }) {
  const w = questivalWindow(now);
  if (final) {
    if (w === "closed") return <span className="alf-assignment-chip fm-chip-closed">Submitted · Closed</span>;
    if (final.extension_used) return <span className="alf-assignment-chip fm-chip-warn">Submitted · Extension used</span>;
    return <span className="alf-assignment-chip">Submitted · Editable until 5:00 PM</span>;
  }
  if (w === "closed") return <span className="alf-assignment-chip fm-chip-closed">Closed</span>;
  if (w === "extension") return <span className="alf-assignment-chip fm-chip-warn">Extension window · 7 min</span>;
  if (w === "before") return <span className="alf-assignment-chip fm-chip-closed">Opens Sat 10:00</span>;
  return <span className="alf-assignment-chip fm-chip-warn">{count ? `In progress · ${count} saved` : "Open"}</span>;
}

// ----- HUB -------------------------------------------------------------------

export function QuestivalHub({
  onOpenQuest,
  onOpenMe,
  onOpenLive,
}: {
  onOpenQuest: (id: string) => void;
  onOpenMe: () => void;
  onOpenLive: () => void;
}) {
  const { quests, submissions, plans, final, now, settings } = useForumStore();
  const [filter, setFilter] = useState<"all" | "todo" | "planned" | "saved">("all");
  const w = questivalWindow(now);
  const doneIds = new Set(submissions.map((s) => s.quest_id));
  const plannedIds = new Set(plans.filter((p) => p.kind === "quest").map((p) => p.target_id));
  const pts = myPoints(submissions);
  const total = quests.length;
  const place = quests.filter((q) => q.venue);
  const anywhere = quests.filter((q) => !q.venue);

  const show = (q: Quest) => (filter === "all" ? true : filter === "saved" ? doneIds.has(q.id) : filter === "planned" ? plannedIds.has(q.id) : !doneIds.has(q.id));

  const byArea = useMemo(() => {
    const m = new Map<string, Quest[]>();
    for (const q of place) {
      const k = q.area ?? "Elsewhere";
      m.set(k, [...(m.get(k) ?? []), q]);
    }
    return [...m.entries()];
  }, [place]);

  return (
    <>
      {settings.announcement && (
        <div className="fm-announce"><b>From the cohosts:</b> {settings.announcement}</div>
      )}
      <section className="alf-card">
        <div className="fm-assign-head">
          <h2 className="alf-card-h" style={{ margin: 0 }}>Assignment 3: Questival</h2>
          <StatusChip final={final} now={now} count={submissions.length} />
        </div>
        <div className="fm-assign-due">
          Due {QUESTIVAL.dueLabel} · Weight 2x{w === "open" || w === "extension" ? ` · ${timeLeft(now)}` : ""}
        </div>
        <p className="alf-card-body">
          Pick your own adventure through the city. Plan what you want to do and with whom, capture as you go, tag whoever
          did it with you, and submit your final list before the bonfire. Everything is optional; every quest is points.
        </p>
        <div className="fm-progress"><span style={{ width: `${Math.min(100, (doneIds.size / Math.max(1, total)) * 100)}%` }} /></div>
        <div className="fm-stats">
          <span><b>{doneIds.size}</b> of {total} done</span>
          <span><b>{plannedIds.size}</b> planned</span>
          <span><b>{pts}</b> pts</span>
        </div>
        <div className="fm-btn-row">
          <button className="fm-btn fm-btn-primary" onClick={onOpenMe}>{final ? "My submission" : "My list"}</button>
          <button className="fm-btn" onClick={onOpenLive}>The class, live</button>
        </div>
      </section>

      <div className="fm-filters">
        {(["all", "todo", "planned", "saved"] as const).map((f) => (
          <button key={f} className={`fm-filter${filter === f ? " fm-filter-on" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "todo" ? "Not done" : f === "planned" ? "Planned" : "Saved"}
          </button>
        ))}
      </div>

      <section className="alf-card">
        <h3 className="alf-card-h">At a place</h3>
        {byArea.map(([area, qs]) => {
          const vis = qs.filter(show);
          if (!vis.length) return null;
          return (
            <div key={area}>
              <p className="fm-eyebrow" style={{ marginTop: 10 }}>{area}</p>
              <ul className="fm-quests">
                {vis.map((q) => <QuestRow key={q.id} q={q} saved={doneIds.has(q.id)} planned={plannedIds.has(q.id)} final={!!final} onOpen={onOpenQuest} />)}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="alf-card">
        <h3 className="alf-card-h">Anywhere</h3>
        <ul className="fm-quests">
          {anywhere.filter(show).map((q) => <QuestRow key={q.id} q={q} saved={doneIds.has(q.id)} planned={plannedIds.has(q.id)} final={!!final} onOpen={onOpenQuest} />)}
        </ul>
      </section>
    </>
  );
}

function QuestRow({ q, saved, planned, final, onOpen }: { q: Quest; saved: boolean; planned: boolean; final: boolean; onOpen: (id: string) => void }) {
  const dot = saved ? (final ? " fm-dot-done" : " fm-dot-saved") : planned ? " fm-dot-planned" : "";
  return (
    <li className="fm-quest" onClick={() => onOpen(q.id)}>
      <span className={`fm-dot${dot}`} />
      <span>
        <div className="fm-quest-title">{q.title}</div>
        <div className="fm-quest-meta">
          {q.venue ? `${q.venue} · ` : ""}{EVIDENCE_LABEL[q.evidence]}{q.repeat ? ` · up to ${q.repeat}×` : ""}{planned && !saved ? " · planned" : ""}
        </div>
      </span>
      <span className="fm-pts">{q.points}</span>
    </li>
  );
}

// ----- QUEST -----------------------------------------------------------------

export function QuestView({ questId, onOpenMe }: { questId: string; onOpenMe: () => void }) {
  const { quests, people, me, submissions, plans, now, saveProof, addPlan, removePlan } = useForumStore();
  const q = quests.find((x) => x.id === questId) ?? getQuest(questId);
  const plan = plans.find((p) => p.kind === "quest" && p.target_id === questId);
  const w = questivalWindow(now);
  const mine = submissions.filter((s) => s.quest_id === questId);
  const cap = q?.repeat ?? 1;
  const nextInstance = mine.length + 1;
  const canAdd = nextInstance <= cap && w !== "closed";

  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>(() => plan?.with.map((p) => p.id).filter((id) => id !== me.id) ?? []);
  const [caption, setCaption] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);

  if (!q) return <section className="alf-card"><p className="fm-empty">That quest isn&apos;t in the catalog anymore.</p></section>;

  const accept = q.evidence === "video" ? "video/*" : q.evidence === "screenshot" ? "image/*" : "image/*,video/*";
  const multiple = q.evidence === "photo-pair";
  const needed = q.evidence === "photo-pair" ? 2 : 1;

  const onFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    setFiles((f) => [...f, ...Array.from(list).map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const save = async () => {
    setBusy("Saving…");
    setError(null);
    try {
      await saveProof({
        questId: q.id,
        instance: nextInstance,
        files: files.map((f) => f.file),
        memberIds: tags,
        caption: q.evidence === "text-photo" ? undefined : caption.trim() || undefined,
        note: q.evidence === "text-photo" ? caption.trim() || undefined : undefined,
        onProgress: (d, t) => setBusy(`Uploading ${d} of ${t}…`),
      });
      const names = tags.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean).map((n) => firstName(n!));
      setReceipt(`Saved ${timeShort(now)}${names.length ? ` · with ${names.join(", ")}` : ""}`);
      setFiles([]);
      setCaption("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save — try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <section className="alf-card">
        <p className="fm-eyebrow">{q.venue ? `At a place · ${q.area ?? ""}` : "Anywhere"}</p>
        <div className="fm-assign-head" style={{ marginBottom: 8 }}>
          <h2 className="alf-card-h" style={{ margin: 0 }}>{q.title}</h2>
          <span className="fm-pts fm-pts-big">{q.points} pts</span>
        </div>
        <p className="fm-prompt">{q.prompt}</p>
        <div className="fm-detail-meta">
          <span><b>Proof</b> · {EVIDENCE_LABEL[q.evidence]}</span>
          {q.venue && <span><b>Where</b> · {q.venue}{q.address ? `, ${q.address}` : ""}</span>}
          {q.repeat && <span><b>Repeats</b> · up to {q.repeat} times, {q.points} pts each</span>}
          {q.bonus && <span><b>Bonus</b> · {q.bonus}</span>}
        </div>
        {q.tip && <p className="fm-note">{q.tip}</p>}
        {q.address && (
          <div className="fm-btn-row">
            <a className="fm-btn fm-btn-blue" href={directionsUrl(q.address)} target="_blank" rel="noreferrer"><PinIcon /> Directions</a>
          </div>
        )}
      </section>

      {mine.length === 0 && (
        <PlanIt kind="quest" plan={plan} people={people} me={me} onPlan={(ids) => addPlan("quest", q.id, ids)} onUnplan={removePlan} />
      )}

      {mine.length > 0 && (
        <section className="alf-card">
          <h3 className="alf-card-h">On your list</h3>
          <div className="fm-thumbs">
            {mine.flatMap((s) => s.media.map((m, i) => <Thumb key={`${s.id}-${i}`} url={m.url} type={m.type} />))}
          </div>
          <p className="fm-muted" style={{ marginTop: 8 }}>
            {mine.length} saved{q.repeat ? ` of ${q.repeat}` : ""}. <button className="fm-link-btn" onClick={onOpenMe}>Open my list</button>
          </p>
        </section>
      )}

      {canAdd ? (
        <section className="alf-card">
          <h3 className="alf-card-h">{q.repeat && mine.length ? `Instance ${nextInstance} of ${cap}` : "Your proof"}</h3>
          <input ref={fileRef} type="file" accept={accept} capture={q.evidence === "screenshot" ? undefined : "environment"} multiple={multiple} hidden onChange={(e) => onFiles(e.target.files)} />
          <button className="fm-capture" onClick={() => fileRef.current?.click()} disabled={!!busy}>
            <CameraIcon />
            {q.evidence === "video" ? "Record a video" : q.evidence === "screenshot" ? "Add a screenshot" : "Take a photo"}
            <small>{q.evidence === "photo-pair" ? "Pick the original and the recreation" : "or choose from your library"}</small>
          </button>
          {error && <p className="fm-note">{error}</p>}
          {files.length > 0 && (
            <div className="fm-thumbs">
              {files.map((f, i) => (
                <Thumb key={i} url={f.preview} type={f.file.type.startsWith("video/") ? "video" : "image"} onRemove={() => setFiles(files.filter((_, j) => j !== i))} />
              ))}
            </div>
          )}

          <p className="fm-eyebrow" style={{ marginTop: 16 }}>Who did it with you</p>
          <TagPicker people={people.filter((p) => p.id !== me.id)} tags={tags} onChange={setTags} />

          {q.evidence === "text-photo" ? (
            <textarea className="fm-input" rows={3} placeholder="Your line…" value={caption} onChange={(e) => setCaption(e.target.value)} style={{ marginTop: 10 }} />
          ) : (
            <input className="fm-input" placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} style={{ marginTop: 10 }} />
          )}

          <div className="fm-btn-row">
            <button className="fm-btn fm-btn-primary" disabled={files.length < needed || !!busy} onClick={save}>{busy ?? "Save to my list"}</button>
          </div>
          {receipt && <p className="fm-receipt">✓ {receipt}</p>}
          {w === "before" && <p className="fm-muted" style={{ marginTop: 8 }}>Saving works now; scoring opens Sat 10:00.</p>}
          {w === "extension" && <p className="fm-note">It&apos;s past 5:00. This one lands on an extension.</p>}
        </section>
      ) : (
        <section className="alf-card">
          <p className="fm-empty">{w === "closed" ? "Questival is closed — you're at the bonfire, go enjoy it." : "You've maxed this one out."}</p>
        </section>
      )}
    </>
  );
}

export function Thumb({ url, type, onRemove }: { url: string; type: "image" | "video"; onRemove?: () => void }) {
  return (
    <div className="fm-thumb">
      {type === "image" && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" />
      ) : type === "video" && url ? (
        <video src={url} playsInline muted />
      ) : (
        <div className="fm-thumb-video" style={{ height: "100%" }}>{type === "video" ? "VIDEO" : "—"}</div>
      )}
      {onRemove && <button className="fm-thumb-x" onClick={onRemove} aria-label="Remove">×</button>}
    </div>
  );
}

/** Faces to tag, by RSVP id. Tagged first. */
export function TagPicker({ people, tags, onChange }: { people: PersonDTO[]; tags: string[]; onChange: (t: string[]) => void }) {
  const [query, setQuery] = useState("");
  const list = people.filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()));
  const ordered = [...list].sort((a, b) => Number(tags.includes(b.id)) - Number(tags.includes(a.id)));
  return (
    <>
      <input className="fm-input" placeholder="Search the class…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 6 }} />
      <div className="fm-tags">
        {ordered.map((p) => {
          const on = tags.includes(p.id);
          return (
            <button key={p.id} className={`fm-tag${on ? " fm-tag-on" : ""}`} onClick={() => onChange(on ? tags.filter((x) => x !== p.id) : [...tags, p.id])}>
              {p.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photo_url} alt="" loading="lazy" />
              ) : (
                <span className="fm-tag-ph">{p.name.charAt(0)}</span>
              )}
              <label>{firstName(p.name)}</label>
            </button>
          );
        })}
        {ordered.length === 0 && <span className="fm-muted">No one by that name.</span>}
      </div>
    </>
  );
}

// ----- MY QUESTIVAL ----------------------------------------------------------

export function MyQuestival({ onOpenQuest, onOpenActivity }: { onOpenQuest: (id: string) => void; onOpenActivity: (id: string) => void }) {
  const { submissions, plans, me, final, now, removeProof, submitFinal } = useForumStore();
  const [confirming, setConfirming] = useState(false);
  const w = questivalWindow(now);
  const pts = myPoints(submissions);
  const withPeople = useMemo(() => {
    const seen = new Map<string, PersonDTO>();
    for (const s of submissions) for (const p of s.members) if (p.id !== me.id) seen.set(p.id, p);
    return [...seen.values()];
  }, [submissions, me.id]);
  const bonfire = getActivity("sat-bonfire")!;
  const editable = w !== "closed";
  const doneIds = new Set(submissions.map((s) => s.quest_id));
  const planned = plans.filter((p) => !(p.kind === "quest" && doneIds.has(p.target_id)));

  return (
    <>
      <section className="alf-card">
        <div className="fm-assign-head">
          <h2 className="alf-card-h" style={{ margin: 0 }}>Assignment 3: Questival</h2>
          <StatusChip final={final} now={now} count={submissions.length} />
        </div>
        <div className="fm-assign-due">
          {final ? `Submitted ${timeShort(final.submitted_at)}${final.extension_used ? " · after the 7th minute" : ""}` : `Due ${QUESTIVAL.dueLabel} · Weight 2x`}
        </div>
        <div className="fm-stats" style={{ marginTop: 6 }}>
          <span><b>{submissions.length}</b> quests</span>
          <span><b>{pts}</b> pts</span>
        </div>
        {withPeople.length > 0 && (
          <div className="fm-row-foot">
            <span className="fm-muted">With</span>
            <Faces people={withPeople} max={8} />
            <span className="fm-muted">{withPeople.map((p) => firstName(p.name)).join(", ")}</span>
          </div>
        )}

        {!final && !confirming && (
          <div className="fm-btn-row">
            <button className="fm-btn fm-btn-primary" disabled={submissions.length === 0 || w === "closed"} onClick={() => setConfirming(true)}>Submit final list</button>
          </div>
        )}
        {!final && confirming && (
          <div className="alf-next-card" style={{ marginTop: 12 }}>
            <div className="alf-next-card-text">
              <span className="alf-next-card-eyebrow">Confirm</span>
              <span className="alf-next-card-title">{submissions.length} quests · {pts} pts{withPeople.length ? ` · with ${withPeople.map((p) => firstName(p.name)).join(", ")}` : ""}</span>
              <span className="alf-next-card-sub">Submit before the bonfire? You can still edit until 5:00 PM.</span>
            </div>
            <div className="alf-next-card-actions">
              <button className="alf-next-card-btn" onClick={() => { submitFinal(); setConfirming(false); }}>Submit</button>
              <button className="alf-next-card-link" onClick={() => setConfirming(false)}>Not yet</button>
            </div>
          </div>
        )}
        {final && (
          <div className="fm-sealed">
            <div className="fm-sealed-big">Submitted.</div>
            <div className="fm-sealed-sub">{final.extension_used ? "Right at the deadline — in the Ani tradition." : "Grades released at dinner, around 8:30."}</div>
          </div>
        )}
      </section>

      {final && (
        <div className="alf-next-card" style={{ marginBottom: 14, marginTop: 0 }}>
          <div className="alf-next-card-text">
            <span className="alf-next-card-eyebrow">Next up</span>
            <span className="alf-next-card-title">Session 1.2 — {bonfire.title}</span>
            <span className="alf-next-card-sub">{bonfire.time} · {bonfire.venue}</span>
          </div>
          <div className="alf-next-card-actions">
            <a className="alf-next-card-btn" href={directionsUrl(bonfire.address!)} target="_blank" rel="noreferrer">Directions →</a>
            <button className="alf-next-card-link" onClick={() => onOpenActivity(bonfire.id)}>Details</button>
          </div>
        </div>
      )}

      {planned.length > 0 && !final && (
        <section className="alf-card">
          <h3 className="alf-card-h">Planned</h3>
          <p className="fm-muted" style={{ marginBottom: 6 }}>What you intend to do. Nothing here counts until you capture it.</p>
          <ul className="fm-proofs">
            {planned.map((p) => {
              const title = p.kind === "quest" ? getQuest(p.target_id)?.title : getActivity(p.target_id)?.title;
              const q = p.kind === "quest" ? getQuest(p.target_id) : undefined;
              const ins = p.with.filter((x) => p.replies[x.id] === "in").map((x) => firstName(x.name));
              return (
                <li key={p.id} className="fm-proof-row" onClick={() => (p.kind === "quest" ? onOpenQuest(p.target_id) : onOpenActivity(p.target_id))}>
                  <div className="fm-proof-thumb" style={{ background: "#f3f0e8", border: "1px dashed #c9c3b4" }}><div className="fm-proof-thumb-ph" style={{ color: "#8a8680" }}>PLAN</div></div>
                  <div>
                    <div className="fm-proof-title">{title}</div>
                    <div className="fm-proof-meta">
                      {p.with.length ? `with ${p.with.map((x) => firstName(x.name)).join(", ")}` : "just you, for now"}{ins.length ? ` · in: ${ins.join(", ")}` : ""}
                    </div>
                  </div>
                  {q && <span className="fm-pts">{q.points}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="alf-card">
        <h3 className="alf-card-h">Your list</h3>
        {submissions.length === 0 ? (
          <p className="fm-empty">Nothing saved yet. Open a quest and take a photo.</p>
        ) : (
          <ul className="fm-proofs">
            {submissions.map((s) => {
              const q = getQuest(s.quest_id);
              const first = s.media[0];
              const others = s.members.filter((p) => p.id !== me.id);
              return (
                <li key={s.id} className={`fm-proof-row${s.status === "rejected" ? " fm-proof-rejected" : ""}`}>
                  <div className="fm-proof-thumb" onClick={() => onOpenQuest(s.quest_id)}>
                    {first?.type === "image" && first.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={first.url} alt="" />
                    ) : (
                      <div className="fm-proof-thumb-ph">{first?.type === "video" ? "VIDEO" : "—"}</div>
                    )}
                  </div>
                  <div onClick={() => onOpenQuest(s.quest_id)}>
                    <div className="fm-proof-title">{q?.title ?? s.quest_id}{q?.repeat ? ` · ${s.instance}` : ""}</div>
                    <div className="fm-proof-meta">
                      {timeShort(s.created_at)}{others.length ? ` · with ${others.map((p) => firstName(p.name)).join(", ")}` : ""}{s.caption ? ` · “${s.caption}”` : ""}
                      {s.status === "rejected" ? ` · not counted${s.review_note ? `: ${s.review_note}` : ""}` : ""}
                    </div>
                  </div>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span className="fm-pts">{s.points}</span>
                    {editable && s.uploader.id === me.id && <button className="fm-proof-remove" onClick={() => removeProof(s.id)} aria-label="Remove">×</button>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

// ----- LIVE ------------------------------------------------------------------

/** Feed + board, from the API when possible, else sample + my local proofs. */
export function useLive() {
  const { mode, submissions, people, now, me } = useForumStore();
  const [feed, setFeed] = useState<SubmissionDTO[] | null>(null);
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const load = useCallback(async () => {
    if (mode !== "api") return;
    const token = await getAccessToken();
    const h: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const [f, b] = await Promise.all([
      fetch("/api/questival/feed", { headers: h }).then((r) => (r.ok ? (r.json() as Promise<FeedResponse>) : null)).catch(() => null),
      fetch("/api/questival/board", { headers: h }).then((r) => (r.ok ? (r.json() as Promise<BoardResponse>) : null)).catch(() => null),
    ]);
    if (f) setFeed(f.items);
    if (b) setBoard(b);
  }, [mode]);
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  // Without the API there is nothing live to show but your own proofs.
  const items: SubmissionDTO[] = feed ?? [...submissions].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const rows = board?.rows ?? [{ person: me, points: myPoints(submissions), completed: submissions.length, rank: 1 }];
  void people;
  void now;
  return { items, rows, frozen: board?.frozen ?? false, refresh: load };
}

export function LiveView({ initial = "feed" }: { initial?: "feed" | "board" }) {
  const { me } = useForumStore();
  const [seg, setSeg] = useState<"feed" | "board">(initial);
  const { items, rows, frozen } = useLive();

  return (
    <>
      <div className="fm-seg" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <button className={`fm-seg-btn${seg === "feed" ? " fm-seg-on" : ""}`} onClick={() => setSeg("feed")}><b>Feed</b><span>as it lands</span></button>
        <button className={`fm-seg-btn${seg === "board" ? " fm-seg-on" : ""}`} onClick={() => setSeg("board")}><b>Board</b><span>{frozen ? "final" : "points"}</span></button>
      </div>

      {seg === "feed" && <Feed items={items} />}

      {seg === "board" && (
        <section className="alf-card">
          <h3 className="alf-card-h">Leaderboard</h3>
          <table className="fm-board">
            <tbody>
              {rows.map((r) => (
                <tr key={r.person.id} className={r.person.id === me.id ? "fm-board-me" : ""}>
                  <td className="fm-board-rank">{r.rank}</td>
                  <td>
                    <span className="fm-board-name">
                      {r.person.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.person.photo_url} alt="" loading="lazy" />
                      ) : (
                        <span className="fm-face" style={{ margin: 0, width: 26, height: 26, background: r.person.id === me.id ? "#2e9e5b" : undefined }} />
                      )}
                      {r.person.name}
                      <span className="fm-muted" style={{ fontSize: 11 }}>{r.completed} quests</span>
                    </span>
                  </td>
                  <td className="fm-board-pts">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fm-muted" style={{ marginTop: 10 }}>Everyone tagged on a proof gets its points. Prizes at dinner for the top three, and for the best recreation.</p>
        </section>
      )}
    </>
  );
}

export function Feed({ items, limit }: { items: SubmissionDTO[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <ul className="fm-feed">
      {shown.length === 0 && <li className="fm-empty">Nothing yet. The class is still at breakfast.</li>}
      {shown.map((f) => {
        const q = getQuest(f.quest_id);
        const others = f.members.filter((p) => p.id !== f.uploader.id);
        const first = f.media[0];
        return (
          <li key={f.id} className="fm-card-proof">
            <div className="fm-card-proof-head">
              {f.uploader.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="fm-face-lg" src={f.uploader.photo_url} alt="" loading="lazy" />
              ) : (
                <span className="fm-face fm-face-lg" style={{ margin: 0, background: f.uploader.id === ME_ID ? "#2e9e5b" : undefined }} />
              )}
              <span className="fm-card-proof-who">
                {firstName(f.uploader.name)}{others.length ? ` + ${others.map((p) => firstName(p.name)).join(", ")}` : ""}
              </span>
              <span className="fm-card-proof-time">{timeShort(f.created_at)}</span>
            </div>
            <div className="fm-card-proof-media">
              {first?.type === "image" && first.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={first.url} alt="" loading="lazy" />
              ) : first?.type === "video" && first.url ? (
                <video src={first.url} controls playsInline preload="metadata" />
              ) : (
                <div className="fm-card-proof-ph" style={{ background: `linear-gradient(135deg, #1a2530 0%, hsl(${djb2(f.quest_id) % 360} 45% 32%) 100%)` }}>
                  <small>{first?.type === "video" ? "Video" : "Proof"}</small>
                  {q?.title ?? f.quest_id}
                </div>
              )}
            </div>
            <div className="fm-card-proof-foot">
              <span>{q?.title ?? f.quest_id}{f.caption ? ` · “${f.caption}”` : ""}{f.note ? ` · “${f.note}”` : ""}</span>
              <span className="fm-pts">+{f.points}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
