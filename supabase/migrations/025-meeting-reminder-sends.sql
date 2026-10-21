-- 025: record of evening-before meeting reminders already sent, so a retried
-- or doubled cron run never emails the same member twice for one meeting.
-- Written only by the server (service role); no client access is needed.

create table if not exists public.meeting_reminder_sends (
  meeting_id text not null,
  member_id  uuid not null references public.members(id) on delete cascade,
  sent_at    timestamptz not null default now(),
  primary key (meeting_id, member_id)
);

alter table public.meeting_reminder_sends enable row level security;
