import { UUID_RE, fail, handler, json, must, readJson, requireCaller } from "@/lib/forum-server";
import { CATCHUP_COLUMNS, catchupDTOs, type CatchupRow } from "@/lib/questival-server";
import type { CatchupReplyRequest } from "@/lib/questival-api";

/** Accept or decline a catch-up. Only the person it was sent to may answer. */
export const POST = handler(async (request) => {
  const { supabase, me } = await requireCaller(request, { joined: true });
  const body = await readJson<CatchupReplyRequest>(request);
  const id = typeof body.id === "string" ? body.id : "";
  if (!UUID_RE.test(id)) fail(400, "bad id", "bad-request");
  if (body.status !== "accepted" && body.status !== "declined") fail(400, "status must be accepted or declined.", "bad-request");

  const row = must(await supabase.from("catchups").select(CATCHUP_COLUMNS).eq("id", id).maybeSingle()) as CatchupRow | null;
  if (!row) fail(404, "Catch-up not found.");
  if (row.to_rsvp !== me.id) fail(403, "Only the person asked can answer.", "forbidden");

  const updated = must(
    await supabase.from("catchups").update({ status: body.status }).eq("id", id).select(CATCHUP_COLUMNS).single(),
  ) as CatchupRow;
  return json((await catchupDTOs(supabase, [updated]))[0]);
});
