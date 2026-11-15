import { addDays, diffDays, startOfWeekMonday } from "@/lib/dates";
import { rangesOverlap, type PlantingDates } from "@/lib/schedule";

export interface GroundSpan {
  start: string;
  end: string;
}

/** Beds a planting actually sits on. Nursery time is not included. */
export function assignedBeds(planting: { bedId: string | null; bedIds?: string[] }): string[] {
  if (planting.bedIds && planting.bedIds.length > 0) return planting.bedIds;
  return planting.bedId ? [planting.bedId] : [];
}

/**
 * The days a planting occupies soil in a calendar year.
 * Perennials (other than tubers and corms, which are lifted) hold the bed from planting until the year ends, and the whole of later years.
 * Annuals hold it from plant-out or direct sowing until the last cut or the lift, whichever is later.
 */
export function groundSpan(planting: PlantingDates, year: number): GroundSpan | null {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const plantYear = Number(planting.fieldDate.slice(0, 4));
  if (plantYear > year) return null;
  const perennial = planting.spansYears && planting.method !== "tuber" && planting.method !== "corm";
  if (perennial) {
    const start = planting.fieldDate > yearStart ? planting.fieldDate : yearStart;
    return { start, end: yearEnd };
  }
  const start = planting.spansYears ? sameDay(planting.fieldDate, year) : planting.fieldDate;
  const bloomEnd = planting.spansYears ? sameDay(planting.bloomEnd, year) : planting.bloomEnd;
  const lift = planting.liftDate ? (planting.spansYears ? sameDay(planting.liftDate, year) : planting.liftDate) : null;
  const end = lift && lift > bloomEnd ? lift : bloomEnd;
  if (end < yearStart || start > yearEnd) return null;
  return { start: start < yearStart ? yearStart : start, end: end > yearEnd ? yearEnd : end };
}

export function spanForPlanting(planting: PlantingDates): GroundSpan {
  const perennial = planting.spansYears && planting.method !== "tuber" && planting.method !== "corm";
  if (perennial) return { start: planting.fieldDate, end: `${planting.firstBloomYear + 20}-12-31` };
  const end = planting.liftDate && planting.liftDate > planting.bloomEnd ? planting.liftDate : planting.bloomEnd;
  return { start: planting.fieldDate, end };
}

export function freeBedIds(plantings: PlantingDates[], bedIds: string[], start: string, end: string, ignoreId?: string): string[] {
  const busy = new Set<string>();
  const year = Number(start.slice(0, 4));
  for (const planting of plantings) {
    if (planting.id === ignoreId) continue;
    const beds = assignedBeds(planting);
    if (beds.length === 0) continue;
    const span = groundSpan(planting, year) ?? overlapYear(spanForPlanting(planting), year);
    if (!span || !rangesOverlap(span.start, span.end, start, end)) continue;
    for (const bedId of beds) busy.add(bedId);
  }
  return bedIds.filter((bedId) => !busy.has(bedId));
}

/** The chosen bed plus the next free neighbours, in order. All of them must be free. */
export function consecutiveBeds(orderedIds: string[], startId: string, count: number, freeIds: string[]): string[] | null {
  const need = Math.max(1, count);
  const free = new Set(freeIds);
  const index = orderedIds.indexOf(startId);
  if (index < 0 || !free.has(startId)) return null;
  const run = orderedIds.slice(index, index + need);
  if (run.length < need || run.some((id) => !free.has(id))) return null;
  return run;
}

export function bedWeekUtilisation(
  bedIds: string[],
  plantings: PlantingDates[],
  year: number,
): { usedWeeks: number; totalWeeks: number; percent: number } {
  const weeks = weeksInYear(year);
  const totalWeeks = bedIds.length * weeks.length;
  if (totalWeeks === 0) return { usedWeeks: 0, totalWeeks: 0, percent: 0 };
  let usedWeeks = 0;
  const spans = plantings.flatMap((planting) => {
    const span = groundSpan(planting, year);
    const beds = assignedBeds(planting);
    return span ? beds.map((bedId) => ({ bedId, span })) : [];
  });
  for (const bedId of bedIds) {
    const mine = spans.filter((item) => item.bedId === bedId);
    for (const week of weeks) {
      const weekEnd = addDays(week, 6);
      if (mine.some((item) => rangesOverlap(item.span.start, item.span.end, week, weekEnd))) usedWeeks += 1;
    }
  }
  return { usedWeeks, totalWeeks, percent: Math.round((usedWeeks / totalWeeks) * 100) };
}

export function bedsEmptyInMonth(bedIds: string[], plantings: PlantingDates[], year: number, month: number): string[] {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = addDays(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`, -1);
  return bedIds.filter((bedId) => {
    return !plantings.some((planting) => {
      if (!assignedBeds(planting).includes(bedId)) return false;
      const span = groundSpan(planting, year);
      return span ? rangesOverlap(span.start, span.end, start, end) : false;
    });
  });
}

export function longestOpenGap(
  bedIds: string[],
  plantings: PlantingDates[],
  year: number,
  from: string,
): { bedId: string; start: string; end: string; days: number } | null {
  const yearEnd = `${year}-12-31`;
  const fromDay = from > `${year}-01-01` ? from : `${year}-01-01`;
  if (fromDay > yearEnd) return null;
  let best: { bedId: string; start: string; end: string; days: number } | null = null;
  for (const bedId of bedIds) {
    const spans = plantings
      .filter((planting) => assignedBeds(planting).includes(bedId))
      .map((planting) => groundSpan(planting, year))
      .filter((span): span is GroundSpan => Boolean(span))
      .sort((a, b) => a.start.localeCompare(b.start));
    let cursor = fromDay;
    for (const span of spans) {
      if (span.end < cursor) continue;
      if (span.start > cursor) {
        const end = addDays(span.start, -1);
        best = longer(best, bedId, cursor, end);
      }
      if (span.end >= cursor) cursor = addDays(span.end, 1);
    }
    if (cursor <= yearEnd) best = longer(best, bedId, cursor, yearEnd);
  }
  return best && best.days >= 28 ? best : null;
}

function longer(
  best: { bedId: string; start: string; end: string; days: number } | null,
  bedId: string,
  start: string,
  end: string,
): { bedId: string; start: string; end: string; days: number } | null {
  if (end < start) return best;
  const days = diffDays(start, end) + 1;
  if (!best || days > best.days) return { bedId, start, end, days };
  return best;
}

function weeksInYear(year: number): string[] {
  const weeks: string[] = [];
  let cursor = startOfWeekMonday(`${year}-01-01`);
  const last = `${year}-12-31`;
  while (cursor <= last) {
    weeks.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

function sameDay(iso: string, year: number): string {
  return `${year}-${iso.slice(5, 10)}`;
}

function overlapYear(span: GroundSpan, year: number): GroundSpan | null {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  if (span.end < yearStart || span.start > yearEnd) return null;
  return { start: span.start < yearStart ? yearStart : span.start, end: span.end > yearEnd ? yearEnd : span.end };
}
