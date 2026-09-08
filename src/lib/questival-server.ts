// Server-only: row → DTO builders and the board math shared by the
// /api/questival routes. The gate and the small joins live in forum-server.ts.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { must, personMap, personOf, publicMediaUrl } from "@/lib/forum-server";
import type { BoardRow, CatchupDTO, MediaDTO, PersonDTO, PlanDTO, QuestDTO, SubmissionDTO } from "@/lib/questival-api";

// --------------------------------------------------------- submissions

export type SubmissionRow = {
  id: string;
  quest_id: string;
  instance: number;
  uploader_rsvp_id: string;
  members: string[];
  media: { path: string; type: "image" | "video" }[];
  caption: string | null;
  note: string | null;
  status: "approved" | "rejected";
  points_override: number | null;
  review_note: string | null;
  created_at: string;
};

export const SUBMISSION_COLUMNS =
  "id, quest_id, instance, uploader_rsvp_id, members, media, caption, note, status, points_override, review_note, created_at";

/** What one proof is worth: 0 when rejected, else override ?? quest points. */
export function submissionPoints(row: SubmissionRow, quests: Map<string, QuestDTO>): number {
  if (row.status !== "approved") return 0;
  if (typeof row.points_override === "number") return row.points_override;
  const q = quests.get(row.quest_id);
  return q && q.status !== "archived" ? q.points : 0;
}

export function mediaDTOs(supabase: SupabaseClient, media: SubmissionRow["media"]): MediaDTO[] {
  return (Array.isArray(media) ? media : []).map((m) => ({ path: m.path, type: m.type, url: publicMediaUrl(supabase, m.path) }));
}

/** Whitelisted DTOs: names and photos only, never emails. */
export async function submissionDTOs(
  supabase: SupabaseClient,
  rows: SubmissionRow[],
  quests: Map<string, QuestDTO>,
): Promise<SubmissionDTO[]> {
  const ids = rows.flatMap((r) => [r.uploader_rsvp_id, ...(r.members ?? [])]);
  const people = await personMap(supabase, ids);
  return rows.map((r) => ({
    id: r.id,
    quest_id: r.quest_id,
    instance: r.instance,
    uploader: personOf(people, r.uploader_rsvp_id),
    members: (r.members ?? []).map((id) => personOf(people, id)),
    media: mediaDTOs(supabase, r.media),
    caption: r.caption ?? null,
    note: r.note ?? null,
    status: r.status,
    points: submissionPoints(r, quests),
    review_note: r.review_note ?? null,
    created_at: new Date(r.created_at).toISOString(),
  }));
}

/** Fetch one submission by id as a DTO (null when absent). */
export async function submissionById(
  supabase: SupabaseClient,
  id: string,
  quests: Map<string, QuestDTO>,
): Promise<SubmissionDTO | null> {
  const row = must(await supabase.from("q_submissions").select(SUBMISSION_COLUMNS).eq("id", id).maybeSingle()) as SubmissionRow | null;
  if (!row) return null;
  return (await submissionDTOs(supabase, [row], quests))[0];
}

// --------------------------------------------------------------- board

/**
 * Per person: best approved proof per (quest, instance), instances capped
 * by the quest's `repeat`; everyone tagged is credited. Ties share a rank
 * (1, 1, 3). Derived on every read; a few hundred rows at most.
 */
export function boardRows(rows: SubmissionRow[], quests: Map<string, QuestDTO>, people: Map<string, PersonDTO>): BoardRow[] {
  const best = new Map<string, Map<string, number>>(); // person → quest#instance → points
  for (const r of rows) {
    if (r.status !== "approved") continue;
    const q = quests.get(r.quest_id);
    const cap = q?.repeat ?? 1;
    if (r.instance < 1 || r.instance > cap) continue;
    const pts = submissionPoints(r, quests);
    const key = `${r.quest_id}#${r.instance}`;
    for (const id of new Set([r.uploader_rsvp_id, ...(r.members ?? [])])) {
      let mine = best.get(id);
      if (!mine) best.set(id, (mine = new Map()));
      mine.set(key, Math.max(mine.get(key) ?? 0, pts));
    }
  }
  const out: BoardRow[] = [];
  for (const person of people.values()) {
    const mine = best.get(person.id);
    let points = 0;
    let completed = 0;
    for (const v of mine?.values() ?? []) {
      points += v;
      if (v > 0) completed += 1;
    }
    out.push({ person, points, completed, rank: 0 });
  }
  out.sort((a, b) => b.points - a.points || b.completed - a.completed || a.person.name.localeCompare(b.person.name));
  out.forEach((row, i) => {
    row.rank = i > 0 && out[i - 1].points === row.points ? out[i - 1].rank : i + 1;
  });
  return out;
}

// --------------------------------------------------------------- plans

export type PlanRow = { id: string; rsvp_id: string; kind: "quest" | "activity"; target_id: string; with_rsvp_ids: string[]; created_at: string };
type ReplyRow = { plan_id: string; rsvp_id: string; reply: "in" | "maybe" };

export const PLAN_COLUMNS = "id, rsvp_id, kind, target_id, with_rsvp_ids, created_at";

export async function planDTOs(supabase: SupabaseClient, rows: PlanRow[]): Promise<PlanDTO[]> {
  if (rows.length === 0) return [];
  const [people, replies] = await Promise.all([
    personMap(supabase, rows.flatMap((r) => [r.rsvp_id, ...(r.with_rsvp_ids ?? [])])),
    supabase.from("q_plan_replies").select("plan_id, rsvp_id, reply").in("plan_id", rows.map((r) => r.id)),
  ]);
  const byPlan = new Map<string, Record<string, "in" | "maybe">>();
  for (const r of (must(replies) ?? []) as ReplyRow[]) {
    const m = byPlan.get(r.plan_id) ?? {};
    m[r.rsvp_id] = r.reply;
    byPlan.set(r.plan_id, m);
  }
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    target_id: r.target_id,
    owner: personOf(people, r.rsvp_id),
    with: (r.with_rsvp_ids ?? []).map((id) => personOf(people, id)),
    replies: byPlan.get(r.id) ?? {},
    created_at: new Date(r.created_at).toISOString(),
  }));
}

// ------------------------------------------------------------ catchups

export type CatchupRow = { id: string; from_rsvp: string; to_rsvp: string; slot: string; note: string | null; status: CatchupDTO["status"]; created_at: string };

export const CATCHUP_COLUMNS = "id, from_rsvp, to_rsvp, slot, note, status, created_at";

export async function catchupDTOs(supabase: SupabaseClient, rows: CatchupRow[]): Promise<CatchupDTO[]> {
  if (rows.length === 0) return [];
  const people = await personMap(supabase, rows.flatMap((r) => [r.from_rsvp, r.to_rsvp]));
  return rows.map((r) => ({
    id: r.id,
    from: personOf(people, r.from_rsvp),
    to: personOf(people, r.to_rsvp),
    slot: r.slot,
    note: r.note ?? null,
    status: r.status,
    created_at: new Date(r.created_at).toISOString(),
  }));
}
