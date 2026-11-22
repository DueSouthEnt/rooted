-- Successive sowings of the same flower share a group, so the year plan
-- can place them one after another and still let you move one on its own.

alter table public.plantings
  add column if not exists succession_group uuid,
  add column if not exists succession_index integer;

create index if not exists plantings_succession_idx on public.plantings (succession_group);
