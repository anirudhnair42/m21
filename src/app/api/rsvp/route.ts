import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import {
  PAYMENT_OPTIONS,
  CHECKOUT_PRODUCT_NAME,
  RETURN_PARAM,
  type PaymentMethod,
} from "@/lib/payments";

/**
 * RSVP submit: upload the photo, insert a `pending` row, create a Stripe
 * Checkout Session for the chosen method, and hand back the checkout URL.
 * The row exists before the redirect, so unpaid RSVPs are still captured.
 */
export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabase = getSupabaseAdmin();
  if (!stripeKey || !supabase) {
    return Response.json(
      { error: "Payments aren't configured yet — set STRIPE_SECRET_KEY, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const name = String(form.get("name") ?? "").trim();
  const fromCity = String(form.get("from") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim();
  const methodRaw = String(form.get("method") ?? "");
  const photo = form.get("photo");

  if (!name) {
    return Response.json({ error: "Name is required." }, { status: 400 });
  }
  if (methodRaw !== "ach" && methodRaw !== "card") {
    return Response.json({ error: "Pick a payment method." }, { status: 400 });
  }
  const method: PaymentMethod = methodRaw;
  const price = PAYMENT_OPTIONS[method];

  // RSVP is members-only: require a signed-in Google account. The verified
  // email also stamps the row so it follows the account across devices, and
  // locks the Stripe receipt to the same identity. No valid token → no RSVP.
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  let verifiedEmail: string | null = null;
  if (token) {
    const { data: userData } = await supabase.auth.getUser(token);
    verifiedEmail = userData?.user?.email?.toLowerCase() ?? null;
  }
  if (!verifiedEmail) {
    return Response.json(
      { error: "Please sign in to RSVP." },
      { status: 401 },
    );
  }

  // Uploads first (both optional) so the row can carry their public URLs.
  // Failures are non-fatal: an RSVP without media beats a lost RSVP.
  const uploadPublic = async (
    file: unknown,
    prefix: string,
    maxBytes: number,
    fallbackExt: string,
  ): Promise<string | null> => {
    if (!(file instanceof File) || file.size === 0) return null;
    if (file.size > maxBytes) return null;
    const ext = (file.name.split(".").pop() || fallbackExt)
      .toLowerCase()
      .slice(0, 5);
    const path = `${prefix}${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("photos")
      .upload(path, file, { contentType: file.type || undefined });
    if (uploadError) {
      console.error(`${prefix || "photo "}upload failed:`, uploadError.message);
      return null;
    }
    return supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
  };

  if (photo instanceof File && photo.size > 10 * 1024 * 1024) {
    return Response.json({ error: "Photo is too large (10 MB max)." }, { status: 400 });
  }
  const photoUrl = await uploadPublic(photo, "", 10 * 1024 * 1024, "jpg");
  // Name-pronunciation voice note (a few seconds of audio).
  const voiceUrl = await uploadPublic(
    form.get("voice"),
    "voice/",
    5 * 1024 * 1024,
    "webm",
  );

  const values: Record<string, unknown> = {
    name,
    from_city: fromCity || null,
    notes: notes || null,
    payment_method: method,
    amount_cents: price.amountCents,
    status: "pending",
    // Who wants a $200 Res Hall room — drives housing planning.
    housing_interest: form.get("housing") === "1",
    ...(verifiedEmail ? { email: verifiedEmail } : {}),
    // Keep previously-uploaded media when resubmitting without new files.
    ...(photoUrl ? { photo_url: photoUrl } : {}),
    ...(voiceUrl ? { voice_url: voiceUrl } : {}),
  };

  // If the housing_interest column hasn't been added yet, drop the field
  // rather than failing the whole RSVP.
  const missingColumn = (message?: string) =>
    !!message && /housing_interest/.test(message);

  // If this device already has an unpaid row (abandoned checkout), update it
  // instead of creating a duplicate.
  const existing = String(form.get("existing") ?? "");
  let rowId: string | null = null;
  if (/^[0-9a-f-]{36}$/i.test(existing)) {
    let { data: updated, error: updateError } = await supabase
      .from("rsvps")
      .update(values)
      .eq("id", existing)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (updateError && missingColumn(updateError.message)) {
      delete values.housing_interest;
      ({ data: updated } = await supabase
        .from("rsvps")
        .update(values)
        .eq("id", existing)
        .eq("status", "pending")
        .select("id")
        .maybeSingle());
    }
    if (updated) rowId = updated.id;
  }
  if (!rowId) {
    let { data: inserted, error: insertError } = await supabase
      .from("rsvps")
      .insert({ photo_url: photoUrl, voice_url: voiceUrl, ...values })
      .select("id")
      .single();
    if (insertError && missingColumn(insertError.message)) {
      delete values.housing_interest;
      ({ data: inserted, error: insertError } = await supabase
        .from("rsvps")
        .insert({ photo_url: photoUrl, voice_url: voiceUrl, ...values })
        .select("id")
        .single());
    }
    if (insertError || !inserted) {
      console.error("rsvp insert failed:", insertError?.message);
      return Response.json({ error: "Couldn't save your RSVP — please try again." }, { status: 500 });
    }
    rowId = inserted.id;
  }
  const row = { id: rowId };

  const origin =
    request.headers.get("origin") ?? new URL(request.url).origin;
  const stripe = new Stripe(stripeKey);

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: method === "ach" ? ["us_bank_account"] : ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: price.amountCents,
            product_data: { name: CHECKOUT_PRODUCT_NAME },
          },
        },
      ],
      metadata: { rsvp_id: row.id },
      // Signed-in RSVPs lock the checkout to the account email, so Stripe's
      // receipt and the account identity always agree.
      ...(verifiedEmail ? { customer_email: verifiedEmail } : {}),
      success_url: `${origin}/?${RETURN_PARAM}=success&method=${method}`,
      cancel_url: `${origin}/?${RETURN_PARAM}=cancelled`,
    });
  } catch (err) {
    console.error("checkout session create failed:", err);
    return Response.json(
      { error: "Couldn't start checkout — please try again." },
      { status: 502 },
    );
  }

  await supabase
    .from("rsvps")
    .update({ stripe_session_id: session.id })
    .eq("id", row.id);

  return Response.json({ url: session.url, id: row.id });
}
