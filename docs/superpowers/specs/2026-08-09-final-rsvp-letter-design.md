# Final RSVP call: personalized letter pages + email blast

Status: **design approved 2026-08-09**, build not started.
Deadline-critical: the email must send **Monday 2026-08-10** for a
**Tuesday 2026-08-11, 11:00 PM PT** RSVP close.

## Problem

63 people signed in with Google on the reunion site but never RSVP'd. They sit
in the `considering` table, visible in the ALF sidebar, and the reunion is
Sept 11-13 — about a month out. This is the last ask before the list closes.

The existing site copy still says the deposit is "refundable through August 1",
which is both past and no longer true. That gets corrected as part of this work.

## Audience: 63 people

Derived from `considering`, pruned in this order. Implemented as a re-runnable
script (`scripts/followup-list.mjs`) so it can be regenerated immediately before
send — anyone who RSVPs in the meantime drops out automatically.

| Step | Removed | Remaining |
|---|---|---|
| `considering` rows | — | 118 |
| RSVP'd, matched by email | 44 | 74 |
| RSVP'd, matched by **normalized name** (different email) | 3 | 71 |
| Ani himself (`ani@base10.vc` / RSVP'd as `Anirudh Nair`) | 1 | 70 |
| Duplicate Google accounts, same person | 2 | 68 |
| `John Song` = `Byungchul (Peter) Song` (confirmed same person) | 1 | 67 |
| Minerva **staff** on `@minerva.edu` (not Class of 2021) | 4 | **63** |

Attending is defined as `status IN ('paid','processing')`. A `pending` row is an
abandoned checkout and still needs the nudge.

Name matching normalizes: Unicode NFKD → ASCII, lowercase, strip non-letters,
collapse whitespace. Match on exact normalized string, then on (first, last).

Specific decisions baked into the script:

- Removed by name match: Zara Amer, Nikolas Alves da Costa E Silva, Tara Morrison
- Duplicates collapsed to the **Minerva address**: Kirsty Hall, Menal Bokhari
- Removed as staff: Branden Balenzuela, Jamina Cole King, Veselina Nedelcheva,
  Camila Loureiro
- `Trang Nguyen` vs `Hung Nguyen` are different people — both retained
- `Wesley Whelan` started checkout 2026-08-04 and never paid → `unfinished` variant

## The letter page: `/letter/[token]`

A standalone, responsive page. **Not** inside the macOS desktop and **not**
wrapped in the fake Safari chrome.

Rationale: most opens will be on a phone, which is why the repo already carries a
separate `MobileShell`. Desktop or browser chrome at 390px undermines itself. More
importantly, chrome reads as irony, and a sincere final ask cannot afford irony.
A quiet "there's a whole desktop if you want to wander →" link at the foot gives
the curious a way in.

Structure, top to bottom:

1. **Greeting** — `Dear {firstName},` in Chronicle Display, fading in
2. **Photo strip** — 6 curated photos, lightbox on click
3. **The letter** — Ani's own words (he is writing this; see Open items)
4. **Event card** — San Francisco, September 11-13, 2026
5. **Live proof** — real attendee count + RSVP photos from `/api/participants`
6. **Deadline + CTA** — Tuesday, August 11 · 11:00 PM PT → RSVP
7. **Closed state** — after the deadline the page degrades gracefully rather
   than 404ing or lying about an open RSVP

Typography reuses the existing `.alf-letter` treatment (eyebrow → title →
subtitle → rule → body → signoff → signature) so the page is visually continuous
with the site. Colors from `--minerva-*` tokens in `src/styles/reunion.css`.

The CTA hands off to the **existing** RSVP flow: Google sign-in → live photo →
Stripe. No part of RSVP is rebuilt.

## Identity and privacy

- **Reading** the letter requires no sign-in. The token carries the name, so the
  greeting lands before anything is asked.
- **RSVPing** requires Google sign-in exactly as today. `/api/rsvp` verifies the
  bearer token server-side via `supabase.auth.getUser()` and stamps the verified
  email on the row.
- Tokens are 128 bits of randomness, not sequential and not derived from the
  email. Editing the URL yields a 404, never another person's letter.
- A forwarded link shows the original recipient's name. Acceptable — RSVP identity
  is server-verified regardless, so no false RSVP can result.

## Data

One new table. RLS on, no public policies, read only through a server route using
the service-role key — the pattern every existing table follows.

```sql
create table letter_invites (
  token      text primary key,
  email      text not null,
  name       text not null,
  variant    text not null default 'default',  -- 'default' | 'unfinished'
  created_at timestamptz not null default now(),
  opened_at  timestamptz
);
create unique index letter_invites_email_idx on letter_invites (lower(email));
```

`opened_at` is set on first view. It tells us who actually read the letter, which
is what a final personal nudge on Tuesday afternoon should be based on.

## Photos

10 supplied; 6 selected for the strip, sequenced as an arc from daylight to dark,
strangers to friends:

1. Foundation Week, bright classroom, everyone smiling at camera
2. Orientation, seated on the floor in circles, Minerva hoodie
3. Friendsgiving, long table mid-laugh, bread being passed
4. Friendsgiving, five standing with plates, photos pinned to brick
5. Friendsgiving, someone at the mic under the banner
6. Friendsgiving, the whole table turned to the camera

Held in reserve: the wide brick room with lanterns, and the second Foundation
Week frame. Cut: the residence-hall kitchen shot (backs of heads, fluorescent).

Originals are 1-4 MB each. They must be resized and compressed before shipping —
target ≤200 KB per image at 1600px wide, served through `next/image`.

## The email

**Sender:** `anirudh.nair@uni.minerva.edu`, `Reply-To: anirudhnair42@gmail.com`.
41 of 63 recipients are on `@uni.minerva.edu`, so two-thirds of the send is
same-Workspace internal routing rather than external mail. It is also the address
they knew him by. Replies land in the inbox he actually reads.

**Mechanism:** Google Apps Script mail merge, sent individually (never BCC, since
every link differs). Verify Apps Script is permitted on the alumni Workspace and
send a real test to himself first.

**Attendee count is fetched live at send time** from `/api/participants`. A stale
number in an email whose whole subject is obsessively watching that number would
be the one detail that breaks it.

**Subject:** `11:07`

**Body** (Ani's words, cleaned only for typos; no hyphens or em dashes by request):

> Dear {firstName},
>
> Since I shipped the website, every day I wake up and rush to it, go to the fake
> ALF, and look at the fake class list. Some days I am happy because we have new
> confirmed attendees. {count} of you now. But I also look at the considering
> list, and I see your name, and then I keep scrolling to see if you updated.
> Obsessively. (Not like the movie though.)
>
> So here is a final attempt at converting your consideration into an RSVP.
>
> RSVP closes Tuesday at 11:00 PM Pacific. But since this is Ani sending the
> email, and I always submitted my assignments right at the deadline, it is
> actually 11:07. In ALF the submission only used up an extension if you
> submitted after the 7th minute. I know this from experience.
>
> Read my letter.
>
> [ Read my letter → ]
>
> Ani

## Deadline copy

The site says **11:00 PM everywhere**, no exceptions. The 11:07 joke lives only in
the email. These are kept deliberately separate in code so neither gets "fixed"
to match the other.

Since the deposit is no longer refundable, refund language is removed rather than
redated:

- `src/components/apps/ALF.tsx:1799-1800` — "The deposit is $100, refundable
  through August 1" → RSVP-closes wording
- `src/components/apps/ALF.tsx:1807` — CTA badge "Refundable through Aug 1" →
  "RSVP closes Tuesday, Aug 11 · 11:00 PM PT"
- `src/components/apps/ALF.tsx:1503` — a faculty comment refers to "a refundable
  deposit". This is an in-world critique of the incentive design, not a promise to
  guests. Left as written.

## Build order

1. ~~Fast-forward the workspace onto `origin/main`~~ (done — was 20 behind)
2. `scripts/followup-list.mjs` → the 63, re-runnable
3. `letter_invites` table + token generation
4. Photo processing into `public/letter/`
5. `/letter/[token]` page
6. Site deadline copy corrections
7. Apps Script mail merge + test send to Ani
8. Send

Steps 2-6 are reviewable before a single email goes out. Nothing sends without
Ani seeing the rendered page and the final list.

## Open items

- **Ani is writing the letter body himself.** Everything else can be built around
  a placeholder; this is the one blocking input.
- Confirm Apps Script is enabled on the alumni Workspace.
- Confirm the production domain for building absolute letter URLs.
