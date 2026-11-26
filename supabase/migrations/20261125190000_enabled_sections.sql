-- Sections a grower turned on at sign-up: flowers, veg, or both.
-- Existing accounts stay on flowers until they add vegetables in settings.

alter table public.profiles
  add column enabled_sections text[] not null default array['flowers']::text[];

alter table public.profiles
  drop constraint if exists profiles_enabled_sections_known;

alter table public.profiles
  add constraint profiles_enabled_sections_known
  check (
    cardinality(enabled_sections) >= 1
    and enabled_sections <@ array['flowers', 'veg']::text[]
  );

-- Same rules as lib/sections.ts: known values only, duplicates dropped, flowers then veg.
-- Missing or empty metadata becomes flowers, which is also the column default.
create or replace function public.sections_from_metadata(meta jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (
      select array_agg(chosen.section order by chosen.section)
      from (
        select distinct value as section
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(meta -> 'enabled_sections') = 'array' then meta -> 'enabled_sections'
            else '[]'::jsonb
          end
        ) as value
        where value in ('flowers', 'veg')
      ) as chosen
    ),
    array['flowers']::text[]
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sections text[];
begin
  sections := public.sections_from_metadata(new.raw_user_meta_data);
  if sections is null or cardinality(sections) = 0 then
    sections := array['flowers']::text[];
  end if;

  insert into public.profiles (id, display_name, enabled_sections)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    sections
  );
  return new;
end;
$$;
