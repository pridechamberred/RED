 -- 005 — Attendance register
--
-- Admins mark each member of a sub-group Attended / Absent for a given meeting
-- from the chamber's Google Calendar, and do the same for any guests invited to
-- that meeting.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.meeting_attendance (
  id uuid primary key default gen_random_uuid(),

  -- The calendar OCCURRENCE, not the series: "<uid>::<start ISO>". A monthly
  -- series shares one uid across every month, so the uid alone could not tell
  -- September's meeting from October's.
  meeting_uid   text not null,
  meeting_start timestamptz not null,
  meeting_title text not null,

  -- Denormalised so the register still reads correctly if an organiser later
  -- renames or moves the calendar event, and so RLS can scope by sub-group
  -- without re-reading an external calendar.
  sub_group text not null check (sub_group in ('RED Central', 'RED Uptown', 'RED Downtown', 'RED West', 'RED Connect')),

  -- Exactly one of these is set: a member, or an invited guest.
  member_id           uuid references public.members (id) on delete cascade,
  guest_invitation_id uuid references public.guest_invitations (id) on delete cascade,

  -- true = Attended, false = Absent. "Not recorded" is the ABSENCE of a row, so
  -- an untouched register is distinguishable from a meeting nobody attended.
  attended boolean not null,

  recorded_by uuid not null references public.members (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint meeting_attendance_one_subject
    check ((member_id is not null) <> (guest_invitation_id is not null))
);

-- A single stored key for "who this row is about", so one plain unique index can
-- cover both members and guests. Two partial unique indexes would work for
-- enforcement but Postgres cannot reliably infer them for ON CONFLICT, which is
-- what the toggle's upsert needs.
alter table public.meeting_attendance
  add column if not exists subject_key text
  generated always as (coalesce('m:' || member_id::text, 'g:' || guest_invitation_id::text)) stored;

create unique index if not exists meeting_attendance_unique_subject
  on public.meeting_attendance (meeting_uid, subject_key);

create index if not exists meeting_attendance_meeting_idx
  on public.meeting_attendance (meeting_uid);

create index if not exists meeting_attendance_member_idx
  on public.meeting_attendance (member_id, meeting_start desc);

-- ---------------------------------------------------------------------------
-- Helper: may the signed-in member administer this sub-group?
-- ---------------------------------------------------------------------------

create or replace function public.can_admin_sub_group(target text)
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
        me.role = 'super-admin'
        or (me.role = 'admin' and me.sub_group = target)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.meeting_attendance enable row level security;

-- Members see their own attendance (it appears in My Activity). Admins see
-- their sub-group's; super-admins see everything. Guest rows are admin-only,
-- since a guest is not a member and has no feed of their own.
drop policy if exists meeting_attendance_select on public.meeting_attendance;
create policy meeting_attendance_select on public.meeting_attendance
  for select to authenticated
  using (
    (member_id is not null and public.can_view_member(member_id))
    or public.can_admin_sub_group(sub_group)
  );

-- Only an admin of the meeting's sub-group may record attendance, and only in
-- their own name (recorded_by cannot be spoofed).
drop policy if exists meeting_attendance_insert on public.meeting_attendance;
create policy meeting_attendance_insert on public.meeting_attendance
  for insert to authenticated
  with check (
    public.can_admin_sub_group(sub_group)
    and recorded_by = public.current_member_id()
  );

drop policy if exists meeting_attendance_update on public.meeting_attendance;
create policy meeting_attendance_update on public.meeting_attendance
  for update to authenticated
  using (public.can_admin_sub_group(sub_group))
  with check (
    public.can_admin_sub_group(sub_group)
    and recorded_by = public.current_member_id()
  );

-- Clearing a mark back to "not recorded" deletes the row.
drop policy if exists meeting_attendance_delete on public.meeting_attendance;
create policy meeting_attendance_delete on public.meeting_attendance
  for delete to authenticated
  using (public.can_admin_sub_group(sub_group));

-- ---------------------------------------------------------------------------
-- Keep updated_at honest
-- ---------------------------------------------------------------------------

create or replace function public.touch_meeting_attendance()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meeting_attendance_touch on public.meeting_attendance;
create trigger meeting_attendance_touch
  before update on public.meeting_attendance
  for each row execute function public.touch_meeting_attendance();
