-- ---------------------------------------------------------------------------
-- 002 — GUEST INVITATIONS
-- ---------------------------------------------------------------------------
-- Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Idempotent: safe to re-run.
--
-- Adds the table behind "Invite a guest to RED" on the home screen. A guest is
-- an outsider being invited to attend a RED sub-group meeting, so this is NOT
-- one of the five tracked activity types — it is deliberately kept out of the
-- activity feed and the admin dashboard metrics.
--
-- The status column is here from the start because email + RSVP is the next
-- step: the send job will flip 'pending' to 'sent', and the guest's RSVP will
-- set 'accepted' or 'declined'. Nothing writes anything but 'pending' yet.

create table if not exists public.guest_invitations (
  id              uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references public.members(id) on delete cascade,
  guest_name      text not null,
  guest_email     text not null,
  sub_group       text not null check (sub_group in ('RED Central', 'RED Uptown', 'RED Downtown', 'RED West', 'RED Connect')),
  status          text not null default 'pending' check (status in ('pending', 'sent', 'accepted', 'declined')),
  created_at      timestamptz not null default now()
);

create index if not exists guest_invitations_inviter_idx
  on public.guest_invitations (inviter_user_id, created_at desc);

alter table public.guest_invitations enable row level security;

-- Visibility mirrors the activity tables: your own invitations, your sub-group's
-- if you are an admin, everything if you are a super-admin.
drop policy if exists guest_invitations_select on public.guest_invitations;
create policy guest_invitations_select on public.guest_invitations
  for select to authenticated
  using (public.can_view_member(inviter_user_id));

drop policy if exists guest_invitations_insert_own on public.guest_invitations;
create policy guest_invitations_insert_own on public.guest_invitations
  for insert to authenticated
  with check (inviter_user_id = public.current_member_id());

drop policy if exists guest_invitations_delete_own on public.guest_invitations;
create policy guest_invitations_delete_own on public.guest_invitations
  for delete to authenticated
  using (inviter_user_id = public.current_member_id());
