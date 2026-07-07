-- "Considering" list: people who signed in with Google but haven't RSVP'd yet.
-- Run this once in the Supabase SQL editor.
--
-- Like `rsvps`, RLS is enabled with NO public policies — the service-role key
-- used by /api/considering is the only thing that reads or writes it.

create table if not exists public.considering (
  email      text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

alter table public.considering enable row level security;
