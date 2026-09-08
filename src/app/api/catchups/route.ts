import { UUID_RE, cleanText, fail, handler, joinedIds, json, must, readJson, requireCaller } from "@/lib/forum-server";
import { CATCHUP_COLUMNS, catchupDTOs, type CatchupRow } from "@/lib/questival-server";
import { CATCHUP_SLOTS } from "@/lib/weekend";
import type { CreateCatchupRequest } from "@/lib/questival-api";

const SLOT_IDS = new Set(CATCHUP_SLOTS.map((s) => s.id));

/**
 * Request a one-on-one catch-up (Mau's mini-Calendly): pick a person, a
 * weekend slot and an optional line. Lands in their inbox as pending.
 * One open ask per pair at a time, in either direction.
 */
export const POST = handler(async (request) => {
  const { supabase, me } = await requireCaller(request, { joined: true });
  const body = await readJson<CreateCatchupRequest>(request);
  const toId = typeof body.to_id === "string" ? body.to_id : "";
  if (!UUID_RE.test(toId) || toId === me.id) fail(400, "Pick someone else.", "bad-request");
  const slot = typeof body.slot === "string" ? body.slot.trim() : "";
  if (!SLOT_IDS.has(slot)) fail(400, "Pick a slot from the list.", "bad-request");
  const note = cleanText(body.note, 280);
  if (!(await joinedIds(supabase, [toId])).has(toId)) fail(400, "They don't have a confirmed RSVP.", "bad-request");

  // Both ids are UUIDs (validated above / from the rsvps row), safe to interpolate into the filter.
  const open = (must(
    await supabase
      .from("catchups")
      .select("id, from_rsvp")
      .eq("status", "pending")
      .or(`and(from_rsvp.eq.${me.id},to_rsvp.eq.${toId}),and(from_rsvp.eq.${toId},to_rsvp.eq.${me.id})`)
      .limit(1),
  ) ?? []) as { id: string; from_rsvp: string }[];
  if (open.length) {
    fail(
      409,
      open[0].from_rsvp === me.id ? "You've already asked them — wait for their answer." : "They already asked you — answer that one from your inbox.",
      "bad-request",
    );
  }

  const row = must(
    await supabase
      .from("catchups")
      .insert({ from_rsvp: me.id, to_rsvp: toId, slot, note, status: "pending" })
      .select(CATCHUP_COLUMNS)
      .single(),
  ) as CatchupRow;
  return json((await catchupDTOs(supabase, [row]))[0], { status: 201 });
});
