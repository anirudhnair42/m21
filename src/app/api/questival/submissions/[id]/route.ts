import { UUID_RE, fail, getSettings, handler, json, mergedCatalog, must, questMap, readJson, requireOrganizer } from "@/lib/forum-server";
import { submissionById } from "@/lib/questival-server";
import type { ReviewSubmissionRequest } from "@/lib/questival-api";

/**
 * Organizer review: take a proof down, or restore it. Stamps who reviewed.
 * Points stay derived from the quest catalog — there is no re-pricing, so a
 * rejected proof is worth 0 and an approved one is worth its quest.
 */
export const PATCH = handler<{ params: Promise<{ id: string }> }>(async (request, ctx) => {
  const { supabase, caller } = await requireOrganizer(request);
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) fail(400, "bad id", "bad-request");
  const body = await readJson<ReviewSubmissionRequest>(request);

  if (body.status !== "approved" && body.status !== "rejected") fail(400, "status must be approved or rejected.", "bad-request");
  const patch = { status: body.status, reviewed_by: caller.email, updated_at: new Date().toISOString() };

  const updated = must(await supabase.from("q_submissions").update(patch).eq("id", id).select("id").maybeSingle()) as { id: string } | null;
  if (!updated) fail(404, "Proof not found.");
  const [quests, settings] = await Promise.all([mergedCatalog(supabase, { organizer: true }), getSettings(supabase)]);
  return json(await submissionById(supabase, id, questMap(quests), { settings, viewer: { id: null, organizer: true } }));
});
