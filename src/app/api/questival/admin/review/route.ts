import { getSettings, handler, json, mergedCatalog, must, questMap, requireOrganizer } from "@/lib/forum-server";
import { SUBMISSION_COLUMNS, submissionDTOs, type SubmissionRow } from "@/lib/questival-server";
import type { ReviewResponse } from "@/lib/questival-api";

/** Everything for the organizer desk: every proof, any status. */
export const GET = handler(async (request) => {
  const { supabase } = await requireOrganizer(request);
  const [subs, quests, settings] = await Promise.all([
    supabase.from("q_submissions").select(SUBMISSION_COLUMNS).order("created_at", { ascending: false }).limit(2000),
    mergedCatalog(supabase, { organizer: true }),
    getSettings(supabase),
  ]);
  const body: ReviewResponse = {
    submissions: await submissionDTOs(supabase, (must(subs) ?? []) as SubmissionRow[], questMap(quests), {
      settings,
      viewer: { id: null, organizer: true },
    }),
  };
  return json(body);
});
