import { MEDIA_BUCKET, fail, handler, json, mergedCatalog, questMap, readJson, requireCaller, tablesMissing, TABLES_MISSING } from "@/lib/forum-server";
import type { UploadUrlRequest, UploadUrlResponse } from "@/lib/questival-api";

/** Accepted uploads → file extension. Phones send HEIC and QuickTime. */
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
const MAX_BYTES = 50 * 1024 * 1024;

/**
 * A signed upload URL for one proof file. The phone PUTs straight to
 * Storage (no function body limit); the path is unguessable and namespaced
 * by quest and uploader so /submissions can check ownership by prefix.
 */
export const POST = handler(async (request) => {
  const { supabase, caller, me } = await requireCaller(request, { joined: true });
  const body = await readJson<UploadUrlRequest>(request);

  const questId = typeof body.quest_id === "string" ? body.quest_id : "";
  const quests = questMap(await mergedCatalog(supabase, { organizer: caller.organizer }));
  const quest = quests.get(questId);
  if (!quest || quest.status === "archived") fail(400, "Unknown quest.", "bad-request");
  const ext = EXT[typeof body.content_type === "string" ? body.content_type.toLowerCase() : ""];
  if (!ext) fail(400, "That file type isn't supported (JPEG, PNG, WebP, HEIC, MP4, MOV, WebM).", "bad-request");
  if (!Number.isFinite(body.size) || body.size <= 0 || body.size > MAX_BYTES) {
    fail(400, "Files must be under 50 MB.", "bad-request");
  }

  const path = `q/${questId}/${me.id}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    if (tablesMissing(error)) return json(TABLES_MISSING, { status: 503 });
    console.error("upload-url failed:", error?.message);
    fail(500, "Couldn't prepare the upload.");
  }
  const out: UploadUrlResponse = { path: data.path, url: data.signedUrl, token: data.token };
  return json(out);
});
