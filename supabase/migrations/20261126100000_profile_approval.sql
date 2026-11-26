-- New accounts wait for the owner. Existing accounts, including the first one, stay in.

alter table public.profiles
  add column approved boolean not null default false;

alter table public.profiles
  add column is_admin boolean not null default false;

update public.profiles set approved = true;

update public.profiles
set is_admin = true, approved = true
where id = (
  select id from public.profiles
  order by created_at asc, id asc
  limit 1
);

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select approved from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- A person can edit their profile, but not these two flags.
-- An admin may change approved. Only the service role may change is_admin.
create or replace function public.protect_profile_flags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_admin boolean;
  service_role boolean;
begin
  service_role := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  actor_admin := coalesce((select is_admin from public.profiles where id = auth.uid()), false);
  if new.is_admin is distinct from old.is_admin and not service_role then
    new.is_admin := old.is_admin;
  end if;
  if new.approved is distinct from old.approved and not actor_admin and not service_role then
    new.approved := old.approved;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_flags on public.profiles;
create trigger profiles_protect_flags
before update on public.profiles
for each row execute function public.protect_profile_flags();

-- Farm data stays closed until the account is approved.
create or replace function public.owns_farm(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.farms
    where id = fid
      and user_id = auth.uid()
      and public.is_approved()
  );
$$;

drop policy if exists "own farms" on public.farms;
create policy "own farms" on public.farms
for all to authenticated
using (user_id = auth.uid() and public.is_approved())
with check (user_id = auth.uid() and public.is_approved());

drop policy if exists "read flowers" on public.flowers;
create policy "read flowers" on public.flowers
for select to authenticated using (public.is_approved());

drop policy if exists "read frost stations" on public.frost_stations;
create policy "read frost stations" on public.frost_stations
for select to authenticated using (public.is_approved());

create or replace function public.admin_list_accounts()
returns table (
  id uuid,
  email text,
  enabled_sections text[],
  created_at timestamptz,
  approved boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text, p.enabled_sections, p.created_at, p.approved
  from auth.users u
  join public.profiles p on p.id = u.id
  where public.is_admin()
  order by p.created_at desc;
$$;

revoke all on function public.admin_list_accounts() from public;
grant execute on function public.admin_list_accounts() to authenticated;

create or replace function public.admin_set_approved(target uuid, value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;
  update public.profiles set approved = value where id = target;
end;
$$;

revoke all on function public.admin_set_approved(uuid, boolean) from public;
grant execute on function public.admin_set_approved(uuid, boolean) to authenticated;
