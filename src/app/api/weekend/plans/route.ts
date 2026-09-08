import { fail, handler, json, must, optionalCaller, personMap, personOf, readJson, requireCaller } from "@/lib/forum-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getActivity } from "@/lib/weekend";
import type { IntentRequest, WhoAllResponse, WhoResponse } from "@/lib/questival-api";

type IntentRow = { rsvp_id: string; activity_id: string; intent: "going" | "interested" };
const ID_RE = /^[a-z0-9-]{1,32}$/;

/**
 * Who's going. Public callers get counts and the faces of people going
 * (RSVP photos are already public via /api/participants); a bearer through
 * the gate also gets the "interested" names.
 */
export const GET = handler(async (request) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ error: "Backend not configured.", code: "unconfigured" }, { status: 503 });
  const auth = await optionalCaller(request);
  const activity = new URL(request.url).searchParams.get("activity");
  if (activity !== null && !ID_RE.test(activity)) fail(400, "bad activity", "bad-request");

  let q = supabase.from("plans").select("rsvp_id, activity_id, intent");
  if (activity) q = q.eq("activity_id", activity);
  const rows = (must(await q) ?? []) as IntentRow[];
  const people = await personMap(
    supabase,
    rows.filter((r) => auth || r.intent === "going").map((r) => r.rsvp_id),
  );

  if (activity) {
    const going = rows.filter((r) => r.intent === "going");
    const interested = rows.filter((r) => r.intent === "interested");
    const body: WhoResponse = {
      going: going.map((r) => personOf(people, r.rsvp_id)),
      interested: auth ? interested.map((r) => personOf(people, r.rsvp_id)) : [],
      going_count: going.length,
      interested_count: interested.length,
    };
    return json(body);
  }

  const body: WhoAllResponse = {};
  for (const r of rows) {
    const a = (body[r.activity_id] ??= { going: [], going_count: 0, interested_count: 0 });
    if (r.intent === "going") {
      a.going.push(personOf(people, r.rsvp_id));
      a.going_count += 1;
    } else a.interested_count += 1;
  }
  return json(body);
});

/** Set or clear my intent for one activity. Intent, not a reservation. */
export const PUT = handler(async (request) => {
  const { supabase, me } = await requireCaller(request, { joined: true });
  const body = await readJson<IntentRequest>(request);
  const activityId = typeof body.activity_id === "string" ? body.activity_id : "";
  if (!ID_RE.test(activityId) || !getActivity(activityId)) fail(400, "Unknown activity.", "bad-request");
  const intent = body.intent ?? null;
  if (intent !== null && intent !== "going" && intent !== "interested") fail(400, "intent must be going, interested or null.", "bad-request");

  if (intent === null) {
    must(await supabase.from("plans").delete().eq("rsvp_id", me.id).eq("activity_id", activityId));
  } else {
    must(
      await supabase
        .from("plans")
        .upsert({ rsvp_id: me.id, activity_id: activityId, intent, updated_at: new Date().toISOString() }, { onConflict: "rsvp_id,activity_id" }),
    );
  }
  return json({ activity_id: activityId, intent });
});
