import { readFileSync, writeFileSync } from "node:fs";
import { stations } from "../data/stations";
import { estimateClimate, hemisphereFromLatitude } from "../lib/climate";

const START = "2015-01-01";
const END = "2024-12-31";
const CONCURRENCY = 2;

interface CacheEntry {
  id: string;
  frostFree: boolean;
  occasionalFrost: boolean;
  frostYears: number;
  sampleYears: number;
  lastSpringMonth: number | null;
  lastSpringDay: number | null;
  firstAutumnMonth: number | null;
  firstAutumnDay: number | null;
  seasonLengthDays: number;
  winterMinC: number | null;
  usdaZone: string | null;
  rhs: string | null;
  summer: string;
  hemisphere: "north" | "south";
  tropical: boolean;
}

async function fetchStation(latitude: number, longitude: number) {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("start_date", START);
  url.searchParams.set("end_date", END);
  url.searchParams.set("daily", "temperature_2m_min,temperature_2m_max");
  url.searchParams.set("timezone", "auto");
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    const response = await fetch(url, { headers: { "User-Agent": "Rooted/1.0 (cut-flower planner)" } });
    if (response.status === 429) {
      lastError = new Error("429");
      continue;
    }
    if (!response.ok) throw new Error(`${response.status}`);
    const body = (await response.json()) as {
      daily?: { time: string[]; temperature_2m_min: Array<number | null>; temperature_2m_max: Array<number | null> };
    };
    const daily = body.daily;
    if (!daily) throw new Error("No daily data");
    return daily.time.map((date, index) => ({
      date,
      tMin: daily.temperature_2m_min[index],
      tMax: daily.temperature_2m_max[index],
    }));
  }
  throw lastError ?? new Error("failed");
}

async function one(station: (typeof stations)[number]): Promise<CacheEntry> {
  const hemisphere = hemisphereFromLatitude(station.latitude);
  const days = await fetchStation(station.latitude, station.longitude);
  const estimate = estimateClimate(days, hemisphere, {
    tropical: Math.abs(station.latitude) < 15,
    source: "open-meteo",
  });
  return {
    id: station.id,
    frostFree: estimate.frostFree,
    occasionalFrost: estimate.occasionalFrost,
    frostYears: estimate.frostYears,
    sampleYears: estimate.sampleYears,
    lastSpringMonth: estimate.lastSpringMonth,
    lastSpringDay: estimate.lastSpringDay,
    firstAutumnMonth: estimate.firstAutumnMonth,
    firstAutumnDay: estimate.firstAutumnDay,
    seasonLengthDays: estimate.seasonLengthDays,
    winterMinC: estimate.winterMinC,
    usdaZone: estimate.usdaZone,
    rhs: estimate.rhs,
    summer: estimate.summer,
    hemisphere,
    tropical: estimate.tropical,
  };
}

const cachePath = new URL("../data/climate-cache.json", import.meta.url);

function writeCache(results: CacheEntry[]) {
  const payload = {
    source: "Open-Meteo historical weather API, daily minimum at or below 0°C, 2015–2024",
    generatedAt: new Date().toISOString(),
    stations: results,
  };
  writeFileSync(cachePath, JSON.stringify(payload, null, 2));
}

async function main() {
  const existing = JSON.parse(readFileSync(cachePath, "utf8")) as { stations: CacheEntry[] };
  const results = [...existing.stations];
  const done = new Set(results.map((entry) => entry.id));
  const pending = stations.filter((station) => !done.has(station.id));
  console.log(`resume with ${results.length}, fetching ${pending.length}`);
  for (let index = 0; index < pending.length; index += CONCURRENCY) {
    const batch = pending.slice(index, index + CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (station) => {
        try {
          const entry = await one(station);
          console.log(`${station.id} ${entry.rhs} zone ${entry.usdaZone} frost ${entry.lastSpringMonth}/${entry.lastSpringDay}`);
          return entry;
        } catch (error) {
          console.error(`failed ${station.id}`, error);
          return null;
        }
      }),
    );
    const fresh = settled.filter((entry): entry is CacheEntry => entry != null);
    results.push(...fresh);
    if (fresh.length) writeCache(results);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  writeCache(results);
  console.log(`wrote ${results.length} stations`);
}

main();
