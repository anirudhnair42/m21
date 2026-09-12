import { getSettings, handler, json, mergedCatalog, must, questMap, requireCaller, toPerson } from "@/lib/forum-server";
import {
  CATCHUP_COLUMNS,
  PLAN_COLUMNS,
  SUBMISSION_COLUMNS,
  catchupDTOs,
  planDTOs,
  submissionDTOs,
  type CatchupRow,
  type PlanRow,
  type SubmissionRow,
} from "@/lib/questival-server";
import type { StateResponse } from "@/lib/questival-api";

/**
 * Everything about me in one call: my proofs (uploaded or tagged), plans I
 * own, invitations, catch-ups either way, and activity intents.
 * A caller without an RSVP row gets `me: null` and empty lists.
 */
export const GET = handler(async (request) => {
  const { supabase, caller, me } = await requireCaller(request);
  const [settings, quests] = await Promise.all([getSettings(supabase), mergedCatalog(supabase, { organizer: true })]);
  const empty: StateResponse = {
    me: null,
    organizer: caller.organizer,
    submissions: [],
    plans: [],
    invites: [],
    catchups: [],
    intents: {},
    settings,
  };
  if (!me) return json(empty);

  const [subs, plans, invites, catchups, intents] = await Promise.all([
    supabase
      .from("q_submissions")
      .select(SUBMISSION_COLUMNS)
      .or(`uploader_rsvp_id.eq.${me.id},members.cs.{${me.id}}`)
      .order("created_at", { ascending: false }),
    supabase.from("q_plans").select(PLAN_COLUMNS).eq("rsvp_id", me.id).order("created_at", { ascending: false }),
    supabase.from("q_plans").select(PLAN_COLUMNS).contains("with_rsvp_ids", [me.id]).order("created_at", { ascending: false }),
    supabase
      .from("catchups")
      .select(CATCHUP_COLUMNS)
      .or(`from_rsvp.eq.${me.id},to_rsvp.eq.${me.id}`)
      .order("created_at", { ascending: false }),
    supabase.from("plans").select("activity_id, intent").eq("rsvp_id", me.id),
  ]);

  const qmap = questMap(quests);
  const [submissions, plansOut, invitesOut, catchupsOut] = await Promise.all([
    submissionDTOs(supabase, (must(subs) ?? []) as SubmissionRow[], qmap, { settings, viewer: { id: me.id, organizer: caller.organizer } }),
    planDTOs(supabase, (must(plans) ?? []) as PlanRow[]),
    planDTOs(supabase, (must(invites) ?? []) as PlanRow[]),
    catchupDTOs(supabase, (must(catchups) ?? []) as CatchupRow[]),
  ]);
  const intentsOut: StateResponse["intents"] = {};
  for (const r of (must(intents) ?? []) as { activity_id: string; intent: "going" | "interested" }[]) intentsOut[r.activity_id] = r.intent;

  const body: StateResponse = {
    ...empty,
    me: toPerson(me),
    submissions,
    plans: plansOut,
    invites: invitesOut,
    catchups: catchupsOut,
    intents: intentsOut,
  };
  return json(body);
});
