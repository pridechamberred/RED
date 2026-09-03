-- ---------------------------------------------------------------------------
-- 006  Done Deals: private, member-only notes
-- ---------------------------------------------------------------------------
-- Run once in the Supabase SQL editor. Every step is idempotent and none of it
-- touches existing data.
--
-- WHY THIS IS A SEPARATE TABLE, NOT A COLUMN ON done_deals
-- -------------------------------------------------------
-- These notes must never be visible to admins or super-admins: the field warns
-- members off putting customer data in it, but people will anyway, so the
-- storage has to assume it holds sensitive text.
--
-- A `notes` column on public.done_deals could NOT deliver that. The existing
-- select policy is:
--
--     create policy done_deals_select on public.done_deals
--       for select to authenticated using (public.can_view_member(user_id));
--
-- Postgres RLS is ROW level, not column level — it decides whether a row is
-- visible, never which of its columns are. So an admin who can see a member's
-- deal row can read every column on it, including a notes column. Hiding it in
-- application code (by leaving it out of the select list) is concealment, not
-- enforcement: the same admin's JWT could read it straight from PostgREST with
-- `?select=notes`, and any later feature that does `select *` would leak it by
-- accident.
--
-- Splitting the notes into their own table makes the privacy a property of the
-- schema instead of a property of our query strings. This table's policies key
-- on current_member_id() alone, with no can_view_member() anywhere, so an admin
-- session simply matches no rows.
--
-- The service role still bypasses RLS, as it does for every table — that is
-- server-only and unavoidable. No server code reads this table on an admin's
-- behalf.

-- 1. One private note per deal. Cascades with the deal, so removing a deal
--    removes its note and cannot leave an orphan behind.
create table if not exists public.done_deal_notes (
  deal_id    uuid primary key references public.done_deals (id) on delete cascade,
  -- Denormalised from done_deals so the RLS policies below can check ownership
  -- without a subquery back into done_deals (which would re-enter that table's
  -- admin-visible select policy).
  user_id    uuid not null references public.members (id) on delete cascade,
  note       text not null check (length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists done_deal_notes_user_idx on public.done_deal_notes (user_id);

-- 2. RLS: the owning member and nobody else. Note the deliberate absence of
--    public.can_view_member() — that helper is what grants admins visibility on
--    every other activity table, and it must not appear here.
alter table public.done_deal_notes enable row level security;

drop policy if exists done_deal_notes_select_own on public.done_deal_notes;
create policy done_deal_notes_select_own on public.done_deal_notes
  for select to authenticated
  using (user_id = public.current_member_id());

drop policy if exists done_deal_notes_insert_own on public.done_deal_notes;
create policy done_deal_notes_insert_own on public.done_deal_notes
  for insert to authenticated
  with check (user_id = public.current_member_id());

drop policy if exists done_deal_notes_update_own on public.done_deal_notes;
create policy done_deal_notes_update_own on public.done_deal_notes
  for update to authenticated
  using (user_id = public.current_member_id())
  with check (user_id = public.current_member_id());

drop policy if exists done_deal_notes_delete_own on public.done_deal_notes;
create policy done_deal_notes_delete_own on public.done_deal_notes
  for delete to authenticated
  using (user_id = public.current_member_id());

-- 3. Verify.
--
--    a) The table and its policies exist, and NONE of them mention
--       can_view_member. Expect four rows, all qualifying on current_member_id:
--
--   select policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'public' and tablename = 'done_deal_notes';
--
--    b) Belt and braces — this should return zero rows. If it ever returns a
--       row, an admin can read members' private notes:
--
--   select policyname
--   from pg_policies
--   where schemaname = 'public'
--     and tablename = 'done_deal_notes'
--     and (coalesce(qual, '') || coalesce(with_check, '')) like '%can_view_member%';
