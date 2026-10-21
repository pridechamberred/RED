-- Optional pronouns shown under a member's name.
-- Values: 'She/Her', 'He/Him', 'They/Them', free text (when "Other" is chosen),
-- or 'hidden' for "Do not show my pronouns". Null means not set.
alter table public.members
  add column if not exists pronouns text
  check (pronouns is null or char_length(pronouns) <= 40);
