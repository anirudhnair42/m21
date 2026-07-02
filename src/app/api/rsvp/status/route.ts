import { getSupabaseAdmin } from "@/lib/supabase-server";

/**
 * Payment status for one RSVP row, looked up by its UUID (which only the
 * device that created it knows). Drives the device-memory identity: button
 * states and the post-RSVP unlocks.
 */
export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ status: null }, { status: 503 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "bad id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("rsvps")
    .select("status, name, photo_url")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("rsvp status query failed:", error.message);
    return Response.json({ status: null }, { status: 500 });
  }
  if (!data) return Response.json({ status: null });

  return Response.json(
    { status: data.status, name: data.name, photo_url: data.photo_url },
    { headers: { "Cache-Control": "no-store" } },
  );
}
