-- Throwaway local schema for stress tests. Mirrors the live project's
-- pre-existing tables (from the payments and letter specs) so
-- sql/questival.sql can be applied on top. Never run against production.
create extension if not exists pgcrypto;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false, file_size_limit bigint
);

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  email text,
  from_city text,
  notes text,
  photo_url text,
  voice_url text,
  payment_method text,
  housing_interest boolean default false,
  hotel_paid boolean default false,
  amount_cents int,
  status text not null default 'pending',
  stripe_session_id text unique
);
create table if not exists public.submissions (
  rsvp_id uuid not null references public.rsvps(id),
  assignment text not null,
  body text,
  updated_at timestamptz default now(),
  primary key (rsvp_id, assignment)
);
create table if not exists public.aid_requests (
  id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
  name text not null, email text not null, barriers text[], amount text, would_attend text, reason text
);
create table if not exists public.considering (
  email text primary key, name text, created_at timestamptz default now()
);
create table if not exists public.letter_invites (
  token text primary key, email text not null, name text not null, variant text not null default 'default',
  created_at timestamptz not null default now(), opened_at timestamptz
);

-- PostgREST roles. The service-role JWT the dev server carries switches to
-- service_role, which bypasses RLS like Supabase's does.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator noinherit login password 'authenticator'; end if;
end $$;
grant anon, service_role to authenticator;
grant usage on schema public, storage to anon, service_role;
grant all on all tables in schema public, storage to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
