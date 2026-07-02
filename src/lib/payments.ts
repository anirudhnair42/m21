/**
 * Payment configuration for the reunion RSVP.
 *
 * Real money moves through Stripe Checkout Sessions created by
 * `src/app/api/rsvp/route.ts`; rows land in Supabase (see
 * docs/superpowers/specs/2026-07-01-reunion-payments-design.md).
 *
 * Two prices, fee passthrough: ACH Direct Debit is $100 flat (we absorb the
 * ~$0.80 fee); card is $103.30 so the 2.9% + $0.30 processing fee nets us
 * $100. A single Checkout can't vary price by payment method, so the form
 * offers the two methods explicitly and each opens its own session.
 */

export type PaymentMethod = "ach" | "card";

export const PAYMENT_OPTIONS: Record<
  PaymentMethod,
  {
    amountCents: number;
    label: string;
    /** Short name shown on the picker card. */
    title: string;
    /** One-line pitch under the title. */
    note: string;
  }
> = {
  ach: {
    amountCents: 100_00,
    label: "$100",
    title: "US bank transfer",
    note: "Links your US bank account. Every dollar goes to the reunion.",
  },
  card: {
    amountCents: 103_30,
    label: "$103.30",
    title: "Card",
    note: "Works everywhere — price includes card processing.",
  },
};

/** What the money is, on Stripe receipts and the checkout page. */
export const CHECKOUT_PRODUCT_NAME = "Minerva 2021 Reunion — Registration";

/**
 * Query params Stripe redirects back with. The shells watch for these on
 * load: skip the intro and reopen the RSVP window in the matching state.
 */
export const RETURN_PARAM = "rsvp";
export type PaymentReturn =
  | { kind: "success"; method: PaymentMethod }
  | { kind: "cancelled" };

/** Parse the payment-return state out of the current URL (client-side). */
export function readPaymentReturn(): PaymentReturn | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const value = params.get(RETURN_PARAM);
  if (value === "success") {
    const method = params.get("method") === "ach" ? "ach" : "card";
    return { kind: "success", method };
  }
  if (value === "cancelled") return { kind: "cancelled" };
  return null;
}

/** Drop the payment-return params so a reload doesn't replay the state.
 * Preserves everything else — notably the auth fragment/code Supabase may
 * still need to read. */
export function clearPaymentReturn() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete(RETURN_PARAM);
  url.searchParams.delete("method");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}
