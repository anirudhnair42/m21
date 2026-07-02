import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase-server";

/**
 * Stripe webhook: flips rsvps.status as payments settle. Keyed on the
 * Checkout Session id, so replayed events are idempotent.
 *
 *   checkout.session.completed        → paid (cards) | processing (ACH settling)
 *   checkout.session.async_payment_succeeded → paid
 *   checkout.session.async_payment_failed    → failed
 *
 * Also backfills the email Stripe collected during checkout.
 */
export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabase = getSupabaseAdmin();
  if (!stripeKey || !webhookSecret || !supabase) {
    return new Response("not configured", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  const stripe = new Stripe(stripeKey);
  let event: Stripe.Event;
  try {
    // Raw body required — any parsing before verification breaks the signature.
    const payload = await request.text();
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error("webhook signature verification failed:", err);
    return new Response("bad signature", { status: 400 });
  }

  const relevant = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
  ]);
  if (!relevant.has(event.type)) {
    return Response.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  let status: "paid" | "processing" | "failed";
  if (event.type === "checkout.session.async_payment_failed") {
    status = "failed";
  } else if (event.type === "checkout.session.async_payment_succeeded") {
    status = "paid";
  } else {
    // completed: cards are paid instantly; ACH sits unpaid while it settles.
    status = session.payment_status === "paid" ? "paid" : "processing";
  }

  const { error } = await supabase
    .from("rsvps")
    .update({ status })
    .eq("stripe_session_id", session.id);
  if (error) {
    console.error("rsvp status update failed:", error.message);
    // 500 so Stripe retries — the row may just not be committed yet.
    return new Response("db error", { status: 500 });
  }

  // Backfill the checkout email ONLY where the row has none — a signed-in
  // RSVP is stamped with the verified Google email at insert, and that link
  // must never be clobbered by whatever was typed into Stripe.
  const email = session.customer_details?.email;
  if (email) {
    await supabase
      .from("rsvps")
      .update({ email: email.toLowerCase() })
      .eq("stripe_session_id", session.id)
      .is("email", null);
  }

  return Response.json({ received: true });
}
