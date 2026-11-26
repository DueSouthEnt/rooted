import type { Unit } from "@/lib/veg/types";

const METRES_TO_FEET = 3.280839895;

export function toFeet(value: number, unit: Unit): number {
  return unit === "m" ? value * METRES_TO_FEET : value;
}

export function fromFeet(feet: number, unit: Unit): number {
  return unit === "m" ? feet / METRES_TO_FEET : feet;
}

export function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

export function roundTo(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function formatNumber(value: number, digits = 1): string {
  const rounded = roundTo(value, digits);
  return rounded.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function formatQuantity(value: number, unit: string): string {
  const digits = value >= 20 ? 0 : 1;
  return `${formatNumber(value, digits)} ${unit}`;
}

export function formatDimension(value: number, unit: Unit): string {
  const label = unit === "ft" ? "ft" : "m";
  const base = `${formatNumber(value, value < 10 ? 2 : 1)} ${label}`;
  if (unit === "ft" && value > 0 && value < 15) {
    return `${base} · ${Math.round(value * 12)} in`;
  }
  return base;
}

export function unitWord(unit: Unit, plural = true): string {
  if (unit === "m") return plural ? "metres" : "metre";
  return plural ? "feet" : "foot";
}

export function summarizeBeds(
  blocks: { unit: Unit; beds: { length: number; width: number }[] }[],
): { bedCount: number; bedFeet: number; areaSqFt: number } {
  let bedCount = 0;
  let bedFeet = 0;
  let areaSqFt = 0;
  for (const block of blocks) {
    for (const bed of block.beds) {
      bedCount += 1;
      const length = toFeet(bed.length, block.unit);
      const width = toFeet(bed.width, block.unit);
      bedFeet += length;
      areaSqFt += length * width;
    }
  }
  return { bedCount, bedFeet, areaSqFt };
}
