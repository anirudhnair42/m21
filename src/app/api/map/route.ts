import { handler, json, mergedCatalog, must, personMap, personOf } from "@/lib/forum-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { MapWhoResponse, PersonDTO } from "@/lib/questival-api";

const CAP = 8;

/**
 * Faces for the map pins: who's going to each activity, who's planning
 * each place quest (owner plus invitees). Public, like /api/participants;
 * capped at 8 faces per pin.
 */
export const GET = handler(async () => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ error: "Backend not configured.", code: "unconfigured" }, { status: 503 });

  const [going, plans, quests] = await Promise.all([
    supabase.from("plans").select("rsvp_id, activity_id").eq("intent", "going").order("updated_at", { ascending: false }),
    supabase.from("q_plans").select("rsvp_id, target_id, with_rsvp_ids").eq("kind", "quest").order("created_at", { ascending: false }),
    mergedCatalog(supabase),
  ]);
  const goingRows = (must(going) ?? []) as { rsvp_id: string; activity_id: string }[];
  const planRows = (must(plans) ?? []) as { rsvp_id: string; target_id: string; with_rsvp_ids: string[] }[];
  const placeQuests = new Set(quests.filter((q) => q.venue).map((q) => q.id));

  const byActivity = new Map<string, string[]>();
  for (const r of goingRows) push(byActivity, r.activity_id, [r.rsvp_id]);
  const byQuest = new Map<string, string[]>();
  for (const r of planRows) if (placeQuests.has(r.target_id)) push(byQuest, r.target_id, [r.rsvp_id, ...(r.with_rsvp_ids ?? [])]);

  const people = await personMap(supabase, [...byActivity.values(), ...byQuest.values()].flat());
  const faces = (m: Map<string, string[]>): Record<string, PersonDTO[]> =>
    Object.fromEntries(Array.from(m, ([k, ids]) => [k, ids.map((id) => personOf(people, id))]));
  const body: MapWhoResponse = { activities: faces(byActivity), quests: faces(byQuest) };
  return json(body);
});

/** Append unique ids, stopping at the cap. */
function push(m: Map<string, string[]>, key: string, ids: string[]) {
  const list = m.get(key) ?? [];
  for (const id of ids) if (list.length < CAP && !list.includes(id)) list.push(id);
  m.set(key, list);
}
