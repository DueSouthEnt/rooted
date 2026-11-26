import { addDaysISO, parseISODate } from "@/lib/veg/dates";
import { rangesOverlap, tasksForPlanting } from "@/lib/veg/planning";
import type { PlantingMethod, TaskDraft } from "@/lib/veg/types";

export type HarvestWindowUnit = "days" | "weeks";

export type ComposeInput = {
  method: PlantingMethod;
  /** Nursery sow date. Ignored for direct sowing. */
  nurserySowDate: string;
  daysInNursery: number;
  /** Direct-sow date, or a manual transplant date when set below. */
  fieldDate: string;
  daysToMaturity: number;
  harvestWindow: number;
  harvestWindowUnit: HarvestWindowUnit;
  /** When set, this replaces the date worked out from nursery days. */
  manualFieldDate: string | null;
  manualFirstHarvest: string | null;
  manualLastHarvest: string | null;
};

export type ComposedDates = {
  nurseryStartDate: string | null;
  fieldPlantingDate: string;
  firstHarvestDate: string;
  lastHarvestDate: string;
  harvestWindowDays: number;
  computedFieldDate: string;
  computedFirstHarvest: string;
  computedLastHarvest: string;
};

export function windowInDays(amount: number, unit: HarvestWindowUnit): number {
  const size = unit === "weeks" ? amount * 7 : amount;
  return Math.max(1, Math.round(size));
}

/** Direct sow uses the field date. Nursery works the transplant date forward from the sow date. */
export function composePlantingDates(input: ComposeInput): ComposedDates {
  const harvestWindowDays = windowInDays(input.harvestWindow, input.harvestWindowUnit);
  const nursery =
    input.method === "transplanted" && parseISODate(input.nurserySowDate) ? input.nurserySowDate : null;
  const computedFieldDate =
    input.method === "transplanted" && nursery
      ? addDaysISO(nursery, Math.max(0, Math.round(input.daysInNursery)))
      : input.fieldDate;
  const fieldPlantingDate = input.manualFieldDate && parseISODate(input.manualFieldDate) ? input.manualFieldDate : computedFieldDate;
  const computedFirstHarvest = addDaysISO(fieldPlantingDate, Math.max(0, Math.round(input.daysToMaturity)));
  const firstHarvestDate =
    input.manualFirstHarvest && parseISODate(input.manualFirstHarvest) ? input.manualFirstHarvest : computedFirstHarvest;
  const computedLastHarvest = addDaysISO(firstHarvestDate, harvestWindowDays - 1);
  const lastHarvestDate =
    input.manualLastHarvest && parseISODate(input.manualLastHarvest) ? input.manualLastHarvest : computedLastHarvest;
  return {
    nurseryStartDate: input.method === "transplanted" ? nursery : null,
    fieldPlantingDate,
    firstHarvestDate,
    lastHarvestDate,
    harvestWindowDays,
    computedFieldDate,
    computedFirstHarvest,
    computedLastHarvest,
  };
}

/** How many plants fit. Spacing is centimetres along the row. */
export function plantCount(bedLengthM: number, bedCount: number, rowsPerBed: number, spacingCm: number): number {
  if (bedLengthM <= 0 || bedCount <= 0 || rowsPerBed <= 0 || spacingCm <= 0) return 0;
  const perRow = Math.floor((bedLengthM * 100) / spacingCm);
  return Math.max(0, perRow) * rowsPerBed * bedCount;
}

/** Plants along one bed. A planting fills the whole bed, so the length is the bed's own length. */
export function plantsPerBed(bedLengthM: number, rowsPerBed: number, spacingCm: number): number {
  return plantCount(bedLengthM, 1, rowsPerBed, spacingCm);
}

/** Phrase for the add-planting form. Assigned beds use their real lengths; otherwise the farm's usual length. */
export function plantCountPhrase(lengthsM: number[], rowsPerBed: number, spacingCm: number, typicalLengthM: number): string {
  const known = lengthsM.filter((length) => length > 0);
  const basis = known.length > 0 ? known : [typicalLengthM];
  const counts = basis.map((length) => plantsPerBed(length, rowsPerBed, spacingCm));
  const low = Math.min(...counts);
  const high = Math.max(...counts);
  const range = low === high ? `${low.toLocaleString("en-GB")}` : `${low.toLocaleString("en-GB")}–${high.toLocaleString("en-GB")}`;
  if (known.length === 0) {
    return `About ${range} plants per bed, using the farm's usual bed length of ${typicalLengthM} m.`;
  }
  return `About ${range} plants per bed.`;
}

export type BedOccupancy = {
  plantingId: string;
  plantingLabel: string;
  bedId: string;
  start: string;
  end: string;
};

export type BedSlot = {
  id: string;
  label: string;
  blockId: string;
  blockName: string;
  position: number;
};

export type BedAvailability = {
  bedId: string;
  status: "free" | "clash";
  clashLabel: string | null;
  clashEnd: string | null;
};

export function availabilityFor(
  beds: BedSlot[],
  occupancy: BedOccupancy[],
  start: string,
  end: string,
  ignorePlantingId?: string,
): BedAvailability[] {
  return beds.map((bed) => {
    const clash = occupancy.find(
      (span) =>
        span.bedId === bed.id &&
        span.plantingId !== ignorePlantingId &&
        rangesOverlap(span.start, span.end, start, end),
    );
    return {
      bedId: bed.id,
      status: clash ? "clash" : "free",
      clashLabel: clash?.plantingLabel ?? null,
      clashEnd: clash?.end ?? null,
    };
  });
}

export type Assignment =
  | { ok: true; bedIds: string[] }
  | { ok: false; message: string };

/**
 * A planting occupies a bed from the field date through the last harvest day.
 * Nursery time does not. N beds are the chosen bed plus the next free neighbours in that block.
 */
export function assignBeds(input: {
  beds: BedSlot[];
  occupancy: BedOccupancy[];
  startBedId: string;
  bedCount: number;
  start: string;
  end: string;
  ignorePlantingId?: string;
}): Assignment {
  const count = Math.max(1, Math.round(input.bedCount));
  const availability = availabilityFor(input.beds, input.occupancy, input.start, input.end, input.ignorePlantingId);
  const byId = new Map(availability.map((item) => [item.bedId, item]));
  const start = input.beds.find((bed) => bed.id === input.startBedId);
  if (!start) return { ok: false, message: "That bed is not on the farm." };
  const clash = byId.get(start.id);
  if (clash?.status === "clash") {
    const suggestion = nextFreeRun(input.beds, availability, count);
    const until = clash.clashEnd ? ` until ${clash.clashEnd}` : "";
    const suggest = suggestion
      ? ` ${suggestion.labels.join(" and ")} ${suggestion.labels.length === 1 ? "is" : "are"} free for the whole spell.`
      : " No bed is free for the whole spell.";
    return {
      ok: false,
      message: `${start.label} already has ${clash.clashLabel}${until}.${suggest}`,
    };
  }
  const neighbours = input.beds
    .filter((bed) => bed.blockId === start.blockId)
    .sort((a, b) => a.position - b.position);
  const index = neighbours.findIndex((bed) => bed.id === start.id);
  const run = neighbours.slice(index, index + count);
  if (run.length < count || run.some((bed) => byId.get(bed.id)?.status === "clash")) {
    const suggestion = nextFreeRun(input.beds, availability, count);
    const suggest = suggestion
      ? ` ${suggestion.labels.join(" and ")} ${suggestion.labels.length === 1 ? "is" : "are"} free together.`
      : "";
    return {
      ok: false,
      message: `This planting needs ${count} beds. ${start.label} is free, but the beds beside it are not.${suggest}`,
    };
  }
  return { ok: true, bedIds: run.map((bed) => bed.id) };
}

function nextFreeRun(
  beds: BedSlot[],
  availability: BedAvailability[],
  count: number,
): { labels: string[] } | null {
  const free = new Set(availability.filter((item) => item.status === "free").map((item) => item.bedId));
  const blocks = new Map<string, BedSlot[]>();
  for (const bed of beds) {
    const list = blocks.get(bed.blockId) ?? [];
    list.push(bed);
    blocks.set(bed.blockId, list);
  }
  for (const list of blocks.values()) {
    const ordered = [...list].sort((a, b) => a.position - b.position);
    for (let index = 0; index <= ordered.length - count; index += 1) {
      const run = ordered.slice(index, index + count);
      if (run.every((bed) => free.has(bed.id))) return { labels: run.map((bed) => bed.label) };
    }
  }
  return null;
}

export function basicPlantingTasks(input: {
  cropName: string;
  cultivar: string;
  method: PlantingMethod;
  nurseryStartDate: string | null;
  daysInNursery: number;
  daysToMaturity?: number;
  fieldPlantingDate: string;
  firstHarvestDate: string;
  lastHarvestDate?: string;
  bedLabels?: string[];
}): TaskDraft[] {
  return tasksForPlanting({
    cropName: input.cropName,
    cultivar: input.cultivar,
    plantingMethod: input.method,
    nurseryStartDate: input.nurseryStartDate,
    daysInNursery: input.daysInNursery,
    daysToMaturity: input.daysToMaturity,
    fieldPlantingDate: input.fieldPlantingDate,
    firstHarvestDate: input.firstHarvestDate,
    lastHarvestDate: input.lastHarvestDate,
    bedLabels: input.bedLabels,
  });
}
