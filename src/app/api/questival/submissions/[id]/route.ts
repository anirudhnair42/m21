import { UUID_RE, fail, handler, json, mergedCatalog, must, questMap, readJson, requireOrganizer } from "@/lib/forum-server";
import { submissionById } from "@/lib/questival-server";
import type { ReviewSubmissionRequest } from "@/lib/questival-api";

/**
 * Organizer review: reject/approve, adjust points with a note. Stamps who
 * reviewed. Points stay derived; only the override is stored.
 */
export const PATCH = handler<{ params: Promise<{ id: string }> }>(async (request, ctx) => {
  const { supabase, caller } = await requireOrganizer(request);
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) fail(400, "bad id", "bad-request");
  const body = await readJson<ReviewSubmissionRequest>(request);

  const patch: Record<string, unknown> = { reviewed_by: caller.email, updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    if (body.status !== "approved" && body.status !== "rejected") fail(400, "status must be approved or rejected.", "bad-request");
    patch.status = body.status;
  }
  if (body.points_override !== undefined) {
    const p = body.points_override;
    if (p !== null && (!Number.isInteger(p) || p < 0 || p > 500)) fail(400, "points_override must be 0–500 or null.", "bad-request");
    patch.points_override = p;
  }
  if (body.review_note !== undefined) {
    if (body.review_note !== null && typeof body.review_note !== "string") fail(400, "review_note must be text.", "bad-request");
    patch.review_note = body.review_note ? body.review_note.trim().slice(0, 500) : null;
  }

  const updated = must(await supabase.from("q_submissions").update(patch).eq("id", id).select("id").maybeSingle()) as { id: string } | null;
  if (!updated) fail(404, "Proof not found.");
  const quests = questMap(await mergedCatalog(supabase, { organizer: true }));
  return json(await submissionById(supabase, id, quests));
});
