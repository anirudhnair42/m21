import { CLOSED_MESSAGE, UUID_RE, fail, getSettings, handler, json, must, requireCaller, windowAt } from "@/lib/forum-server";
import { shift3Map } from "@/lib/questival-server";
import type { Shift3Response } from "@/lib/questival-api";

type ProofOwners = { id: string; uploader_rsvp_id: string; members: string[] };

/**
 * The heart on the feed. POST gives one, DELETE takes it back.
 *
 * Idempotent in both directions: the primary key is (submission_id,
 * giver_rsvp_id), so a double tap is a no-op rather than a second point.
 * You can't Shift 3 a proof you're credited on — every heart is worth +1 to
 * everyone tagged, so self-hearting would be minting your own points.
 * Giving follows the same window as proofs, which lets the tally settle
 * before results at 8:30 instead of drifting through the reveal.
 */
async function shift3(request: Request, give: boolean): Promise<Response> {
  // Off until sql/questival.sql has created q_shift3 (see /api/forum/access).
  if (process.env.SHIFT3_OPEN !== "1") fail(503, "Shift 3 isn't switched on yet.", "unconfigured");
  const { supabase, me } = await requireCaller(request, { joined: true });
  const settings = await getSettings(supabase);
  if (windowAt(settings, Date.now()) === "closed") fail(403, CLOSED_MESSAGE, "closed");

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) fail(400, "bad id", "bad-request");

  const proof = must(
    await supabase.from("q_submissions").select("id, uploader_rsvp_id, members").eq("id", id).maybeSingle(),
  ) as ProofOwners | null;
  if (!proof) fail(404, "Proof not found.");
  if ([proof.uploader_rsvp_id, ...(proof.members ?? [])].includes(me.id)) {
    fail(403, "You can't Shift 3 a proof you're on.", "forbidden");
  }

  if (give) {
    must(
      await supabase
        .from("q_shift3")
        .upsert({ submission_id: id, giver_rsvp_id: me.id }, { onConflict: "submission_id,giver_rsvp_id", ignoreDuplicates: true }),
    );
  } else {
    must(await supabase.from("q_shift3").delete().eq("submission_id", id).eq("giver_rsvp_id", me.id));
  }

  const fresh = (await shift3Map(supabase, [id], me.id)).get(id);
  const body: Shift3Response = { submission_id: id, shift3: fresh?.count ?? 0, shift3_by_me: fresh?.mine ?? false };
  return json(body);
}

export const POST = handler((request) => shift3(request, true));
export const DELETE = handler((request) => shift3(request, false));
