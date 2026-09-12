import { UUID_RE, fail, getSettings, handler, json, mergedCatalog, must, questMap, requireCaller } from "@/lib/forum-server";
import { SUBMISSION_COLUMNS, submissionDTOs, type SubmissionRow } from "@/lib/questival-server";
import type { FeedResponse } from "@/lib/questival-api";

const PAGE = 30;

/**
 * Keyset cursor: (created_at, id), opaque to the client. created_at is the
 * database's own microsecond value, not the millisecond ISO in the DTO —
 * truncating it skipped rows that landed in the same millisecond.
 */
type Cursor = { t: string; id: string };

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

/** The opaque shape, or a bare timestamp (the first release's cursor) for old clients. */
function decodeCursor(raw: string): Cursor {
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<Cursor>;
    if (c && typeof c.t === "string" && !Number.isNaN(Date.parse(c.t)) && typeof c.id === "string" && UUID_RE.test(c.id)) {
      return { t: c.t, id: c.id };
    }
  } catch {
    // not the opaque shape
  }
  if (!Number.isNaN(Date.parse(raw))) return { t: new Date(raw).toISOString(), id: "" };
  return fail(400, "bad cursor", "bad-request");
}

/**
 * The class, live: approved proofs newest first, keyset-paginated on
 * (created_at, id). Whitelisted DTO — names and photos, no emails.
 */
export const GET = handler(async (request) => {
  const { supabase, caller, me } = await requireCaller(request);
  const settings = await getSettings(supabase);
  const raw = new URL(request.url).searchParams.get("cursor");
  const cursor = raw ? decodeCursor(raw) : null;

  let q = supabase
    .from("q_submissions")
    .select(SUBMISSION_COLUMNS)
    .eq("status", "approved")
    // Pre-open proofs are saved but never score, so they stay out of the live feed too.
    .gte("created_at", settings.opens_at)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE + 1);
  if (cursor) {
    // Quoted so the timestamp's ':' and '+' survive PostgREST's filter grammar.
    q = cursor.id ? q.or(`created_at.lt."${cursor.t}",and(created_at.eq."${cursor.t}",id.lt.${cursor.id})`) : q.lt("created_at", cursor.t);
  }
  const rows = (must(await q) ?? []) as SubmissionRow[];

  const page = rows.slice(0, PAGE);
  const quests = questMap(await mergedCatalog(supabase, { organizer: true }));
  const items = await submissionDTOs(supabase, page, quests, { settings, viewer: { id: me?.id ?? null, organizer: caller.organizer } });
  const last = page[page.length - 1];
  const body: FeedResponse = {
    items,
    next_cursor: rows.length > PAGE && last ? encodeCursor({ t: last.created_at, id: last.id }) : null,
  };
  return json(body);
});
