import { handler, json, mergedCatalog, must, personMap, personOf, questMap, requireOrganizer } from "@/lib/forum-server";
import { SUBMISSION_COLUMNS, submissionDTOs, type SubmissionRow } from "@/lib/questival-server";
import type { ReviewResponse } from "@/lib/questival-api";

/** Everything for the organizer desk: every proof (any status) and who pressed Submit. */
export const GET = handler(async (request) => {
  const { supabase } = await requireOrganizer(request);
  const [subs, finals, quests] = await Promise.all([
    supabase.from("q_submissions").select(SUBMISSION_COLUMNS).order("created_at", { ascending: false }).limit(2000),
    supabase.from("q_finals").select("rsvp_id, submitted_at, extension_used").order("submitted_at", { ascending: true }),
    mergedCatalog(supabase, { organizer: true }),
  ]);
  const finalRows = (must(finals) ?? []) as { rsvp_id: string; submitted_at: string; extension_used: boolean }[];
  const [submissions, people] = await Promise.all([
    submissionDTOs(supabase, (must(subs) ?? []) as SubmissionRow[], questMap(quests)),
    personMap(supabase, finalRows.map((f) => f.rsvp_id)),
  ]);
  const body: ReviewResponse = {
    submissions,
    finals: finalRows.map((f) => ({
      person: personOf(people, f.rsvp_id),
      submitted_at: new Date(f.submitted_at).toISOString(),
      extension_used: f.extension_used,
    })),
  };
  return json(body);
});
