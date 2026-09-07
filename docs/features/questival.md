# Feature: The Questival (Saturday scavenger hunt)

Status: **decided Sep 6, 2026 — built elsewhere, linked from here.** The
Questival runs on [walkspot](https://github.com/mauurda/walkspot), a separate
app, deployed as its own Vercel project. m21 links to it. No hunt code lands
in this repo.

## Why it isn't built here

The reunion is September 11–13. This site is live at `www.m2021.co` with live
Stripe keys and paid RSVP rows in Supabase. Walkspot is ~4.1k LOC of Next 15
with its own Supabase schema, Leaflet, Sentry, and a `node:test` suite; m21 is
Next 16 on pnpm with a single package. Porting one into the other means a Next
major, a package-manager change, and a second schema in the database that
holds the payments — five days before the event, for no user-visible gain.

There was also nothing to merge. m21 never implemented a hunt: the Questival
existed only as agenda copy in `src/lib/reunion-course.ts` plus three dead
placeholders in Saturday's resource list ("Link goes here", "TBD"), and the
`photos` Photo Wall app is still an `AppStub`. The overlap was planned, not
written.

## How they connect

`Resource` (`src/lib/reunion-course.ts`) already carries an optional `url`, so
wiring the hunt in is a one-line edit per row — no redirect branch, no route.
In session 1.2 (`SAT`), the resource list becomes:

| row | points at |
|---|---|
| Questival challenge list | `https://<walkspot>/e/<CODE>` |
| Nostalgic stops map (851, 1412, Corona Heights…) | `https://<walkspot>/e/<CODE>/map` |
| Photo wall — submit your recreation | `https://<walkspot>/e/<CODE>/feed` |

Point `questival.m2021.co` at the walkspot Vercel project and the link reads
as native. One domain, two projects, zero code moved. The `photos` stub can
either stay stubbed or get a dock icon that opens the same URL — the Photo
Wall and walkspot's proof feed are the same idea, and walkspot's is built.

## What is deliberately NOT shared

- **Identity.** m21 remembers a device by `rsvp_id` in localStorage; walkspot
  mints its own `wsp_…` claim against a roster spot. Each person taps their
  name once per app. Don't build SSO between them for one weekend.
- **The `submissions` table.** Both repos have one and they are unrelated:
  m21's is the Assignment 1.1 text reflection keyed to `rsvp_id`; walkspot's
  is a photo proof. Same noun, different things. Don't unify them.
- **The roster.** The one genuine duplication. m21's `rsvps` (status `paid` or
  `processing`) is the guest list; walkspot needs those names in its
  `participants`. Seed it once by pasting names into walkspot's organizer
  People screen — it accepts one per line — not by wiring the databases
  together.

## After the reunion

Nothing to reconcile. If the Photo Wall is ever wanted as a permanent archive
in m21, build it against m21's own `rsvps` then; walkspot's proofs are a
record of one Saturday, not a library.

## Appendix — the challenge list (as of Sep 6)

Organizer content, kept here because it is reunion material; walkspot itself
stays generic. Blank location = doable anywhere (walkspot allows a challenge
with no map pin). Points still need filling in.

| Location | Activity | Notes |
|---|---|---|
| Palace of Fine Arts | Shout something in a circle | |
| 851 California | — | nostalgic stop |
| Grace Cathedral | — | nostalgic stop |
| 1412 Market Street | Selfie/photo outside or in the lobby | |
| Bob's Donuts | Do the donut challenge | 20 pts |
| Bob's Donuts | Eat a donut | 10 pts |
| — | Recreate a photo from first year, post both together | this is the Photo Wall assignment |
| — | FaceTime your favorite professor | |
| Old Minerva HQ | Professor charades | |
| New Minerva Res | Selfie with a non-M21 | bonus |
| Corona Heights | Write something to someone not at the reunion | |
| — | Challenge another group in sports | |
| All Star (next to 1412) | — | |
| Ocean Beach | Bonfire | the 18:00 anchor |
| — | Make a new HC | |
| — | Take a selfie with your legacy | |
| — | Drink Huel with a photo of Oscar Englebrektsen | |
| — | Sing "Rather Be" at a random place | |
| — | Get others to sing along | bonus on the above |
| — | Photo representing a rotation city (German biergarten, Argentinian flag…) | |
| — | Visit a legacy landmark (Crissy Field, Coit Tower…) | |
| — | Break a rule you broke in college | |
| — | Film an "I'm a Minervan, of course I…" video with friends | |
| — | Make a meal in a rice cooker | |
| — | SF parks visited | 10 pts each — see the caveat below |
| — | Food from a rotation city (Korea, India…) | |
| — | Video call someone not at the reunion, have them do something | |
| — | Take a photo at your legacy site | |
| Saigon Sandwich | Get a Saigon sandwich | |
| Ferry Building | Farmers market (Saturday) | |

**Two things the app won't do as written:**

1. **Repeatable challenges don't score repeatedly.** walkspot keeps only the
   best approved proof per person per challenge
   (`submissions/scoring.ts`, `progressFor`). "10 points per SF park" and
   "food from a rotation city" score once, not per instance. Either split them
   into separate challenges (Park 1, Park 2…) or accept a single flat award.
2. **"Bonus" rows aren't children.** There is no parent/child challenge; a
   bonus is just its own challenge with its own points. Note this in the
   description so players know it stacks with the one above it.

The group bonus is a separate, built-in mechanic: a proof is worth
`base × (1 + min(cap, pct × (people − 1)) / 100)` to *everyone* tagged on it,
default +25% per extra person capped at +100%. That is what makes the "Points
per Person" column work — set the base, let the app do the group math.
