-- Weekend Forum + Questival tables. Run once in the Supabase SQL editor;
-- every statement is idempotent so re-running is safe.
--
-- Like `rsvps`, RLS is enabled with NO public policies: the service-role key
-- used by the /api/questival, /api/weekend and /api/catchups routes is the
-- only thing that reads or writes these tables. No teams (spec section 17).

-- Organizer additions and overrides on top of the static catalog in
-- src/lib/questival.ts, keyed by the quest slug. A row for a static id
-- overrides that quest; a new id adds one.
create table if not exists public.q_quests (
  id          text primary key,
  title       text not null,
  prompt      text not null default '',
  points      int  not null check (points between 1 and 200),
  evidence    text not null check (evidence in ('photo','video','photo-pair','text-photo','screenshot')),
  venue       text,
  address     text,
  area        text,
  lat         double precision,
  lng         double precision,
  repeat      int check (repeat between 1 and 12),
  bonus       text,
  tip         text,
  status      text not null default 'live' check (status in ('live','draft','archived')),
  updated_at  timestamptz not null default now(),
  updated_by  text
);
alter table public.q_quests enable row level security;

-- Activity intent ("going" / "interested"), not reservations.
create table if not exists public.plans (
  rsvp_id     uuid not null references public.rsvps(id) on delete cascade,
  activity_id text not null,
  intent      text not null check (intent in ('going','interested')),
  updated_at  timestamptz not null default now(),
  primary key (rsvp_id, activity_id)
);
alter table public.plans enable row level security;
create index if not exists plans_activity_idx on public.plans (activity_id);

-- "I want to do this, with these people." Not a submission.
create table if not exists public.q_plans (
  id            uuid primary key default gen_random_uuid(),
  rsvp_id       uuid not null references public.rsvps(id) on delete cascade,
  kind          text not null check (kind in ('quest','activity')),
  target_id     text not null,
  with_rsvp_ids uuid[] not null default '{}',
  created_at    timestamptz not null default now()
);
alter table public.q_plans enable row level security;
create index if not exists q_plans_with_idx on public.q_plans using gin (with_rsvp_ids);
create index if not exists q_plans_owner_idx on public.q_plans (rsvp_id);
create index if not exists q_plans_target_idx on public.q_plans (kind, target_id);
-- One plan per (owner, kind, target): planning again replaces the earlier
-- plan. Older duplicates from before this rule go first so the index builds.
delete from public.q_plans a using public.q_plans b
  where a.rsvp_id = b.rsvp_id and a.kind = b.kind and a.target_id = b.target_id
    and (a.created_at, a.id) < (b.created_at, b.id);
create unique index if not exists q_plans_owner_target_uidx on public.q_plans (rsvp_id, kind, target_id);

-- Answers to an invitation. The inbox itself is derived from q_plans.
create table if not exists public.q_plan_replies (
  plan_id uuid not null references public.q_plans(id) on delete cascade,
  rsvp_id uuid not null references public.rsvps(id) on delete cascade,
  reply   text not null check (reply in ('in','maybe')),
  at      timestamptz not null default now(),
  primary key (plan_id, rsvp_id)
);
alter table public.q_plan_replies enable row level security;

-- One proof. Points are derived at read time (override ?? quest points).
create table if not exists public.q_submissions (
  id               uuid primary key default gen_random_uuid(),
  quest_id         text not null,
  instance         int  not null default 1,
  uploader_rsvp_id uuid not null references public.rsvps(id) on delete cascade,
  members          uuid[] not null default '{}',          -- credited rsvp ids, uploader included
  media            jsonb not null default '[]'::jsonb,    -- [{path, type:'image'|'video'}]
  caption          text,
  note             text,
  status           text not null default 'approved' check (status in ('approved','rejected')),
  points_override  int,
  review_note      text,
  reviewed_by      text,
  idempotency_key  text not null unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.q_submissions enable row level security;
create index if not exists q_submissions_created_idx on public.q_submissions (created_at desc);
create index if not exists q_submissions_members_idx on public.q_submissions using gin (members);
create index if not exists q_submissions_uploader_idx on public.q_submissions (uploader_rsvp_id);
create index if not exists q_submissions_quest_idx on public.q_submissions (quest_id, instance);

-- The "Submit final list" act. Ceremony plus a nudge; proofs count either way.
create table if not exists public.q_finals (
  rsvp_id        uuid primary key references public.rsvps(id) on delete cascade,
  submitted_at   timestamptz not null default now(),
  extension_used boolean not null default false
);
alter table public.q_finals enable row level security;

-- Event switches. Exactly one row (id = 1). Times are Sat Sep 12, 2026 in
-- San Francisco (PDT, UTC-7): opens 10:00, due 17:00, extension to 17:07.
create table if not exists public.q_settings (
  id                  int primary key default 1 check (id = 1),
  opens_at            timestamptz not null default '2026-09-12 10:00:00-07',
  due_at              timestamptz not null default '2026-09-12 17:00:00-07',
  extension_until     timestamptz not null default '2026-09-12 17:07:00-07',
  announcement        text,
  results_released_at timestamptz,
  frozen_at           timestamptz
);
alter table public.q_settings enable row level security;
insert into public.q_settings (id) values (1) on conflict (id) do nothing;

-- Catch-up requests (Mau's mini-Calendly). Slot ids come from CATCHUP_SLOTS
-- in src/lib/weekend.ts.
create table if not exists public.catchups (
  id         uuid primary key default gen_random_uuid(),
  from_rsvp  uuid not null references public.rsvps(id) on delete cascade,
  to_rsvp    uuid not null references public.rsvps(id) on delete cascade,
  slot       text not null,
  note       text,
  status     text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now()
);
alter table public.catchups enable row level security;
create index if not exists catchups_from_idx on public.catchups (from_rsvp);
create index if not exists catchups_to_idx on public.catchups (to_rsvp);

-- Public bucket for proof media. Paths are q/<quest>/<rsvp>/<random>.<ext>
-- (unguessable, same posture as RSVP photos). 50 MiB per file.
insert into storage.buckets (id, name, public, file_size_limit)
values ('questival', 'questival', true, 52428800)
on conflict (id) do nothing;
