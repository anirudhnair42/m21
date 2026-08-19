import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const BOOKING_KIND = "minerva_res_hall_ru26";

// Room payment now happens on the GoFundMe Pro event page (per-night tickets);
// Stripe remains only as the ledger for rooms booked before the switch.
const HOUSING_PAYMENT_URL =
  "https://pro.gofundme.com/event/m21-reunion-minerva-housing/e833521/register/new/select-tickets";

async function bookingContext(request: Request) {
  const supabase = getSupabaseAdmin();
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!supabase || !stripeKey) return { error: "not_configured" as const };

  const token = (request.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!token) return { error: "signed_out" as const };

  const { data: userData } = await supabase.auth.getUser(token);
  const email = userData.user?.email?.toLowerCase();
  if (!email) return { error: "signed_out" as const };

  const fetchRsvp = (columns: string) =>
    supabase
      .from("rsvps")
      .select(columns)
      .eq("email", email)
      .in("status", ["paid", "processing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string;
        name: string | null;
        status: string;
        housing_interest?: boolean | null;
        hotel_paid?: boolean | null;
      }>();

  // Newer columns may not exist in the DB yet; degrade instead of failing the
  // whole endpoint (same tolerance as /api/rsvp). hotel_paid is the cohost-set
  // "paid on GoFundMe" flag; housing_interest gates who may book at all.
  let { data: rsvp, error } = await fetchRsvp(
    "id, name, status, housing_interest, hotel_paid",
  );
  if (error && /hotel_paid/.test(error.message)) {
    ({ data: rsvp, error } = await fetchRsvp("id, name, status, housing_interest"));
  }
  if (error && /housing_interest/.test(error.message)) {
    ({ data: rsvp, error } = await fetchRsvp("id, name, status"));
    if (rsvp) rsvp = { ...rsvp, housing_interest: true };
  }
  if (error) throw error;
  if (!rsvp) return { error: "not_eligible" as const, email };
  if (!rsvp.housing_interest) return { error: "no_housing_interest" as const };

  return { supabase, stripe: new Stripe(stripeKey), email, rsvp };
}

async function alreadyBooked(stripe: Stripe, rsvpId: string) {
  // The reunion has a small attendee set, so the recent Checkout ledger is a
  // reliable source of truth without introducing a second database migration.
  const sessions = await stripe.checkout.sessions.list({ limit: 100 });
  return sessions.data.some(
    (session) =>
      session.metadata?.booking_kind === BOOKING_KIND &&
      session.metadata?.rsvp_id === rsvpId &&
      session.status === "complete" &&
      session.payment_status === "paid",
  );
}

// GoFundMe can't call us back, so cohosts flip rsvps.hotel_paid from the
// registration emails / attendee export; Stripe covers pre-switch bookings.
async function isBooked(context: {
  stripe: Stripe;
  rsvp: { id: string; hotel_paid?: boolean | null };
}) {
  if (context.rsvp.hotel_paid) return true;
  return alreadyBooked(context.stripe, context.rsvp.id);
}

function contextError(
  error: "not_configured" | "signed_out" | "not_eligible" | "no_housing_interest",
  email?: string,
) {
  if (error === "not_configured") {
    return Response.json(
      { error: "Hotel booking is not configured yet." },
      { status: 503 },
    );
  }
  if (error === "signed_out") {
    return Response.json({ error: "Sign in to book a room." }, { status: 401 });
  }
  if (error === "no_housing_interest") {
    return Response.json(
      {
        eligible: false,
        error:
          "Rooms are held for classmates who asked for reunion housing on their RSVP. Write to the cohosts if that should include you.",
      },
      { status: 403 },
    );
  }
  return Response.json(
    {
      eligible: false,
      error: `Rooms are reserved for confirmed reunion attendees. You're signed in as ${email ?? "an account"} — if you RSVP'd under a different email, sign out and back in with that one.`,
    },
    { status: 403 },
  );
}

export async function GET(request: Request) {
  try {
    const context = await bookingContext(request);
    if (context.error) return contextError(context.error, "email" in context ? context.email : undefined);
    return Response.json({
      eligible: true,
      booked: await isBooked(context),
      guestName: context.rsvp.name,
    });
  } catch (error) {
    console.error("hotel booking status failed:", error);
    return Response.json(
      { error: "Could not check your room status." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await bookingContext(request);
    if (context.error) return contextError(context.error, "email" in context ? context.email : undefined);

    if (await isBooked(context)) {
      return Response.json({ booked: true });
    }

    return Response.json({ url: HOUSING_PAYMENT_URL });
  } catch (error) {
    console.error("hotel checkout failed:", error);
    return Response.json(
      { error: "Could not start hotel checkout. Please try again." },
      { status: 502 },
    );
  }
}
