-- Migration 017 — Vous Scheduler.
--
-- A vous_request is the lightweight negotiation behind arranging a 1:1 meeting:
-- one member proposes some availability windows and preferred places, the other
-- picks a slot (or counters with their own), and once agreed the row carries the
-- confirmed date/time/location. There is deliberately NO messages/threads table
-- — this is a scheduler, not a chat. See lib/vous.ts for the shapes stored in
-- the jsonb/array columns.
--
-- Run once in the Supabase SQL editor. Idempotent.

create table if not exists public.vous_requests (
  id                       uuid primary key default gen_random_uuid(),
  inviter_id               uuid not null references public.members(id) on delete cascade,
  invitee_id               uuid not null references public.members(id) on delete cascade,
  status                   text not null default 'pending'
                             check (status in ('pending', 'counter_proposed', 'confirmed', 'cancelled', 'expired')),
  -- Whoever proposed the CURRENT set of windows: the inviter to begin with, the
  -- invitee after a counter-proposal. Drives whose turn it is to respond — the
  -- party who is NOT proposed_by is the one who can confirm or counter.
  proposed_by              uuid not null references public.members(id) on delete cascade,
  -- [{ "date": "YYYY-MM-DD", "start": "HH:MM", "end": "HH:MM" }, ...] — wall-clock
  -- times in the chamber's timezone (America/New_York).
  proposed_windows         jsonb not null default '[]'::jsonb,
  -- Preference keys, any of: coffee | inviter_office | invitee_office | online | lunch | other
  locations                text[] not null default '{}',
  location_other           text,
  message                  text,
  -- Set together, once, when the vous is confirmed.
  confirmed_date           date,
  confirmed_start          text,  -- 'HH:MM', America/New_York
  confirmed_end            text,  -- 'HH:MM', America/New_York
  confirmed_location       text,
  confirmed_location_other text,
  confirmed_at             timestamptz,
  cancelled_at             timestamptz,
  cancelled_by             uuid references public.members(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint vous_requests_not_self check (inviter_id <> invitee_id)
);

create index if not exists vous_requests_invitee_idx on public.vous_requests (invitee_id, status);
create index if not exists vous_requests_inviter_idx on public.vous_requests (inviter_id, status);
create index if not exists vous_requests_confirmed_idx
  on public.vous_requests (confirmed_date)
  where status = 'confirmed';

alter table public.vous_requests enable row level security;

-- Strictly the two participants. No can_view_member() here on purpose: a
-- member's proposed availability is private and admins have no business reading
-- who is arranging to meet whom.
drop policy if exists vous_requests_select on public.vous_requests;
create policy vous_requests_select on public.vous_requests
  for select to authenticated
  using (inviter_id = public.current_member_id() or invitee_id = public.current_member_id());

drop policy if exists vous_requests_insert on public.vous_requests;
create policy vous_requests_insert on public.vous_requests
  for insert to authenticated
  with check (
    inviter_id = public.current_member_id()
    and proposed_by = public.current_member_id()
    and inviter_id <> invitee_id
    and exists (select 1 from public.members m where m.id = invitee_id)
  );

-- Either participant may update (the invitee confirms/counters, either may
-- cancel). The state machine and the "first confirmation wins" race guard live
-- in the server actions; RLS only guarantees a stranger can never touch the row.
drop policy if exists vous_requests_update on public.vous_requests;
create policy vous_requests_update on public.vous_requests
  for update to authenticated
  using (inviter_id = public.current_member_id() or invitee_id = public.current_member_id())
  with check (inviter_id = public.current_member_id() or invitee_id = public.current_member_id());

drop policy if exists vous_requests_delete on public.vous_requests;
create policy vous_requests_delete on public.vous_requests
  for delete to authenticated using (inviter_id = public.current_member_id());
