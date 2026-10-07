-- 020: member phone number + opt-in to share phone/email with other members.
--
-- `share_contact` defaults to false so nobody's details are shown until they
-- explicitly slide the toggle to YES on /profile. Updates go through the
-- existing members_update_own RLS policy, so no new policies are needed.

alter table public.members
  add column if not exists phone text,
  add column if not exists share_contact boolean not null default false;

alter table public.members
  drop constraint if exists members_phone_length;
alter table public.members
  add constraint members_phone_length check (phone is null or char_length(phone) <= 30);
