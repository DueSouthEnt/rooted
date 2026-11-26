-- The length new plantings start with. Stored in metres. 15 m is also shown as 50 ft.
alter table public.veg_farm_settings
  add column if not exists standard_bed_length_m double precision not null default 15;
