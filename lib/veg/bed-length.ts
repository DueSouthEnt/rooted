import { spanWidthForCount } from "@/lib/veg/bed-layout";
import { addDaysISO } from "@/lib/veg/dates";

/** New plantings use this until the farm chooses another length. */
export const DEFAULT_BED_LENGTH_M = 15;

export const BED_LENGTH_PRESETS = [
  { metres: 15, feet: 50 },
  { metres: 30, feet: 100 },
] as const;

const FOOT = 0.3048;

export function standardBedLengthMetres(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0.4 || number > 200) return DEFAULT_BED_LENGTH_M;
  return number;
}

export function metresFromDisplay(value: number, unit: "m" | "ft"): number {
  return unit === "ft" ? value * FOOT : value;
}

export function displayOfMetres(metres: number, unit: "m" | "ft"): number {
  return unit === "ft" ? metres / FOOT : metres;
}

/** 15 m is the 50 ft preset. 30 m is the 100 ft preset. Anything else is custom. */
export function matchingPreset(metres: number): 15 | 30 | null {
  if (Math.abs(metres - 15) < 0.05) return 15;
  if (Math.abs(metres - 30) < 0.05) return 30;
  return null;
}

export function plantingFitsBed(plantingLengthM: number, bedLengthM: number): boolean {
  if (!(plantingLengthM > 0) || !(bedLengthM > 0)) return true;
  return plantingLengthM <= bedLengthM + 0.05;
}

export function lengthClashMessage(plantingLengthM: number, bedLengthM: number, bedLabel: string): string {
  const want = trim(plantingLengthM);
  const have = trim(bedLengthM);
  return `This planting is ${want} m long and ${bedLabel} is only ${have} m. Shorten the planting, or choose a longer bed.`;
}

export function blockSpanForBeds(bedCount: number, bedLengthM: number, bedWidthM: number, pathWidthM: number) {
  return {
    spanLengthM: bedLengthM,
    spanWidthM: spanWidthForCount(Math.max(1, Math.round(bedCount)), bedWidthM, pathWidthM, "m"),
  };
}

export function shiftIsoDate(iso: string | null, days: number): string | null {
  if (!iso) return null;
  return addDaysISO(iso, Math.round(days));
}

function trim(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, "");
}
