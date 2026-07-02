# Feature: Identity, payment states & post-RSVP unlocks

Status: **v1 SHIPPED July 2, 2026** (device-memory identity, payment-state
buttons, unlocks, 1.1 submission page, 1.2 class simulator). Remaining:
Google login before launch (access to Minerva Workspace is universal —
confirmed), 1.3 post-reunion surprise, housing booking. The `submissions`
table SQL must be run in Supabase before 1.1 accepts submissions.

## Identity (v1: device memory, v2: email login)

- v1: `/api/rsvp` returns the new row's `id`; the client stores it in
  localStorage before redirecting to Stripe. On load, the shells query
  `GET /api/rsvp/status?id=…` → `pending | processing | paid` and adapt the
  UI. No login screen.
- v2 (layered later): email + 6-digit code (Supabase Auth) so people can
  claim their RSVP from any device and edit their photo/voice note.

## Payment states → UI

| My status | RSVP buttons become | ALF locks |
|---|---|---|
| none | "RSVP →" (as today) | locked |
| pending (abandoned checkout) | "Finish your RSVP →" (new checkout) | locked |
| processing (ACH clearing) | "Payment clearing — you're in" | **unlocked** (money in flight) |
| paid | "✓ You're in" | unlocked |

Ripple effects when joined: home assignment row shows complete, syllabus
Status radio = Complete, banner sub = "Nothing due — see you September 11."

Participant rail dots (SHIPPED July 2): yellow = pending/clearing
("Pending confirmation" / "Payment clearing" on hover), green = paid
("Confirmed attending").

## The unlocks (Ani's decisions)

1. **Assignment 1.1 — "reflection: opening line"**: unlocked post-RSVP.
   Open-ended text box; prompt is about *the people you're excited to meet
   and hang out with*. Submissions go to the organizers, used to compose
   similar **Questival groups**. Needs: `submissions` table keyed to
   rsvp_id, submission UI in the assignment page, edit-until-deadline.
2. **Assignment 1.2 — "photo wall submission" → LIVE CLASS SIMULATOR**:
   not a photo wall. A recreation of the ALF live-class view (dark chrome,
   session title bar, filmstrip on top, main grid of video tiles with
   name labels bottom-left — see the SS111 screenshot in the transcript).
   Every RSVP's photo becomes a "video tile" in the class; the grid keeps
   growing as people join. Data already exists via `/api/participants`.
3. **Assignment 1.3 — "closing line"**: stays locked until after the
   reunion ("we will make something fun").
4. **Housing / "Stay"**: see `subsidized-housing.md` — post-RSVP room
   booking, Google-Flights-hotel vibe.

## Still needed from Ani

- Day-1 (Friday) itinerary specifics — "needs to be sharpened up, I will
  give exact specifics."
- Exact prompt wording for 1.1.
- Whether cross-device login (v2) must exist at launch.
