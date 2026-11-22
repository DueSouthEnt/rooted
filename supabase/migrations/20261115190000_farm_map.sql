-- Satellite farm map. Geometry lives on the existing farm and bed rows,
-- so the row-level policies already on those tables cover it. No new grants.

alter table public.farms
  add column if not exists boundary jsonb;

comment on column public.farms.boundary is
  'GeoJSON Polygon, WGS84, coordinates in [longitude, latitude]. The farm outline drawn on the satellite map.';

alter table public.beds
  add column if not exists geometry jsonb;

comment on column public.beds.geometry is
  'Rectangle drawn on the satellite map: { type, center [lng, lat], lengthM, widthM, rotationDeg clockwise from north }. length_cm and width_cm stay in sync so plant counts use the real size.';

-- Satellite beds can be longer than the original 100 m cap.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.beds'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%length_cm%'
  loop
    execute format('alter table public.beds drop constraint %I', constraint_name);
  end loop;

  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.beds'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%width_cm%'
  loop
    execute format('alter table public.beds drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.beds
  add constraint beds_length_cm_check check (length_cm > 0 and length_cm <= 200000);

alter table public.beds
  add constraint beds_width_cm_check check (width_cm > 0 and width_cm <= 200000);
