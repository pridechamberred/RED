-- 022: Prevent duplicate activity.
--
-- The app already refuses duplicates before inserting (see app/actions.ts).
-- These unique indexes stop the race where the same form is submitted twice in
-- quick succession. All are keyed on the date the activity HAPPENED, not when it
-- was logged.
--
-- STEP 1 — run these first. A unique index can't be created while duplicates
-- exist, so any rows returned need tidying (delete the extra copies) before
-- STEP 2.

-- select user_id, member_id, date, count(*) from public.vous
--   group by 1, 2, 3 having count(*) > 1;
-- select user_id, date, count(*) from public.volunteering
--   group by 1, 2 having count(*) > 1;
-- select user_id, date, lower(event_name), count(*) from public.chamber_events
--   group by 1, 2, 3 having count(*) > 1;
-- select referrer_user_id, recipient_member_id, lower(referred_name), occurred_on, count(*)
--   from public.referrals group by 1, 2, 3, 4 having count(*) > 1;

-- STEP 2

-- One vous with the same person per day.
create unique index if not exists vous_once_per_day_uidx
  on public.vous (user_id, member_id, date);

-- Volunteering once per day.
create unique index if not exists volunteering_once_per_day_uidx
  on public.volunteering (user_id, date);

-- Each chamber event once (same name on the same day).
create unique index if not exists chamber_events_once_uidx
  on public.chamber_events (user_id, date, lower(event_name));

-- The same person referred to the same member once per day.
create unique index if not exists referrals_once_per_day_uidx
  on public.referrals (referrer_user_id, recipient_member_id, lower(referred_name), occurred_on);
