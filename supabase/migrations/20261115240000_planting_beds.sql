-- A planting can sit on more than one bed. bed_id stays as the first bed
-- so the map and older queries still see it.

alter table public.plantings
  add column if not exists beds_needed integer not null default 1 check (beds_needed between 1 and 40),
  add column if not exists days_to_maturity integer,
  add column if not exists days_in_nursery integer,
  add column if not exists bloom_weeks integer,
  add column if not exists spacing_cm integer,
  add column if not exists bed_length_m double precision,
  add column if not exists notes text not null default '';

create table public.planting_beds (
  planting_id uuid not null references public.plantings (id) on delete cascade,
  bed_id uuid not null references public.beds (id) on delete cascade,
  primary key (planting_id, bed_id)
);

create index planting_beds_bed_idx on public.planting_beds (bed_id);

insert into public.planting_beds (planting_id, bed_id)
select id, bed_id from public.plantings where bed_id is not null
on conflict do nothing;

alter table public.planting_beds enable row level security;

create policy "own planting beds" on public.planting_beds
  for all to authenticated
  using (
    exists (
      select 1 from public.plantings p
      where p.id = planting_id and public.owns_farm(p.farm_id)
    )
  )
  with check (
    exists (
      select 1 from public.plantings p
      where p.id = planting_id and public.owns_farm(p.farm_id)
    )
  );

grant select, insert, update, delete on public.planting_beds to authenticated;
grant all on public.planting_beds to service_role;
