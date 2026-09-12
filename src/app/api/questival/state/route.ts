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
 * own, invitations, catch-ups either way, activity intents, final state.
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
    final: null,
    settings,
  };
  if (!me) return json(empty);

  const [subs, plans, invites, catchups, intents, final] = await Promise.all([
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
    supabase.from("q_finals").select("submitted_at, extension_used").eq("rsvp_id", me.id).maybeSingle(),
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
  const f = must(final) as { submitted_at: string; extension_used: boolean } | null;

  const body: StateResponse = {
    ...empty,
    me: toPerson(me),
    submissions,
    plans: plansOut,
    invites: invitesOut,
    catchups: catchupsOut,
    intents: intentsOut,
    final: f ? { submitted_at: new Date(f.submitted_at).toISOString(), extension_used: f.extension_used } : null,
  };
  return json(body);
});
