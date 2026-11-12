-- Allow up to 50 characters for custom ("Other") pronouns.
alter table public.members
  drop constraint if exists members_pronouns_check;

alter table public.members
  add constraint members_pronouns_check
  check (pronouns is null or char_length(pronouns) <= 50);
