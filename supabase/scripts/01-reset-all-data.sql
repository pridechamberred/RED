-- ===========================================================================
-- 01 — RESET ALL DATA
-- ===========================================================================
-- Wipes every member and every activity row, ready for the real CSV import.
--
-- *** THIS IS DESTRUCTIVE AND CANNOT BE UNDONE. ***
-- Run it once in the Supabase SQL editor. Take a backup first if you want a
-- way back (Dashboard > Database > Backups).
--
-- Confirmed live counts before writing this (via the REST API):
--     members 17 · vous 6 · referrals 5 · done_deals 0
--     volunteering 6 · chamber_events 8 · guest_invitations 0
--     auth users 1  (redtracker.verify.9f3a@gmail.com — the test login)
--
-- WHAT IS KEPT: the test auth account, as you asked. See step 3 — it needs a
-- member row rebuilt or it cannot get past the login screen.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Clear the activity tables.
-- ---------------------------------------------------------------------------
-- Every activity row references members(id) with `on delete cascade`, so
-- deleting members would clear these anyway. They are listed explicitly so the
-- row counts below tell you exactly what went, rather than it happening
-- invisibly as a side effect.

delete from public.vous;
delete from public.referrals;
delete from public.done_deals;
delete from public.volunteering;
delete from public.chamber_events;
delete from public.guest_invitations;


-- ---------------------------------------------------------------------------
-- 2. Clear the members.
-- ---------------------------------------------------------------------------

delete from public.members;


-- ---------------------------------------------------------------------------
-- 3. Rebuild the member row for the test login.  <-- DO NOT SKIP
-- ---------------------------------------------------------------------------
-- This is the non-obvious bit. `members.auth_user_id` links a member to a real
-- auth account, and the app resolves the signed-in user by looking that link
-- up. Step 2 deleted the row the test account was linked to, so the auth
-- account still exists but now points at nothing — every page would bounce
-- straight back to the login screen.
--
-- The signup trigger that normally claims a member row only fires on NEW
-- signups, so it will not repair this. We re-link by hand.
--
-- If you would rather not keep this account at all, skip this step and delete
-- the auth user in Dashboard > Authentication > Users instead.

insert into public.members (auth_user_id, first_name, last_name, email, company, role, sub_group)
select u.id, 'Test', 'Account', u.email, 'v0 verification', 'super-admin', 'RED Central'
from auth.users u
where u.email = 'redtracker.verify.9f3a@gmail.com'
on conflict (email) do update
  set auth_user_id = excluded.auth_user_id,
      role         = 'super-admin';


-- ---------------------------------------------------------------------------
-- 4. Confirm the result.
-- ---------------------------------------------------------------------------
-- Expect: members 1 (the test account), every activity table 0.

select 'members'           as table_name, count(*) from public.members
union all select 'vous',              count(*) from public.vous
union all select 'referrals',         count(*) from public.referrals
union all select 'done_deals',        count(*) from public.done_deals
union all select 'volunteering',      count(*) from public.volunteering
union all select 'chamber_events',    count(*) from public.chamber_events
union all select 'guest_invitations', count(*) from public.guest_invitations
order by table_name;
