# Feature: Subsidized housing booking (post-RSVP)

Status: **captured, build later** (per Ani, July 2, 2026). The teaser copy is
already live on the RSVP form and success screen.

## The facts (from Ani)

- The **Minerva Res Hall on Van Ness** can tentatively accommodate the group
  for the **September 11–13, 2026** weekend.
- Flat rate: **$200 per room** for the weekend.
- Headcount and room configurations to be finalized later — the hall is
  still figuring out how many **singles, doubles, and triples** are
  available.

## The product idea

A post-RSVP surface on the site itself — "Google Flights hotel picker vibe,"
but for reunion rooms:

- Only visible/unlocked once you've RSVP'd (ties into the identity +
  unlocks system).
- Browse room types (single / double / triple), see the flat $200/room
  price, pick roommates or be matched, and claim a room.
- Inventory counts per room type once Minerva confirms configurations.
- Likely lives as its own desktop app window ("Stay") — the stub app
  already registered in `src/lib/apps.ts` — replacing the current
  hotel-options concept.

## Open questions for Ani

- Is the $200 collected through the site (second Stripe checkout) or
  settled directly with Minerva?
- Roommate selection: self-organized groups vs organizer matching?
- Deadline for room claims?
- What happens when rooms run out — waitlist + hotel suggestions?

## Where the teaser copy lives today

- RSVP form lede (`src/components/apps/RSVPApp.tsx`, `.rsvp-lede-housing`)
- RSVP success screen hint ("Room booking opens here soon")
