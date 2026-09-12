import { getSettings, handler, json, mergedCatalog, optionalCaller } from "@/lib/forum-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { CatalogResponse } from "@/lib/questival-api";

/**
 * The quest catalog and the event switches. Public: anyone can browse the
 * list. An organizer's bearer also gets drafts and archived quests.
 */
export const GET = handler(async (request) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ error: "Backend not configured.", code: "unconfigured" }, { status: 503 });
  const auth = await optionalCaller(request);
  const [quests, settings] = await Promise.all([
    mergedCatalog(supabase, { organizer: auth?.caller.organizer ?? false }),
    getSettings(supabase),
  ]);
  const body: CatalogResponse = { quests, settings };
  return json(body);
});
