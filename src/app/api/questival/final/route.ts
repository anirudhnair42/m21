import { CLOSED_MESSAGE, fail, getSettings, handler, json, must, requireCaller, windowAt } from "@/lib/forum-server";
import type { FinalResponse } from "@/lib/questival-api";

/**
 * "Submit final list": the 5:00 PM moment. Between due_at and
 * extension_until it still lands, flagged as an extension. After that it's
 * closed. Pressing twice returns the first submission unchanged.
 */
export const POST = handler(async (request) => {
  const { supabase, me } = await requireCaller(request, { joined: true });
  const settings = await getSettings(supabase);
  const now = Date.now();
  const w = windowAt(settings, now);
  if (w === "closed") fail(403, CLOSED_MESSAGE, "closed");

  const existing = must(
    await supabase.from("q_finals").select("submitted_at, extension_used").eq("rsvp_id", me.id).maybeSingle(),
  ) as { submitted_at: string; extension_used: boolean } | null;
  if (existing) {
    const out: FinalResponse = { submitted_at: new Date(existing.submitted_at).toISOString(), extension_used: existing.extension_used };
    return json(out);
  }

  const row = { rsvp_id: me.id, submitted_at: new Date(now).toISOString(), extension_used: w === "extension" };
  // ignoreDuplicates: two taps in the same second both return the first row.
  must(await supabase.from("q_finals").upsert(row, { onConflict: "rsvp_id", ignoreDuplicates: true }));
  const saved = must(
    await supabase.from("q_finals").select("submitted_at, extension_used").eq("rsvp_id", me.id).single(),
  ) as { submitted_at: string; extension_used: boolean };
  const out: FinalResponse = { submitted_at: new Date(saved.submitted_at).toISOString(), extension_used: saved.extension_used };
  return json(out, { status: 201 });
});
