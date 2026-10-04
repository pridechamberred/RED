-- 019: member YouTube channel link.
--
-- Same rules as the other social columns from 018: stores a full, normalised
-- https URL on youtube.com, or null when not added. Existing RLS policies
-- already cover reads (members_select_authenticated) and own-row writes
-- (members_update_own).

alter table public.members
  add column if not exists social_youtube text;
