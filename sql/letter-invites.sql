-- Personalized final-call letters: one unguessable token per person, so
-- /letter/<token> can greet them by name with no sign-in wall.
-- Run this once in the Supabase SQL editor.
--
-- Like `rsvps` and `considering`, RLS is enabled with NO public policies — the
-- service-role key used by the /letter route is the only thing that reads it.

create table if not exists public.letter_invites (
  token      text primary key,
  email      text not null,
  name       text not null,
  -- 'default' | 'unfinished' (started checkout, never paid — different ask)
  variant    text not null default 'default',
  created_at timestamptz not null default now(),
  -- Set on first view. Tells us who actually read it, which is what a final
  -- personal nudge before the deadline should be based on.
  opened_at  timestamptz
);

-- One letter per person, case-insensitively.
create unique index if not exists letter_invites_email_idx
  on public.letter_invites (lower(email));

alter table public.letter_invites enable row level security;
