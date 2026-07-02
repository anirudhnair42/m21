import { getSupabaseAdmin } from "@/lib/supabase-server";

/**
 * The class list + live RSVP count: everyone who has RSVP'd (minus failed
 * payments), newest first. Powers the Participants rail in the ALF course
 * page and the menu-bar counter. When the backend isn't configured, returns
 * an empty list and a null count so the UI hides the live bits gracefully.
 */
export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ participants: [], count: null });

  const [list, total] = await Promise.all([
    supabase
      .from("rsvps")
      .select("name, photo_url, voice_url, status")
      .neq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("rsvps")
      .select("id", { count: "exact", head: true })
      .neq("status", "failed"),
  ]);
  if (list.error || total.error) {
    console.error(
      "participants query failed:",
      list.error?.message ?? total.error?.message,
    );
    return Response.json({ participants: [], count: null });
  }

  return Response.json(
    { participants: list.data ?? [], count: total.count ?? 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
