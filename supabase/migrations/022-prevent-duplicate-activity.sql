-- 022: Prevent duplicate activity.
--
-- The app already refuses duplicates before inserting (see app/actions.ts).
-- These unique indexes stop the race where the same form is submitted twice in
-- quick succession. All are keyed on the date the activity HAPPENED, not when it
-- was logged.
--
-- STEP 1 — see what's duplicated. Run each query on its own; each one lists
-- the duplicated groups and how many copies exist. Nothing is changed.

select user_id, member_id, date, count(*) from public.vous
  group by 1, 2, 3 having count(*) > 1;
select user_id, date, count(*) from public.volunteering
  group by 1, 2 having count(*) > 1;
select user_id, date, lower(event_name), count(*) from public.chamber_events
  group by 1, 2, 3 having count(*) > 1;
select referrer_user_id, recipient_member_id, lower(referred_name), occurred_on, count(*)
  from public.referrals group by 1, 2, 3, 4 having count(*) > 1;

-- STEP 1b — remove the extra copies. Keeps the EARLIEST-logged row in every
-- duplicated group and deletes the rest. Nothing references these rows, so no
-- other data is affected.

delete from public.vous where id in (
  select id from (
    select id, row_number() over (
      partition by user_id, member_id, date order by created_at, id
    ) as n from public.vous
  ) ranked where n > 1
);

delete from public.volunteering where id in (
  select id from (
    select id, row_number() over (
      partition by user_id, date order by created_at, id
    ) as n from public.volunteering
  ) ranked where n > 1
);

delete from public.chamber_events where id in (
  select id from (
    select id, row_number() over (
      partition by user_id, date, lower(event_name) order by created_at, id
    ) as n from public.chamber_events
  ) ranked where n > 1
);

delete from public.referrals where id in (
  select id from (
    select id, row_number() over (
      partition by referrer_user_id, recipient_member_id, lower(referred_name), occurred_on
      order by created_at, id
    ) as n from public.referrals
  ) ranked where n > 1
);

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
