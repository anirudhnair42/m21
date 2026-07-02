# Reunion payments + attendee tracking

Approved 2026-07-01. Replaces the Payment Link placeholder with real Stripe
Checkout Sessions and a Supabase ledger.

## Decisions

- **Two prices, fee passthrough**: ACH Direct Debit = **$100.00** flat
  (organizers absorb the ~$0.80 fee); card = **$103.30** (solves
  `X − (2.9%·X + $0.30) = $100`). A single Checkout can't vary price by
  payment method, so the RSVP screen offers two explicit choices, each
  creating its own single-method Checkout Session.
- **Supabase from day one** (lean scope): one `rsvps` table + one public
  `photos` Storage bucket. Photos and unpaid RSVPs are captured immediately;
  the wall/counter stay client-side theater for now.
- **Row before redirect**: the RSVP row is inserted with `status: 'pending'`
  *before* the person leaves for Stripe, so the DB holds both "said yes" and
  "paid" lists.
- **Same-tab redirect** to Stripe (popups get eaten by ad-blockers); Stripe
  collects the payer's email; success/cancel URLs return to the site with
  query params the shells use to skip the intro and reopen the RSVP window.
- Stripe runs on Anirudh's personal account (Individual activation).

## Data flow

1. RSVP form (name, city, notes, photo + method picker) POSTs multipart to
   `/api/rsvp` → upload photo to Storage → insert `pending` row → create
   Checkout Session (ACH-only or card-only, `metadata.rsvp_id`) → update row
   with `stripe_session_id` → return the checkout URL → same-tab redirect.
2. Stripe hosts checkout, collects email, redirects to
   `/?rsvp=success&method=<ach|card>` (or `/?rsvp=cancelled`).
3. `/api/stripe/webhook` (signature-verified):
   - `checkout.session.completed` → `paid` if `payment_status === 'paid'`
     (cards), else `processing` (ACH settling)
   - `checkout.session.async_payment_succeeded` → `paid`
   - `checkout.session.async_payment_failed` → `failed`
   - backfills `email` from `customer_details`; keyed on session id so
     replays are idempotent.

## Database

```sql
create table rsvps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  email text,
  from_city text,
  notes text,
  photo_url text,
  voice_url text,            -- optional name-pronunciation clip
  payment_method text,       -- 'ach' | 'card'
  amount_cents int,
  status text not null default 'pending',  -- pending | processing | paid | failed
  stripe_session_id text unique
);

-- Confidential financial-aid requests (reviewed in the table editor).
create table aid_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  email text not null,
  barriers text[],
  amount text,
  would_attend text,
  reason text
);
```

Bucket `photos`: public read (voice notes live in the same bucket under
`voice/`). RLS on with no public policies — only server routes touch the DB
via the service-role key.

Additional routes: `GET /api/participants` (name/photo/voice for the ALF
class list), `POST /api/aid` (aid requests).

## Env vars (.env.local + Vercel)

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`

## Deferred

Real photo wall, real RSVP counter, unpaid-RSVP reminders, failed-ACH retry
flow, admin UI (use the Supabase table editor).

## Operator checklist (outside code)

Stripe: activate as Individual → enable US bank account (ACH) payment method
→ set public name/statement descriptor → copy secret key (test mode first) →
after deploy, add webhook endpoint `https://<domain>/api/stripe/webhook` with
the four `checkout.session.*` events → copy signing secret.

Supabase: free project → run the SQL above → create public bucket `photos` →
copy URL + service-role key.

Test: Stripe test mode end-to-end — card `4242…` → `paid`; test bank account
(delayed settlement) → `processing` → `paid`; cancel → row stays `pending`.
