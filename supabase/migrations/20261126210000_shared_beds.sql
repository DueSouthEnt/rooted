-- One physical bed can hold flower plantings and vegetable plantings.
-- veg_beds.shared_bed_id was reserved for this. Flower beds point at the same row.
-- The outline lives on the shared row, and each section's map draws that one shape.

create table public.shared_beds (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null,
  length_m double precision not null check (length_m > 0),
  width_m double precision not null check (width_m > 0),
  center_lng double precision,
  center_lat double precision,
  rotation_deg double precision not null default 0,
  created_at timestamptz not null default now()
);

create index shared_beds_farm_idx on public.shared_beds (farm_id);

alter table public.beds
  add column if not exists shared_bed_id uuid references public.shared_beds (id) on delete set null;

alter table public.veg_beds
  add constraint veg_beds_shared_bed_fk
  foreign key (shared_bed_id) references public.shared_beds (id) on delete set null;

create unique index beds_one_shared_idx on public.beds (shared_bed_id) where shared_bed_id is not null;
create unique index veg_beds_one_shared_idx on public.veg_beds (shared_bed_id) where shared_bed_id is not null;

alter table public.shared_beds enable row level security;

create policy "own shared beds" on public.shared_beds
  for all to authenticated
  using (public.owns_farm(farm_id))
  with check (public.owns_farm(farm_id));

grant select, insert, update, delete on public.shared_beds to authenticated;
grant all on public.shared_beds to service_role;
