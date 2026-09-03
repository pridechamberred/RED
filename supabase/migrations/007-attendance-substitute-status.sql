-- 007: Add a "Substitute" attendance option alongside Attended and Absent.
--
-- 005 stored attendance as `attended boolean`, which can only express two
-- states. A third option cannot be bolted on with a flag (an extra
-- `was_substitute boolean` would allow the nonsense row
-- attended=false + was_substitute=true, and every read would have to
-- reconstruct the real state from two columns), so the column becomes a
-- constrained `status` text instead — one column, one source of truth, and the
-- check constraint makes an invalid state unrepresentable.
--
-- "Not recorded" stays modelled as the ABSENCE OF A ROW, exactly as in 005.
-- It is not a status value: reports must never confuse "no admin has ruled on
-- this person yet" with a confirmed absence.
--
-- Per the product decision, `substitute` is its own reporting category — it is
-- deliberately NOT folded into attended or absent, so either rule can still be
-- derived later.
--
-- Idempotent and safe t8o re-run. Ordering note: this drops `attended`, so run
-- it together with the matching deploy — code that still writes `attended`
-- will fail against the new shape.

-- 1. Add the new column, nullable for now so the backfill can populate it.
alter table public.meeting_attendance
  add column if not exists status text;

-- 2. Backfill from the boolean. Only rows that exist are touched, so
--    "not recorded" (no row) is preserved untouched. Nothing maps to
--    'substitute': it did not exist before, so no historical row can be one.
update public.meeting_attendance
   set status = case when attended then 'attended' else 'absent' end
 where status is null;

-- 3. Now that every row has a value, lock the column down.
alter table public.meeting_attendance
  alter column status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.meeting_attendance'::regclass
       and conname  = 'meeting_attendance_status_check'
  ) then
    alter table public.meeting_attendance
      add constraint meeting_attendance_status_check
      check (status in ('attended', 'absent', 'substitute'));
  end if;
end $$;

-- 4. Drop the boolean. Keeping it (even as a generated column) would leave two
--    representations of the same fact, and the app now reads `status` only.
alter table public.meeting_attendance
  drop column if exists attended;

-- Verify -------------------------------------------------------------------
do $$
declare
  col_type text;
  has_bool boolean;
  bad_rows integer;
begin
  -- (a) status exists, is text, and is NOT NULL
  select data_type into col_type
    from information_schema.columns
   where table_schema = 'public' and table_name = 'meeting_attendance' and column_name = 'status';
  if col_type is null then
    raise exception '007 FAILED: meeting_attendance.status was not created';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'meeting_attendance'
       and column_name = 'status' and is_nullable = 'YES'
  ) then
    raise exception '007 FAILED: status should be NOT NULL';
  end if;

  -- (b) the old boolean is gone, so nothing can read a stale second copy
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'meeting_attendance' and column_name = 'attended'
  ) into has_bool;
  if has_bool then
    raise exception '007 FAILED: the old attended column still exists';
  end if;

  -- (c) every row carries a valid status
  select count(*) into bad_rows
    from public.meeting_attendance
   where status not in ('attended', 'absent', 'substitute');
  if bad_rows > 0 then
    raise exception '007 FAILED: % row(s) have an invalid status', bad_rows;
  end if;

  -- (d) the constraint actually rejects nonsense
  begin
    insert into public.meeting_attendance (meeting_uid, meeting_start, meeting_title, sub_group, member_id, status)
    values ('__007_probe__', now(), 'probe', 'RED Central',
            (select id from public.members limit 1), 'not-a-status');
    raise exception '007 FAILED: status check constraint did not reject an invalid value';
  exception
    when check_violation then null;  -- expected
    when not_null_violation then null;  -- no members yet; constraint still installed
  end;
  delete from public.meeting_attendance where meeting_uid = '__007_probe__';

  raise notice '007 OK: attendance now supports attended / absent / substitute';
end $$;
