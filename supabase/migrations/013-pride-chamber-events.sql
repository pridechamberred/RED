-- 013-pride-chamber-events.sql
--
-- Imported Pride Chamber public-calendar events, populated by a daily
-- server-side scraper of the GrowthZone event calendar
-- (https://business.thepridechamber.org/event-calendar/). Members pick from
-- these in the chamber-event attendance form instead of typing a free-text
-- name, so the event name shown to everyone is the calendar's own.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- Imported events
-- ---------------------------------------------------------------------------
create table if not exists public.pride_chamber_events (
  id           uuid primary key default gen_random_uuid(),
  -- Stable GrowthZone event id, parsed from the Details URL
  -- (.../Details/<slug>-<source_id>). This is the dedup key: re-running the
  -- sync updates the matching row rather than inserting a copy.
  source_id    text not null unique,
  title        text not null,
  -- Calendar date in America/New_York (Orlando). Stored as a plain date so the
  -- 31-day eligibility window is a simple calendar comparison, never an
  -- instant comparison that could slip a day around midnight.
  event_date   date not null,
  detail_url   text,
  -- Set false when an event rolls out of the eligible window, is retitled into
  -- an exclusion, or stops being returned by the calendar. Never hard-deleted,
  -- so an attendance row that links to it always finds a row to point at.
  is_active    boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists pride_chamber_events_active_idx
  on public.pride_chamber_events (is_active, event_date desc);

-- ---------------------------------------------------------------------------
-- Sync diagnostics: one row per attempt, readable only by admins.
-- ---------------------------------------------------------------------------
create table if not exists public.pride_chamber_sync_runs (
  id                 uuid primary key default gen_random_uuid(),
  ran_at             timestamptz not null default now(),
  ok                 boolean not null,
  events_found       integer not null default 0,
  events_upserted    integer not null default 0,
  events_deactivated integer not null default 0,
  error              text,
  -- 'cron' for the scheduled run, 'manual' for an admin-triggered one.
  trigger            text not null default 'cron'
);

create index if not exists pride_chamber_sync_runs_ran_at_idx
  on public.pride_chamber_sync_runs (ran_at desc);

-- ---------------------------------------------------------------------------
-- Link an attendance row to the canonical imported event. Nullable: the manual
-- "can't find your event?" fallback and every pre-existing historical row have
-- no linked event and keep their free-text event_name unchanged.
-- ---------------------------------------------------------------------------
alter table public.chamber_events
  add column if not exists pride_chamber_event_id uuid references public.pride_chamber_events(id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.pride_chamber_events   enable row level security;
alter table public.pride_chamber_sync_runs enable row level security;

-- Any signed-in member may read the imported events — they need them for the
-- attendance form. There are deliberately NO member insert/update/delete
-- policies: every write goes through the service-role sync, which bypasses RLS.
drop policy if exists pride_chamber_events_select on public.pride_chamber_events;
create policy pride_chamber_events_select on public.pride_chamber_events
  for select to authenticated using (true);

-- Only admins and super-admins may read sync diagnostics.
drop policy if exists pride_chamber_sync_runs_select on public.pride_chamber_sync_runs;
create policy pride_chamber_sync_runs_select on public.pride_chamber_sync_runs
  for select to authenticated using (
    exists (
      select 1 from public.members m
      where m.auth_user_id = auth.uid()
        and m.role in ('admin', 'super-admin')
    )
  );
