import { fail, handler, json, mergedCatalog, must, questMap, requireCaller } from "@/lib/forum-server";
import { SUBMISSION_COLUMNS, submissionDTOs, type SubmissionRow } from "@/lib/questival-server";
import type { FeedResponse } from "@/lib/questival-api";

const PAGE = 30;

/**
 * The class, live: approved proofs newest first, keyset-paginated on
 * created_at. Whitelisted DTO — names and photos, no emails.
 */
export const GET = handler(async (request) => {
  const { supabase } = await requireCaller(request);
  const cursor = new URL(request.url).searchParams.get("cursor");
  if (cursor && Number.isNaN(Date.parse(cursor))) fail(400, "bad cursor", "bad-request");

  let q = supabase
    .from("q_submissions")
    .select(SUBMISSION_COLUMNS)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(PAGE + 1);
  if (cursor) q = q.lt("created_at", new Date(cursor).toISOString());
  const rows = (must(await q) ?? []) as SubmissionRow[];

  const page = rows.slice(0, PAGE);
  const quests = questMap(await mergedCatalog(supabase, { organizer: true }));
  const items = await submissionDTOs(supabase, page, quests);
  const body: FeedResponse = {
    items,
    next_cursor: rows.length > PAGE ? items[items.length - 1].created_at : null,
  };
  return json(body);
});
