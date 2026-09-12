"use client";

import { useCallback, useEffect, useState } from "react";
import { EVIDENCE_LABEL, type Evidence } from "@/lib/questival";
import { useForumStore } from "@/components/forum/ForumStore";
import { Feed } from "@/components/forum/Questival";
import { getAccessToken } from "@/lib/auth";
import type { CatalogResponse, PeopleResponse, QuestDTO, ReviewResponse, SubmissionDTO, UpsertQuestRequest } from "@/lib/questival-api";
import { firstName, timeShort } from "@/components/forum/store";

/**
 * Organizers: add and finalize quests, moderate proofs, set the announcement
 * and the clock, release results. Same on phone and desktop (inside ALF).
 * Everything here talks straight to /api/questival/admin/*.
 */
async function call<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error ?? `Request failed (${res.status})`), { code: body.code });
  return body as T;
}

const EVIDENCES: Evidence[] = ["photo", "video", "photo-pair", "text-photo", "screenshot"];

export function AdminView() {
  const { organizer, mode, localReason, setToast, refresh } = useForumStore();
  const [tab, setTab] = useState<"quests" | "review" | "settings" | "people">("quests");
  const [error, setError] = useState<string | null>(null);

  if (!organizer) {
    return (
      <section className="alf-card"><p className="fm-empty">Organizers only.</p></section>
    );
  }

  return (
    <>
      {mode !== "api" && (
        <div className="fm-announce">
          <b>Not live yet.</b>{" "}
          {localReason === "tables-missing"
            ? "Run sql/questival.sql in the Supabase SQL editor, then reload. Until then this page can't save."
            : localReason === "no-rsvp"
              ? "Your Google account isn't tied to an RSVP row, so writes are disabled. Sign in with the account you RSVP'd with."
              : "Sign in to manage Questival."}
        </div>
      )}
      {error && <div className="fm-note" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="fm-seg" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {(["quests", "review", "settings", "people"] as const).map((t) => (
          <button key={t} className={`fm-seg-btn${tab === t ? " fm-seg-on" : ""}`} onClick={() => setTab(t)}>
            <b>{t === "quests" ? "Quests" : t === "review" ? "Review" : t === "settings" ? "Settings" : "People"}</b>
          </button>
        ))}
      </div>
      {tab === "quests" && <QuestsAdmin onError={setError} onSaved={() => { setToast("Saved"); refresh(); }} />}
      {tab === "review" && <ReviewAdmin onError={setError} />}
      {tab === "settings" && <SettingsAdmin onError={setError} onSaved={() => { setToast("Saved"); refresh(); }} />}
      {tab === "people" && <PeopleAdmin onError={setError} />}
    </>
  );
}

// ----- Quests ----------------------------------------------------------------

const EMPTY: UpsertQuestRequest = { title: "", prompt: "", points: 10, evidence: "photo", status: "draft" };

function QuestsAdmin({ onError, onSaved }: { onError: (e: string | null) => void; onSaved: () => void }) {
  const [quests, setQuests] = useState<QuestDTO[]>([]);
  const [editing, setEditing] = useState<UpsertQuestRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    call<CatalogResponse>("/api/questival/catalog").then((c) => setQuests(c.quests)).catch((e) => onError(e.message));
  }, [onError]);
  useEffect(load, [load]);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    onError(null);
    try {
      await call("/api/questival/admin/quests", { method: "POST", json: editing });
      setEditing(null);
      load();
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  };
  const archive = async (id: string) => {
    if (!confirm("Archive this quest? It disappears from the catalog; existing proofs stay.")) return;
    try {
      await call(`/api/questival/admin/quests?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      load();
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't archive");
    }
  };
  const setStatus = async (q: QuestDTO, status: QuestDTO["status"]) => {
    try {
      await call("/api/questival/admin/quests", { method: "POST", json: { ...q, status } });
      load();
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't update");
    }
  };

  const live = quests.filter((q) => q.status === "live");
  const draft = quests.filter((q) => q.status === "draft");

  return (
    <>
      <section className="alf-card">
        <div className="fm-assign-head">
          <h3 className="alf-card-h" style={{ margin: 0 }}>Quests</h3>
          <span className="fm-muted">{live.length} live · {draft.length} draft</span>
          <button className="fm-btn fm-btn-blue" style={{ marginLeft: "auto", padding: "7px 12px" }} onClick={() => setEditing({ ...EMPTY })}>+ New quest</button>
        </div>
        <p className="fm-muted" style={{ marginTop: 6 }}>
          Draft quests are only visible here. Set them live when the wording and points are final. Edits to a live quest apply immediately.
        </p>
      </section>

      {editing && (
        <section className="alf-card fm-admin-form">
          <h3 className="alf-card-h">{editing.id ? `Edit · ${editing.id}` : "New quest"}</h3>
          <label className="fm-field"><span>Title</span><input className="fm-input" value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></label>
          <label className="fm-field"><span>Prompt</span><textarea className="fm-input" rows={3} value={editing.prompt ?? ""} onChange={(e) => setEditing({ ...editing, prompt: e.target.value })} /></label>
          <div className="fm-field-row">
            <label className="fm-field"><span>Points</span><input className="fm-input" type="number" min={1} max={200} value={editing.points ?? 10} onChange={(e) => setEditing({ ...editing, points: Number(e.target.value) })} /></label>
            <label className="fm-field"><span>Proof</span>
              <select className="fm-input" value={editing.evidence ?? "photo"} onChange={(e) => setEditing({ ...editing, evidence: e.target.value as Evidence })}>
                {EVIDENCES.map((ev) => <option key={ev} value={ev}>{EVIDENCE_LABEL[ev]}</option>)}
              </select>
            </label>
            <label className="fm-field"><span>Repeats</span><input className="fm-input" type="number" min={1} max={10} value={editing.repeat ?? 1} onChange={(e) => setEditing({ ...editing, repeat: Number(e.target.value) > 1 ? Number(e.target.value) : undefined })} /></label>
          </div>
          <div className="fm-field-row">
            <label className="fm-field"><span>Venue (blank = anywhere)</span><input className="fm-input" value={editing.venue ?? ""} onChange={(e) => setEditing({ ...editing, venue: e.target.value || undefined })} /></label>
            <label className="fm-field"><span>Area</span><input className="fm-input" value={editing.area ?? ""} onChange={(e) => setEditing({ ...editing, area: e.target.value || undefined })} /></label>
          </div>
          <label className="fm-field"><span>Address (for Directions)</span><input className="fm-input" value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value || undefined })} /></label>
          <div className="fm-field-row">
            <label className="fm-field"><span>Lat</span><input className="fm-input" type="number" step="0.0001" value={editing.lat ?? ""} onChange={(e) => setEditing({ ...editing, lat: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
            <label className="fm-field"><span>Lng</span><input className="fm-input" type="number" step="0.0001" value={editing.lng ?? ""} onChange={(e) => setEditing({ ...editing, lng: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
          </div>
          <div className="fm-field-row">
            <label className="fm-field"><span>Bonus line</span><input className="fm-input" value={editing.bonus ?? ""} onChange={(e) => setEditing({ ...editing, bonus: e.target.value || undefined })} /></label>
            <label className="fm-field"><span>Tip / rule</span><input className="fm-input" value={editing.tip ?? ""} onChange={(e) => setEditing({ ...editing, tip: e.target.value || undefined })} /></label>
          </div>
          <label className="fm-field"><span>Status</span>
            <select className="fm-input" value={editing.status ?? "draft"} onChange={(e) => setEditing({ ...editing, status: e.target.value as QuestDTO["status"] })}>
              <option value="draft">Draft (organizers only)</option>
              <option value="live">Live (everyone)</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <div className="fm-btn-row">
            <button className="fm-btn fm-btn-primary" disabled={busy || !editing.title || !editing.prompt} onClick={save}>{busy ? "Saving…" : "Save"}</button>
            <button className="fm-btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </section>
      )}

      {[["Live", live], ["Draft", draft]].map(([label, list]) => (
        <section key={label as string} className="alf-card">
          <h3 className="alf-card-h">{label as string}</h3>
          {(list as QuestDTO[]).length === 0 ? (
            <p className="fm-empty">None.</p>
          ) : (
            <ul className="fm-quests">
              {(list as QuestDTO[]).map((q) => (
                <li key={q.id} className="fm-quest" style={{ cursor: "default", gridTemplateColumns: "1fr auto" }}>
                  <span>
                    <div className="fm-quest-title">{q.title}{q.custom && <span className="fm-kind fm-kind-peer" style={{ marginLeft: 6 }}>edited</span>}</div>
                    <div className="fm-quest-meta">{q.venue ? `${q.venue} · ` : "Anywhere · "}{EVIDENCE_LABEL[q.evidence]} · {q.points} pts{q.repeat ? ` · ×${q.repeat}` : ""}</div>
                  </span>
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button className="fm-link-btn" onClick={() => setEditing({ ...q })}>Edit</button>
                    {q.status === "draft" ? (
                      <button className="fm-link-btn" onClick={() => setStatus(q, "live")}>Set live</button>
                    ) : (
                      <button className="fm-link-btn" onClick={() => setStatus(q, "draft")}>Unpublish</button>
                    )}
                    <button className="fm-link-btn" style={{ color: "#c0392b" }} onClick={() => archive(q.id)}>Archive</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

// ----- Review ----------------------------------------------------------------

function ReviewAdmin({ onError }: { onError: (e: string | null) => void }) {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [filter, setFilter] = useState<"all" | "rejected">("all");
  const load = useCallback(() => {
    call<ReviewResponse>("/api/questival/admin/review").then(setData).catch((e) => onError(e.message));
  }, [onError]);
  useEffect(load, [load]);

  const patch = async (s: SubmissionDTO, body: { status?: "approved" | "rejected"; points_override?: number | null; review_note?: string | null }) => {
    try {
      await call(`/api/questival/submissions/${s.id}`, { method: "PATCH", json: body });
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't update");
    }
  };

  const items = (data?.submissions ?? []).filter((s) => filter === "all" || s.status === "rejected");

  return (
    <>
      <section className="alf-card">
        <div className="fm-assign-head">
          <h3 className="alf-card-h" style={{ margin: 0 }}>Proofs</h3>
          <span className="fm-muted">{data?.submissions.length ?? 0} total · {data?.finals.length ?? 0} final lists submitted</span>
        </div>
        <div className="fm-filters" style={{ marginTop: 10, marginBottom: 0 }}>
          <button className={`fm-filter${filter === "all" ? " fm-filter-on" : ""}`} onClick={() => setFilter("all")}>All</button>
          <button className={`fm-filter${filter === "rejected" ? " fm-filter-on" : ""}`} onClick={() => setFilter("rejected")}>Rejected</button>
          <button className="fm-filter" onClick={load}>Refresh</button>
        </div>
      </section>
      {items.length === 0 ? (
        <section className="alf-card"><p className="fm-empty">Nothing to review yet.</p></section>
      ) : (
        <ul className="fm-feed">
          {items.map((s) => (
            <li key={s.id} className="fm-card-proof">
              <Feed items={[s]} />
              <div className="fm-card-proof-foot" style={{ borderTop: "1px solid #efeadf", flexWrap: "wrap", gap: 8 }}>
                <span className="fm-muted">{s.status === "rejected" ? "Rejected" : "Counts"}{s.review_note ? ` · ${s.review_note}` : ""}</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  {s.status === "approved" ? (
                    <button className="fm-link-btn" style={{ color: "#c0392b" }} onClick={() => { const note = prompt("Why? (shown to them)") ?? ""; patch(s, { status: "rejected", review_note: note || null }); }}>Reject</button>
                  ) : (
                    <button className="fm-link-btn" onClick={() => patch(s, { status: "approved", review_note: null })}>Approve</button>
                  )}
                  <button className="fm-link-btn" onClick={() => { const v = prompt("Points for this proof (blank = quest default)"); if (v === null) return; patch(s, { points_override: v.trim() === "" ? null : Number(v) }); }}>Points</button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ----- Settings --------------------------------------------------------------

function toLocalInput(iso: string): string {
  // ISO → "YYYY-MM-DDTHH:MM" in San Francisco time for a datetime-local input.
  const d = new Date(iso);
  // hourCycle h23, not hour12:false — the latter renders midnight as "24:00", which datetime-local rejects.
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
function fromLocalInput(v: string): string {
  return new Date(`${v}:00-07:00`).toISOString();
}

function SettingsAdmin({ onError, onSaved }: { onError: (e: string | null) => void; onSaved: () => void }) {
  const { settings } = useForumStore();
  const [announcement, setAnnouncement] = useState(settings.announcement ?? "");
  const [opens, setOpens] = useState(toLocalInput(settings.opens_at));
  const [due, setDue] = useState(toLocalInput(settings.due_at));
  const [ext, setExt] = useState(toLocalInput(settings.extension_until));
  const [busy, setBusy] = useState(false);

  const save = async (extra?: { release_results?: boolean; freeze?: boolean }) => {
    setBusy(true);
    onError(null);
    try {
      await call("/api/questival/admin/settings", {
        method: "POST",
        json: { announcement: announcement.trim() || null, opens_at: fromLocalInput(opens), due_at: fromLocalInput(due), extension_until: fromLocalInput(ext), ...extra },
      });
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="alf-card fm-admin-form">
        <h3 className="alf-card-h">Announcement</h3>
        <p className="fm-muted">One line, shown at the top of everyone&apos;s Home and Questival. Blank to clear.</p>
        <textarea className="fm-input" rows={2} value={announcement} onChange={(e) => setAnnouncement(e.target.value)} placeholder="Common Space address is up — see Doors at 18:00." />
      </section>
      <section className="alf-card fm-admin-form">
        <h3 className="alf-card-h">The clock</h3>
        <p className="fm-muted">San Francisco time. The 7-minute extension is the ALF joke; keep it.</p>
        <div className="fm-field-row">
          <label className="fm-field"><span>Opens</span><input className="fm-input" type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} /></label>
          <label className="fm-field"><span>Due</span><input className="fm-input" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></label>
          <label className="fm-field"><span>Extension until</span><input className="fm-input" type="datetime-local" value={ext} onChange={(e) => setExt(e.target.value)} /></label>
        </div>
        <div className="fm-btn-row">
          <button className="fm-btn fm-btn-primary" disabled={busy} onClick={() => save()}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </section>
      <section className="alf-card">
        <h3 className="alf-card-h">Results</h3>
        <p className="fm-muted">
          {settings.frozen_at ? `Board frozen ${timeShort(settings.frozen_at)}. ` : "Freeze stops late edits from moving the board. "}
          {settings.results_released_at ? `Results released ${timeShort(settings.results_released_at)}.` : "Release shows everyone their grade card."}
        </p>
        <div className="fm-btn-row">
          <button className="fm-btn" disabled={busy || !!settings.frozen_at} onClick={() => confirm("Freeze the board now?") && save({ freeze: true })}>Freeze board</button>
          <button className="fm-btn fm-btn-going" disabled={busy || !!settings.results_released_at} onClick={() => confirm("Release results to everyone?") && save({ release_results: true })}>Release results</button>
        </div>
      </section>
    </>
  );
}

// ----- People ----------------------------------------------------------------

function PeopleAdmin({ onError }: { onError: (e: string | null) => void }) {
  const [data, setData] = useState<PeopleResponse | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    call<PeopleResponse>("/api/questival/admin/people").then(setData).catch((e) => onError(e.message));
  }, [onError]);
  const list = (data?.people ?? []).filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.email ?? "").includes(q.toLowerCase()));
  return (
    <section className="alf-card">
      <h3 className="alf-card-h">People · {data?.people.length ?? "…"}</h3>
      <input className="fm-input" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
      <ul className="fm-quests">
        {list.map((p) => (
          <li key={p.id} className="fm-quest" style={{ cursor: "default", gridTemplateColumns: "28px 1fr auto" }}>
            {p.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photo_url} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <span className="fm-face" style={{ margin: 0, width: 26, height: 26 }} />
            )}
            <span>
              <div className="fm-quest-title">{p.name}{p.organizer && <span className="fm-kind fm-kind-anchor" style={{ marginLeft: 6 }}>Organizer</span>}</div>
              <div className="fm-quest-meta">{p.email ?? "no email on the RSVP"} · {p.status}</div>
            </span>
            <span className="fm-muted" style={{ fontSize: 11 }}>{firstName(p.name)}</span>
          </li>
        ))}
      </ul>
      <p className="fm-muted" style={{ marginTop: 10 }}>To make someone an organizer, add their email to ORGANIZER_EMAILS on Vercel and redeploy.</p>
    </section>
  );
}
