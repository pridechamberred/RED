-- incREDible — migration 001
-- Leadership decision: a Done Deal no longer records who the referral came
-- from, and no longer records the customer / business name. A Done Deal is now
-- purely self-reported by the member who closed it.
--
-- Run this ONCE in the Supabase SQL editor (Dashboard > SQL Editor > New query)
-- against your existing database. It is idempotent: safe to re-run.
--
-- ⚠️ THIS PERMANENTLY DESTROYS DATA. Dropping these two columns deletes the
-- referrer link and the customer name from every existing done deal, including
-- the seeded sample rows. There is no undo. Take a backup first if you want the
-- option of restoring (Dashboard > Database > Backups).

-- 1. The RLS policies reference the columns we are about to drop, so they must
--    be replaced first. Visibility and inserts now hinge only on user_id, the
--    member who recorded the deal.
drop policy if exists done_deals_select on public.done_deals;
create policy done_deals_select on public.done_deals
  for select to authenticated
  using (public.can_view_member(user_id));

drop policy if exists done_deals_insert_own on public.done_deals;
create policy done_deals_insert_own on public.done_deals
  for insert to authenticated
  with check (user_id = public.current_member_id());

-- 2. Drop the columns. This also removes the foreign key and any index that
--    depended on referral_from_member_id.
alter table public.done_deals drop column if exists referral_from_member_id;
alter table public.done_deals drop column if exists customer_name;

-- 3. Sanity check — should return only the surviving columns:
--    id, user_id, deal_value, deal_type, recurring_value,
--    recurring_frequency, date, created_at
--
--   select column_name, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'done_deals'
--    order by ordinal_position;
