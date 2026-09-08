import { JOINED, getSettings, handler, json, mergedCatalog, must, questMap, requireCaller, toPerson } from "@/lib/forum-server";
import { SUBMISSION_COLUMNS, boardRows, type SubmissionRow } from "@/lib/questival-server";
import type { BoardResponse, PersonDTO } from "@/lib/questival-api";

/**
 * The leaderboard, derived on every read from approved proofs. Everyone
 * with a confirmed RSVP is listed so "where am I" always has an answer.
 * Once results are frozen, only proofs from before frozen_at count.
 */
export const GET = handler(async (request) => {
  const { supabase } = await requireCaller(request);
  const settings = await getSettings(supabase);

  let q = supabase.from("q_submissions").select(SUBMISSION_COLUMNS).eq("status", "approved");
  if (settings.frozen_at) q = q.lt("created_at", settings.frozen_at);
  const [subs, people, quests] = await Promise.all([
    q,
    supabase.from("rsvps").select("id, name, photo_url").in("status", JOINED),
    mergedCatalog(supabase, { organizer: true }),
  ]);
  const map = new Map<string, PersonDTO>();
  for (const p of (must(people) ?? []) as PersonDTO[]) map.set(p.id, toPerson(p));

  const body: BoardResponse = {
    rows: boardRows((must(subs) ?? []) as SubmissionRow[], questMap(quests), map),
    frozen: settings.frozen_at !== null,
  };
  return json(body);
});
