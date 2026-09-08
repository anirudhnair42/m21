import { fail, getSettings, handler, json, must, readJson, requireOrganizer } from "@/lib/forum-server";
import type { UpdateSettingsRequest } from "@/lib/questival-api";

function when(v: unknown, field: string): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) fail(400, `${field} must be an ISO timestamp.`, "bad-request");
  return new Date(v).toISOString();
}

/**
 * Event switches: move the deadlines, pin an announcement, release the
 * results (which also freezes the board), or freeze on its own.
 */
export const POST = handler(async (request) => {
  const { supabase } = await requireOrganizer(request);
  const body = await readJson<UpdateSettingsRequest>(request);
  const current = await getSettings(supabase);

  const patch: Record<string, unknown> = { id: 1 };
  const opens = when(body.opens_at, "opens_at");
  const due = when(body.due_at, "due_at");
  const ext = when(body.extension_until, "extension_until");
  if (opens) patch.opens_at = opens;
  if (due) patch.due_at = due;
  if (ext) patch.extension_until = ext;
  const o = Date.parse(opens ?? current.opens_at);
  const d = Date.parse(due ?? current.due_at);
  const e = Date.parse(ext ?? current.extension_until);
  if (!(o < d && d <= e)) fail(400, "Need opens_at < due_at <= extension_until.", "bad-request");

  if (body.announcement !== undefined) {
    if (body.announcement !== null && typeof body.announcement !== "string") fail(400, "announcement must be text.", "bad-request");
    patch.announcement = body.announcement ? body.announcement.trim().slice(0, 500) : null;
  }
  const now = new Date().toISOString();
  if (body.release_results) {
    patch.results_released_at = current.results_released_at ?? now;
    patch.frozen_at = current.frozen_at ?? now;
  }
  if (body.freeze) patch.frozen_at = current.frozen_at ?? now;

  must(await supabase.from("q_settings").upsert(patch, { onConflict: "id" }));
  return json(await getSettings(supabase));
});
