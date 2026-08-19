# Feature: Subsidized housing booking (post-RSVP)

Status: **built August 14, 2026**. The Google Hotels-style app now lives in the
desktop dock and replaces the old Stay stub.

## The facts (from Branden's August 18, 2026 email to RSVP'd folks)

- The **Minerva Res Hall at 2550 Van Ness Ave** hosts the group for
  **Friday September 11 – Monday September 14, 2026**.
- Flat rate: **$200 per room** for the whole stay (not per night).
- **9 double rooms** available; if fewer people request lodging than there are
  rooms, solo occupancy is possible.
- Payment happens on the GoFundMe Pro event page:
  <https://pro.gofundme.com/event/m21-reunion-minerva-housing/e833521/register/new/select-tickets>
- Financial assistance (via the site's aid form) can cover the $200 housing fee.

## Product behavior

A post-RSVP surface on the site itself — "Google Hotels picker vibe," but for
the reunion room:

- Only visible/unlocked once you've RSVP'd (ties into the identity +
  unlocks system).
- Search fields are prefilled to San Francisco, September 11–14, one room, and
  two guests.
- There is one bookable result: Minerva Residence Hall at 2550 Van Ness Ave,
  $200 flat for Fri–Mon.
- The button requires Google sign-in, a paid/processing reunion RSVP, and
  `housing_interest` checked on that RSVP (the "$200 Res Hall room" ask in the
  RSVP flow). Classmates who didn't ask for housing see a note pointing them
  to the cohosts instead of a book button.
- Booking opens the GoFundMe Pro registration page in a new tab. GoFundMe has
  no webhook back to us, so cohosts flip `rsvps.hotel_paid` (boolean) from the
  GoFundMe registration emails / attendee export; the app then shows "Room
  reserved". Stripe's Checkout ledger still marks any pre-switch bookings.
- Deep link that opens the site with the Hotels app already open (skips the
  intro): `/?open=stay` — this is the link to hand to Branden for the email.
- Room configurations remain intentionally unspecified until Minerva confirms
  singles, doubles, and triples.

## Still open

- Roommate selection: self-organized groups vs organizer matching?
- Deadline for room claims?
- What happens when rooms run out — waitlist + hotel suggestions?

## Implementation

- App UI: `src/components/apps/HotelApp.tsx`
- Checkout/status endpoint: `src/app/api/hotel/route.ts`
- Dock registration: `src/lib/apps.ts` and `src/components/Desktop.tsx`
- Official property gallery: `public/assets/hotel/2550-van-ness-*.webp`, sourced
  from [2550 Van Ness](https://www.2550vanness.com/) and its
  [Accommodations page](https://www.2550vanness.com/accommodations).
