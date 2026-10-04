-- 018: member social media links.
--
-- Each column stores a full, normalised https URL (the app converts handles
-- like "@jane" into the platform's profile URL and rejects anything that isn't
-- on the platform's own domain). Null means "not added".
--
-- No policy changes are needed: members_select_authenticated already lets
-- every signed-in member read these, and members_update_own already limits
-- writes to the member's own row.

alter table public.members
  add column if not exists social_facebook  text,
  add column if not exists social_instagram text,
  add column if not exists social_linkedin  text,
  add column if not exists social_tiktok    text,
  add column if not exists social_x         text,
  add column if not exists social_bluesky   text;
