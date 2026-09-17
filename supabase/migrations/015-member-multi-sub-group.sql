-- 015 — Members can belong to more than one sub-group.
--
-- Adds public.members.sub_groups (text[]): the FULL set of groups a member is
-- in. public.members.sub_group is kept as the member's PRIMARY group — a single
-- value that still satisfies its CHECK and drives every display and
-- single-group code path. `sub_groups` always contains the primary.
--
-- Membership scoping (who is on a register, which admins can see a member, and
-- which groups their attendance is reported under) is driven by `sub_groups`.
--
-- Idempotent and safe to re-run.

-- 1. The column. Starts empty; the backfill + trigger below fill and maintain it.
alter table public.members
  add column if not exists sub_groups text[] not null default '{}';

-- 2. Backfill existing rows: everyone starts in exactly the group they are in.
update public.members
   set sub_groups = array[sub_group]
 where sub_groups is null or cardinality(sub_groups) = 0;

-- 3. Keep sub_group and sub_groups in agreement, from EITHER side, on every
--    write. This is what lets you also just edit the array directly in the
--    Supabase table editor (e.g. {"RED Central","RED Uptown"}) without having to
--    touch sub_group by hand:
--      * empty sub_groups            -> seeded from the primary sub_group
--      * primary missing from the set-> prepended so it is always a member
--      * order preserved, duplicates removed
--      * primary realigned to the first element after normalisation
create or replace function public.normalize_member_sub_groups()
returns trigger
language plpgsql
as $$
declare
  seen text[] := '{}';
  g    text;
begin
  if new.sub_groups is null or cardinality(new.sub_groups) = 0 then
    new.sub_groups := array[new.sub_group];
  end if;

  -- Ensure the primary is present so `sub_group = any(sub_groups)` always holds.
  if not (new.sub_group = any(new.sub_groups)) then
    new.sub_groups := array_prepend(new.sub_group, new.sub_groups);
  end if;

  -- De-duplicate while preserving order.
  foreach g in array new.sub_groups loop
    if not (g = any(seen)) then
      seen := array_append(seen, g);
    end if;
  end loop;
  new.sub_groups := seen;

  -- The primary is, by definition, the first group in the list.
  new.sub_group := new.sub_groups[1];

  return new;
end;
$$;

drop trigger if exists members_normalize_sub_groups on public.members;
create trigger members_normalize_sub_groups
  before insert or update on public.members
  for each row execute function public.normalize_member_sub_groups();

-- 4. Constraints: every element must be one of the five, and the primary must be
--    part of the set. Added NOT VALID then validated so a re-run is cheap and a
--    stray legacy row surfaces loudly rather than silently.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'members_sub_groups_valid'
  ) then
    alter table public.members
      add constraint members_sub_groups_valid
      check (
        cardinality(sub_groups) >= 1
        and sub_groups <@ array['RED Central','RED Uptown','RED Downtown','RED West','RED Connect']::text[]
        and sub_group = any(sub_groups)
      ) not valid;
    alter table public.members validate constraint members_sub_groups_valid;
  end if;
end
$$;

-- 5. GIN index so the overlap (&&) / contains (@>) scoping queries are fast.
create index if not exists members_sub_groups_gin on public.members using gin (sub_groups);

-- 6. Admin visibility follows the FULL set on both sides: a member is visible to
--    an admin when their groups intersect. Own-record and super-admin branches
--    are unchanged.
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
          and me.sub_groups && (select t.sub_groups from public.members t where t.id = target_member)
        )
      )
  );
$$;

-- 7. New sign-ups start in a single group; the trigger in step 3 mirrors it into
--    sub_groups automatically, but set it explicitly so the row is correct even
--    if this function runs before the normalise trigger in some future ordering.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed uuid;
  chosen  text;
begin
  update public.members
     set auth_user_id = new.id
   where lower(email) = lower(new.email)
     and auth_user_id is null
  returning id into claimed;

  if claimed is null then
    chosen := coalesce(nullif(new.raw_user_meta_data ->> 'sub_group', ''), 'RED Central');
    insert into public.members (auth_user_id, first_name, last_name, email, company, sub_group, sub_groups)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'first_name', ''), 'New'),
      coalesce(nullif(new.raw_user_meta_data ->> 'last_name', ''), 'Member'),
      new.email,
      nullif(new.raw_user_meta_data ->> 'company', ''),
      chosen,
      array[chosen]
    )
    on conflict (email) do nothing;
  end if;

  return new;
end;
$$;

-- Putting a member in two groups after this has run is a one-liner (or a direct
-- array edit in the Table editor):
--   update public.members
--      set sub_groups = array['RED Central','RED Uptown']
--    where email = 'someone@example.com';
