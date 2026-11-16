import { addDays, addYears, diffDays, monthDayToIso, parseISODate } from "@/lib/dates";
import type { Flower } from "@/lib/flower";
import { recommend, type Fit } from "@/lib/recommend";
import type { SitePlan } from "@/lib/tasks";
import { rhsRank } from "@/lib/hardiness";

export type PlantingMethod = "indoor" | "direct" | "tuber" | "bulb" | "corm" | "crown" | "division";

export interface FlowerWindow {
  method: PlantingMethod;
  nurseryStart: string | null;
  fieldDate: string;
  bloomStart: string;
  bloomEnd: string;
  liftDate: string | null;
  firstBloomYear: number;
  spansYears: boolean;
  variety: string;
}

export interface PlantingDates {
  id: string;
  flowerSlug: string;
  flowerName: string;
  colour: string;
  variety: string;
  method: PlantingMethod;
  nurseryStart: string | null;
  fieldDate: string;
  bloomStart: string;
  bloomEnd: string;
  liftDate: string | null;
  firstBloomYear: number;
  spansYears: boolean;
  bedId: string | null;
  bedIds?: string[];
  bedsNeeded?: number;
  daysToMaturity?: number;
  daysInNursery?: number;
  bloomWeeks?: number;
  spacingCm?: number;
  bedLengthM?: number;
  notes?: string;
  successionGroup?: string | null;
  successionIndex?: number | null;
}

export interface SowSuggestion {
  flower: Flower;
  fit: Fit;
  window: FlowerWindow;
  action: string;
  when: string;
  daysFromToday: number;
}

export interface YearBars {
  nursery: { left: number; width: number } | null;
  growing: { left: number; width: number } | null;
  bloom: { left: number; width: number } | null;
  establishing: { left: number; width: number } | null;
  lift: { left: number; width: number } | null;
}

export interface BedSpan {
  plantingId: string;
  bedId: string;
  label: string;
  start: string;
  end: string;
}

const METHODS: PlantingMethod[] = ["indoor", "direct", "tuber", "bulb", "corm", "crown", "division"];

export function isPlantingMethod(value: string): value is PlantingMethod {
  return METHODS.includes(value as PlantingMethod);
}

export function scheduleFlower(flower: Flower, site: SitePlan): FlowerWindow {
  const method = methodFor(flower);
  const last = site.lastSpringFrost;
  const variety = flower.varieties.split(",")[0]?.trim() || "Garden mix";
  const spansYears = flower.lifeCycle === "perennial" || flower.lifeCycle === "shrub" || flower.lifeCycle === "tuber" || flower.lifeCycle === "bulb" || flower.lifeCycle === "corm";
  let nurseryStart: string | null = null;
  let fieldDate = last;

  if (method === "indoor") {
    nurseryStart = addDays(last, -(flower.indoorWeeksBeforeFrost ?? 6) * 7);
    fieldDate = addDays(last, (flower.transplantWeeksAfterFrost ?? 0) * 7);
  } else if (method === "direct") {
    fieldDate = addDays(last, (flower.directSowWeeksAfterFrost ?? 0) * 7);
  } else if (method === "tuber" || method === "corm") {
    fieldDate = addDays(last, (flower.transplantWeeksAfterFrost ?? 2) * 7);
  } else if (method === "bulb" || (method === "crown" && flower.autumnPlantWeeksBeforeFrost != null)) {
    const autumn = addYears(site.firstAutumnFrost, -1);
    fieldDate = addDays(autumn, -(flower.autumnPlantWeeksBeforeFrost ?? 6) * 7);
  } else {
    fieldDate = addDays(last, (flower.transplantWeeksAfterFrost ?? 0) * 7);
  }

  const bloomStart =
    flower.bloomWeeksFromLastFrost != null ? addDays(last, flower.bloomWeeksFromLastFrost * 7) : addDays(fieldDate, Math.max(0, flower.daysFromPlantToBloom));
  const bloomEnd = addDays(bloomStart, Math.max(flower.bloomWeeks, 1) * 7 - 1);
  const liftDate = shouldLift(flower, site) ? addDays(site.firstAutumnFrost, 7) : null;
  const firstBloomYear = site.seasonYear + Math.max(0, (flower.yearsToEstablish || 1) - 1);

  return { method, nurseryStart, fieldDate, bloomStart, bloomEnd, liftDate, firstBloomYear, spansYears, variety };
}

/** Autumn sowing for next spring, dated from the autumn before the flowering season. */
export function autumnSowWindow(flower: Flower, site: SitePlan): FlowerWindow | null {
  if (!flower.autumnSow || flower.autumnSowWeeksBeforeFrost == null) return null;
  const autumn = addYears(site.firstAutumnFrost, -1);
  const nurseryStart = addDays(autumn, -flower.autumnSowWeeksBeforeFrost * 7);
  const fieldDate = addDays(site.lastSpringFrost, (flower.transplantWeeksAfterFrost ?? -2) * 7);
  const bloomStart = addDays(fieldDate, Math.max(0, flower.daysFromPlantToBloom));
  const bloomEnd = addDays(bloomStart, Math.max(flower.bloomWeeks, 1) * 7 - 1);
  const variety = flower.varieties.split(",")[0]?.trim() || "Garden mix";
  return {
    method: "indoor",
    nurseryStart,
    fieldDate,
    bloomStart,
    bloomEnd,
    liftDate: null,
    firstBloomYear: site.seasonYear,
    spansYears: false,
    variety,
  };
}

export function sowNow(flowers: Flower[], site: SitePlan, today: string, limit = 6): SowSuggestion[] {
  const ranked = new Map(recommend(flowers, site).map((item) => [item.flower.slug, item]));
  const suggestions: SowSuggestion[] = [];
  for (const flower of flowers) {
    const fit = ranked.get(flower.slug);
    if (!fit || fit.fit === "risky") continue;
    const candidates: { window: FlowerWindow; action: string; when: string }[] = [];
    const main = scheduleFlower(flower, site);
    if (main.nurseryStart) candidates.push({ window: main, action: "Sow under cover", when: main.nurseryStart });
    if (main.method === "direct") candidates.push({ window: main, action: "Sow direct", when: main.fieldDate });
    if (main.method === "tuber" || main.method === "corm") candidates.push({ window: main, action: "Plant out", when: main.fieldDate });
    if (main.method === "bulb") candidates.push({ window: main, action: "Plant the bulbs", when: main.fieldDate });
    if (main.method === "crown" || main.method === "division") candidates.push({ window: main, action: "Plant the crowns", when: main.fieldDate });
    const autumn = autumnSowWindow(flower, site);
    if (autumn?.nurseryStart) candidates.push({ window: autumn, action: "Sow under cover for next spring", when: autumn.nurseryStart });
    const soon = candidates
      .map((item) => ({ ...item, daysFromToday: diffDays(today, item.when) }))
      .filter((item) => item.daysFromToday >= -21 && item.daysFromToday <= 28)
      .sort((a, b) => Math.abs(a.daysFromToday) - Math.abs(b.daysFromToday));
    const pick = soon[0];
    if (!pick) continue;
    suggestions.push({
      flower,
      fit: fit.fit,
      window: pick.window,
      action: pick.action,
      when: pick.when,
      daysFromToday: pick.daysFromToday,
    });
  }
  return suggestions
    .sort((a, b) => Math.abs(a.daysFromToday) - Math.abs(b.daysFromToday) || b.flower.commonName.localeCompare(a.flower.commonName) * -1)
    .slice(0, limit);
}

export function shiftDates<T extends { nurseryStart: string | null; fieldDate: string; bloomStart: string; bloomEnd: string; liftDate: string | null; firstBloomYear: number }>(
  dates: T,
  days: number,
): T {
  if (days === 0) return dates;
  const bloomYear = Number(dates.bloomStart.slice(0, 4));
  const next = {
    ...dates,
    nurseryStart: dates.nurseryStart ? addDays(dates.nurseryStart, days) : null,
    fieldDate: addDays(dates.fieldDate, days),
    bloomStart: addDays(dates.bloomStart, days),
    bloomEnd: addDays(dates.bloomEnd, days),
    liftDate: dates.liftDate ? addDays(dates.liftDate, days) : null,
  };
  const movedYear = Number(next.bloomStart.slice(0, 4));
  next.firstBloomYear = dates.firstBloomYear + (movedYear - bloomYear);
  return next;
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function bedOccupancy(planting: PlantingDates, year: number): { start: string; end: string } | null {
  if (!planting.bedId) return null;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  if (planting.spansYears && planting.method !== "tuber" && planting.method !== "corm") {
    if (planting.fieldDate.slice(0, 4) > String(year)) return null;
    const start = planting.fieldDate > yearStart ? planting.fieldDate : yearStart;
    return { start, end: yearEnd };
  }
  if (planting.spansYears && (planting.method === "tuber" || planting.method === "corm")) {
    if (Number(planting.fieldDate.slice(0, 4)) > year) return null;
    const start = sameMonthDay(planting.fieldDate, year);
    const end = sameMonthDay(planting.liftDate ?? planting.bloomEnd, year);
    return start <= end ? { start, end } : { start: end, end: start };
  }
  const start = planting.fieldDate;
  const end = planting.liftDate && planting.liftDate > planting.bloomEnd ? planting.liftDate : planting.bloomEnd;
  if (end < yearStart || start > yearEnd) return null;
  return { start, end };
}

export function clashOnBed(plantings: PlantingDates[], bedId: string, start: string, end: string, ignoreId?: string): PlantingDates | null {
  for (const planting of plantings) {
    if (planting.id === ignoreId || planting.bedId !== bedId) continue;
    const year = Number(start.slice(0, 4));
    const span = bedOccupancy({ ...planting, bedId }, year);
    if (span && rangesOverlap(span.start, span.end, start, end)) return planting;
  }
  return null;
}

export function yearBars(planting: PlantingDates, year: number): YearBars {
  const empty = { nursery: null, growing: null, bloom: null, establishing: null, lift: null };
  const plantYear = Number(planting.fieldDate.slice(0, 4));
  if (planting.spansYears && (planting.method === "tuber" || planting.method === "corm")) {
    if (plantYear > year) return empty;
    const field = sameMonthDay(planting.fieldDate, year);
    const bloomStart = sameMonthDay(planting.bloomStart, year);
    const bloomEnd = sameMonthDay(planting.bloomEnd, year);
    const lift = planting.liftDate ? sameMonthDay(planting.liftDate, year) : null;
    return {
      nursery: null,
      growing: clampBar(field, addDays(bloomStart, -1), year),
      bloom: clampBar(bloomStart, bloomEnd, year),
      establishing: null,
      lift: lift ? clampBar(lift, addDays(lift, 6), year) : null,
    };
  }
  if (planting.spansYears) {
    if (plantYear > year) return empty;
    const blooming = year >= planting.firstBloomYear;
    const bloomStart = sameMonthDay(planting.bloomStart, year);
    const bloomEnd = sameMonthDay(planting.bloomEnd, year);
    if (plantYear === year) {
      return {
        nursery: planting.nurseryStart ? clampBar(planting.nurseryStart, addDays(planting.fieldDate, -1), year) : null,
        growing: blooming ? clampBar(planting.fieldDate, addDays(bloomStart, -1), year) : null,
        bloom: blooming ? clampBar(bloomStart, bloomEnd, year) : null,
        establishing: blooming ? null : clampBar(planting.fieldDate, `${year}-12-31`, year),
        lift: null,
      };
    }
    return {
      nursery: null,
      growing: blooming ? clampBar(`${year}-01-01`, addDays(bloomStart, -1), year) : null,
      bloom: blooming ? clampBar(bloomStart, bloomEnd, year) : null,
      establishing: blooming ? null : clampBar(`${year}-01-01`, `${year}-12-31`, year),
      lift: null,
    };
  }
  return {
    nursery: planting.nurseryStart ? clampBar(planting.nurseryStart, addDays(planting.fieldDate, -1), year) : null,
    growing: clampBar(planting.fieldDate, addDays(planting.bloomStart, -1), year),
    bloom: clampBar(planting.bloomStart, planting.bloomEnd, year),
    establishing: null,
    lift: planting.liftDate ? clampBar(planting.liftDate, addDays(planting.liftDate, 6), year) : null,
  };
}

export function visibleInYear(planting: PlantingDates, year: number): boolean {
  const bars = yearBars(planting, year);
  return Boolean(bars.nursery || bars.growing || bars.bloom || bars.establishing || bars.lift);
}

export function clampBar(start: string, end: string, year: number): { left: number; width: number } | null {
  if (!parseISODate(start) || !parseISODate(end)) return null;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const visibleStart = start < yearStart ? yearStart : start;
  const visibleEnd = end > yearEnd ? yearEnd : end;
  if (visibleEnd < visibleStart) return null;
  const days = diffDays(yearStart, yearEnd) + 1;
  const left = (diffDays(yearStart, visibleStart) / days) * 100;
  const width = ((diffDays(visibleStart, visibleEnd) + 1) / days) * 100;
  return { left, width: Math.max(width, 0.35) };
}

export function frostMarker(iso: string, year: number): number | null {
  if (!iso.startsWith(String(year))) return null;
  const days = diffDays(`${year}-01-01`, `${year}-12-31`) + 1;
  return (diffDays(`${year}-01-01`, iso) / days) * 100;
}

export function tasksForPlanting(planting: PlantingDates): {
  taskKey: string;
  flowerSlug: string;
  title: string;
  detail: string;
  dueDate: string;
  category: "sow" | "plant" | "harvest" | "lift";
}[] {
  const name = planting.variety ? `${planting.flowerName} (${planting.variety})` : planting.flowerName;
  const tasks: {
    taskKey: string;
    flowerSlug: string;
    title: string;
    detail: string;
    dueDate: string;
    category: "sow" | "plant" | "harvest" | "lift";
  }[] = [];
  if (planting.nurseryStart) {
    tasks.push({
      taskKey: `planting:${planting.id}:sow`,
      flowerSlug: planting.flowerSlug,
      title: `Sow ${name}`,
      detail: "Under cover. Label the tray — March will not remember.",
      dueDate: planting.nurseryStart,
      category: "sow",
    });
  }
  const plantWord = planting.method === "direct" ? "Sow" : "Plant";
  tasks.push({
    taskKey: `planting:${planting.id}:field`,
    flowerSlug: planting.flowerSlug,
    title: `${plantWord} ${name}`,
    detail: planting.bedId ? "Onto its bed." : "Not on a bed yet — the year plan is where it lands.",
    dueDate: planting.fieldDate,
    category: planting.method === "direct" ? "sow" : "plant",
  });
  const bloomYear = Number(planting.bloomStart.slice(0, 4));
  if (bloomYear >= planting.firstBloomYear) {
    tasks.push({
      taskKey: `planting:${planting.id}:bloom`,
      flowerSlug: planting.flowerSlug,
      title: `First cut of ${name}`,
      detail: "Cut into clean water. The window runs until the last date on the year plan.",
      dueDate: planting.bloomStart,
      category: "harvest",
    });
  }
  if (planting.liftDate) {
    tasks.push({
      taskKey: `planting:${planting.id}:lift`,
      flowerSlug: planting.flowerSlug,
      title: `Lift and store ${name}`,
      detail: "After the tops blacken. Dry, then keep cool, dark, and only just damp.",
      dueDate: planting.liftDate,
      category: "lift",
    });
  }
  return tasks;
}

function methodFor(flower: Flower): PlantingMethod {
  if (flower.lifeCycle === "tuber" || flower.sowMethod === "tuber") return "tuber";
  if (flower.lifeCycle === "bulb" || flower.sowMethod === "bulb") return "bulb";
  if (flower.lifeCycle === "corm" || flower.sowMethod === "corm") return "corm";
  if (flower.sowMethod === "crown") return "crown";
  if (flower.sowMethod === "division" || flower.lifeCycle === "perennial" || flower.lifeCycle === "shrub") {
    return flower.autumnPlantWeeksBeforeFrost != null ? "crown" : "division";
  }
  if (flower.sowMethod === "direct") return "direct";
  if (flower.indoorWeeksBeforeFrost != null) return "indoor";
  return "direct";
}

function shouldLift(flower: Flower, site: SitePlan): boolean {
  if (flower.lifeCycle !== "tuber" && flower.lifeCycle !== "corm") return false;
  if (!flower.liftIfColderThanRhs) return true;
  if (site.frostFree) return false;
  if (!site.rhs) return true;
  return rhsRank(site.rhs) >= rhsRank(flower.liftIfColderThanRhs);
}

function sameMonthDay(iso: string, year: number): string {
  const [, month, day] = iso.split("-").map(Number);
  const date = parseISODate(monthDayToIso(year, month, Math.min(day, 28)));
  if (month === 2 && day > 28) return monthDayToIso(year, 2, 28);
  const candidate = monthDayToIso(year, month, day);
  return parseISODate(candidate) ? candidate : monthDayToIso(year, month, date.getUTCDate());
}
