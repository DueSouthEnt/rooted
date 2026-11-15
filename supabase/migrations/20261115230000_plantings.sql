-- A planting is one dated run of a flower: sow, plant out, bloom, and maybe a lift.
-- It can sit on a bed. Perennials and tubers keep their dates and show again in later years.

create table public.plantings (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  flower_slug text not null,
  variety text not null default '',
  method text not null check (method in ('indoor', 'direct', 'tuber', 'bulb', 'corm', 'crown', 'division')),
  nursery_start date,
  field_date date not null,
  bloom_start date not null,
  bloom_end date not null,
  lift_date date,
  first_bloom_year integer not null,
  spans_years boolean not null default false,
  bed_id uuid references public.beds (id) on delete set null,
  season_year integer not null,
  created_at timestamptz not null default now()
);

create index plantings_farm_idx on public.plantings (farm_id, season_year);
create index plantings_bed_idx on public.plantings (bed_id);

alter table public.plantings enable row level security;

create policy "own plantings" on public.plantings
  for all to authenticated
  using (public.owns_farm(farm_id))
  with check (public.owns_farm(farm_id));

grant select, insert, update, delete on public.plantings to authenticated;
grant all on public.plantings to service_role;
