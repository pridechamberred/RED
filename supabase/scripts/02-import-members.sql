ree-- ===========================================================================
-- 02 — IMPORT REAL MEMBERS FROM CSV
-- ===========================================================================
-- Run AFTER 01-reset-all-data.sql.
--
-- Your CSV columns:  email, Membership, Company, first_name, last_name, role
-- Target columns:    email, sub_group,  company, first_name, last_name, role
--
-- Membership and Company need renaming/normalising, and sub_group + role are
-- both constrained — a single stray value ("Central" instead of "RED Central")
-- fails the whole insert with a constraint error that doesn't tell you which
-- row was at fault. So we load the CSV into a staging table first, check it,
-- and only then copy across.
--
-- Nothing touches public.members until step 5, so steps 1-4 are safe to re-run.
--
--
-- HOW TO GET THE CSV IN (easiest route — no copy/pasting 40 rows by hand):
--
--   1. Run STEP 1 below to create the staging table.
--   2. Dashboard > Table Editor > members_import > Insert > Import data from CSV.
--      Upload your file. The headers match your CSV exactly, including the
--      capitalised Membership and Company, so they map automatically.
--   3. Come back and run steps 2-6.
--
-- If you would rather paste the rows as SQL instead, use the commented-out
-- INSERT at the bottom of STEP 1.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- STEP 1 — Staging table (all text, no constraints, so any CSV loads).
-- ---------------------------------------------------------------------------

drop table if exists public.members_import;

create table public.members_import (
  email       text,
  "Membership" text,
  "Company"    text,
  first_name  text,
  last_name   text,
  role        text
);

-- Optional: paste rows directly instead of uploading the CSV.
-- insert into public.members_import (email, "Membership", "Company", first_name, last_name, role) values
--   ('ada@example.com',  'RED Central',  'Lovelace Ltd', 'Ada',  'Lovelace', 'super-admin'),
--   ('grace@example.com','RED Uptown',   'Hopper Co',    'Grace','Hopper',   'user');


-- ---------------------------------------------------------------------------
-- STEP 2 — Normalisers.
-- ---------------------------------------------------------------------------
-- These absorb the usual spreadsheet drift: casing, stray hyphens, double
-- spaces, a missing "RED " prefix, trailing whitespace. Anything they cannot
-- confidently interpret returns null, which STEP 4 then reports rather than
-- letting it through as a wrong-but-valid value.

create or replace function public.norm_sub_group(raw text)
returns text language sql immutable as $$
  select case regexp_replace(lower(coalesce(raw, '')), '[^a-z]', '', 'g')
    when 'redcentral'  then 'RED Central'
    when 'central'     then 'RED Central'
    when 'reduptown'   then 'RED Uptown'
    when 'uptown'      then 'RED Uptown'
    when 'reddowntown' then 'RED Downtown'
    when 'downtown'    then 'RED Downtown'
    when 'redwest'     then 'RED West'
    when 'west'        then 'RED West'
    when 'redvirtual'  then 'RED Connect'
    when 'virtual'     then 'RED Connect'
    else null
  end
$$;

create or replace function public.norm_role(raw text)
returns text language sql immutable as $$
  select case regexp_replace(lower(coalesce(raw, '')), '[^a-z]', '', 'g')
    when 'user'        then 'user'
    when 'member'      then 'user'
    when ''            then 'user'   -- blank role defaults to a normal member
    when 'admin'       then 'admin'
    when 'superadmin'  then 'super-admin'
    else null
  end
$$;


-- ---------------------------------------------------------------------------
-- STEP 3 — Preview what will be imported.
-- ---------------------------------------------------------------------------

select
  lower(trim(email))                    as email,
  trim(first_name)                      as first_name,
  trim(last_name)                       as last_name,
  nullif(trim("Company"), '')           as company,
  public.norm_sub_group("Membership")   as sub_group,
  public.norm_role(role)                as role,
  "Membership"                          as membership_as_supplied,
  role                                  as role_as_supplied
from public.members_import
order by 6 desc, 5, 3;


-- ---------------------------------------------------------------------------
-- STEP 4 — Validate. READ THIS OUTPUT BEFORE RUNNING STEP 5.
-- ---------------------------------------------------------------------------
-- An empty result means you are clear to import. Any row returned here would
-- either fail the insert or land wrong.

select 'unrecognised Membership' as problem, email, "Membership" as value
from public.members_import
where public.norm_sub_group("Membership") is null

union all
select 'unrecognised role', email, role
from public.members_import
where public.norm_role(role) is null

union all
select 'missing email', coalesce(email, '(null)'), null
from public.members_import
where coalesce(trim(email), '') = ''

union all
select 'missing first or last name', email, first_name || ' / ' || last_name
from public.members_import
where coalesce(trim(first_name), '') = '' or coalesce(trim(last_name), '') = ''

union all
select 'duplicate email in CSV', lower(trim(email)), count(*)::text
from public.members_import
group by lower(trim(email))
having count(*) > 1

union all
select 'email already in members', lower(trim(i.email)), m.first_name || ' ' || m.last_name
from public.members_import i
join public.members m on m.email = lower(trim(i.email));


-- ---------------------------------------------------------------------------
-- STEP 5 — Import.
-- ---------------------------------------------------------------------------
-- Guarded: if STEP 4 returned anything, this raises and imports nothing rather
-- than importing the good rows and leaving you to work out which are missing.
-- No auth accounts are created — members sign up themselves with these emails
-- and the signup trigger claims the matching row, inheriting the role set here.

do $$
declare
  bad_count integer;
  inserted  integer;
begin
  select count(*) into bad_count
  from public.members_import
  where public.norm_sub_group("Membership") is null
     or public.norm_role(role) is null
     or coalesce(trim(email), '') = ''
     or coalesce(trim(first_name), '') = ''
     or coalesce(trim(last_name), '') = '';

  if bad_count > 0 then
    raise exception
      'Import aborted: % row(s) failed validation. Re-run STEP 4 to see them.', bad_count;
  end if;

  insert into public.members (first_name, last_name, email, company, role, sub_group)
  select
    trim(first_name),
    trim(last_name),
    lower(trim(email)),
    nullif(trim("Company"), ''),
    public.norm_role(role),
    public.norm_sub_group("Membership")
  from public.members_import
  on conflict (email) do nothing;

  get diagnostics inserted = row_count;
  raise notice 'Imported % member(s).', inserted;
end $$;


-- ---------------------------------------------------------------------------
-- STEP 6 — Confirm, then clean up.
-- ---------------------------------------------------------------------------

select sub_group, role, count(*)
from public.members
group by sub_group, role
order by sub_group, role;

select count(*) as total_members from public.members;

-- Once you are happy, drop the staging table and helpers:
-- drop table if exists public.members_import;
-- drop function if exists public.norm_sub_group(text);
-- drop function if exists public.norm_role(text);
