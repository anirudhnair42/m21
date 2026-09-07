"use client";

import { useMemo, useRef, useState } from "react";
import {
  ANYWHERE_QUESTS,
  EVIDENCE_LABEL,
  PLACE_QUESTS,
  QUESTIVAL,
  QUESTS,
  TEAMS,
  getQuest,
  getTeam,
  questivalWindow,
  timeLeft,
  totalPoints,
  type Quest,
} from "@/lib/questival";
import { directionsUrl, getActivity } from "@/lib/weekend";
import { CameraIcon, PinIcon } from "@/components/forum/icons";
import { Faces, PlanIt } from "@/components/forum/ForumMobile";
import {
  ME,
  djb2,
  firstName,
  sample,
  shrinkImage,
  teamFor,
  teammates,
  timeShort,
  uid,
  type Final,
  type Media,
  type Person,
  type Plan,
  type SavedProof,
} from "@/components/forum/store";

function toProofs(saved: SavedProof[], approved: boolean) {
  return saved.map((p) => ({ questId: p.questId, instance: p.instance, status: approved ? ("approved" as const) : ("draft" as const) }));
}

/** Preview stand-in for a person's derived score. */
function samplePoints(name: string): number {
  return (djb2("pts" + name) % 19) * 10;
}

function StatusChip({ final, now, count }: { final: Final; now: number; count: number }) {
  const w = questivalWindow(now);
  if (final) {
    if (w === "closed") return <span className="alf-assignment-chip fm-chip-closed">Submitted · Closed</span>;
    if (final.extension) return <span className="alf-assignment-chip fm-chip-warn">Submitted · Extension used</span>;
    return <span className="alf-assignment-chip">Submitted · Editable until 5:00 PM</span>;
  }
  if (w === "closed") return <span className="alf-assignment-chip fm-chip-closed">Closed</span>;
  if (w === "extension") return <span className="alf-assignment-chip fm-chip-warn">Extension window · 7 min</span>;
  if (w === "before") return <span className="alf-assignment-chip fm-chip-closed">Opens Sat 10:00</span>;
  return <span className="alf-assignment-chip fm-chip-warn">{count ? `In progress · ${count} saved` : "Open"}</span>;
}

// ----- HUB -------------------------------------------------------------------

export function QuestivalHub({
  proofs,
  plans,
  people,
  final,
  now,
  onOpenQuest,
  onOpenMe,
  onOpenLive,
}: {
  proofs: SavedProof[];
  plans: Plan[];
  people: Person[];
  final: Final;
  now: number;
  onOpenQuest: (id: string) => void;
  onOpenMe: () => void;
  onOpenLive: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "todo" | "planned" | "saved" | "team">("all");
  const w = questivalWindow(now);
  const doneIds = new Set(proofs.map((p) => p.questId));
  const plannedIds = new Set(plans.filter((p) => p.kind === "quest").map((p) => p.targetId));
  const pts = totalPoints(toProofs(proofs, true));
  const total = QUESTS.length;

  const team = getTeam(teamFor(ME));
  const mates = teammates(people, ME);
  const teamPts = pts + mates.reduce((s, p) => s + samplePoints(p.name), 0);
  const teamRank = 1 + TEAMS.filter((t) => t.id !== team.id && teamTotal(people, t.id) > teamPts).length;

  const show = (q: Quest) =>
    filter === "all" ? true : filter === "saved" ? doneIds.has(q.id) : filter === "planned" ? plannedIds.has(q.id) : filter === "team" ? !!q.teamMin : !doneIds.has(q.id);

  const byArea = useMemo(() => {
    const m = new Map<string, Quest[]>();
    for (const q of PLACE_QUESTS) {
      const k = q.area ?? "Elsewhere";
      m.set(k, [...(m.get(k) ?? []), q]);
    }
    return [...m.entries()];
  }, []);

  return (
    <>
      <section className="alf-card">
        <div className="fm-team">
          <span className="fm-team-swatch" style={{ background: team.color }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="fm-team-name">Team {team.name}</div>
            <div className="fm-team-meta">{mates.length + 1} people · {ordinal(teamRank)} of {TEAMS.length} · {teamPts} pts</div>
          </div>
          <Faces people={mates} max={4} />
        </div>
        <p className="fm-muted" style={{ marginTop: 10 }}>
          Every point you earn counts for {team.name}, whoever you earn it with. Team quests need {" "}
          <b style={{ color: "#2e9e5b" }}>3+ teammates</b> tagged and are worth more.
        </p>
      </section>

      <section className="alf-card">
        <div className="fm-assign-head">
          <h2 className="alf-card-h" style={{ margin: 0 }}>Assignment 3: Questival</h2>
          <StatusChip final={final} now={now} count={proofs.length} />
        </div>
        <div className="fm-assign-due">
          Due {QUESTIVAL.dueLabel} · Weight 1x{w === "open" || w === "extension" ? ` · ${timeLeft(now)}` : ""}
        </div>
        <p className="alf-card-body">
          Pick your own adventure through the city. Plan what you want to do and with whom, capture as you go, and submit your
          final list before the bonfire. Everything is optional; every quest is points.
        </p>
        <div className="fm-progress"><span style={{ width: `${Math.min(100, (doneIds.size / total) * 100)}%` }} /></div>
        <div className="fm-stats">
          <span><b>{doneIds.size}</b> of {total} done</span>
          <span><b>{plannedIds.size}</b> planned</span>
          <span><b>{pts}</b> pts</span>
        </div>
        <div className="fm-btn-row">
          <button className="fm-btn fm-btn-primary" onClick={onOpenMe}>{final ? "My submission" : "My list"}</button>
          <button className="fm-btn" onClick={onOpenLive}>Leaderboard</button>
        </div>
      </section>

      <div className="fm-filters">
        {(["all", "todo", "planned", "saved", "team"] as const).map((f) => (
          <button key={f} className={`fm-filter${filter === f ? " fm-filter-on" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "todo" ? "Not done" : f === "planned" ? "Planned" : f === "saved" ? "Saved" : "Team quests"}
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
          {ANYWHERE_QUESTS.filter(show).map((q) => <QuestRow key={q.id} q={q} saved={doneIds.has(q.id)} planned={plannedIds.has(q.id)} final={!!final} onOpen={onOpenQuest} />)}
        </ul>
      </section>
    </>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function teamTotal(people: Person[], teamId: string): number {
  return people.filter((p) => teamFor(p.name) === teamId).reduce((s, p) => s + samplePoints(p.name), 0);
}

function QuestRow({ q, saved, planned, final, onOpen }: { q: Quest; saved: boolean; planned: boolean; final: boolean; onOpen: (id: string) => void }) {
  const dot = saved ? (final ? " fm-dot-done" : " fm-dot-saved") : planned ? " fm-dot-planned" : "";
  return (
    <li className="fm-quest" onClick={() => onOpen(q.id)}>
      <span className={`fm-dot${dot}`} />
      <span>
        <div className="fm-quest-title">
          {q.title}
          {q.teamMin && <span className="fm-kind fm-kind-team" style={{ marginLeft: 6, verticalAlign: "middle" }}>Team</span>}
        </div>
        <div className="fm-quest-meta">
          {q.venue ? `${q.venue} · ` : ""}{EVIDENCE_LABEL[q.evidence]}{q.repeat ? ` · up to ${q.repeat}×` : ""}{planned && !saved ? " · planned" : ""}
        </div>
      </span>
      <span className="fm-pts">{q.points}</span>
    </li>
  );
}

// ----- QUEST -----------------------------------------------------------------

export function QuestView({
  questId,
  people,
  proofs,
  plan,
  now,
  onSave,
  onPlan,
  onUnplan,
  onOpenMe,
}: {
  questId: string;
  people: Person[];
  proofs: SavedProof[];
  plan?: Plan;
  now: number;
  onSave: (p: SavedProof) => void;
  onPlan: (withNames: string[]) => void;
  onUnplan: (id: string) => void;
  onOpenMe: () => void;
}) {
  const q = getQuest(questId)!;
  const w = questivalWindow(now);
  const mine = proofs.filter((p) => p.questId === q.id);
  const cap = q.repeat ?? 1;
  const nextInstance = mine.length + 1;
  const canAdd = nextInstance <= cap && w !== "closed";
  const team = getTeam(teamFor(ME));

  const fileRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>(() => plan?.with ?? []);
  const [caption, setCaption] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);

  const accept = q.evidence === "video" ? "video/*" : q.evidence === "screenshot" ? "image/*" : "image/*,video/*";
  const multiple = q.evidence === "photo-pair";
  const needed = q.evidence === "photo-pair" ? 2 : 1;
  const teamTagged = 1 + tags.filter((n) => teamFor(n) === team.id).length;
  const teamShort = q.teamMin ? Math.max(0, q.teamMin - teamTagged) : 0;

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const next: Media[] = [];
      for (const f of Array.from(files)) {
        if (f.type.startsWith("video/")) next.push({ kind: "video", src: URL.createObjectURL(f) });
        else next.push({ kind: "image", src: await shrinkImage(f) });
      }
      setMedia((m) => [...m, ...next]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = () => {
    const proof: SavedProof = {
      id: uid(),
      questId: q.id,
      instance: nextInstance,
      at: now,
      caption: caption.trim(),
      members: tags,
      // Object URLs don't survive a reload; keep the kind so the list stays honest.
      media: media.map((m) => (m.kind === "video" ? { kind: "video" } : m)),
    };
    onSave(proof);
    setMedia([]);
    setCaption("");
    setReceipt(`Saved ${timeShort(now)}${tags.length ? ` · with ${tags.map(firstName).join(", ")}` : ""}`);
  };

  return (
    <>
      <section className="alf-card">
        <p className="fm-eyebrow">{q.venue ? `At a place · ${q.area ?? ""}` : "Anywhere"}{q.teamMin ? " · Team quest" : ""}</p>
        <div className="fm-assign-head" style={{ marginBottom: 8 }}>
          <h2 className="alf-card-h" style={{ margin: 0 }}>{q.title}</h2>
          <span className="fm-pts fm-pts-big">{q.points} pts</span>
        </div>
        <p className="fm-prompt">{q.prompt}</p>
        <div className="fm-detail-meta">
          <span><b>Proof</b> · {EVIDENCE_LABEL[q.evidence]}</span>
          {q.venue && <span><b>Where</b> · {q.venue}{q.address ? `, ${q.address}` : ""}</span>}
          {q.teamMin && <span><b>Team</b> · at least {q.teamMin} of Team {team.name} tagged, you included</span>}
          {q.repeat && <span><b>Repeats</b> · up to {q.repeat} times, {q.points} pts each</span>}
          {q.bonus && <span><b>Bonus</b> · {q.bonus}</span>}
        </div>
        {q.tip && <p className="fm-note">{q.tip}</p>}
        {q.address && (
          <div className="fm-btn-row">
            <a className="fm-btn fm-btn-blue" href={directionsUrl(q.address)} target="_blank" rel="noreferrer">
              <PinIcon /> Directions
            </a>
          </div>
        )}
      </section>

      {mine.length === 0 && (
        <PlanIt
          kind="quest"
          plan={plan}
          people={people}
          onPlan={onPlan}
          onUnplan={onUnplan}
          teamHint={q.teamMin ? `Team quest — rally ${q.teamMin - 1} from Team ${team.name}. Your teammates are first in the picker.` : undefined}
        />
      )}

      {mine.length > 0 && (
        <section className="alf-card">
          <h3 className="alf-card-h">On your list</h3>
          <div className="fm-thumbs">
            {mine.flatMap((p) => p.media.map((m, i) => <Thumb key={`${p.id}-${i}`} m={m} />))}
          </div>
          <p className="fm-muted" style={{ marginTop: 8 }}>
            {mine.length} saved{q.repeat ? ` of ${q.repeat}` : ""}. <button className="fm-link-btn" onClick={onOpenMe}>Open my list</button>
          </p>
        </section>
      )}

      {canAdd ? (
        <section className="alf-card">
          <h3 className="alf-card-h">{q.repeat && mine.length ? `Instance ${nextInstance} of ${cap}` : "Your proof"}</h3>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            capture={q.evidence === "screenshot" ? undefined : "environment"}
            multiple={multiple}
            hidden
            onChange={(e) => onFiles(e.target.files)}
          />
          <button className="fm-capture" onClick={() => fileRef.current?.click()} disabled={busy}>
            <CameraIcon />
            {busy ? "Reading…" : q.evidence === "video" ? "Record a video" : q.evidence === "screenshot" ? "Add a screenshot" : "Take a photo"}
            <small>{q.evidence === "photo-pair" ? "Pick the original and the recreation" : "or choose from your library"}</small>
          </button>
          {error && <p className="fm-note">{error}</p>}
          {media.length > 0 && (
            <div className="fm-thumbs">
              {media.map((m, i) => (
                <Thumb key={i} m={m} onRemove={() => setMedia(media.filter((_, j) => j !== i))} />
              ))}
            </div>
          )}

          <p className="fm-eyebrow" style={{ marginTop: 16 }}>Who did it with you</p>
          <TagPicker people={people} tags={tags} onChange={setTags} />
          {q.teamMin && (
            <p className={teamShort ? "fm-note" : "fm-receipt"} style={{ marginTop: 6 }}>
              {teamShort ? `${teamShort} more from Team ${team.name} needed for this to count.` : `✓ ${teamTagged} from Team ${team.name} — counts.`}
            </p>
          )}

          {q.evidence === "text-photo" ? (
            <textarea className="fm-input" rows={3} placeholder="Your line…" value={caption} onChange={(e) => setCaption(e.target.value)} style={{ marginTop: 10 }} />
          ) : (
            <input className="fm-input" placeholder="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} style={{ marginTop: 10 }} />
          )}

          <div className="fm-btn-row">
            <button className="fm-btn fm-btn-primary" disabled={media.length < needed || busy || teamShort > 0} onClick={save}>
              Save to my list
            </button>
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

function Thumb({ m, onRemove }: { m: Media; onRemove?: () => void }) {
  return (
    <div className="fm-thumb">
      {m.kind === "image" && m.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.src} alt="" />
      ) : m.kind === "video" && m.src ? (
        <video src={m.src} playsInline muted />
      ) : (
        <div className="fm-thumb-video" style={{ height: "100%" }}>VIDEO</div>
      )}
      {onRemove && <button className="fm-thumb-x" onClick={onRemove} aria-label="Remove">×</button>}
    </div>
  );
}

/** Faces to tag. Tagged first, then your team, then everyone else. */
export function TagPicker({ people, tags, onChange }: { people: Person[]; tags: string[]; onChange: (t: string[]) => void }) {
  const [query, setQuery] = useState("");
  const myTeam = teamFor(ME);
  const list = people.filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()));
  const rank = (p: Person) => (tags.includes(p.name) ? 0 : teamFor(p.name) === myTeam ? 1 : 2);
  const ordered = [...list].sort((a, b) => rank(a) - rank(b));
  return (
    <>
      <input className="fm-input" placeholder="Search the class…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 6 }} />
      <div className="fm-tags">
        {ordered.map((p) => {
          const on = tags.includes(p.name);
          const t = getTeam(teamFor(p.name));
          const mate = t.id === myTeam;
          return (
            <button
              key={p.name}
              className={`fm-tag${on ? " fm-tag-on" : ""}${mate ? " fm-tag-team" : ""}`}
              style={mate ? ({ "--team": t.color } as React.CSSProperties) : undefined}
              onClick={() => onChange(on ? tags.filter((x) => x !== p.name) : [...tags, p.name])}
            >
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

export function MyQuestival({
  proofs,
  plans,
  people,
  final,
  now,
  onRemove,
  onSubmitFinal,
  onOpenQuest,
  onOpenActivity,
}: {
  proofs: SavedProof[];
  plans: Plan[];
  people: Person[];
  final: Final;
  now: number;
  onRemove: (id: string) => void;
  onSubmitFinal: () => void;
  onOpenQuest: (id: string) => void;
  onOpenActivity: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const w = questivalWindow(now);
  const pts = totalPoints(toProofs(proofs, true));
  const withNames = [...new Set(proofs.flatMap((p) => p.members))];
  const withPeople = withNames.map((n) => people.find((p) => p.name === n) ?? { name: n, photo_url: null });
  const bonfire = getActivity("sat-bonfire")!;
  const editable = w === "open" || w === "extension" || w === "before";
  const doneIds = new Set(proofs.map((p) => p.questId));
  const planned = plans.filter((p) => !(p.kind === "quest" && doneIds.has(p.targetId)));
  const team = getTeam(teamFor(ME));

  return (
    <>
      <section className="alf-card">
        <div className="fm-assign-head">
          <h2 className="alf-card-h" style={{ margin: 0 }}>Assignment 3: Questival</h2>
          <StatusChip final={final} now={now} count={proofs.length} />
        </div>
        <div className="fm-assign-due">
          {final
            ? `Submitted ${timeShort(final.at)}${final.extension ? " · after the 7th minute" : ""}`
            : `Due ${QUESTIVAL.dueLabel} · Weight 1x`}
          {" · "}Team {team.name}
        </div>
        <div className="fm-stats" style={{ marginTop: 6 }}>
          <span><b>{proofs.length}</b> quests</span>
          <span><b>{pts}</b> pts for {team.name}</span>
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
            <button className="fm-btn fm-btn-primary" disabled={proofs.length === 0 || w === "closed"} onClick={() => setConfirming(true)}>
              Submit final list
            </button>
          </div>
        )}
        {!final && confirming && (
          <div className="alf-next-card" style={{ marginTop: 12 }}>
            <div className="alf-next-card-text">
              <span className="alf-next-card-eyebrow">Confirm</span>
              <span className="alf-next-card-title">{proofs.length} quests · {pts} pts{withPeople.length ? ` · with ${withPeople.map((p) => firstName(p.name)).join(", ")}` : ""}</span>
              <span className="alf-next-card-sub">Submit before the bonfire? You can still edit until 5:00 PM.</span>
            </div>
            <div className="alf-next-card-actions">
              <button className="alf-next-card-btn" onClick={() => { onSubmitFinal(); setConfirming(false); }}>Submit</button>
              <button className="alf-next-card-link" onClick={() => setConfirming(false)}>Not yet</button>
            </div>
          </div>
        )}
        {final && (
          <div className="fm-sealed">
            <div className="fm-sealed-big">Submitted.</div>
            <div className="fm-sealed-sub">
              {final.extension ? "Right at the deadline — in the Ani tradition." : "Grades released at dinner, around 8:30."}
            </div>
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
              const title = p.kind === "quest" ? getQuest(p.targetId)?.title : getActivity(p.targetId)?.title;
              const q = p.kind === "quest" ? getQuest(p.targetId) : undefined;
              return (
                <li key={p.id} className="fm-proof-row" onClick={() => (p.kind === "quest" ? onOpenQuest(p.targetId) : onOpenActivity(p.targetId))}>
                  <div className="fm-proof-thumb" style={{ background: "#f3f0e8", border: "1px dashed #c9c3b4" }}>
                    <div className="fm-proof-thumb-ph" style={{ color: "#8a8680" }}>PLAN</div>
                  </div>
                  <div>
                    <div className="fm-proof-title">{title}</div>
                    <div className="fm-proof-meta">{p.with.length ? `with ${p.with.map(firstName).join(", ")}` : "just you, for now"}</div>
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
        {proofs.length === 0 ? (
          <p className="fm-empty">Nothing saved yet. Open a quest and take a photo.</p>
        ) : (
          <ul className="fm-proofs">
            {proofs.map((p) => {
              const q = getQuest(p.questId)!;
              const first = p.media[0];
              return (
                <li key={p.id} className="fm-proof-row">
                  <div className="fm-proof-thumb" onClick={() => onOpenQuest(q.id)}>
                    {first?.kind === "image" && first.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={first.src} alt="" />
                    ) : (
                      <div className="fm-proof-thumb-ph">{first?.kind === "video" ? "VIDEO" : "—"}</div>
                    )}
                  </div>
                  <div onClick={() => onOpenQuest(q.id)}>
                    <div className="fm-proof-title">{q.title}{q.repeat ? ` · ${p.instance}` : ""}</div>
                    <div className="fm-proof-meta">
                      {timeShort(p.at)}{p.members.length ? ` · with ${p.members.map(firstName).join(", ")}` : ""}{p.caption ? ` · “${p.caption}”` : ""}
                    </div>
                  </div>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span className="fm-pts">{q.points}</span>
                    {editable && <button className="fm-proof-remove" onClick={() => onRemove(p.id)} aria-label="Remove">×</button>}
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

type FeedItem = { id: string; who: Person; withPeople: Person[]; quest: Quest; at: number; media?: Media; caption?: string };

function sampleFeed(people: Person[], now: number): FeedItem[] {
  if (people.length === 0) return [];
  const base = Math.min(now, QUESTIVAL.dueAt);
  return QUESTS.filter((q) => djb2("feed" + q.id) % 100 < 45)
    .map((q, i) => {
      const who = people[djb2("who" + q.id) % people.length];
      const withPeople = sample(people, "with" + q.id, 12).filter((p) => p !== who).slice(0, 3);
      return { id: `s-${q.id}`, who, withPeople, quest: q, at: base - (i + 1) * 17 * 60_000 };
    });
}

/** Ties share a rank (1, 1, 3), the way a scoreboard reads out loud. */
function rankRows<T extends { pts: number }>(rows: T[]): (T & { rank: number })[] {
  const out: (T & { rank: number })[] = [];
  rows.forEach((r, i) => {
    const prev = out[i - 1];
    out.push({ ...r, rank: prev && prev.pts === r.pts ? prev.rank : i + 1 });
  });
  return out;
}

export function LiveView({ proofs, people, now }: { proofs: SavedProof[]; people: Person[]; now: number }) {
  const [seg, setSeg] = useState<"teams" | "people" | "feed">("teams");
  const me: Person = { name: ME, photo_url: null };
  const myTeam = teamFor(ME);

  const feed: FeedItem[] = [
    ...proofs.map((p) => ({
      id: p.id,
      who: me,
      withPeople: p.members.map((n) => people.find((x) => x.name === n) ?? { name: n, photo_url: null }),
      quest: getQuest(p.questId)!,
      at: p.at,
      media: p.media[0],
      caption: p.caption,
    })),
    ...sampleFeed(people, now),
  ].sort((a, b) => b.at - a.at);

  const myPts = totalPoints(toProofs(proofs, true));
  const board = [
    ...people.map((p) => ({ p, pts: samplePoints(p.name), done: Math.round(samplePoints(p.name) / 15) })),
    { p: me, pts: myPts, done: proofs.length },
  ].sort((a, b) => b.pts - a.pts || a.p.name.localeCompare(b.p.name));
  const ranked = rankRows(board);

  const teams = rankRows(
    TEAMS.map((t) => {
      const members = people.filter((p) => teamFor(p.name) === t.id);
      const pts = members.reduce((s, p) => s + samplePoints(p.name), 0) + (t.id === myTeam ? myPts : 0);
      return { t, members, pts, size: members.length + (t.id === myTeam ? 1 : 0) };
    }).sort((a, b) => b.pts - a.pts),
  );

  return (
    <>
      <div className="fm-seg">
        <button className={`fm-seg-btn${seg === "teams" ? " fm-seg-on" : ""}`} onClick={() => setSeg("teams")}><b>Teams</b><span>the board</span></button>
        <button className={`fm-seg-btn${seg === "people" ? " fm-seg-on" : ""}`} onClick={() => setSeg("people")}><b>People</b><span>individual</span></button>
        <button className={`fm-seg-btn${seg === "feed" ? " fm-seg-on" : ""}`} onClick={() => setSeg("feed")}><b>Feed</b><span>as it lands</span></button>
      </div>

      {seg === "teams" && (
        <section className="alf-card">
          <h3 className="alf-card-h">Teams</h3>
          <table className="fm-board">
            <tbody>
              {teams.map((r) => (
                <tr key={r.t.id} className={r.t.id === myTeam ? "fm-board-me" : ""}>
                  <td className="fm-board-rank">{r.rank}</td>
                  <td>
                    <span className="fm-board-name">
                      <span className="fm-team-swatch" style={{ background: r.t.color }} />
                      {r.t.name}
                      <Faces people={r.members} max={4} />
                      <span className="fm-muted" style={{ fontSize: 11 }}>{r.size}</span>
                    </span>
                  </td>
                  <td className="fm-board-pts">{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fm-muted" style={{ marginTop: 10 }}>A team&apos;s score is the sum of its people. Prizes at dinner for the top team and the top three people.</p>
        </section>
      )}

      {seg === "people" && (
        <section className="alf-card">
          <h3 className="alf-card-h">People</h3>
          <table className="fm-board">
            <tbody>
              {ranked.map((r) => {
                const t = getTeam(teamFor(r.p.name));
                return (
                  <tr key={r.p.name} className={r.p === me ? "fm-board-me" : ""}>
                    <td className="fm-board-rank">{r.rank}</td>
                    <td>
                      <span className="fm-board-name">
                        {r.p.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.p.photo_url} alt="" loading="lazy" style={{ boxShadow: `0 0 0 2px ${t.color}` }} />
                        ) : (
                          <span className="fm-face" style={{ margin: 0, width: 26, height: 26, background: r.p === me ? "#2e9e5b" : undefined, boxShadow: `0 0 0 2px ${t.color}` }} />
                        )}
                        {r.p.name}
                        <span className="fm-muted" style={{ fontSize: 11 }}>{t.name} · {r.done} quests</span>
                      </span>
                    </td>
                    <td className="fm-board-pts">{r.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {seg === "feed" && (
        <ul className="fm-feed">
          {feed.length === 0 && <li className="fm-empty">Nothing yet. The class is still at breakfast.</li>}
          {feed.map((f) => (
            <li key={f.id} className="fm-card-proof">
              <div className="fm-card-proof-head">
                {f.who.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="fm-face-lg" src={f.who.photo_url} alt="" loading="lazy" />
                ) : (
                  <span className="fm-face fm-face-lg" style={{ margin: 0, background: "#2e9e5b" }} />
                )}
                <span className="fm-card-proof-who">
                  {firstName(f.who.name)}{f.withPeople.length ? ` + ${f.withPeople.map((p) => firstName(p.name)).join(", ")}` : ""}
                </span>
                <span className="fm-card-proof-time">{timeShort(f.at)}</span>
              </div>
              <div className="fm-card-proof-media">
                {f.media?.kind === "image" && f.media.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.media.src} alt="" />
                ) : (
                  <div className="fm-card-proof-ph">
                    <small>{f.media?.kind === "video" ? "Video" : "Proof"}</small>
                    {f.quest.title}
                  </div>
                )}
              </div>
              <div className="fm-card-proof-foot">
                <span>{f.quest.title}{f.caption ? ` · “${f.caption}”` : ""}</span>
                <span className="fm-pts">+{f.quest.points} {getTeam(teamFor(f.who.name)).name}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
