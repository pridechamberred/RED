-- incREDible — migration 008
-- Done Deals now record where the referral came from again.
--
-- This partly reverses migration 001, which dropped `referral_from_member_id`
-- on a leadership decision. The link is back, but in a richer form: a deal now
-- names one of four sources, only one of which is a member in this database.
-- `customer_name`, also dropped in 001, stays dropped — it is not reinstated
-- here.
--
-- Run this ONCE in the Supabase SQL editor (Dashboard > SQL Editor > New
-- query). It is idempotent: safe to re-run.
--
-- This migration is additive and destroys nothing.

-- 1. The source vocabulary, plus the member link used by the 'member' source.
--
--    Both columns are nullable, and deliberately so: every done deal recorded
--    before this migration has no answer to the question, and there is no
--    honest value to backfill. Null therefore means "recorded before this
--    field existed", which is a different thing from any of the four answers.
--    New deals are required to pick one — that rule is enforced in the server
--    action, not here, so historic rows stay valid.
alter table public.done_deals
  add column if not exists referral_source text,
  add column if not exists referral_from_member_id uuid
    references public.members (id) on delete set null;

-- `on delete set null` above, not cascade: if a member is deleted from the
-- database, the deal they referred still happened and must not disappear from
-- the recorder's own record. The source is repaired below rather than left
-- pointing at nothing.

-- 2. Constrain the vocabulary, and keep the member link consistent with it.
alter table public.done_deals
  drop constraint if exists done_deals_referral_source_check;
alter table public.done_deals
  add constraint done_deals_referral_source_check check (
    referral_source is null
    or referral_source in ('confidential', 'pride-chamber', 'former-red-member', 'member')
  );

-- A member id is meaningful only for the 'member' source, and is mandatory
-- there. This is what stops a half-set row: 'member' with nobody named, or a
-- name attached to 'confidential'.
alter table public.done_deals
  drop constraint if exists done_deals_referral_member_check;
alter table public.done_deals
  add constraint done_deals_referral_member_check check (
    case referral_source
      when 'member' then referral_from_member_id is not null
      else referral_from_member_id is null
    end
  );

-- 3. If a named member is ever deleted, the FK above nulls the id, which would
--    leave 'member' with no member and violate the constraint. Demote those
--    rows to 'former-red-member' — which is what someone removed from the
--    database now is — so the deletion cannot fail.
create or replace function public.demote_deleted_referral_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.done_deals
     set referral_source = 'former-red-member',
         referral_from_member_id = null
   where referral_from_member_id = old.id;
  return old;
end;
$$;

drop trigger if exists done_deals_demote_referral_source on public.members;
create trigger done_deals_demote_referral_source
  before delete on public.members
  for each row execute function public.demote_deleted_referral_source();

-- 4. Look up deals by who referred them (admin reporting on referral flow).
create index if not exists done_deals_referral_from_member_id_idx
  on public.done_deals (referral_from_member_id)
  where referral_from_member_id is not null;

-- 5. No RLS change is needed. done_deals visibility still hinges only on
--    user_id via can_view_member(), and public.members is readable by every
--    authenticated user, so embedding the referrer's name works even when they
--    sit in a different sub-group from the admin reading the row.

-- 6. Sanity check — both columns should be listed as nullable:
--
--   select column_name, is_nullable
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name = 'done_deals'
--      and column_name in ('referral_source', 'referral_from_member_id');
