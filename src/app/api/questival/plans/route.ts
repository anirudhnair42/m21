import { UUID_RE, fail, handler, joinedIds, json, mergedCatalog, must, questMap, readJson, requireCaller } from "@/lib/forum-server";
import { PLAN_COLUMNS, planDTOs, type PlanRow } from "@/lib/questival-server";
import { getActivity } from "@/lib/weekend";
import type { CreatePlanRequest } from "@/lib/questival-api";

const MAX_WITH = 30;

/**
 * "I want to do this, with these people." Lands in each invitee's inbox
 * (derived from with_rsvp_ids); nobody is committed to anything.
 *
 * One plan per (owner, kind, target): planning the same thing again
 * replaces the earlier plan, replies included — what ForumStore already
 * assumes locally, and what the unique index in sql/questival.sql enforces.
 */
export const POST = handler(async (request) => {
  const { supabase, caller, me } = await requireCaller(request, { joined: true });
  const body = await readJson<CreatePlanRequest>(request);
  const targetId = typeof body.target_id === "string" ? body.target_id : "";

  if (body.kind === "quest") {
    const quest = questMap(await mergedCatalog(supabase, { organizer: caller.organizer })).get(targetId);
    if (!quest || quest.status === "archived") fail(400, "Unknown quest.", "bad-request");
  } else if (body.kind === "activity") {
    if (!getActivity(targetId)) fail(400, "Unknown activity.", "bad-request");
  } else fail(400, "kind must be quest or activity.", "bad-request");

  const withIds = Array.isArray(body.with_ids)
    ? Array.from(new Set(body.with_ids.filter((id) => typeof id === "string" && UUID_RE.test(id) && id !== me.id)))
    : [];
  if (withIds.length > MAX_WITH) fail(400, `Invite up to ${MAX_WITH} people.`, "bad-request");
  const ok = await joinedIds(supabase, withIds);
  for (const id of withIds) if (!ok.has(id)) fail(400, "Someone invited doesn't have a confirmed RSVP.", "bad-request");

  const mine = () => supabase.from("q_plans").select(PLAN_COLUMNS).eq("rsvp_id", me.id).eq("kind", body.kind).eq("target_id", targetId);
  must(await supabase.from("q_plans").delete().eq("rsvp_id", me.id).eq("kind", body.kind).eq("target_id", targetId));
  const inserted = await supabase
    .from("q_plans")
    .insert({ rsvp_id: me.id, kind: body.kind, target_id: targetId, with_rsvp_ids: withIds })
    .select(PLAN_COLUMNS)
    .single();
  if (inserted.error) {
    // Lost a race with my own double-tap: the other insert won, return it.
    if (inserted.error.code === "23505") {
      const row = must(await mine().maybeSingle()) as PlanRow | null;
      if (row) return json((await planDTOs(supabase, [row]))[0]);
    }
    throw inserted.error;
  }
  return json((await planDTOs(supabase, [inserted.data as PlanRow]))[0], { status: 201 });
});

/** Drop a plan I own. Replies go with it (cascade). */
export const DELETE = handler(async (request) => {
  const { supabase, me } = await requireCaller(request, { joined: true });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) fail(400, "bad id", "bad-request");
  const gone = must(await supabase.from("q_plans").delete().eq("id", id).eq("rsvp_id", me.id).select("id").maybeSingle()) as { id: string } | null;
  if (!gone) fail(404, "Plan not found, or not yours.");
  return json({ ok: true, id });
});
