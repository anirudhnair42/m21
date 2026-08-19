import { getSupabaseAdmin } from "@/lib/supabase-server";
import { RSVP_CLOSED, RSVP_DEADLINE_LABEL } from "@/lib/letter";

/**
 * Replace the RSVP photo (people deserve a retake). Authorized by possession
 * of the row's UUID — same model as the status endpoint — plus, when a
 * Google session is present and the row is owned, the emails must match.
 */
export async function POST(request: Request) {
  if (RSVP_CLOSED) {
    return Response.json(
      { error: `The RSVP deadline ended on ${RSVP_DEADLINE_LABEL}.` },
      { status: 410 },
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json({ error: "Backend not configured." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const rsvpId = String(form.get("rsvp_id") ?? "");
  const photo = form.get("photo");
  if (!/^[0-9a-f-]{36}$/i.test(rsvpId)) {
    return Response.json({ error: "bad rsvp_id" }, { status: 400 });
  }
  if (!(photo instanceof File) || photo.size === 0) {
    return Response.json({ error: "No photo attached." }, { status: 400 });
  }
  if (photo.size > 10 * 1024 * 1024) {
    return Response.json({ error: "Photo is too large (10 MB max)." }, { status: 400 });
  }

  const { data: row } = await supabase
    .from("rsvps")
    .select("id, email, photo_url")
    .eq("id", rsvpId)
    .maybeSingle();
  if (!row) return Response.json({ error: "RSVP not found." }, { status: 404 });

  // If the row belongs to an account and the caller is signed in, they must
  // be the same person.
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (row.email && token) {
    const { data: userData } = await supabase.auth.getUser(token);
    const email = userData?.user?.email?.toLowerCase();
    if (email && email !== row.email) {
      return Response.json({ error: "Not your RSVP." }, { status: 403 });
    }
  }

  const ext = (photo.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(path, photo, { contentType: photo.type || "image/jpeg" });
  if (uploadError) {
    console.error("photo replace upload failed:", uploadError.message);
    return Response.json({ error: "Upload failed — try again." }, { status: 500 });
  }
  const publicUrl = supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;

  const { error: updateError } = await supabase
    .from("rsvps")
    .update({ photo_url: publicUrl })
    .eq("id", rsvpId);
  if (updateError) {
    console.error("photo url update failed:", updateError.message);
    return Response.json({ error: "Couldn't save — try again." }, { status: 500 });
  }

  // Best-effort cleanup of the previous photo object.
  if (row.photo_url) {
    const old = row.photo_url.split("/photos/").pop();
    if (old && !old.startsWith("voice/")) {
      supabase.storage.from("photos").remove([old]);
    }
  }

  return Response.json({ ok: true, photo_url: publicUrl });
}
