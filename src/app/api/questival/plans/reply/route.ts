import { UUID_RE, fail, handler, json, must, readJson, requireCaller } from "@/lib/forum-server";
import { PLAN_COLUMNS, planDTOs, type PlanRow } from "@/lib/questival-server";
import type { PlanReplyRequest } from "@/lib/questival-api";

/** Answer an invitation: "in" or "maybe". Only the invited can reply. */
export const POST = handler(async (request) => {
  const { supabase, me } = await requireCaller(request, { joined: true });
  const body = await readJson<PlanReplyRequest>(request);
  const planId = typeof body.plan_id === "string" ? body.plan_id : "";
  if (!UUID_RE.test(planId)) fail(400, "bad plan_id", "bad-request");
  if (body.reply !== "in" && body.reply !== "maybe") fail(400, "reply must be in or maybe.", "bad-request");

  const plan = must(await supabase.from("q_plans").select(PLAN_COLUMNS).eq("id", planId).maybeSingle()) as PlanRow | null;
  if (!plan) fail(404, "Plan not found.");
  if (!(plan.with_rsvp_ids ?? []).includes(me.id)) fail(403, "You weren't invited to this one.", "forbidden");

  must(
    await supabase
      .from("q_plan_replies")
      .upsert({ plan_id: planId, rsvp_id: me.id, reply: body.reply, at: new Date().toISOString() }, { onConflict: "plan_id,rsvp_id" }),
  );
  return json((await planDTOs(supabase, [plan]))[0]);
});
