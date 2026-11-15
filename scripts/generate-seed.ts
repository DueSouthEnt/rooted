import { readFileSync, writeFileSync } from "node:fs";
import { flowers } from "../data/flowers";
import { stations } from "../data/stations";

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlJson(value: unknown): string {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

const cache = JSON.parse(readFileSync(new URL("../data/climate-cache.json", import.meta.url), "utf8")) as {
  stations: Array<{ id: string } & Record<string, unknown>>;
};
const climateById = new Map(cache.stations.map((entry) => [entry.id, entry]));

const flowerRows = flowers
  .map(
    (flower) =>
      `(${[
        sqlString(flower.slug),
        sqlString(flower.commonName),
        sqlString(flower.latinName),
        sqlString(flower.lifeCycle),
        sqlString(flower.hardyClass),
        sqlString(flower.rhs),
        sqlString(flower.difficulty),
        sqlJson(flower),
      ].join(", ")})`,
  )
  .join(",\n");

const stationRows = stations
  .map((station) => {
    const climate = climateById.get(station.id);
    const codes = `array[${station.postalCodes.map(sqlString).join(", ")}]::text[]`;
    return `(${[
      sqlString(station.id),
      sqlString(station.name),
      sqlString(station.region),
      sqlString(station.country),
      station.latitude,
      station.longitude,
      codes,
      climate ? sqlJson(climate) : "null",
    ].join(", ")})`;
  })
  .join(",\n");

const sql = `-- Generated from data/flowers.ts, data/stations.ts and data/climate-cache.json.
-- Safe to re-run. Does not touch anyone's farms.

insert into public.flowers (slug, common_name, latin_name, life_cycle, hardy_class, rhs, difficulty, data)
values
${flowerRows}
on conflict (slug) do update set
  common_name = excluded.common_name,
  latin_name = excluded.latin_name,
  life_cycle = excluded.life_cycle,
  hardy_class = excluded.hardy_class,
  rhs = excluded.rhs,
  difficulty = excluded.difficulty,
  data = excluded.data;

insert into public.frost_stations (id, name, region, country, latitude, longitude, postal_codes, climate)
values
${stationRows}
on conflict (id) do update set
  name = excluded.name,
  region = excluded.region,
  country = excluded.country,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  postal_codes = excluded.postal_codes,
  climate = excluded.climate;
`;

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log(`wrote seed for ${flowers.length} flowers and ${stations.length} stations`);
