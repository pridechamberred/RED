-- incREDible — migration 009
-- Referrals can now be recorded as "offline" (already passed in person), and a
-- new referral no longer has to carry an email address.
--
-- Two kinds of referral now share this table:
--
--   'new'     — the referral is being made through the app. The recipient gets
--               the full details by email, exactly as before.
--   'offline' — a referral that already happened somewhere else (at an event,
--               over the phone). Both people have already spoken, so only the
--               referred person's name is captured. Nothing else is relevant.
--
-- Run this ONCE in the Supabase SQL editor (Dashboard > SQL Editor > New
-- query). It is idempotent: safe to re-run.
--
-- This migration is additive and destroys nothing. It only *relaxes*
-- constraints, so every existing row stays valid.

-- 1. How the referral was made.
--
--    Defaulted to 'new' rather than left nullable: every row written before
--    this migration was made through the app with full details, so 'new' is a
--    true statement about all of them, not a guess. That makes the column
--    `not null` honestly, and the app never has to handle a third "unknown"
--    case.
alter table public.referrals
  add column if not exists referral_mode text not null default 'new';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'referrals_referral_mode_check'
  ) then
    alter table public.referrals
      add constraint referrals_referral_mode_check
      check (referral_mode in ('new', 'offline'));
  end if;
end;
$$;

-- 2. When the referral actually happened.
--
--    An offline referral is recorded after the fact, so `created_at` (when it
--    was typed in) is the wrong date to report it under — a referral made at
--    last week's event would otherwise land in this week's numbers. This column
--    is the date to trust for reporting.
--
--    Backfilled from created_at for existing rows, which is exactly right for
--    them: an in-app referral happens the moment it is submitted.
alter table public.referrals
  add column if not exists occurred_on date;

update public.referrals
   set occurred_on = created_at::date
 where occurred_on is null;

alter table public.referrals
  alter column occurred_on set default current_date;

alter table public.referrals
  alter column occurred_on set not null;

-- 3. Whether the referred person asked to be told about the referral.
--
--    Only ever true for 'new' referrals that carry an email address. False is
--    the correct value for every historic row: that email did not exist yet, so
--    none were ever sent.
alter table public.referrals
  add column if not exists notify_referred boolean not null default false;

-- 4. Relax the two columns an offline referral cannot fill.
--
--    `referred_email` was `not null`, but an offline referral captures only a
--    name, and even a 'new' referral now treats the email as optional (the
--    member may only have a phone number). `details` was `not null` for the
--    same reason — there is nothing to tell the recipient when they already
--    know.
--
--    Nullable here means "not captured". The rule that a *new* referral must
--    still carry details is enforced in the server action, not in the schema,
--    so these two modes can diverge without a second table.
alter table public.referrals alter column referred_email drop not null;
alter table public.referrals alter column details       drop not null;

-- 5. Normalize any empty strings that earlier form posts may have stored, so
--    "not captured" is represented one way only. A later `is null` check would
--    otherwise miss an empty string and render a blank line in the feed.
update public.referrals set referred_email   = null where referred_email   = '';
update public.referrals set referred_phone   = null where referred_phone   = '';
update public.referrals set referred_company = null where referred_company = '';
update public.referrals set details          = null where details          = '';

-- 6. Report referrals by when they happened, which is now the common filter.
create index if not exists referrals_occurred_on_idx
  on public.referrals (occurred_on desc);

-- 7. No RLS change is needed. Referral visibility still hinges on
--    referrer_user_id / recipient_member_id, both untouched here.

-- 8. Sanity checks:
--
--    -- both should now be nullable, and the three new columns present
--    select column_name, is_nullable, column_default
--      from information_schema.columns
--     where table_schema = 'public'
--       and table_name = 'referrals'
--       and column_name in ('referred_email', 'details', 'referral_mode',
--                           'occurred_on', 'notify_referred')
--     order by column_name;
--
--    -- every existing row should read 'new', with occurred_on filled in
--    select referral_mode, count(*), count(occurred_on) as dated
--      from public.referrals group by 1;
