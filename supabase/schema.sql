-- incREDible — The Pride Chamber's RED Group activity tracker.
-- Full schema, RLS policies and seed data.
-- Run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is idempotent: safe to re-run.
--
-- NOTE: this file describes the CURRENT shape of the database. If your database
-- was created before a change landed, the matching one-time migration lives in
-- supabase/migrations/ — running this file alone will not alter existing tables.

-- ---------------------------------------------------------------------------
-- 1. MEMBERS
-- ---------------------------------------------------------------------------
-- members.id is its own uuid (NOT auth.users.id) so that demo/seed members can
-- exist before anyone signs up. auth_user_id links a member record to a real
-- Supabase auth account. When someone signs up with an email that already
-- exists as a member, the trigger below claims that member record for them.

create table if not exists public.members (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  first_name   text not null,
  last_name    text not null,
  email        text not null unique,
  company      text,
  role         text not null default 'user' check (role in ('user', 'admin', 'super-admin')),
  sub_group    text not null check (sub_group in ('RED Central', 'RED Uptown', 'RED Downtown', 'RED West', 'RED Connect')),
  created_at   timestamptz not null default now()
);

create index if not exists members_sub_group_idx on public.members (sub_group);
create index if not exists members_auth_user_id_idx on public.members (auth_user_id);

-- ---------------------------------------------------------------------------
-- 2. ACTIVITY TABLES
-- ---------------------------------------------------------------------------

-- A Vous is a 1:1 meeting. user_id = who recorded it, member_id = who they met.
create table if not exists public.vous (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.members(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  date       date not null default current_date,
  notes      text,
  created_at timestamptz not null default now(),
  constraint vous_not_self check (user_id <> member_id)
);

-- Two kinds of referral share this table, distinguished by referral_mode:
--   'new'     — made through the app; the recipient is emailed the details.
--   'offline' — already passed in person or by phone, recorded after the fact.
--               Both people have already spoken, so only the referred person's
--               name is captured and every other field is null.
-- Only referred_name is required of both. The rule that a 'new' referral must
-- carry details lives in the server action, not here, so the two modes can
-- diverge without a second table. See migration 009.
create table if not exists public.referrals (
  id                   uuid primary key default gen_random_uuid(),
  referrer_user_id     uuid not null references public.members(id) on delete cascade,
  recipient_member_id  uuid not null references public.members(id) on delete cascade,
  referred_name        text not null,
  -- Null means "not captured", for an offline referral or a new one where the
  -- member only had a phone number.
  referred_email       text,
  referred_phone       text,
  referred_company     text,
  details              text,
  referral_mode        text not null default 'new'
                         check (referral_mode in ('new', 'offline')),
  -- When the referral actually happened, which for an offline referral is
  -- earlier than created_at. This is the date to report under.
  occurred_on          date not null default current_date,
  -- True only when the referred person supplied an email and asked to be told.
  notify_referred      boolean not null default false,
  created_at           timestamptz not null default now(),
  constraint referrals_not_self check (referrer_user_id <> recipient_member_id)
);

-- A running record rather than a snapshot. One-off deals carry a fixed
-- deal_value; recurring deals carry only what they bill per period, and their
-- total is accrued from `date` and scoped to the calendar year (so it resets
-- each January while the deal keeps running). See lib/deal-totals.ts.
create table if not exists public.done_deals (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.members(id) on delete cascade,
  -- One-off deals only. Null for recurring deals, which accrue instead.
  deal_value               numeric(12, 2) check (deal_value >= 0),
  deal_type                text not null check (deal_type in ('one-off', 'recurring')),
  recurring_value          numeric(12, 2) check (recurring_value >= 0),
  recurring_frequency      text check (recurring_frequency in ('week', 'month', 'quarter', 'year')),
  -- Accrual halts here, permanently: a stopped deal never resumes.
  recurring_ended_on       date,
  -- A manual total replacing the computed one, scoped to a single year so it
  -- cannot leak into the next.
  total_override           numeric(12, 2),
  total_override_year      integer,
  -- Where the referral behind this deal came from. Nullable, and deliberately
  -- so: deals recorded before migration 008 have no answer and there is nothing
  -- honest to backfill, so null means "predates the field" rather than any of
  -- the four answers. New deals must pick one — enforced in the server action,
  -- not here, so historic rows stay valid.
  referral_source          text,
  -- Set only when referral_source = 'member'. See migration 008.
  referral_from_member_id  uuid references public.members (id) on delete set null,
  date                     date not null default current_date,
  created_at               timestamptz not null default now(),
  constraint done_deals_total_override_check check (total_override is null or total_override >= 0),
  constraint done_deals_override_year_check  check ((total_override is null) = (total_override_year is null)),
  constraint done_deals_ended_check          check (recurring_ended_on is null or deal_type = 'recurring'),
  constraint done_deals_referral_source_check check (
    referral_source is null
    or referral_source in ('confidential', 'pride-chamber', 'former-red-member', 'member')
  ),
  -- A member id is meaningful only for the 'member' source, and is mandatory
  -- there. Stops a half-set row: 'member' with nobody named, or a name attached
  -- to 'confidential'.
  constraint done_deals_referral_member_check check (
    case referral_source
      when 'member' then referral_from_member_id is not null
      else referral_from_member_id is null
    end
  )
);

-- A member's own private reminder of what a deal was for. Deliberately a
-- separate table, not a column on done_deals: RLS is row level, so an admin who
-- can see a deal row can read every column on it. Keeping notes here lets the
-- policies below key on current_member_id() alone — no can_view_member() — so
-- admins and super-admins match no rows at all. See migration 006.
create table if not exists public.done_deal_notes (
  deal_id    uuid primary key references public.done_deals (id) on delete cascade,
  -- Denormalised from done_deals so the policies can check ownership without a
  -- subquery back into that admin-visible table.
  user_id    uuid not null references public.members (id) on delete cascade,
  note       text not null check (length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.volunteering (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.members(id) on delete cascade,
  date         date not null default current_date,
  organization text not null,
  hours        numeric(6, 2) not null check (hours > 0),
  notes        text,
  created_at   timestamptz not null default now()
);

create table if not exists public.chamber_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.members(id) on delete cascade,
  date       date not null default current_date,
  event_name text not null,
  hours      numeric(6, 2) check (hours >= 0),
  notes      text,
  created_at timestamptz not null default now()
);

-- Guests invited to attend a sub-group meeting. NOT one of the five tracked
-- activity types: deliberately excluded from the activity feed, though the admin
-- dashboard does report a "Guests invited" count. status is reserved for the
-- upcoming email + RSVP flow; nothing writes anything but 'pending' yet.
create table if not exists public.guest_invitations (
  id              uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references public.members(id) on delete cascade,
  guest_name      text not null,
  guest_email     text not null,
  sub_group       text not null check (sub_group in ('RED Central', 'RED Uptown', 'RED Downtown', 'RED West', 'RED Connect')),
  status          text not null default 'pending' check (status in ('pending', 'sent', 'accepted', 'declined')),
  -- Snapshot of the Google Calendar meeting the guest was invited to, all
  -- nullable because choosing one is optional. Denormalised on purpose: the
  -- calendar is external and an occurrence can be moved or deleted.
  meeting_uid      text,
  meeting_start    timestamptz,
  meeting_title    text,
  meeting_location text,
  created_at      timestamptz not null default now()
);

create index if not exists vous_user_idx on public.vous (user_id, date desc);
create index if not exists referrals_referrer_idx on public.referrals (referrer_user_id, created_at desc);
create index if not exists done_deals_user_idx on public.done_deals (user_id, date desc);
create index if not exists done_deals_referral_from_member_id_idx
  on public.done_deals (referral_from_member_id)
  where referral_from_member_id is not null;
create index if not exists done_deal_notes_user_idx on public.done_deal_notes (user_id);
create index if not exists volunteering_user_idx on public.volunteering (user_id, date desc);
create index if not exists chamber_events_user_idx on public.chamber_events (user_id, date desc);
create index if not exists guest_invitations_inviter_idx on public.guest_invitations (inviter_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. HELPER FUNCTIONS (security definer, so policies don't recurse on members)
-- ---------------------------------------------------------------------------

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.members where auth_user_id = auth.uid();
$$;

-- True when the signed-in member may see records owned by target_member:
-- their own, anything in their sub-group (admin), or everything (super-admin).
create or replace function public.can_view_member(target_member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members me
    where me.auth_user_id = auth.uid()
      and (
        me.id = target_member
        or me.role = 'super-admin'
        or (
          me.role = 'admin'
          and me.sub_group = (select t.sub_group from public.members t where t.id = target_member)
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. AUTO-LINK / CREATE MEMBER ON SIGN UP
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed uuid;
begin
  -- Claim a pre-existing (seeded) member record with the same email.
  update public.members
     set auth_user_id = new.id
   where lower(email) = lower(new.email)
     and auth_user_id is null
  returning id into claimed;

  if claimed is null then
    insert into public.members (auth_user_id, first_name, last_name, email, company, sub_group)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'first_name', ''), 'New'),
      coalesce(nullif(new.raw_user_meta_data ->> 'last_name', ''), 'Member'),
      new.email,
      nullif(new.raw_user_meta_data ->> 'company', ''),
      coalesce(nullif(new.raw_user_meta_data ->> 'sub_group', ''), 'RED Central')
    )
    on conflict (email) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- If a member named as a deal's referrer is deleted, the FK nulls the id, which
-- would leave referral_source = 'member' with nobody named and violate
-- done_deals_referral_member_check. Demote those rows to 'former-red-member' —
-- which is what someone removed from the database now is — so the delete
-- succeeds and the deal stays on its recorder's record. See migration 008.
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

-- ---------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

alter table public.members        enable row level security;
alter table public.vous           enable row level security;
alter table public.referrals      enable row level security;
alter table public.done_deals     enable row level security;
alter table public.done_deal_notes enable row level security;
alter table public.volunteering   enable row level security;
alter table public.chamber_events enable row level security;
alter table public.guest_invitations enable row level security;

-- MEMBERS: every signed-in member can find every other member (that is the
-- whole point of the search box), but can only edit their own record.
drop policy if exists members_select_authenticated on public.members;
create policy members_select_authenticated on public.members
  for select to authenticated using (true);

drop policy if exists members_update_own on public.members;
create policy members_update_own on public.members
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- VOUS
drop policy if exists vous_select on public.vous;
create policy vous_select on public.vous
  for select to authenticated
  using (public.can_view_member(user_id) or public.can_view_member(member_id));

drop policy if exists vous_insert_own on public.vous;
create policy vous_insert_own on public.vous
  for insert to authenticated
  with check (
    user_id = public.current_member_id()
    and exists (select 1 from public.members m where m.id = member_id)
  );

drop policy if exists vous_delete_own on public.vous;
create policy vous_delete_own on public.vous
  for delete to authenticated using (user_id = public.current_member_id());

-- REFERRALS (visible to the giver, the recipient, and their admins)
drop policy if exists referrals_select on public.referrals;
create policy referrals_select on public.referrals
  for select to authenticated
  using (public.can_view_member(referrer_user_id) or public.can_view_member(recipient_member_id));

drop policy if exists referrals_insert_own on public.referrals;
create policy referrals_insert_own on public.referrals
  for insert to authenticated
  with check (
    referrer_user_id = public.current_member_id()
    and exists (select 1 from public.members m where m.id = recipient_member_id)
  );

drop policy if exists referrals_delete_own on public.referrals;
create policy referrals_delete_own on public.referrals
  for delete to authenticated using (referrer_user_id = public.current_member_id());

-- DONE DEALS (self-reported: visibility and insert both hinge only on the
-- member who recorded the deal. A deal may now name who referred it, but that
-- deliberately grants the named referrer no access — the deal belongs to the
-- record of whoever closed it, so do not add referral_from_member_id here.)
drop policy if exists done_deals_select on public.done_deals;
create policy done_deals_select on public.done_deals
  for select to authenticated
  using (public.can_view_member(user_id));

drop policy if exists done_deals_insert_own on public.done_deals;
create policy done_deals_insert_own on public.done_deals
  for insert to authenticated
  with check (user_id = public.current_member_id());

drop policy if exists done_deals_update_own on public.done_deals;
create policy done_deals_update_own on public.done_deals
  for update to authenticated
  using (user_id = public.current_member_id())
  with check (user_id = public.current_member_id());

drop policy if exists done_deals_delete_own on public.done_deals;
create policy done_deals_delete_own on public.done_deals
  for delete to authenticated using (user_id = public.current_member_id());

-- DONE DEAL NOTES (private to the member who wrote them). Every policy keys on
-- current_member_id() and NONE uses can_view_member() — that is the whole point
-- of the table, so do not add it here. An admin session matches no rows.
drop policy if exists done_deal_notes_select_own on public.done_deal_notes;
create policy done_deal_notes_select_own on public.done_deal_notes
  for select to authenticated using (user_id = public.current_member_id());

drop policy if exists done_deal_notes_insert_own on public.done_deal_notes;
create policy done_deal_notes_insert_own on public.done_deal_notes
  for insert to authenticated with check (user_id = public.current_member_id());

drop policy if exists done_deal_notes_update_own on public.done_deal_notes;
create policy done_deal_notes_update_own on public.done_deal_notes
  for update to authenticated
  using (user_id = public.current_member_id())
  with check (user_id = public.current_member_id());

drop policy if exists done_deal_notes_delete_own on public.done_deal_notes;
create policy done_deal_notes_delete_own on public.done_deal_notes
  for delete to authenticated using (user_id = public.current_member_id());

-- VOLUNTEERING
drop policy if exists volunteering_select on public.volunteering;
create policy volunteering_select on public.volunteering
  for select to authenticated using (public.can_view_member(user_id));

drop policy if exists volunteering_insert_own on public.volunteering;
create policy volunteering_insert_own on public.volunteering
  for insert to authenticated with check (user_id = public.current_member_id());

drop policy if exists volunteering_delete_own on public.volunteering;
create policy volunteering_delete_own on public.volunteering
  for delete to authenticated using (user_id = public.current_member_id());

-- CHAMBER EVENTS
drop policy if exists chamber_events_select on public.chamber_events;
create policy chamber_events_select on public.chamber_events
  for select to authenticated using (public.can_view_member(user_id));

drop policy if exists chamber_events_insert_own on public.chamber_events;
create policy chamber_events_insert_own on public.chamber_events
  for insert to authenticated with check (user_id = public.current_member_id());

drop policy if exists chamber_events_delete_own on public.chamber_events;
create policy chamber_events_delete_own on public.chamber_events
  for delete to authenticated using (user_id = public.current_member_id());

-- GUEST INVITATIONS
drop policy if exists guest_invitations_select on public.guest_invitations;
create policy guest_invitations_select on public.guest_invitations
  for select to authenticated using (public.can_view_member(inviter_user_id));

drop policy if exists guest_invitations_insert_own on public.guest_invitations;
create policy guest_invitations_insert_own on public.guest_invitations
  for insert to authenticated with check (inviter_user_id = public.current_member_id());

drop policy if exists guest_invitations_delete_own on public.guest_invitations;
create policy guest_invitations_delete_own on public.guest_invitations
  for delete to authenticated using (inviter_user_id = public.current_member_id());

-- ---------------------------------------------------------------------------
-- 6. SEED MEMBERS (fictional demo data)
-- ---------------------------------------------------------------------------
-- These have no auth account yet. Signing up with one of these email addresses
-- claims that member record, including its role.

insert into public.members (first_name, last_name, email, company, role, sub_group) values
  ('Sarah',    'Smith',     'sarah.smith@smithmarketing.example',      'Smith Marketing',        'user',        'RED Central'),
  ('James',    'Brown',     'james.brown@brownaccounting.example',     'Brown Accounting',       'admin',       'RED Central'),
  ('Michael',  'Jones',     'michael.jones@jonesinsurance.example',    'Jones Insurance',        'user',        'RED Central'),
  ('Lisa',     'Williams',  'lisa.williams@williamsrealty.example',    'Williams Realty',        'user',        'RED Central'),
  ('Priya',    'Patel',     'priya.patel@patellegal.example',          'Patel Legal',            'admin',       'RED Uptown'),
  ('Daniel',   'Okafor',    'daniel.okafor@okaforbuilds.example',      'Okafor Builds',          'user',        'RED Uptown'),
  ('Emma',     'Nguyen',    'emma.nguyen@nguyendesign.example',        'Nguyen Design Studio',   'user',        'RED Uptown'),
  ('Carlos',   'Rivera',    'carlos.rivera@riverafitness.example',     'Rivera Fitness',         'user',        'RED Downtown'),
  ('Hannah',   'Clarke',    'hannah.clarke@clarkeconsulting.example',  'Clarke Consulting',      'admin',       'RED Downtown'),
  ('Tom',      'Fitzgerald','tom.fitzgerald@fitzplumbing.example',     'Fitz Plumbing',          'user',        'RED Downtown'),
  ('Aisha',    'Rahman',    'aisha.rahman@rahmanphotography.example',  'Rahman Photography',     'user',        'RED West'),
  ('Greg',     'Sullivan',  'greg.sullivan@sullivanautos.example',     'Sullivan Autos',         'admin',       'RED West'),
  ('Nadia',    'Kowalski',  'nadia.kowalski@kowalskibakery.example',   'Kowalski Bakery',        'user',        'RED West'),
  ('Ben',      'Harper',    'ben.harper@harperit.example',             'Harper IT Services',     'user',        'RED Connect'),
  ('Grace',    'Lindqvist', 'grace.lindqvist@lindqvisttravel.example', 'Lindqvist Travel',       'admin',       'RED Connect'),
  ('Omar',     'Haddad',    'omar.haddad@haddadlogistics.example',     'Haddad Logistics',       'user',        'RED Connect')
on conflict (email) do nothing;

-- NOTE: the 16 members above use .example email addresses on purpose. They are
-- directory entries to search for and record activity against — nobody signs in
-- as them. Supabase Auth rejects .example domains, so do not try. Create your
-- own account through the app's sign-up form, then run section 8 below.

-- ---------------------------------------------------------------------------
-- 7. SEED ACTIVITY (so the admin dashboard is not empty on day one)
-- ---------------------------------------------------------------------------

with m as (select email, id from public.members)
insert into public.vous (user_id, member_id, date, notes)
select a.id, b.id, d.date, d.notes
from (values
  ('sarah.smith@smithmarketing.example',  'james.brown@brownaccounting.example',    current_date - 3, 'Great chat about Q4 campaigns.'),
  ('james.brown@brownaccounting.example', 'michael.jones@jonesinsurance.example',   current_date - 5, null),
  ('lisa.williams@williamsrealty.example','sarah.smith@smithmarketing.example',     current_date - 8, 'Wants help with listing photography.'),
  ('priya.patel@patellegal.example',      'daniel.okafor@okaforbuilds.example',     current_date - 2, null),
  ('carlos.rivera@riverafitness.example', 'hannah.clarke@clarkeconsulting.example', current_date - 6, 'Discussed corporate wellness packages.'),
  ('ben.harper@harperit.example',         'grace.lindqvist@lindqvisttravel.example',current_date - 4, null)
) as d(from_email, to_email, date, notes)
join m a on a.email = d.from_email
join m b on b.email = d.to_email
where not exists (select 1 from public.vous limit 1);

with m as (select email, id from public.members)
insert into public.referrals (referrer_user_id, recipient_member_id, referred_name, referred_email, referred_phone, referred_company, details)
select a.id, b.id, d.referred_name, d.referred_email, d.referred_phone, d.referred_company, d.details
from (values
  ('james.brown@brownaccounting.example', 'sarah.smith@smithmarketing.example',   'Alan Whitfield', 'alan@whitfieldjoinery.example', '555-0141', 'Whitfield Joinery',  'Alan is rebranding and needs a marketing partner. He is expecting your call.'),
  ('sarah.smith@smithmarketing.example',  'michael.jones@jonesinsurance.example', 'Rita Delgado',   'rita@delgadocafe.example',     null,       'Delgado Cafe',       'Rita is opening a second location and needs commercial cover.'),
  ('emma.nguyen@nguyendesign.example',    'priya.patel@patellegal.example',       'Sam Overton',    'sam@overtonapps.example',      '555-0199', 'Overton Apps',       'Sam needs help with contractor agreements for a new dev team.'),
  ('greg.sullivan@sullivanautos.example', 'aisha.rahman@rahmanphotography.example','Kelly Moss',    'kelly@mossbridal.example',     null,       'Moss Bridal',        'Kelly is looking for a photographer for a seasonal lookbook.')
) as d(from_email, to_email, referred_name, referred_email, referred_phone, referred_company, details)
join m a on a.email = d.from_email
join m b on b.email = d.to_email
where not exists (select 1 from public.referrals limit 1);

-- No done_deals seed. Totals are now accrued over time rather than stored, so
-- demo rows would either read as $0 or drift upward every month on their own.
-- The Done Deals Record starts empty and fills as members add real deals.

with m as (select email, id from public.members)
insert into public.volunteering (user_id, date, organization, hours, notes)
select a.id, d.date, d.organization, d.hours, d.notes
from (values
  ('sarah.smith@smithmarketing.example',  current_date - 6,  'Community Food Drive',      3.0, 'Helped run the donation desk.'),
  ('hannah.clarke@clarkeconsulting.example', current_date - 9, 'Youth Business Mentoring', 2.5, null),
  ('nadia.kowalski@kowalskibakery.example', current_date - 14,'Riverside Clean-Up',        4.0, null)
) as d(email, date, organization, hours, notes)
join m a on a.email = d.email
where not exists (select 1 from public.volunteering limit 1);

with m as (select email, id from public.members)
insert into public.chamber_events (user_id, date, event_name, hours, notes)
select a.id, d.date, d.event_name, d.hours, d.notes
from (values
  ('sarah.smith@smithmarketing.example',   current_date - 2,  'Chamber Breakfast Briefing', 2.0, null),
  ('james.brown@brownaccounting.example',  current_date - 2,  'Chamber Breakfast Briefing', 2.0, 'Sat with the new members table.'),
  ('daniel.okafor@okaforbuilds.example',   current_date - 11, 'Trade Expo Evening',         3.5, null),
  ('omar.haddad@haddadlogistics.example',  current_date - 4,  'Virtual Speed Networking',   1.0, null)
) as d(email, date, event_name, hours, notes)
join m a on a.email = d.email
where not exists (select 1 from public.chamber_events limit 1);

-- ---------------------------------------------------------------------------
-- 8. MAKE YOURSELF SUPER-ADMIN  (run this AFTER you sign up in the app)
-- ---------------------------------------------------------------------------
-- Use a REAL email address you control — Supabase Auth rejects .example and
-- other reserved test domains. Steps:
--
--   1. Open the app and create your account via the sign-up form.
--   2. Confirm your email if email confirmation is enabled.
--   3. Run the statement below with that same email to unlock the Admin tab.
--
--   update public.members set role = 'super-admin' where email = 'you@yourbusiness.com';
--
-- Roles: 'user' (own activity only), 'admin' (own sub-group), 'super-admin' (all).

-- ---------------------------------------------------------------------------
-- 9. OPTIONAL: REMOVE THE VERIFICATION TEST ACCOUNT
-- ---------------------------------------------------------------------------
-- A test account was used to verify the five recording flows end to end.
--
-- IMPORTANT: deleting the auth user alone is NOT enough. members.auth_user_id is
-- `on delete set null` (see section 1), so removing the auth user just unlinks
-- the login and leaves the member row plus all of its activity in place. The
-- activity tables DO cascade from public.members, so delete the member row to
-- clear the activity, then delete the auth user to remove the login:
--
--   delete from public.members where email = 'redtracker.verify.9f3a@gmail.com';
--   delete from auth.users   where email = 'redtracker.verify.9f3a@gmail.com';
--
-- Run both with the service role (SQL editor). The second one can also be done
-- from the dashboard under Authentication > Users.
--
-- That leaves the 16 seeded directory members and their sample activity.

-- ---------------------------------------------------------------------------
-- 10. BULK-ADDING MEMBERS
-- ---------------------------------------------------------------------------
-- Add people to public.members — NOT to Authentication > Users. A member row
-- works without a login: they are searchable and can receive vous and referrals
-- straight away. When they later sign up with the same email, the
-- on_auth_user_created trigger (section 4) claims this row via `on conflict
-- (email) do nothing`, so their existing history carries over.
--
-- Creating auth users instead would force a password on everyone before they
-- have been referred, and it will not backfill the profile fields below.
--
-- Only these five columns need values. id, created_at and role are defaulted
-- (role becomes 'user'); company is optional; auth_user_id stays null until
-- they sign up.
--
--   insert into public.members (first_name, last_name, email, company, sub_group)
--   values
--     ('Dana', 'Ortiz',  'dana@ortizlaw.com',   'Ortiz Law',   'RED Central'),
--     ('Kofi', 'Mensah', 'kofi@mensahhvac.com', 'Mensah HVAC', 'RED Uptown')
--   on conflict (email) do nothing;
--
-- Two constraints that will reject the whole insert if violated:
--
--   * email is UNIQUE and is the key the sign-up trigger matches on. It must be
--     the address the member will actually register with — a typo here means
--     their sign-up silently creates a SECOND row instead of claiming this one.
--   * sub_group has a CHECK constraint. It must be exactly one of:
--     'RED Central', 'RED Uptown', 'RED Downtown', 'RED West', 'RED Connect'.
--
-- Prefer a spreadsheet? Use supabase/members-import-template.csv with
-- Table Editor > members > Insert > Import data from CSV. Its header row already
-- matches the five columns above. Leave the company cell blank for members with
-- no business name; a CSV import can store that as an empty string rather than
-- null, so normalize it afterwards to keep "company or sub-group" fallbacks
-- rendering correctly:
--
--   update public.members set company = null where company = '';
--
-- After importing, sanity-check the result:
--
--   -- headcount per sub-group: confirm it matches your roster, and that no
--   -- group was missed entirely (a bad sub_group cannot exist — the CHECK
--   -- rejects the insert — but a group you forgot to import will be absent)
--   select sub_group, count(*) from public.members group by sub_group order by 1;
--
--   -- same person entered twice under different addresses
--   select lower(first_name || ' ' || last_name) as who, count(*), array_agg(email)
--   from public.members group by 1 having count(*) > 1;
