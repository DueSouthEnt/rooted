create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  created_at timestamptz not null default now()
);

create table public.flowers (
  slug text primary key,
  common_name text not null,
  latin_name text not null,
  life_cycle text not null,
  hardy_class text not null,
  rhs text not null,
  difficulty text not null,
  data jsonb not null
);

create table public.frost_stations (
  id text primary key,
  name text not null,
  region text not null,
  country text not null,
  latitude double precision not null,
  longitude double precision not null,
  postal_codes text[] not null default '{}',
  climate jsonb
);

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  season_year integer not null,
  place_name text,
  postal_code text,
  country text,
  latitude double precision,
  longitude double precision,
  hemisphere text check (hemisphere in ('north', 'south')),
  frost_free boolean not null default false,
  occasional_frost boolean not null default false,
  last_spring_month integer,
  last_spring_day integer,
  first_autumn_month integer,
  first_autumn_day integer,
  season_length_days integer,
  usda_zone text,
  rhs_rating text,
  summer text check (summer in ('cool', 'mild', 'hot')),
  winter_min_c double precision,
  tropical boolean not null default false,
  frost_source text,
  frost_note text,
  plan_top text not null default 'north' check (plan_top in ('north', 'east', 'south', 'west')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.farm_crops (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  flower_slug text not null,
  status text not null default 'planting' check (status in ('planting', 'established')),
  successions integer not null default 1 check (successions between 1 and 8),
  unique (farm_id, flower_slug)
);

create table public.beds (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null,
  length_cm integer not null check (length_cm > 0 and length_cm < 10000),
  width_cm integer not null check (width_cm > 0 and width_cm < 10000),
  bed_kind text not null default 'annual' check (bed_kind in ('annual', 'perennial', 'bulb')),
  position_x integer not null default 0,
  position_y integer not null default 0
);

create table public.bed_plants (
  id uuid primary key default gen_random_uuid(),
  bed_id uuid not null references public.beds (id) on delete cascade,
  flower_slug text not null,
  unique (bed_id, flower_slug)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  season_year integer not null,
  task_key text not null,
  flower_slug text,
  title text not null,
  detail text,
  due_date date not null,
  category text not null,
  completed_at timestamptz,
  unique (farm_id, season_year, task_key)
);

create index farms_user_idx on public.farms (user_id);
create index crops_farm_idx on public.farm_crops (farm_id);
create index beds_farm_idx on public.beds (farm_id);
create index tasks_farm_due_idx on public.tasks (farm_id, season_year, due_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger farms_updated_at
before update on public.farms
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.owns_farm(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.farms
    where id = fid and user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.flowers enable row level security;
alter table public.frost_stations enable row level security;
alter table public.farms enable row level security;
alter table public.farm_crops enable row level security;
alter table public.beds enable row level security;
alter table public.bed_plants enable row level security;
alter table public.tasks enable row level security;

create policy "read own profile" on public.profiles
for select to authenticated using (id = auth.uid());

create policy "update own profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "read flowers" on public.flowers
for select to authenticated using (true);

create policy "read frost stations" on public.frost_stations
for select to authenticated using (true);

create policy "own farms" on public.farms
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "own crops" on public.farm_crops
for all to authenticated
using (public.owns_farm(farm_id))
with check (public.owns_farm(farm_id));

create policy "own beds" on public.beds
for all to authenticated
using (public.owns_farm(farm_id))
with check (public.owns_farm(farm_id));

create policy "own bed plants" on public.bed_plants
for all to authenticated
using (
  exists (
    select 1 from public.beds b
    where b.id = bed_id and public.owns_farm(b.farm_id)
  )
)
with check (
  exists (
    select 1 from public.beds b
    where b.id = bed_id and public.owns_farm(b.farm_id)
  )
);

create policy "own tasks" on public.tasks
for all to authenticated
using (public.owns_farm(farm_id))
with check (public.owns_farm(farm_id));

grant usage on schema public to anon, authenticated, service_role;
grant select on public.flowers, public.frost_stations to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.farms, public.farm_crops, public.beds, public.bed_plants, public.tasks to authenticated;
grant all on public.profiles, public.flowers, public.frost_stations, public.farms, public.farm_crops, public.beds, public.bed_plants, public.tasks to service_role;
