// Server-only: row → DTO builders and the board math shared by the
// /api/questival routes. The gate and the small joins live in forum-server.ts.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { must, personMap, personOf, publicMediaUrl, tablesMissing } from "@/lib/forum-server";
import { shift3Points, type Shift3Proof } from "@/lib/questival";
import type { BoardRow, CatchupDTO, MediaDTO, PersonDTO, PlanDTO, QuestDTO, SettingsDTO, SubmissionDTO } from "@/lib/questival-api";

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
  created_at: string;
};

export const SUBMISSION_COLUMNS = "id, quest_id, instance, uploader_rsvp_id, members, media, caption, note, status, created_at";

/** Who is reading: decides whose Shift 3 the `shift3_by_me` flag reflects. */
export type Viewer = { id: string | null; organizer: boolean };

/** A proof landed before opens_at is saved but never scores ("scoring opens Sat 10:00"). */
export function beforeOpen(row: Pick<SubmissionRow, "created_at">, settings: SettingsDTO): boolean {
  return Date.parse(row.created_at) < Date.parse(settings.opens_at);
}

/** What one proof is worth: 0 when rejected or pre-open, else the catalog value. */
export function submissionPoints(row: SubmissionRow, quests: Map<string, QuestDTO>, settings: SettingsDTO): number {
  if (row.status !== "approved") return 0;
  if (beforeOpen(row, settings)) return 0;
  const q = quests.get(row.quest_id);
  return q && q.status !== "archived" ? q.points : 0;
}

/** Everyone credited on a proof: the uploader plus whoever was tagged. */
export function creditedOn(row: SubmissionRow): string[] {
  return [...new Set([row.uploader_rsvp_id, ...(row.members ?? [])])];
}

type Shift3Row = { submission_id: string; giver_rsvp_id: string };

/** PostgREST caps an unbounded select at 1000 rows, so hearts are always paged. */
const SHIFT3_PAGE = 1000;
/** Above this many proofs, ask for the table rather than put every uuid in the URL. */
const SHIFT3_IN_LIMIT = 100;

/**
 * Shift 3 rows, paged.
 *
 * Hearts are uncapped, so even a single feed page of popular proofs can carry
 * more than one PostgREST page (30 proofs x 40 hearts already does) — paging
 * is what stops the count silently truncating at 1000 and under-paying
 * people. `ids` narrows to the proofs actually on screen, which is the
 * 20-second polling path and hits the submission_id index; the organizer desk
 * reads 2000 proofs at once, too many for the URL, so it takes the whole
 * table and filters in memory. `before` mirrors the board's freeze cutoff.
 */
async function shift3Rows(supabase: SupabaseClient, ids: string[] | null, before?: string | null): Promise<Shift3Row[]> {
  const out: Shift3Row[] = [];
  for (let from = 0; ; from += SHIFT3_PAGE) {
    let q = supabase
      .from("q_shift3")
      .select("submission_id, giver_rsvp_id")
      .order("submission_id")
      .order("giver_rsvp_id")
      .range(from, from + SHIFT3_PAGE - 1);
    if (ids) q = q.in("submission_id", ids);
    if (before) q = q.lt("created_at", before);
    const res = await q;
    // q_shift3 ships with sql/questival.sql. Until that has run, a proof just
    // has no hearts — reads must not 503 and take the feed, the board and
    // everyone's own list down with them. The write route still fails loudly.
    if (res.error) {
      if (tablesMissing(res.error)) return [];
      throw res.error;
    }
    const rows = (res.data ?? []) as Shift3Row[];
    out.push(...rows);
    if (rows.length < SHIFT3_PAGE) return out;
  }
}

/** Hearts per proof, plus whether the viewer already gave one. */
export async function shift3Map(
  supabase: SupabaseClient,
  submissionIds: string[],
  viewerId: string | null,
  opts: { before?: string | null } = {},
): Promise<Map<string, { count: number; mine: boolean }>> {
  const out = new Map<string, { count: number; mine: boolean }>();
  if (submissionIds.length === 0) return out;
  const wanted = new Set(submissionIds);
  const ids = wanted.size <= SHIFT3_IN_LIMIT ? [...wanted] : null;

  for (const r of await shift3Rows(supabase, ids, opts.before)) {
    if (!wanted.has(r.submission_id)) continue;
    const e = out.get(r.submission_id) ?? { count: 0, mine: false };
    e.count += 1;
    if (viewerId !== null && r.giver_rsvp_id === viewerId) e.mine = true;
    out.set(r.submission_id, e);
  }
  return out;
}

export function mediaDTOs(supabase: SupabaseClient, media: SubmissionRow["media"]): MediaDTO[] {
  return (Array.isArray(media) ? media : []).map((m) => ({ path: m.path, type: m.type, url: publicMediaUrl(supabase, m.path) }));
}

/** Whitelisted DTOs: names and photos only, never emails. */
export async function submissionDTOs(
  supabase: SupabaseClient,
  rows: SubmissionRow[],
  quests: Map<string, QuestDTO>,
  opts: { settings: SettingsDTO; viewer: Viewer },
): Promise<SubmissionDTO[]> {
  const ids = rows.flatMap((r) => [r.uploader_rsvp_id, ...(r.members ?? [])]);
  const { settings, viewer } = opts;
  const [people, hearts] = await Promise.all([
    personMap(supabase, ids),
    shift3Map(supabase, rows.map((r) => r.id), viewer.id),
  ]);
  return rows.map((r) => {
    const h = hearts.get(r.id);
    return {
      id: r.id,
      quest_id: r.quest_id,
      instance: r.instance,
      uploader: personOf(people, r.uploader_rsvp_id),
      members: (r.members ?? []).map((id) => personOf(people, id)),
      media: mediaDTOs(supabase, r.media),
      caption: r.caption ?? null,
      note: r.note ?? null,
      status: r.status,
      points: submissionPoints(r, quests, settings),
      shift3: h?.count ?? 0,
      shift3_by_me: h?.mine ?? false,
      created_at: new Date(r.created_at).toISOString(),
    };
  });
}

/** Fetch one submission by id as a DTO (null when absent). */
export async function submissionById(
  supabase: SupabaseClient,
  id: string,
  quests: Map<string, QuestDTO>,
  opts: { settings: SettingsDTO; viewer: Viewer },
): Promise<SubmissionDTO | null> {
  const row = must(await supabase.from("q_submissions").select(SUBMISSION_COLUMNS).eq("id", id).maybeSingle()) as SubmissionRow | null;
  if (!row) return null;
  return (await submissionDTOs(supabase, [row], quests, opts))[0];
}

// --------------------------------------------------------------- board

/**
 * Per person: best approved proof per (quest, instance), instances capped
 * by the quest's `repeat`; everyone tagged is credited. Ties share a rank
 * (1, 1, 3). Derived on every read; a few hundred rows at most.
 *
 * Shift 3 points are added on top, tallied by shift3Points() so they sit
 * outside the best-per-quest rule — a repeat proof scores no quest points
 * but keeps the hearts it drew. Pass `shift3` as proof id → heart count.
 */
export function boardRows(
  rows: SubmissionRow[],
  quests: Map<string, QuestDTO>,
  people: Map<string, PersonDTO>,
  settings: SettingsDTO,
  shift3: Map<string, number> = new Map(),
): BoardRow[] {
  const best = new Map<string, Map<string, number>>(); // person → quest#instance → points
  // Pre-open proofs never score, so their hearts don't either.
  const heartProofs: Shift3Proof[] = rows
    .filter((r) => !beforeOpen(r, settings))
    .map((r) => ({ status: r.status, members: creditedOn(r), shift3: shift3.get(r.id) ?? 0 }));
  for (const r of rows) {
    if (r.status !== "approved") continue;
    const q = quests.get(r.quest_id);
    const cap = q?.repeat ?? 1;
    if (r.instance < 1 || r.instance > cap) continue;
    const pts = submissionPoints(r, quests, settings);
    const key = `${r.quest_id}#${r.instance}`;
    for (const id of creditedOn(r)) {
      let mine = best.get(id);
      if (!mine) best.set(id, (mine = new Map()));
      mine.set(key, Math.max(mine.get(key) ?? 0, pts));
    }
  }
  const out: BoardRow[] = [];
  for (const person of people.values()) {
    const mine = best.get(person.id);
    let quest = 0;
    let completed = 0;
    for (const v of mine?.values() ?? []) {
      quest += v;
      if (v > 0) completed += 1;
    }
    const hearts = shift3Points(heartProofs, person.id);
    out.push({ person, points: quest + hearts, completed, rank: 0, shift3: hearts });
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
