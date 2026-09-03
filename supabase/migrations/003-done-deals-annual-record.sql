-- ---------------------------------------------------------------------------
-- 003  Done Deals Record: rolling annual totals
-- ---------------------------------------------------------------------------
-- Run once in the Supabase SQL editor. Every step is idempotent EXCEPT step 4,
-- which deletes all existing done deals. Read step 4 before running.
--
-- Done deals stop being a snapshot of a closed amount and become a running
-- record. A recurring deal now stores only what it bills per period; the total
-- is accrued from the start date and scoped to the calendar year, so it resets
-- each January while the deal itself keeps running.
--
-- 1. Recurring deals no longer carry a fixed total, so deal_value only applies
--    to one-off deals and must be nullable.
alter table public.done_deals alter column deal_value drop not null;

-- 2. Two new controls, both driven by the Update button on the record.
--    recurring_ended_on  — accrual halts here, permanently. A stopped deal
--                          locks at what it accrued and never resumes.
--    total_override      — a manual figure replacing the computed total. Scoped
--                          to one year via total_override_year so an override
--                          set this year cannot silently leak into the next.
alter table public.done_deals
  add column if not exists recurring_ended_on  date,
  add column if not exists total_override      numeric(12, 2),
  add column if not exists total_override_year integer;

alter table public.done_deals drop constraint if exists done_deals_total_override_check;
alter table public.done_deals
  add constraint done_deals_total_override_check
  check (total_override is null or total_override >= 0);

-- An override is meaningless without the year it applies to, and vice versa.
alter table public.done_deals drop constraint if exists done_deals_override_year_check;
alter table public.done_deals
  add constraint done_deals_override_year_check
  check ((total_override is null) = (total_override_year is null));

-- Only recurring deals can be stopped.
alter table public.done_deals drop constraint if exists done_deals_ended_check;
alter table public.done_deals
  add constraint done_deals_ended_check
  check (recurring_ended_on is null or deal_type = 'recurring');

-- 3. Updating a deal is new, so it needs its own policy. Members may only
--    touch their own rows, and may not reassign a row to someone else.
drop policy if exists done_deals_update_own on public.done_deals;
create policy done_deals_update_own on public.done_deals
  for update to authenticated
  using (user_id = public.current_member_id())
  with check (user_id = public.current_member_id());

-- 4. DESTRUCTIVE, AND THE ONE PART OF THIS FILE THAT IS NOT SAFE TO RE-RUN.
--    The four seeded rows each stored a fixed total alongside a per-period
--    amount, which the new model has no place for, and the test rows recorded
--    during development are meaningless. So: wipe every done deal.
--
--    There is no way to tell a seeded one-off row from a genuine one after the
--    fact, so this cannot be narrowed to "only the demo data" — it clears the
--    table outright. Comment this statement out before re-running the file at
--    any later date, or it will delete real member deals.
delete from public.done_deals;

-- 5. Verify.
--    Expect: zero rows, and the new columns present.
--
--   select count(*) as remaining_deals from public.done_deals;
--
--   select column_name, is_nullable, data_type
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'done_deals'
--   order by ordinal_position;
