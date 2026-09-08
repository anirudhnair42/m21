import { UUID_RE, fail, handler, joinedIds, json, must, readJson, requireCaller } from "@/lib/forum-server";
import { CATCHUP_COLUMNS, catchupDTOs, type CatchupRow } from "@/lib/questival-server";
import type { CreateCatchupRequest } from "@/lib/questival-api";

/**
 * Request a one-on-one catch-up (Mau's mini-Calendly): pick a person, a
 * weekend slot and an optional line. Lands in their inbox as pending.
 */
export const POST = handler(async (request) => {
  const { supabase, me } = await requireCaller(request, { joined: true });
  const body = await readJson<CreateCatchupRequest>(request);
  const toId = typeof body.to_id === "string" ? body.to_id : "";
  if (!UUID_RE.test(toId) || toId === me.id) fail(400, "Pick someone else.", "bad-request");
  const slot = typeof body.slot === "string" ? body.slot.trim() : "";
  if (!slot || slot.length > 32) fail(400, "Pick a slot.", "bad-request");
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 280) : "";
  if (!(await joinedIds(supabase, [toId])).has(toId)) fail(400, "They don't have a confirmed RSVP.", "bad-request");

  const row = must(
    await supabase
      .from("catchups")
      .insert({ from_rsvp: me.id, to_rsvp: toId, slot, note: note || null, status: "pending" })
      .select(CATCHUP_COLUMNS)
      .single(),
  ) as CatchupRow;
  return json((await catchupDTOs(supabase, [row]))[0], { status: 201 });
});
