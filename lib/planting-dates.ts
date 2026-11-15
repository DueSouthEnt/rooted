import { addDays, diffDays } from "@/lib/dates";

export type SowStyle = "indoor" | "direct";

export interface ComposedDates {
  nurseryStart: string | null;
  fieldDate: string;
  bloomStart: string;
  bloomEnd: string;
}

/**
 * Dates follow each other. Under cover: plant-out is sow plus the weeks in the nursery.
 * First bloom is plant-out plus days to maturity. The last cut is the bloom window after that.
 * A hand-edited date is kept; leave it null to let it be calculated.
 */
export function composeFlowerDates(input: {
  style: SowStyle;
  sowDate: string;
  daysInNursery: number;
  daysToMaturity: number;
  bloomWeeks: number;
  fieldDate?: string | null;
  bloomStart?: string | null;
  bloomEnd?: string | null;
}): ComposedDates {
  const nurseryStart = input.style === "indoor" ? input.sowDate : null;
  const fieldDate =
    input.fieldDate ||
    (input.style === "indoor" ? addDays(input.sowDate, Math.max(0, Math.round(input.daysInNursery))) : input.sowDate);
  const bloomStart = input.bloomStart || addDays(fieldDate, Math.max(0, Math.round(input.daysToMaturity)));
  const bloomEnd = input.bloomEnd || addDays(bloomStart, Math.max(1, Math.round(input.bloomWeeks)) * 7 - 1);
  return { nurseryStart, fieldDate, bloomStart, bloomEnd };
}

export function daysBetween(from: string, to: string): number {
  return Math.max(0, diffDays(from, to));
}
