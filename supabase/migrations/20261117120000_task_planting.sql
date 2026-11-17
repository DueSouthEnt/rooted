-- Tasks written for one planting point at that planting, so deleting it
-- removes the jobs as well as the bed links. planting_beds already cascades.

alter table public.tasks
  add column if not exists planting_id uuid references public.plantings (id) on delete cascade;

create index if not exists tasks_planting_idx on public.tasks (planting_id);
