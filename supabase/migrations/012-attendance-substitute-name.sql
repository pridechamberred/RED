-- 012: Optional free-text name of the substitute a member sent.
--
-- When an admin marks a member "substitute", they may also type who came in
-- their place. The field is optional and only meaningful for that one status,
-- so it is a plain nullable text column rather than a new table or a required
-- value — there is no member row for a one-off stand-in, and forcing a name
-- would slow down the common "just mark it and move on" case.
--
-- Invariant enforced in the database, not just the UI: a name can only be
-- present when status = 'substitute'. Switching a row to attended/absent must
-- clear any stale name so a later reader can never see, say, an "attended" row
-- still carrying the name of a substitute who is no longer relevant. The app
-- clears it on every write too, but the constraint makes the bad state
-- unrepresentable regardless of how a row is written.
--
-- Idempotent and safe to re-run. Adds a nullable column only — no destructive
-- change — so it does not carry the same deploy-ordering risk as 007.

-- 1. The column: trimmed free text, capped so it cannot grow unbounded.
alter table public.meeting_attendance
  add column if not exists substitute_name text;

-- 2. Normalise empties to NULL up front, so "" and "   " never masquerade as a
--    real name and the constraint below has a single "no name" representation.
update public.meeting_attendance
   set substitute_name = null
 where substitute_name is not null
   and length(btrim(substitute_name)) = 0;

-- 3. Invariant: a name may exist only on a substitute row, and never blank.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.meeting_attendance'::regclass
       and conname  = 'meeting_attendance_substitute_name_check'
  ) then
    alter table public.meeting_attendance
      add constraint meeting_attendance_substitute_name_check
      check (
        substitute_name is null
        or (status = 'substitute' and length(btrim(substitute_name)) between 1 and 120)
      );
  end if;
end $$;

-- Verify -------------------------------------------------------------------
do $$
declare
  member_id_val uuid;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'meeting_attendance'
       and column_name = 'substitute_name'
  ) then
    raise exception '012 FAILED: substitute_name column was not created';
  end if;

  select id into member_id_val from public.members limit 1;

  -- (a) a name on a non-substitute row must be rejected
  if member_id_val is not null then
    begin
      insert into public.meeting_attendance
        (meeting_uid, meeting_start, meeting_title, sub_group, member_id, status, substitute_name, recorded_by)
      values ('__012_probe__', now(), 'probe', 'RED Central', member_id_val, 'attended', 'Sam Stand-in', member_id_val);
      raise exception '012 FAILED: a name was allowed on a non-substitute row';
    exception
      when check_violation then null; -- expected
    end;

    -- (b) a name on a substitute row must be accepted
    insert into public.meeting_attendance
      (meeting_uid, meeting_start, meeting_title, sub_group, member_id, status, substitute_name, recorded_by)
    values ('__012_probe__', now(), 'probe', 'RED Central', member_id_val, 'substitute', 'Sam Stand-in', member_id_val);
    delete from public.meeting_attendance where meeting_uid = '__012_probe__';
  end if;

  raise notice '012 OK: substitute_name added and constrained to substitute rows';
end $$;
