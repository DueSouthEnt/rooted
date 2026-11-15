import {
  diffDays,
  doyToMonthDay,
  median,
  monthDayToDoy,
  monthDayToIso,
  nonLeapDayOfYear,
} from "@/lib/dates";
import { rhsFromMinC, usdaFromMinC, type RhsRating } from "@/lib/hardiness";

export type Hemisphere = "north" | "south";
export type Summer = "cool" | "mild" | "hot";
export type FrostSource = "open-meteo" | "station" | "manual";

export interface DailyTemperature {
  date: string;
  tMin: number | null;
  tMax?: number | null;
}

export interface ClimateEstimate {
  hemisphere: Hemisphere;
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
  rhs: RhsRating | null;
  summer: Summer;
  warmestMonthMeanMaxC: number | null;
  tropical: boolean;
  source: FrostSource;
}

const FROST_C = 0;

function yearsOf(days: DailyTemperature[]): number[] {
  return [...new Set(days.map((day) => Number(day.date.slice(0, 4))))].sort();
}

function monthOf(iso: string): number {
  return Number(iso.slice(5, 7));
}

/**
 * Estimate frost dates from daily minimum temperatures.
 * Threshold is 0°C. Northern spring is January–July and autumn is August–December.
 * Southern spring is July–December and autumn is January–June, so the season wraps the new year.
 */
export function estimateClimate(
  days: DailyTemperature[],
  hemisphere: Hemisphere,
  options?: { tropical?: boolean; source?: FrostSource },
): ClimateEstimate {
  const years = yearsOf(days);
  const springFrostDoys: number[] = [];
  const autumnFrostDoys: number[] = [];
  const winterMins: number[] = [];

  for (const year of years) {
    const inYear = days.filter(
      (day) => Number(day.date.slice(0, 4)) === year && day.tMin != null,
    );
    if (inYear.length === 0) continue;

    const mins = inYear.map((day) => day.tMin as number);
    winterMins.push(Math.min(...mins));

    const spring = inYear.filter((day) => {
      const month = monthOf(day.date);
      return hemisphere === "north" ? month <= 7 : month >= 7;
    });
    const autumn = inYear.filter((day) => {
      const month = monthOf(day.date);
      return hemisphere === "north" ? month >= 8 : month <= 6;
    });

    const springFrosts = spring.filter((day) => (day.tMin as number) <= FROST_C);
    const autumnFrosts = autumn.filter((day) => (day.tMin as number) <= FROST_C);

    if (springFrosts.length > 0) {
      const last = springFrosts[springFrosts.length - 1];
      springFrostDoys.push(nonLeapDayOfYear(last.date));
    }
    if (autumnFrosts.length > 0) {
      const first = autumnFrosts[0];
      autumnFrostDoys.push(nonLeapDayOfYear(first.date));
    }
  }

  const frostYears = Math.max(springFrostDoys.length, autumnFrostDoys.length);
  const sampleYears = Math.max(years.length, 1);
  const frostFree = frostYears === 0;
  const occasionalFrost = !frostFree && frostYears / sampleYears < 0.5;

  let lastSpringMonth: number | null = null;
  let lastSpringDay: number | null = null;
  let firstAutumnMonth: number | null = null;
  let firstAutumnDay: number | null = null;

  if (springFrostDoys.length > 0) {
    const parts = doyToMonthDay(median(springFrostDoys));
    lastSpringMonth = parts.month;
    lastSpringDay = parts.day;
  }
  if (autumnFrostDoys.length > 0) {
    const parts = doyToMonthDay(median(autumnFrostDoys));
    firstAutumnMonth = parts.month;
    firstAutumnDay = parts.day;
  }

  const seasonLengthDays = seasonLengthFromParts(
    hemisphere,
    frostFree,
    lastSpringMonth,
    lastSpringDay,
    firstAutumnMonth,
    firstAutumnDay,
  );

  const winterMinC =
    winterMins.length > 0
      ? Math.round((winterMins.reduce((sum, value) => sum + value, 0) / winterMins.length) * 10) /
        10
      : null;

  const monthMaxes = new Map<number, number[]>();
  for (const day of days) {
    if (day.tMax == null) continue;
    const month = monthOf(day.date);
    const bucket = monthMaxes.get(month) ?? [];
    bucket.push(day.tMax);
    monthMaxes.set(month, bucket);
  }
  let warmest: number | null = null;
  for (const values of monthMaxes.values()) {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    if (warmest == null || mean > warmest) warmest = mean;
  }
  const warmestMonthMeanMaxC = warmest == null ? null : Math.round(warmest * 10) / 10;
  const summer: Summer =
    warmestMonthMeanMaxC == null
      ? "mild"
      : warmestMonthMeanMaxC >= 29
        ? "hot"
        : warmestMonthMeanMaxC >= 22
          ? "mild"
          : "cool";

  return {
    hemisphere,
    frostFree,
    occasionalFrost,
    frostYears,
    sampleYears,
    lastSpringMonth,
    lastSpringDay,
    firstAutumnMonth,
    firstAutumnDay,
    seasonLengthDays,
    winterMinC,
    usdaZone: winterMinC == null ? null : usdaFromMinC(winterMinC),
    rhs: winterMinC == null ? null : rhsFromMinC(winterMinC),
    summer,
    warmestMonthMeanMaxC,
    tropical: options?.tropical ?? false,
    source: options?.source ?? "open-meteo",
  };
}

export function seasonLengthFromParts(
  hemisphere: Hemisphere,
  frostFree: boolean,
  lastSpringMonth: number | null,
  lastSpringDay: number | null,
  firstAutumnMonth: number | null,
  firstAutumnDay: number | null,
): number {
  if (
    frostFree ||
    lastSpringMonth == null ||
    lastSpringDay == null ||
    firstAutumnMonth == null ||
    firstAutumnDay == null
  ) {
    return 365;
  }
  const lastDoy = monthDayToDoy(lastSpringMonth, lastSpringDay);
  const firstDoy = monthDayToDoy(firstAutumnMonth, firstAutumnDay);
  if (hemisphere === "north") return Math.max(0, firstDoy - lastDoy);
  return 365 - lastDoy + firstDoy;
}

export interface PlanningWindow {
  lastSpringFrost: string;
  firstAutumnFrost: string;
  seasonLengthDays: number;
  anchored: boolean;
}

/** Real frost dates for a season year, or labelled anchors where frost is rare. */
export function planningWindow(
  estimate: Pick<
    ClimateEstimate,
    | "hemisphere"
    | "frostFree"
    | "lastSpringMonth"
    | "lastSpringDay"
    | "firstAutumnMonth"
    | "firstAutumnDay"
    | "seasonLengthDays"
  >,
  seasonYear: number,
): PlanningWindow {
  if (
    !estimate.frostFree &&
    estimate.lastSpringMonth &&
    estimate.lastSpringDay &&
    estimate.firstAutumnMonth &&
    estimate.firstAutumnDay
  ) {
    const lastSpringFrost = monthDayToIso(
      seasonYear,
      estimate.lastSpringMonth,
      estimate.lastSpringDay,
    );
    const autumnYear =
      estimate.hemisphere === "south" && estimate.firstAutumnMonth <= 6
        ? seasonYear + 1
        : seasonYear;
    const firstAutumnFrost = monthDayToIso(
      autumnYear,
      estimate.firstAutumnMonth,
      estimate.firstAutumnDay,
    );
    return {
      lastSpringFrost,
      firstAutumnFrost,
      seasonLengthDays: diffDays(lastSpringFrost, firstAutumnFrost),
      anchored: false,
    };
  }

  if (estimate.hemisphere === "north") {
    return {
      lastSpringFrost: monthDayToIso(seasonYear, 3, 1),
      firstAutumnFrost: monthDayToIso(seasonYear, 12, 1),
      seasonLengthDays: 365,
      anchored: true,
    };
  }
  return {
    lastSpringFrost: monthDayToIso(seasonYear, 9, 1),
    firstAutumnFrost: monthDayToIso(seasonYear + 1, 6, 1),
    seasonLengthDays: 365,
    anchored: true,
  };
}

export function hemisphereFromLatitude(latitude: number): Hemisphere {
  return latitude >= 0 ? "north" : "south";
}
