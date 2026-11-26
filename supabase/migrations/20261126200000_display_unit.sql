-- How the farm map shows lengths. Bed sizes stay in metres.
alter table public.veg_farm_settings
  add column if not exists display_unit text not null default 'm'
  check (display_unit in ('m', 'ft'));
