-- ---------------------------------------------------------------------------
-- 004 — "RED Virtual" becomes "RED Connect", plus the meeting a guest is
--        invited to
-- ---------------------------------------------------------------------------
-- Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Idempotent: safe to re-run.
--
-- RUN THIS BEFORE DEPLOYING the matching app release. `sub_group` carries a
-- CHECK constraint that still lists 'RED Virtual', so the new code would fail
-- with 23514 ("violates check constraint") the moment anyone adds a member to
-- RED Connect or invites a guest to it.
--
-- The rename itself is low risk right now: no members sit in RED Virtual (all
-- 41 are in Central/Uptown/Downtown) and guest_invitations is empty. The UPDATE
-- statements are kept anyway so this still does the right thing if it is run
-- later, or against a copy of the database that does hold such rows.

-- 1. Move any existing rows across FIRST. The constraint swap in step 2 is
--    validated against existing data, so a leftover 'RED Virtual' row would
--    abort the whole migration.
update public.members
   set sub_group = 'RED Connect'
 where sub_group = 'RED Virtual';

update public.guest_invitations
   set sub_group = 'RED Connect'
 where sub_group = 'RED Virtual';

-- 2. Swap the CHECK constraints. Postgres auto-names these
--    "<table>_<column>_check" when they are declared inline, as they were in
--    schema.sql. Dropping by that name is safe with IF EXISTS.
alter table public.members
  drop constraint if exists members_sub_group_check;

alter table public.members
  add constraint members_sub_group_check
  check (sub_group in ('RED Central', 'RED Uptown', 'RED Downtown', 'RED West', 'RED Connect'));

alter table public.guest_invitations
  drop constraint if exists guest_invitations_sub_group_check;

alter table public.guest_invitations
  add constraint guest_invitations_sub_group_check
  check (sub_group in ('RED Central', 'RED Uptown', 'RED Downtown', 'RED West', 'RED Connect'));

-- 3. Record WHICH meeting a guest is being invited to.
--
--    Deliberately a denormalised snapshot rather than a foreign key: meetings
--    live in an external Google Calendar with no stable database identity, and
--    an organiser can move, rename or delete an occurrence at any time. Storing
--    the title/time/venue as they were at the moment of invitation keeps the
--    record meaningful afterwards. meeting_uid is kept only for future matching.
--
--    All nullable: choosing a meeting is optional ("Not sure yet").
alter table public.guest_invitations
  add column if not exists meeting_uid      text,
  add column if not exists meeting_start    timestamptz,
  add column if not exists meeting_title    text,
  add column if not exists meeting_location text;

create index if not exists guest_invitations_meeting_start_idx
  on public.guest_invitations (meeting_start)
  where meeting_start is not null;

-- 4. Verify. Expect: zero 'RED Virtual' rows anywhere, and both constraints
--    listing 'RED Connect'.
--
--   select 'members' as t, sub_group, count(*) from public.members group by 2
--   union all
--   select 'guests', sub_group, count(*) from public.guest_invitations group by 2;
--
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conname in ('members_sub_group_check', 'guest_invitations_sub_group_check');
