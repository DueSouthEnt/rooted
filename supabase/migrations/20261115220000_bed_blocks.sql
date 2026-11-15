-- A block is a run of parallel beds with a path between them.
-- Each bed is still its own row, so a planting can sit on one bed.
-- Row-level security matches the farms table: only the farm's owner.

create table public.bed_blocks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  area_name text not null default 'Farm area',
  name text not null,
  bed_length_m double precision not null,
  bed_width_cm integer not null,
  path_width_cm integer not null,
  bed_count integer not null check (bed_count > 0 and bed_count <= 400),
  rotation_deg double precision not null default 0,
  origin jsonb not null,
  along_sign smallint not null default 1 check (along_sign in (-1, 1)),
  across_sign smallint not null default 1 check (across_sign in (-1, 1)),
  season_year integer,
  created_at timestamptz not null default now()
);

create index bed_blocks_farm_idx on public.bed_blocks (farm_id);

alter table public.beds
  add column if not exists block_id uuid references public.bed_blocks (id) on delete cascade,
  add column if not exists block_index integer;

create index if not exists beds_block_idx on public.beds (block_id);

alter table public.bed_blocks enable row level security;

create policy "own blocks" on public.bed_blocks
  for all to authenticated
  using (public.owns_farm(farm_id))
  with check (public.owns_farm(farm_id));

grant select, insert, update, delete on public.bed_blocks to authenticated;
grant all on public.bed_blocks to service_role;
