-- ============================================================================
-- Reset activity & attendance data — start recording "from scratch"
-- ============================================================================
-- Run THIS file in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- NOTE: this is NOT `01-reset-all-data.sql`. That other script deletes every
-- member and is the WRONG one for this goal — running it fails with
-- "...violates foreign key constraint meeting_attendance_recorded_by_fkey"
-- because meeting_attendance.recorded_by is ON DELETE RESTRICT. This script
-- keeps all members and only clears the recorded test data.
--
-- WHAT IT DELETES (all activity/attendance recorded to date):
--   meeting_attendance  – attendance register marks
--   vous                – 1-2-1 / vous
--   referrals           – referrals
--   done_deals          – done deals   (+ done_deal_notes, its private notes)
--   volunteering        – volunteering
--   chamber_events      – chamber-event attendance
--   guest_invitations   – guest invitations
--
-- WHAT IT KEEPS:
--   members             – EVERY member you have entered is retained, untouched
--   pride_chamber_events / pride_chamber_sync_runs – the synced Pride Chamber
--       public-calendar catalog + sync logs (NOT member data; the daily scraper
--       maintains these and the chamber-event form reads from them)
--
-- The whole thing runs in one transaction: if any statement fails, nothing is
-- deleted. Review the "before"/"after" counts; success = all activity counts 0
-- with members_kept unchanged.
-- ============================================================================

begin;

-- Counts BEFORE (so you can see what is about to be removed).
select 'before' as phase,
  (select count(*) from public.meeting_attendance) as meeting_attendance,
  (select count(*) from public.vous)               as vous,
  (select count(*) from public.referrals)          as referrals,
  (select count(*) from public.done_deals)         as done_deals,
  (select count(*) from public.done_deal_notes)    as done_deal_notes,
  (select count(*) from public.volunteering)       as volunteering,
  (select count(*) from public.chamber_events)     as chamber_events,
  (select count(*) from public.guest_invitations)  as guest_invitations,
  (select count(*) from public.members)            as members_kept;

-- Delete in foreign-key-safe order. Crucially, none of these statements touch
-- public.members, so the ON DELETE RESTRICT on meeting_attendance.recorded_by
-- is never exercised — members are left completely intact.

-- meeting_attendance references guest_invitations, so clear it first.
delete from public.meeting_attendance;

-- done_deal_notes references done_deals (child before parent).
delete from public.done_deal_notes;
delete from public.done_deals;

-- The remaining activity tables reference only members (which we keep) — order
-- among them does not matter.
delete from public.vous;
delete from public.referrals;
delete from public.volunteering;
delete from public.chamber_events;
delete from public.guest_invitations;

-- Counts AFTER — every activity table should read 0; members_kept unchanged.
select 'after' as phase,
  (select count(*) from public.meeting_attendance) as meeting_attendance,
  (select count(*) from public.vous)               as vous,
  (select count(*) from public.referrals)          as referrals,
  (select count(*) from public.done_deals)         as done_deals,
  (select count(*) from public.done_deal_notes)    as done_deal_notes,
  (select count(*) from public.volunteering)       as volunteering,
  (select count(*) from public.chamber_events)     as chamber_events,
  (select count(*) from public.guest_invitations)  as guest_invitations,
  (select count(*) from public.members)            as members_kept;

-- If the numbers look right, keep this. To back out instead, change to ROLLBACK.
commit;
