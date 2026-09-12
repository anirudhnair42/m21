import { JOINED, getSettings, handler, json, mergedCatalog, must, questMap, requireCaller, toPerson } from "@/lib/forum-server";
import { SUBMISSION_COLUMNS, boardRows, shift3Map, type SubmissionRow } from "@/lib/questival-server";
import type { BoardResponse, PersonDTO } from "@/lib/questival-api";

/**
 * The leaderboard, derived on every read from approved proofs plus the Shift
 * 3 hearts they drew. Everyone with a confirmed RSVP is listed so "where am
 * I" always has an answer. Once results are frozen, only proofs — and hearts
 * — from before frozen_at count.
 */
export const GET = handler(async (request) => {
  const { supabase } = await requireCaller(request);
  const settings = await getSettings(supabase);

  // Pre-open proofs never score (see submissionPoints); skipping them here keeps the query small.
  let q = supabase.from("q_submissions").select(SUBMISSION_COLUMNS).eq("status", "approved").gte("created_at", settings.opens_at);
  if (settings.frozen_at) q = q.lt("created_at", settings.frozen_at);
  const [subs, people, quests] = await Promise.all([
    q,
    supabase.from("rsvps").select("id, name, photo_url").in("status", JOINED),
    mergedCatalog(supabase, { organizer: true }),
  ]);
  const map = new Map<string, PersonDTO>();
  for (const p of (must(people) ?? []) as PersonDTO[]) map.set(p.id, toPerson(p));

  const rows = (must(subs) ?? []) as SubmissionRow[];
  const hearts = await shift3Map(supabase, rows.map((r) => r.id), null, { before: settings.frozen_at });
  const counts = new Map([...hearts].map(([id, h]) => [id, h.count]));

  const body: BoardResponse = {
    rows: boardRows(rows, questMap(quests), map, settings, counts),
    frozen: settings.frozen_at !== null,
  };
  return json(body);
});
