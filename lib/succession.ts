import { freeBedIds } from "@/lib/occupancy";
import { shiftDates, type PlantingDates } from "@/lib/schedule";

export function successionEligible(lifeCycle: string): boolean {
  return lifeCycle === "annual";
}

/** Cut-and-come-again flowers keep blooming if you cut them, so a second sowing is optional. */
export function cutAndComeAgain(flower: { deadhead: boolean; successionWeeks: number | null }): boolean {
  return flower.deadhead && flower.successionWeeks == null;
}

export function successionDefaults(flower: { successionWeeks: number | null; defaultSuccessions: number }): {
  count: number;
  intervalDays: number;
} {
  const weeks = flower.successionWeeks ?? 3;
  const count = flower.successionWeeks ? Math.max(1, Math.min(6, flower.defaultSuccessions)) : 1;
  return { count, intervalDays: weeks * 7 };
}

type Window = {
  nurseryStart: string | null;
  fieldDate: string;
  bloomStart: string;
  bloomEnd: string;
  liftDate: string | null;
  firstBloomYear: number;
};

/** Index 0 is the first sowing. Later ones move every date by the interval. */
export function successionWindows<T extends Window>(base: T, count: number, intervalDays: number): T[] {
  const total = Math.max(1, Math.min(8, Math.round(count)));
  const step = Math.max(1, Math.round(intervalDays));
  return Array.from({ length: total }, (_, index) => (index === 0 ? base : shiftDates(base, index * step)));
}

function spellEnd(planting: PlantingDates): string {
  return planting.liftDate && planting.liftDate > planting.bloomEnd ? planting.liftDate : planting.bloomEnd;
}

/**
 * The first sowing takes the bed you dropped on.
 * The next sowing uses that same bed when it is free again, otherwise the nearest free bed in the block.
 */
export function placeSuccessionSeries(input: {
  series: PlantingDates[];
  startBedId: string;
  blockBedIds: string[];
  plantings: PlantingDates[];
}): { placed: { id: string; bedId: string }[]; left: string[] } {
  const working = input.plantings.map((item) => ({ ...item }));
  const ordered = [...input.series].sort((a, b) => (a.successionIndex ?? 0) - (b.successionIndex ?? 0));
  const placed: { id: string; bedId: string }[] = [];
  const left: string[] = [];
  const startIndex = Math.max(0, input.blockBedIds.indexOf(input.startBedId));

  function fits(bedId: string, member: PlantingDates): boolean {
    return freeBedIds(working, [bedId], member.fieldDate, spellEnd(member), member.id).includes(bedId);
  }

  function take(member: PlantingDates, bedId: string) {
    const next = { ...member, bedId, bedIds: [bedId] };
    const index = working.findIndex((item) => item.id === member.id);
    if (index >= 0) working[index] = next;
    else working.push(next);
    placed.push({ id: member.id, bedId });
  }

  for (let index = 0; index < ordered.length; index += 1) {
    const member = ordered[index];
    if (index === 0) {
      if (!fits(input.startBedId, member)) return { placed: [], left: ordered.map((item) => item.id) };
      take(member, input.startBedId);
      continue;
    }
    if (fits(input.startBedId, member)) {
      take(member, input.startBedId);
      continue;
    }
    const nearest = input.blockBedIds
      .map((bedId, bedIndex) => ({ bedId, distance: Math.abs(bedIndex - startIndex) }))
      .filter((item) => item.distance > 0)
      .sort((a, b) => a.distance - b.distance);
    const found = nearest.find((item) => fits(item.bedId, member));
    if (found) take(member, found.bedId);
    else left.push(member.id);
  }
  return { placed, left };
}
