import { NextResponse } from "next/server";
import climateCache from "@/data/climate-cache.json";
import { stations } from "@/data/stations";
import {
  estimateClimate,
  hemisphereFromLatitude,
  planningWindow,
  type ClimateEstimate,
  type Hemisphere,
  type Summer,
} from "@/lib/climate";
import { defaultSeasonYear } from "@/lib/dates";
import { isRhsRating } from "@/lib/hardiness";
import { nearestStation } from "@/lib/places";

export const dynamic = "force-dynamic";

interface CacheRow {
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
  hemisphere: Hemisphere;
  tropical: boolean;
}

function fromCache(id: string): ClimateEstimate | null {
  const row = (climateCache.stations as CacheRow[]).find((item) => item.id === id);
  if (!row || !row.rhs || !isRhsRating(row.rhs)) return null;
  const summer: Summer = row.summer === "cool" || row.summer === "hot" ? row.summer : "mild";
  return {
    hemisphere: row.hemisphere,
    frostFree: row.frostFree,
    occasionalFrost: row.occasionalFrost,
    frostYears: row.frostYears,
    sampleYears: row.sampleYears,
    lastSpringMonth: row.lastSpringMonth,
    lastSpringDay: row.lastSpringDay,
    firstAutumnMonth: row.firstAutumnMonth,
    firstAutumnDay: row.firstAutumnDay,
    seasonLengthDays: row.seasonLengthDays,
    winterMinC: row.winterMinC,
    usdaZone: row.usdaZone,
    rhs: row.rhs,
    summer,
    warmestMonthMeanMaxC: null,
    tropical: row.tropical,
    source: "station",
  };
}

function payload(estimate: ClimateEstimate, note: string) {
  const seasonYear = defaultSeasonYear(estimate.hemisphere);
  const window = planningWindow(estimate, seasonYear);
  return {
    hemisphere: estimate.hemisphere,
    frostFree: estimate.frostFree,
    occasionalFrost: estimate.occasionalFrost,
    lastSpring: estimate.frostFree ? "" : window.lastSpringFrost,
    firstAutumn: estimate.frostFree ? "" : window.firstAutumnFrost,
    seasonLengthDays: window.seasonLengthDays,
    usdaZone: estimate.usdaZone,
    rhs: estimate.rhs,
    summer: estimate.summer,
    winterMinC: estimate.winterMinC,
    tropical: estimate.tropical,
    seasonYear,
    source: estimate.source,
    anchored: window.anchored,
    note,
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "Need a latitude and longitude." }, { status: 400 });
  }

  const hemisphere = hemisphereFromLatitude(latitude);
  const nearest = nearestStation(stations, latitude, longitude);
  try {
    const url = new URL("https://archive-api.open-meteo.com/v1/archive");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("start_date", "2015-01-01");
    url.searchParams.set("end_date", "2024-12-31");
    url.searchParams.set("daily", "temperature_2m_min,temperature_2m_max");
    url.searchParams.set("timezone", "auto");
    const response = await fetch(url, {
      headers: { "User-Agent": "Rooted/1.0 (cut-flower farm planner)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(String(response.status));
    const body = (await response.json()) as {
      daily?: { time: string[]; temperature_2m_min: Array<number | null>; temperature_2m_max: Array<number | null> };
    };
    if (!body.daily) throw new Error("empty");
    const days = body.daily.time.map((date, index) => ({
      date,
      tMin: body.daily!.temperature_2m_min[index],
      tMax: body.daily!.temperature_2m_max[index],
    }));
    const estimate = estimateClimate(days, hemisphere, {
      tropical: Math.abs(latitude) < 15,
      source: "open-meteo",
    });
    const note = estimate.frostFree
      ? `Frost is rare here (0°C in ${estimate.frostYears} of ${estimate.sampleYears} years, Open-Meteo). Dates below, if you add them, are your own.`
      : estimate.occasionalFrost
        ? `Frost showed up in only ${estimate.frostYears} of ${estimate.sampleYears} years. The dates are the middle of the years that did frost — a caution, not an annual event. Open-Meteo, 0°C.`
        : `Median frost dates from 2015–2024 daily weather (Open-Meteo), using a 0°C threshold. ${estimate.frostYears} of ${estimate.sampleYears} years frosted.`;
    return NextResponse.json(payload(estimate, note));
  } catch {
    const fallback = fromCache(nearest.id);
    if (!fallback) {
      return NextResponse.json(
        {
          error:
            "The weather history didn't answer, and there's no saved climate for a nearby place yet. Type the frost dates yourself — you know the garden better than a server does.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      payload(
        fallback,
        `Live weather history didn't answer. These are saved estimates for ${nearest.name}, the nearest reference place. Treat them as a rough sketch.`,
      ),
    );
  }
}
