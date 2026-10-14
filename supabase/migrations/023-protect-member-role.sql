-- 023: Stop members changing their own role, email or login link directly.
--
-- members_update_own lets a signed-in member update their own row, which is
-- what profile edits (phone, socials, business name, avatar) rely on. Without
-- this trigger that same policy would also let someone promote themselves by
-- calling the Supabase API directly. Role and email changes go through server
-- actions using the service role, which this trigger allows.

create or replace function public.members_protect_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' and (
    new.role is distinct from old.role
    or new.email is distinct from old.email
    or new.auth_user_id is distinct from old.auth_user_id
  ) then
    raise exception 'Role, email and login changes must go through the app.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists members_protect_privileged_columns on public.members;
create trigger members_protect_privileged_columns
  before update on public.members
  for each row execute function public.members_protect_privileged_columns();
