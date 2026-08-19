import { getSupabaseAdmin } from "@/lib/supabase-server";

/**
 * The final class list + count: paid attendees and payments still clearing,
 * newest first. Pending/abandoned checkouts are not confirmed RSVPs. Powers the Participants rail in the ALF course
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
      .in("status", ["paid", "processing"])
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("rsvps")
      .select("id", { count: "exact", head: true })
      .in("status", ["paid", "processing"]),
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
