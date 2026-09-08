# Weekend itinerary + Questival on the phone — design

Status: **proposed 2026-09-06**, awaiting Ani's approval. Reunion is
Sept 11–13; Questival is Saturday Sept 12. Everything below is scoped to
ship by **Thursday Sept 10 evening** with a cohost rehearsal on Wednesday.

Companion preview: the mobile Forum lives at `/weekend` and `/questival`
on this branch (static content, local state, no backend yet).

---

## 1. What we are building, in one paragraph

The reunion site already *is* the ALF. On a phone it currently says "go use
a computer". For the weekend, the phone becomes **the Forum on mobile**: the
same course (RU26), the same sessions (1.1 Friday, 1.2 Saturday, 1.3
Sunday), the same assignment language. Three things get added on top of what
exists: (1) the **final three-day run of show** with venues, directions,
hosts, and an "I'm going / Interested" toggle that shows the faces of who
else is going; (2) **Questival as Assignment 2** — a catalog of quests, a
camera-first capture flow that saves photos and videos to your list as you
go, tagging the classmates who did it with you, and a **"Submit final list"
moment due at 5:00 PM before the Ocean Beach bonfire** (with the 7-minute
ALF extension joke); (3) a **live layer** — class feed of proofs, a
leaderboard, an organizer review queue, and a "grades released" reveal at
dinner in the ALF Grades & Comments style.

Walkspot is **not** integrated as a product. We borrow two small pure
modules from it (client image shrinking, derived scoring) with a
provenance note, and Mau can keep Walkspot as an optional "plan my walk"
utility if he ships it. One place for submissions, scores and results: the
Minerva site.

## 2. Principles

- **It is the ALF.** Black banner with the wordmark, italic serif titles,
  paper cards, `Session 1.2`, `Assignment 2`, `Submitted · Editable`,
  `Will be unlocked later`. New surfaces reuse `.alf-*` primitives and
  tokens (`--minerva-blue`, `--minerva-paper`, `--minerva-ink`, Chronicle
  Display). No new design system, no Tailwind component library.
- **Phone and desktop, 1:1.** The intro and existing apps stay as they are.
  Every weekend feature exists on both: on the phone as the mobile Forum
  (standalone page, no fake iPhone chrome), on the desktop as real apps in
  the dock, sharing one store so a plan made in one window shows in all:
  **Calendar** (the weekend, Sessions 1.1–1.3, who's going, plan-it),
  **Maps** (the live map), **Photos** (feed, team and people boards, the
  class), **Mail** (invitations arrive as messages in the 2017 inbox, with
  I'm in / Maybe in the message body), and **ALF** (Assignment 3: Questival
  — hub, quests, My Questival, the class live). Dock icons follow the High
  Sierra language: a September 12 Calendar tile, a Maps tile with a pin, the
  Photos pinwheel.
- **Open participation.** Browsing needs no sign-in. Marking plans, tagging
  and submitting need the existing Google sign-in + RSVP identity. No
  teams are assigned; groups form by tagging. No app, no codes, no GPS
  requirement.
- **The phone is secondary to the day.** Every screen answers "where do I
  go next" or "capture this and get back to your friends" in one tap. No
  feeds designed to be scrolled.
- **Nothing invented.** Unconfirmed venues/times ship with an honest
  "confirmed by Friday" note rather than a made-up address. Draft points
  are labeled draft until cohosts approve the catalog.

## 3. Surfaces and routes

| Route | What | Who |
|---|---|---|
| `/` (phone) | Mobile Forum home (replaces the "visit on a computer" card). `?open=stay` and `?open=aid` keep working. | anyone |
| `/` (desktop) | Unchanged macOS desktop + ALF. | anyone |
| `/weekend` | Sessions 1.1–1.3 as Fri/Sat/Sun tabs, full run of show | anyone |
| `/weekend/[day]/[slug]` | One activity: venue, address, Directions, host, bring, cost, who's going, Going/Interested, Share | anyone; toggle needs sign-in |
| `/map` | Live map: anchors, quests with points, side sessions, and who's planning to be at each pin | anyone |
| `/inbox` | Invitations ("Anna wants to do X with you"), what you've sent, cohost announcements | signed-in |
| `/questival` | Assignment 2 hub: your team, status card, due time, quest catalog (At a place / Anywhere), progress | anyone |
| `/questival/q/[slug]` | One quest: prompt, evidence, location + Directions, capture, tag, caption, save | capture needs sign-in |
| `/questival/me` | My Questival: captured list, points, tagged friends, **Submit final list**, sealed state | signed-in |
| `/questival/live` | Class feed (newest first) + Board tab | signed-in |
| `/questival/results` | Grades & Comments reveal (after organizers release) | signed-in |
| `/questival/review` | Organizer queue: approve/reject/adjust, announcement, release results | organizer emails only |
| `/letter/[token]` | unchanged | |

Every route has Open Graph metadata (title, date/time, venue) so a pasted
link unfurls in iMessage/WhatsApp. The Share button uses `navigator.share`
with copy-link fallback.

On desktop width these routes render the same page centered at 720px on
paper with a small "there's a whole desktop if you want to wander →" link,
matching the letter page's decision.

## 4. Screens

### 4.1 Mobile Forum shell
- Banner: `.alf-fb` at 84px — wordmark, italic serif title, sub, avatar.
- Bottom bar (the sidebar, folded): **Home · Weekend · Map · Questival ·
  Inbox**. Icons reuse the ALF sidebar glyphs. The class list lives under
  Home. "Class Assessments" and "Outcome Index" are not carried over.
- Sign-in: `.alf-fb-signin` in the banner. Redirect returns to the same
  route (`?auth=<path>`). The dual-account issue gets a one-line hint:
  "Not on the list? Try your other Google account."

### 4.2 Home
- Title `Welcome, {first}` / sub during the weekend: **Now / Next** line
  computed in America/Los_Angeles from the itinerary ("Now: Lunch at 2550
  Van Ness · Next: Side quests, 4:00").
- Organizer announcement strip if set ("Common Space address: …").
- **Assignments Due** table (the real Forum home): Assignment 1 reflection
  (Submitted · Editable), **Assignment 2: Questival · Due Sat 5:00 PM**,
  Assignment 3 closing line (locked).
- Card: "Today" — that day's run of show, condensed, with Directions links.

### 4.3 Weekend
- Fri / Sat / Sun segmented tabs = Sessions 1.1 / 1.2 / 1.3 with the
  session title, date chip, "Class starts…" meta.
- Run of show as `.alf-agenda` timeline. Each row: time, title, venue,
  host, `Optional` styling for soft items, face stack of who's going
  (RSVP photos, max 5 + "+12").
- Tap → activity page: description, address, **Directions** (Apple Maps on
  iOS, Google Maps elsewhere), what to bring, cost/inclusions when known,
  status note when unconfirmed, **I'm going / Interested** toggle, "Who's
  going" list (signed-in only; counts public), Share.
- Optional / peer-led extras (Altın Gün, disc golf, Pandora karaoke,
  Friday-morning ideas) sit in a "Side sessions" card at the bottom of the
  relevant day, marked `Peer-led · proposed`, with the same interest toggle
  so the live count is visible ("live display of people going").

### 4.3b Map (`/map`)
- Paper-toned CARTO tiles inside the Forum, not a separate app.
- Pins: blue = anchors with day/time label, orange circle = quest with its
  points, green circle = team quest, purple = peer-led side session. Pins
  you've planned get a blue ring.
- Tap a pin → popup with title, time/points, faces of who's going or
  planning to be there, and Open.
- Chips: Where we meet · Points · Side sessions · Find me (browser
  geolocation, never required).
- Data: coordinates on activities and place quests in the static files;
  "who" from `plans` and `q_plans`.

### 4.3c Plan it, and the Inbox
- On any quest or activity: **I want to do this** + pick who with. That
  creates a `q_plans` row, not a submission. The quest shows `Planned ·
  with Anna, Mau`; My Questival gets a "Planned" section above "Saved".
- Everyone picked gets an inbox item: "Anna wants to do The Bob's Donuts
  challenge with you · Sat". Actions: **I'm in** (adds you to the plan, so
  it shows on your list and the map) or **Maybe**.
- Inbox tab badge = unanswered invitations. Also holds what you've sent
  and cohost announcements. Polling, no push.

### 4.3d Teams
- **Cohosts assign six teams** before Saturday, named after the rotation
  cities (Seoul, Hyderabad, Berlin, Buenos Aires, London, Taipei), ~8 each,
  using the Assignment 1 answers. Swaps go through a cohost. No self-serve
  team creation.
- **Scoring stays per person; the team is the sum of its people.** Everyone
  tagged on a proof earns, whatever team they're on, so mingling across
  teams still feeds your own board.
- **Team quests** (Challenge another team, the "of course I…" video, the
  team Reel, the Palace shout) need `teamMin` teammates tagged and are worth
  more.
- Board tabs: **Teams · People · Feed**. Hub shows "Team Berlin · 8 people
  · 3rd · 240 pts" with faces. Tag picker puts your teammates first.

### 4.4 Questival hub (`/questival`)
- Assignment card: `Assignment 2: Questival` · `Due Sat, Sep 12 · 5:00 PM
  PT · Weight 1x` · status chip (Not started / In progress · 6 saved /
  Submitted). Primary button: **Open my list** or **Start**.
- Two lists: **At a place** (grouped by neighborhood, nearest-first if
  location permission is granted, otherwise route order) and **Anywhere**.
  Row: title, points, evidence glyph (📷 / 🎥 / 📷×2 / ✎), status dot.
- Filter chips: All · Not done · Saved · Submitted.

### 4.5 Quest page
- Prompt in serif, points, evidence required, location card with
  Directions, tips/rules line, "Also counts for…" for linked bonuses.
- **Capture**: one big button → `<input type="file" accept="image/*,video/*"
  capture="environment">` plus "Choose from library". Multiple files allowed
  for photo-pair quests. Client shrinks images to ≤1600px JPEG before
  upload. Video ≤ 50 MB.
- **Tag who did it with you**: chip picker over `/api/participants` faces,
  recent tags first. One upload credits everyone tagged.
- Caption (optional). **Save to my list** → draft row created immediately;
  upload progress shown per file; retry on failure; the receipt stays on
  screen ("Saved 2:14 PM · with Anna, Mau").
- Repeatable quests (parks, rotation cities) show "Instance 2 of 5".

### 4.6 My Questival (`/questival/me`)
- The assignment page. Header chip logic:
  - before submit: `In progress · editable`
  - after submit, before 5:00: `Submitted · Editable until 5:00 PM`
  - 5:00–5:07: `Submitted · Extension used` (ALF joke, real behavior)
  - after 5:07: `Closed` (read-only)
- List of saved quests with thumbnails, points, tagged faces, remove.
- Running total and a "with" line (everyone you've been tagged with).
- **Submit final list** button → confirm sheet ("8 quests · 140 pts · with
  Anna, Mau, Erkin. Submit before the bonfire?") → sealed state with the
  `.alf-next-card` "Next up: Session 1.2 — Bonfire at Ocean Beach, 5:00 ·
  Directions".
- Submitting also submits any drafts. Editing after submit is allowed until
  the deadline (like Assignment 1).

### 4.7 Live (`/questival/live`)
- **Feed**: cards with photo/video, quest title, uploader + tagged faces,
  time, caption. Polls every 20s while visible; pull-to-refresh via a
  "Refresh" link. No comments/likes in v1.
- **Board**: rank, face, name, points, quests done. Ties share rank. Also a
  "Most tagged" line for fun (derived, free).

### 4.8 Results (`/questival/results`)
- Locked until organizers release. Then: the ALF Grades & Comments layout
  (reused from the syllabus grader view): your score, rank, "HC" badge
  per category, a one-line organizer comment if any, top 3 podium.

### 4.9 Organizer review (`/questival/review`)
- Allowlist `ORGANIZER_EMAILS`. Queue of submissions (auto-approved on
  submit, so the board is live). Reject with note; adjust points on a
  submission; pin an announcement; **Release results**; freeze scores.

## 5. Final itinerary content (draft to confirm)

All times America/Los_Angeles. Sources: master workbook (Fri/Sun), Route
sheet (Sat), Sept 6 chat. Items marked ⚠ need a cohost answer before launch;
they ship with honest placeholder copy, never an invented address.

### Session 1.1 — Friday Sept 11 · Welcome night
| Time | Activity | Venue | Host | Note |
|---|---|---|---|---|
| 12:00 | Arrival lunch (self-pay) | ⚠ Spark Social vs Presidio food trucks — pick one | Nathan | Optional |
| 14:00 | Neighborhood wander / museum | ⚠ Nathan's suggestions list | Nathan | Optional, small groups |
| 18:00 | **Welcome dinner & drinks** ⭐ | Southern Pacific Brewing, 620 Treat Ave | Dulce + Anna | ⚠ reservation status; "Patio, ~50 of us" |
| 21:00 | Bar hopping | Mission bars, decided at dinner | Nathan + Ani | Optional |
| Side sessions | Altın Gün show ⚠ date/tickets, disc golf (Mau), karaoke at Pandora | | peer-led | proposed |

### Session 1.2 — Saturday Sept 12 · Questival
| Time | Activity | Venue | Note |
|---|---|---|---|
| 10:00 | **Breakfast** ⭐ | Dahlia Dell, Golden Gate Park (picnic table permit) | Anna. Saint Frank coffee, Bob's Donuts |
| 11:30 | Sports Palooza | Dahlia Dell | ⚠ sheet says 23:30; assumed 11:30 AM. Volleyball, spikeball, frisbee, relay, whipped-cream war |
| 10:00 → 17:00 | **Questival open** | All over SF | Capture anytime; final list due 5:00 PM |
| 13:30 | Speed catch-up | ⚠ Alamo Square (confirm spot) | |
| 15:00 | **Lunch** ⭐ | 2550 Van Ness (Res Hall) | ⚠ entrance/host |
| 16:00 | Side quests | Multiple | last push before deadline |
| 17:00 | **Bonfire & hangout** ⭐ | Ocean Beach ⚠ stairwell/pit number | Questival closes 5:00 (extension to 5:07) |
| 18:00 | Doors | Common Space ⚠ Richmond vs Marina property | address published in the app when booked |
| 19:00 | **Dinner** ⭐ · results at ~20:30 | Common Space | Kahoot/trivia, prizes |
| 22:00 | Venue closes → After party | ⚠ Chug Pub (to confirm) | Optional |
| 01:30 | Home | | end-of-night marker |

The old site copy (Fort Mason breakfast, 12:00 kickoff, 18:00 beach dinner)
is replaced by the above.

### Session 1.3 — Sunday Sept 13 · Slow Sunday
| Time | Activity | Venue | Note |
|---|---|---|---|
| 11:00 | **Faculty brunch / picnic** ⭐ | Hellman Hollow, Golden Gate Park (4 tables booked) | Mau. ⚠ bagels (Schlok's) pending. Bring blankets, frisbees, drinks if local |
| ⚠ ~14:00 | Closing moment | Hellman Hollow | remarks, photos, Assignment 3 opens |
| ongoing | Open park | | come/leave around flights |

## 6. Quest catalog (draft points — cohosts approve)

Scale: 10 easy · 15 place/effort · 20 medium · 25–30 video/creative.
Everyone tagged on a proof gets the full points (no multiplier; groups are
the point). Best approved proof per person per quest counts; repeatables
count per distinct instance up to the cap.

**At a place**
| Slug | Quest | Pts | Evidence | ⚠ |
|---|---|---|---|---|
| 851 | Selfie at the 851 California doorstep or lobby | 15 | photo | |
| 1412 | Selfie outside or in the lobby of 1412 Market | 15 | photo | |
| all-star | Grab something at All Star next to 1412 | 10 | photo | confirm name |
| grace | Recreate a Grace Cathedral steps photo | 15 | photo | |
| corona | At Corona Heights, write a note to someone who couldn't come | 20 | photo + text | notes go to the person after, via organizers |
| palace | Shout something in a circle at Palace of Fine Arts | 15 | video | |
| old-hq | Professor charades at the old Minerva HQ | 20 | video | confirm address |
| res-hall | Selfie with a non-M21 at 2550 Van Ness | 10 | photo | |
| bobs-eat | Eat a Bob's donut | 10 | photo | |
| bobs-challenge | The Bob's Donuts challenge | 20 | video | define the challenge |
| saigon | Get a Saigon Sandwich | 10 | photo | |
| ferry | Ferry Building farmers market | 10 | photo | market ends 14:00 |
| coolbrith | Ina Coolbrith Park | 10 | photo | |
| landmark | A legacy landmark (Crissy Field, Coit Tower, Painted Ladies…) | 15 | photo | repeatable ×3 |
| parks | An SF park you haven't been to today | 5 | photo | repeatable ×5 |

**Anywhere**
| Slug | Quest | Pts | Evidence | ⚠ |
|---|---|---|---|---|
| recreate | Recreate a first-year photo — upload the original and the recreation | 30 | photo ×2 | |
| professor | Video-call your favorite professor | 25 | screenshot | consent; organizers pre-warn faculty |
| absent-call | Video-call someone who isn't here and make them do something | 20 | screenshot/video | |
| sports | Challenge another group at a sport | 20 | video | |
| new-hc | Make a new HC (name + one-line definition) | 15 | text + photo | |
| legacy-selfie | Selfie with your legacy | 15 | photo | define "legacy" |
| soylent | Drink Soylent (or Huel) with a photo of Oscar Englebrektsen | 15 | photo | Soylent vs Huel; supply the reference photo |
| rather-be | Sing "Rather Be" somewhere public | 15 | video | +15 bonus if strangers join |
| rotation-photo | A photo that represents a rotation city | 10 | photo | repeatable ×6 (Seoul, Hyderabad, Berlin, BA, London, Taipei) |
| rotation-food | Eat food from a rotation city | 10 | photo | repeatable ×6 |
| rule | Recreate (safely) a rule you broke in college | 20 | photo/video | wording review |
| of-course | "I'm a Minervan, of course I…" video with friends | 25 | video | |
| rice-cooker | Make a meal in a rice cooker | 20 | photo | |
| karaoke | Karaoke at Pandora | 20 | video | |
| hc-advice | Give unsolicited HC advice to a stranger | 20 | video | |
| reel | Make a Reel of your crew's day | 25 | video | |

Not quests (evening program): guess-the-class/person from quotes, video
messages from faculty/alumni, performances. Bonfire is a checkpoint, not a
quest.

## 7. Data model (Supabase, additive; RLS on, no policies; server routes only)

```sql
-- Intent, not reservations.
create table plans (
  rsvp_id uuid not null references rsvps(id),
  activity_id text not null,               -- e.g. 'sat-lunch'
  intent text not null check (intent in ('going','interested')),
  updated_at timestamptz not null default now(),
  primary key (rsvp_id, activity_id)
);

-- One proof. Points are derived at read time (never stored).
create table q_submissions (
  id uuid primary key default gen_random_uuid(),
  quest_id text not null,                  -- slug from src/lib/questival.ts
  uploader_rsvp_id uuid not null references rsvps(id),
  members uuid[] not null,                 -- credited rsvp ids, uploader included
  media jsonb not null default '[]',       -- [{path, type:'image'|'video', w, h}]
  caption text,
  note text,                               -- for text-evidence quests
  instance int not null default 1,         -- repeatables
  status text not null default 'approved'  -- draft | approved | rejected
    check (status in ('draft','approved','rejected')),
  points_override int,                     -- organizer adjustment
  review_note text,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index q_submissions_created_idx on q_submissions (created_at desc);
create index q_submissions_members_idx on q_submissions using gin (members);

-- The "Submit final list" act.
create table q_finals (
  rsvp_id uuid primary key references rsvps(id),
  submitted_at timestamptz not null default now(),
  extension_used boolean not null default false
);

-- Teams (cohosts assign; a person is on one team).
create table q_teams (
  id text primary key,                     -- 'berlin'
  name text not null,
  color text not null
);
alter table rsvps add column team_id text references q_teams(id);

-- Intentions: "I want to do this, with these people." Not a submission.
create table q_plans (
  id uuid primary key default gen_random_uuid(),
  rsvp_id uuid not null references rsvps(id),
  kind text not null check (kind in ('quest','activity')),
  target_id text not null,
  with_rsvp_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index q_plans_with_idx on q_plans using gin (with_rsvp_ids);

-- Inbox read/answer state (the inbox itself is derived from q_plans).
create table q_plan_replies (
  plan_id uuid not null references q_plans(id),
  rsvp_id uuid not null references rsvps(id),
  reply text not null check (reply in ('in','maybe')),
  at timestamptz not null default now(),
  primary key (plan_id, rsvp_id)
);

-- Event switches (single row).
create table q_settings (
  id int primary key default 1,
  opens_at timestamptz not null,           -- 2026-09-12 10:00 PT
  due_at timestamptz not null,             -- 2026-09-12 17:00 PT
  extension_until timestamptz not null,    -- 2026-09-12 17:07 PT
  announcement text,
  results_released_at timestamptz,
  frozen_at timestamptz
);
```

Storage: new **public** bucket `questival`, paths
`q/<quest>/<rsvp>/<uuid>.<ext>` (unguessable, same posture as RSVP photos).
Feeds are behind sign-in at the API layer; a direct URL is shareable, which
is fine for silly photos among 50 friends. 50 MB per file limit.

Quests and activities are **static TypeScript** (`src/lib/weekend.ts`,
`src/lib/questival.ts`) — no CMS. Editing = a commit + `vercel --prod`,
which is faster and safer than an admin UI this week. Organizer-time
tweaks (announcement, points overrides, release) live in the tables above.

## 8. APIs (all under `/api`, service-role, bearer-verified where noted)

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/weekend/plans?activity=` | none for counts; bearer for names | who's going |
| `PUT /api/weekend/plans` | bearer + RSVP | set/clear intent |
| `GET /api/questival/state` | none | settings + counts + my status when bearer |
| `POST /api/questival/upload-url` | bearer + joined RSVP | signed upload URL + final path (client PUTs directly; no function body limit) |
| `POST /api/questival/submissions` | bearer + joined | create proof (media paths must start with caller's prefix; members validated against paid/processing rsvps; single insert, idempotency key) |
| `PATCH /api/questival/submissions/[id]` | uploader or organizer | edit caption/tags/remove before deadline; organizer reject/adjust |
| `GET /api/questival/me` | bearer | my list, plans, team, points, final state |
| `POST /api/questival/plans` · `DELETE …/[id]` | bearer | plan a quest/activity with people |
| `GET /api/questival/inbox` · `POST …/[planId]/reply` | bearer | invitations derived from `q_plans`; answer in/maybe |
| `GET /api/map` | none; bearer for faces | pins + who's going/planning per pin |
| `POST /api/questival/admin/teams` | organizer | upload the team assignment (CSV of email → team) |
| `POST /api/questival/final` | bearer | seal (server checks due/extension) |
| `GET /api/questival/feed?cursor=` | bearer | newest first, cursor paginated, whitelisted DTO (no emails, no GPS) |
| `GET /api/questival/board` | bearer | derived leaderboard, cached 15s |
| `GET /api/questival/results` | bearer | only after release |
| `POST /api/questival/admin/*` | organizer allowlist | announce, release, freeze |

Existing `/api/submissions` (Assignment 1) is untouched. Its rsvp-id-only
auth pattern is **not** copied: every new write verifies the Google token
and resolves the RSVP by verified email, like `/api/me`.

## 9. Identity, permissions, edge cases

- Browse: no sign-in. Plans/tags/proofs: Google sign-in → `/api/me` →
  RSVP with `paid|processing`. Same rule as Assignment 1.
- Google OAuth is blocked inside Instagram/Facebook in-app webviews.
  iMessage/WhatsApp open real browsers and are fine. The sign-in page shows
  "If this fails, open in Safari/Chrome" with a copy-link button.
- Dual accounts (memory): hint under the sign-in button.
- Organizers: `ORGANIZER_EMAILS` env (Ani, Amal, Anna, Mau, Dulce, Nathan).
- Faculty / partners without an RSVP: can browse and see the feed only if
  signed in and on an `EXTRA_VIEWERS` allowlist; they cannot submit. Keep
  out of v1 unless someone asks.

## 10. Deadline and scoring rules (server-enforced, PT)

- Opens Sat 10:00. Captures before that save as drafts but do not count.
- `due_at` 17:00: "Submit final list" → `q_finals`. 17:00–17:07: allowed,
  `extension_used = true`, chip says "Extension used". After 17:07: uploads
  and finals rejected with "Closed — you're at the bonfire, go enjoy it".
- Anyone who never pressed Submit still has their approved proofs counted
  (we do not punish forgetting; the button is ceremony + a nudge).
- Points: base per quest; everyone in `members` gets it; best proof per
  (person, quest, instance); overrides win; rejected = 0. Team quests only
  count when `members` contains ≥ `teamMin` people from the uploader's
  team. Team score = sum of its members' scores. Board recomputed per read
  from approved rows (≤ 2k rows, trivial).
- Freeze at results release; edits after freeze do not change the board.

## 11. Collaboration

**Between classmates (product)**
- Teams are assigned by cohosts and shown everywhere; tagging is how credit
  flows. One phone uploads, everyone tagged is credited.
- Plan it: intentions with people, invitations in the inbox, "I'm in" adds
  you. The map shows who's planning to be where.
- "Who's going" faces on every activity; "I'm going" is one tap; Share
  sends a link that unfurls.
- Feed shows what other crews are doing right now → spontaneous joining.
- "With" line on My Questival shows who you've done things with; the board
  shows "Most tagged".

**Between organizers**
- Review queue, announcement strip, release/freeze. Points overrides with
  a note. Everything else is a code change on the branch.

**With Mau (code)**
- Add Mau as a collaborator on `anirudhnair42/m21`; work on
  `anirudhnair42/questival-site-prep`; every push gets a Vercel preview URL
  to test on phones.
- Borrow from walkspot with a provenance comment: `src/image.ts` (client
  shrink) and `api/submissions/scoring.ts` (pointsFor/leaderboard tests
  pattern). Nothing else is transplanted.
- If Mau ships Walkspot's map/route planner, link it from the Questival hub
  as "Plan a walk (Mau's tool)". Optional, never required.

## 12. Changes to existing code

| File | Change |
|---|---|
| `src/lib/reunion-course.ts` | Sessions now import agenda from `src/lib/weekend.ts` (single source for desktop + mobile). Assignments list gains `a2q` "Assignment 2: Questival". |
| `src/lib/weekend.ts` (new) | Activities: id, day, time (ISO PT), title, venue, address, mapsUrl, host, kind (anchor/optional/peer), bring, cost, status note. |
| `src/lib/questival.ts` (new) | Quest catalog + pure rules (deadline math, points). |
| `src/components/mobile/MobileShell.tsx` | Renders `ForumMobile` home instead of the invitation card; keeps `stay`/`aid`. |
| `src/components/forum/*` (new) | `ForumMobile` shell, `WeekendView`, `ActivityView`, `MapView` (Leaflet, dynamic import), `InboxView`, `QuestivalHub`, `QuestView` with Plan-it, `MyQuestival`, `LiveView` (Teams/People/Feed), `ResultsView`, `ReviewView`. |
| `package.json` | `leaflet` + `@types/leaflet` (only new dependency). |
| `src/app/weekend/**`, `src/app/questival/**` (new) | Routes with `generateMetadata` for unfurls. |
| `src/styles/forum-mobile.css` (new) | Mobile layout only; all colors/type from existing tokens. |
| `src/components/apps/ALF.tsx` | Session pages read the new data; course table shows Assignment 2 with "Open on your phone" + link; ForumHome due list adds Assignment 2. |
| `src/lib/auth.ts` | `signInTo` accepts a return path. |
| `src/app/api/questival/**`, `src/app/api/weekend/**` (new) | Section 8. |
| `sql/questival.sql` (new) | Section 7. |
| `.env` | `ORGANIZER_EMAILS`. |
| Tests | `node:test` for `questival.ts` rules (deadline windows, points, board ties). No test runner exists today; add `"test": "node --test src/**/*.test.ts"` via tsx. |

## 12b. Cohost preview and the launch gate

The mobile Forum routes ship to **production unlisted**, behind a server-side
gate, so cohosts can test with real Google sign-in on their own phones:

- `GET /api/forum/access` verifies the Google token and answers `allowed`
  when the email is in `FORUM_TESTERS` (comma-separated, Vercel env) or when
  `FORUM_OPEN=1` and the email has a confirmed RSVP.
- Not allowed → the page shows the ALF "Will be unlocked later" card with
  the Google button. Signed-in but not on the list → "Not on the preview
  list yet — ask Ani." Nothing about the weekend leaks.
- Sign-in from the Forum stores the return path, redirects through Google,
  and lands back on the same route. If Supabase collapses the redirect to
  the site root, `Shell` finishes the exchange and bounces to the stored
  path. Testers sign in with whichever Google account they RSVP'd with.
- **Launch** = set `FORUM_OPEN=1`, redeploy, and switch the mobile root
  from the "visit on a computer" card to the Forum home.

The gate also matches by name (`FORUM_TESTER_NAMES`) against the RSVP row
and the Google profile, so a cohost passes with either of their accounts.
On the desktop the same check hides the Calendar/Maps/Photos dock icons,
the invitations in Mail, and the Assignment 3 row until it passes.

Shipped 2026-09-07 to production, gated. Share `https://www.m2021.co/weekend`
(phone) or `https://www.m2021.co` (desktop, sign in through ALF).

## 13. Build order (all on this branch, preview URL after each step)

| When | Step | Done when |
|---|---|---|
| Sun Sep 6 (today) | **Phone preview**: mobile Forum with real itinerary + quest catalog, local state, no backend | Ani opens it on a phone |
| Mon Sep 7 | Data files + routes + OG metadata; mobile home replaces the card; desktop ALF reads the same data; `plans` table + API + sign-in return path | Going/Interested works cross-device |
| Tue Sep 8 | `q_*` tables, upload URL, submissions, My Questival, final submit + deadline, plans + inbox, map API, team board | Ani + one cohost complete a quest end-to-end on iPhone and Android |
| Wed Sep 9 | Review queue, announcement, results reveal, results page, polish, cohost rehearsal on the group chat | 5 phones, 20 uploads, no stuck states |
| Thu Sep 10 | Content freeze (venues confirmed), `vercel --prod`, share link in the class group | Launched |
| Sat Sep 12 | Ani/Amal on review; release results at dinner | |

## 14. Verification checklist

- `pnpm exec tsc --noEmit`, `pnpm lint` (no new errors; the 34 existing are
  pre-existing), `node --test`.
- Phones: iPhone Safari (camera capture, HEIC from library, MOV video),
  Android Chrome (JPEG, MP4), WhatsApp/iMessage in-app open → sign-in.
- Upload 10 MB photo on LTE with the screen locking mid-upload → retry
  works, receipt persists.
- Deadline: clock the server to 16:59 / 17:03 / 17:08 with a test
  `q_settings` row.
- Sign out / other Google account → clean states, no spinner traps.
- Desktop unchanged: intro, RSVP closed state, Hotels, aid link.

## 15. Decisions needed from Ani / cohosts (not blocking the preview)

1. Friday lunch: Spark Social or Presidio Tunnel Tops trucks? Southern
   Pacific reservation confirmed?
2. Saturday: 11:30 AM for Sports Palooza? Alamo = Alamo Square? Lunch host
   at 2550 Van Ness? Which Common Space property, and its address?
3. Questival window 10:00–17:00 with 17:07 extension — OK? Results at
   dinner ~20:30?
4. Approve the catalog and draft points (Section 6); resolve Soylent/Huel,
   "legacy", the donut challenge definition, old HQ address.
5. Names on "who's going" visible to signed-in attendees; counts public —
   OK?
6. Organizer email list.
7. Sunday closing moment time; bagels.
8. Team assignment: six rotation-city teams, cohosts assign from Assignment
   1 answers by Thursday. Confirm names and the team-quest list.

## 16. Out of scope this week

Chat, reactions, push notifications, offline maps, fixed teams, a CMS,
video transcoding, Supabase Realtime, Walkspot embedding, post-reunion
archive (that becomes Assignment 3 / the Photo Wall app after the weekend).

## 17. Revisions after Mau's review (2026-09-07)

Source: Ani ↔ Mau chat, Sept 7. Agreed: one integrated site, ALF design
language, Walkspot's underlying logic (scoring, upload rules) reused where it
saves time. Mau's notes and the resulting changes:

### Remove
- **Teams.** No assignment, no team quests, no `teamMin`, no Teams board,
  no team colors in the class list. Tagging stays as the only group
  mechanic ("hang out with whoever you want"). Drop `q_teams`,
  `rsvps.team_id`, the team card on the hub, and the "Team" filter. Points
  raised for the former team quests go back to their base values.
- **Speed catch-up pre-selection.** Nothing to pick in advance for the
  13:30 block; cohosts randomize on the spot.

### Add
- **Organizer section** (`/questival/review`, and an "Organizers" item in
  the desktop ALF sidebar): add/edit/archive quests and points live
  (stored overrides on top of the static catalog), review and reject
  proofs, adjust points with a note, pin the announcement, release results,
  and manage people (find someone's RSVP, fix a name, mark someone as
  organizer). Allowlist: `ORGANIZER_EMAILS`.
- **Feed, front and center.** The feed exists (Photos on desktop, the
  class-live view on the phone) but Mau couldn't find it. Make it a
  top-level **Feed** tab on the phone (replacing the now-unneeded Class
  tab slot) and the default view of Photos on the desktop; add "Latest from
  the class" to the Questival hub.
- **Catch-up requests** (Mau's mini-Calendly). From anyone's face in the
  class list: "Request a catch-up" → pick a window from the weekend's open
  slots (Fri 14:00–17:00, Sat 13:30–15:00, Sat 16:00–17:00, Sun
  11:00–14:00) and an optional line → lands in their inbox → Accept puts
  it on both calendars with a shared spot suggestion (nearest anchor).
  Table `catchups (id, from_rsvp, to_rsvp, slot, note, status)`.

### Keep, as reviewed
- Map with the schedule, plan-it with invitations, tagging, the submission
  page, the 5:00 PM final-submit moment, single sign-in.

### Launch prep (Ani's email with the full schedule)
- Content freeze on `weekend.ts` and `questival.ts` after cohost answers.
- `FORUM_OPEN=1` + redeploy; mobile root already switches to the Forum for
  anyone allowed.
- Email links: `https://www.m2021.co/weekend` and `https://www.m2021.co/questival`.
