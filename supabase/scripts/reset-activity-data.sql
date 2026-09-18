-- ============================================================================
-- Reset activity & attendance data — start recording "from scratch"
-- ============================================================================
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- WHAT IT DELETES (all test data recorded to date):
--   meeting_attendance  – attendance register marks
--   vous                – 1-2-1 / vous
--   referrals           – referrals
--   done_deals          – done deals   (+ done_deal_notes, its private notes)
--   volunteering        – volunteering
--   chamber_events      – chamber-event attendance
--   guest_invitations   – guest invitations
--
-- WHAT IT KEEPS:
--   members             – every member you have entered is retained
--   pride_chamber_events / pride_chamber_sync_runs – the synced Pride Chamber
--       public-calendar catalog + sync logs (NOT member data; the daily scraper
--       maintains these and the chamber-event form reads from them)
--
-- The whole thing runs in one transaction: if any statement fails, nothing is
-- deleted. Review the "before" and "after" counts it prints, and only the fact
-- that all "after" counts are 0 confirms success.
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

-- One TRUNCATE for all target tables. done_deal_notes is listed explicitly
-- because it has a foreign key into done_deals (it would also be removed by the
-- ON DELETE CASCADE, but naming it keeps TRUNCATE happy without CASCADE).
-- No other table references these, and members / pride_chamber_* are untouched.
truncate table
  public.meeting_attendance,
  public.vous,
  public.referrals,
  public.done_deal_notes,
  public.done_deals,
  public.volunteering,
  public.chamber_events,
  public.guest_invitations;

-- Counts AFTER — every activity table should read 0; members unchanged.
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
