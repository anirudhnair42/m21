import {
  CLOSED_MESSAGE,
  MEDIA_BUCKET,
  UUID_RE,
  fail,
  getSettings,
  handler,
  joinedIds,
  json,
  mergedCatalog,
  must,
  questMap,
  readJson,
  requireCaller,
  windowAt,
} from "@/lib/forum-server";
import { SUBMISSION_COLUMNS, submissionById, submissionDTOs, type SubmissionRow } from "@/lib/questival-server";
import type { CreateSubmissionRequest } from "@/lib/questival-api";

const MAX_MEDIA = 6;
const MAX_MEMBERS = 30;

/**
 * Create a proof. Server checks: the window is open (from q_settings), the
 * quest exists, media paths are the caller's own uploads, tagged people are
 * confirmed RSVPs. One insert; a retry with the same idempotency key gets
 * the same row back instead of a duplicate. Approved by default; organizers
 * reject after the fact.
 */
export const POST = handler(async (request) => {
  const { supabase, caller, me } = await requireCaller(request, { joined: true });
  const settings = await getSettings(supabase);
  if (windowAt(settings, Date.now()) === "closed") fail(403, CLOSED_MESSAGE, "closed");

  const body = await readJson<CreateSubmissionRequest>(request);
  const key = typeof body.idempotency_key === "string" ? body.idempotency_key.trim().slice(0, 80) : "";
  if (!key) fail(400, "idempotency_key is required.", "bad-request");

  const quests = questMap(await mergedCatalog(supabase, { organizer: caller.organizer }));
  const quest = quests.get(typeof body.quest_id === "string" ? body.quest_id : "");
  if (!quest || quest.status === "archived") fail(400, "Unknown quest.", "bad-request");

  const existing = must(
    await supabase.from("q_submissions").select(SUBMISSION_COLUMNS).eq("idempotency_key", key).maybeSingle(),
  ) as SubmissionRow | null;
  if (existing) return json((await submissionDTOs(supabase, [existing], quests))[0]);

  const instance = body.instance === undefined ? 1 : body.instance;
  const cap = quest.repeat ?? 1;
  if (!Number.isInteger(instance) || instance < 1 || instance > cap) {
    fail(400, cap > 1 ? `instance must be 1–${cap}.` : "This quest has a single instance.", "bad-request");
  }

  // Media must be the caller's own uploads: q/<quest>/<my rsvp id>/<file>.
  const own = new RegExp(`^q/[a-z0-9-]+/${me.id}/[A-Za-z0-9-]+\\.[a-z0-9]+$`, "i");
  const media = Array.isArray(body.media) ? body.media : [];
  if (media.length === 0) fail(400, "Attach at least one photo or video.", "bad-request");
  if (media.length > MAX_MEDIA) fail(400, `Up to ${MAX_MEDIA} files per proof.`, "bad-request");
  for (const m of media) {
    if (!m || typeof m.path !== "string" || !own.test(m.path) || (m.type !== "image" && m.type !== "video")) {
      fail(400, "Media must come from /api/questival/upload-url.", "bad-request");
    }
  }

  const tagged = Array.isArray(body.member_ids) ? body.member_ids.filter((id) => typeof id === "string" && UUID_RE.test(id)) : [];
  if (tagged.length > MAX_MEMBERS) fail(400, `Tag up to ${MAX_MEMBERS} people.`, "bad-request");
  const ok = await joinedIds(supabase, tagged);
  for (const id of tagged) if (!ok.has(id)) fail(400, "Someone tagged doesn't have a confirmed RSVP.", "bad-request");
  const members = Array.from(new Set([me.id, ...tagged]));

  const caption = typeof body.caption === "string" ? body.caption.trim().slice(0, 280) : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";

  const inserted = await supabase
    .from("q_submissions")
    .insert({
      quest_id: quest.id,
      instance,
      uploader_rsvp_id: me.id,
      members,
      media: media.map((m) => ({ path: m.path, type: m.type })),
      caption: caption || null,
      note: note || null,
      status: "approved",
      idempotency_key: key,
    })
    .select(SUBMISSION_COLUMNS)
    .single();
  if (inserted.error) {
    // Lost a race with our own retry: the first insert won, return it.
    if (inserted.error.code === "23505") {
      const again = must(
        await supabase.from("q_submissions").select(SUBMISSION_COLUMNS).eq("idempotency_key", key).maybeSingle(),
      ) as SubmissionRow | null;
      if (again) return json((await submissionDTOs(supabase, [again], quests))[0]);
    }
    throw inserted.error;
  }
  return json((await submissionDTOs(supabase, [inserted.data as SubmissionRow], quests))[0], { status: 201 });
});

/** Remove my own proof while the window is still open. Files go too. */
export const DELETE = handler(async (request) => {
  const { supabase, caller, me } = await requireCaller(request, { joined: true });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) fail(400, "bad id", "bad-request");
  const settings = await getSettings(supabase);
  if (windowAt(settings, Date.now()) === "closed") fail(403, CLOSED_MESSAGE, "closed");

  const quests = questMap(await mergedCatalog(supabase, { organizer: caller.organizer }));
  const sub = await submissionById(supabase, id, quests);
  if (!sub) fail(404, "Proof not found.");
  if (sub.uploader.id !== me.id) fail(403, "Only the uploader can remove a proof.", "forbidden");

  must(await supabase.from("q_submissions").delete().eq("id", id));
  const paths = sub.media.map((m) => m.path);
  if (paths.length) {
    // Best effort: an orphaned file in a public bucket is harmless.
    supabase.storage.from(MEDIA_BUCKET).remove(paths).catch(() => {});
  }
  return json({ ok: true, id });
});
