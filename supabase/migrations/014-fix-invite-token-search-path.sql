se -- ===========================================================================
-- 014 · Fix "Database error creating new user" when adding members / signing up
--
-- Run this whole file in the Supabase SQL editor (Dashboard > SQL Editor >
-- New query). Idempotent and safe to re-run. No data is changed — existing
-- invite tokens are untouched; this only redefines a function.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS BROKEN
-- ---------------------------------------------------------------------------
-- Creating any new login (Admin > Add Member, and ordinary sign-up) failed with
-- the opaque Supabase auth error:
--
--     "Database error creating new user"  (HTTP 500)
--
-- The real cause was the trigger public.handle_new_user(), which fires on every
-- insert into auth.users and inserts the matching row into public.members. That
-- trigger is defined with `set search_path = ''` (a deliberate security-definer
-- hardening so it cannot be hijacked by a rogue search_path).
--
-- Migration 011 then made members.invite_token NOT NULL with a column default of
-- public.generate_invite_token(). That function had NO search_path of its own,
-- so when the trigger inserted a member the default was evaluated under the
-- trigger's empty search_path. Its body called gen_random_bytes() — a pgcrypto
-- function that on Supabase lives in the `extensions` schema, NOT in pg_catalog.
-- Under `search_path = ''` that name could not be resolved, the INSERT raised
-- `function gen_random_bytes(integer) does not exist`, and the whole auth.users
-- insert was rolled back — surfacing as the masked message above.
--
-- (The row's `id` default, gen_random_uuid(), kept working because it is a
-- pg_catalog builtin and pg_catalog is always implicitly on the search_path.
-- That is why only invite_token — added in 011 — triggered the failure, and why
-- the breakage started the day 011 was applied.)
--
-- ---------------------------------------------------------------------------
-- THE FIX
-- ---------------------------------------------------------------------------
-- Redefine generate_invite_token() so it does not depend on the caller's
-- search_path at all:
--   * pin its own `set search_path = ''`, and
--   * build the token from gen_random_uuid(), which is a pg_catalog builtin
--     (always resolvable), instead of pgcrypto's gen_random_bytes().
--
-- Output shape is unchanged: 16 lowercase hex characters, e.g. "9f3a1c7d2b4e6f08".
create or replace function public.generate_invite_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
$$;

-- ---------------------------------------------------------------------------
-- CHECK IT WORKED
-- ---------------------------------------------------------------------------
-- Should return a fresh 16-character hex string with no error.
select public.generate_invite_token() as sample_token;
