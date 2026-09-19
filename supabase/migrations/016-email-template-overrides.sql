-- Editable email copy overrides.
--
-- Stores ONLY the fields a super-admin has changed for a given template, as a
-- JSON map of { fieldKey: text }. Anything not present here falls back to the
-- code default in lib/email-templates.ts, so rewording a default in code still
-- reaches templates that were never customised.
--
-- Access model: this table holds no user data, only super-admin-authored copy.
-- Every read (sending emails, incl. the sessionless calendar-sync cron) and
-- write (the editor's server actions, which authorize super-admin first) goes
-- through the service-role client, which bypasses RLS. RLS is therefore enabled
-- with NO permissive policies, so the anon and authenticated keys cannot see or
-- change it at all — a deliberate deny-by-default lockdown.

create table if not exists public.email_template_overrides (
  template_id text primary key,
  copy        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.members(id) on delete set null
);

alter table public.email_template_overrides enable row level security;

-- No policies on purpose: only the service-role key (used server-side after an
-- explicit super-admin check) may touch this table. Revoke the client roles'
-- default grants too, so RLS is not the only thing standing in the way.
revoke all on public.email_template_overrides from anon, authenticated;
