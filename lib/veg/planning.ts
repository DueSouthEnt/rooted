import { ukCropName } from "@/lib/veg/crop-names";
import { addDaysISO, diffDays, parseISODate, startOfWeekMonday } from "@/lib/veg/dates";
import type {
  BedMeasure,
  BedSyncDraft,
  CropTiming,
  DateMode,
  Occupant,
  Overlap,
  PlanRequest,
  PlantingMethod,
  PlantingPhase,
  ProposedPlanting,
  Schedule,
  TaskDraft,
  Unit,
} from "@/lib/veg/types";
import { nearlyEqual, toFeet } from "@/lib/veg/units";

export type ScheduleInput = {
  plantingMethod: PlantingMethod;
  daysToMaturity: number;
  daysInNursery: number;
  harvestWindowDays: number;
  dateMode: DateMode;
  anchorDate: string;
};

/**
 * Harvest window is an inclusive span: a 1-day window is a single pick,
 * and a 7-day window runs from the first harvest through six days later.
 * Direct-seeded plantings ignore nursery days. Transplant nursery dates
 * are counted back from the field planting date.
 */
export function schedulePlanting(input: ScheduleInput): Schedule {
  if (!parseISODate(input.anchorDate)) {
    throw new Error(`Invalid anchor date: ${input.anchorDate}`);
  }
  const nurseryDays =
    input.plantingMethod === "transplanted" ? Math.max(0, input.daysInNursery) : 0;
  let fieldPlantingDate: string;
  let firstHarvestDate: string;
  if (input.dateMode === "field_planting") {
    fieldPlantingDate = input.anchorDate;
    firstHarvestDate = addDaysISO(fieldPlantingDate, input.daysToMaturity);
  } else {
    firstHarvestDate = input.anchorDate;
    fieldPlantingDate = addDaysISO(firstHarvestDate, -input.daysToMaturity);
  }
  const nurseryStartDate =
    nurseryDays > 0 ? addDaysISO(fieldPlantingDate, -nurseryDays) : null;
  const lastHarvestDate = addDaysISO(
    firstHarvestDate,
    Math.max(input.harvestWindowDays, 1) - 1,
  );
  return {
    nurseryStartDate,
    fieldPlantingDate,
    firstHarvestDate,
    lastHarvestDate,
  };
}

export function predictYield(bedFeet: number, yieldPer100BedFeet: number): number {
  return (bedFeet / 100) * yieldPer100BedFeet;
}

export function bedFeetOf(
  beds: { length: number; unit: Unit }[],
): number {
  return beds.reduce((sum, bed) => sum + toFeet(bed.length, bed.unit), 0);
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function plantingPhase(
  planting: {
    nurseryStartDate: string | null;
    fieldPlantingDate: string;
    firstHarvestDate: string;
    lastHarvestDate: string;
  },
  today: string,
): PlantingPhase {
  const visibleStart = planting.nurseryStartDate ?? planting.fieldPlantingDate;
  if (today < visibleStart) return "upcoming";
  if (planting.nurseryStartDate && today < planting.fieldPlantingDate) return "nursery";
  if (today < planting.firstHarvestDate) return "in_ground";
  if (today <= planting.lastHarvestDate) return "harvesting";
  return "finished";
}

export function distributeYield(
  firstHarvest: string,
  lastHarvest: string,
  total: number,
): { weekStart: string; amount: number }[] {
  if (!parseISODate(firstHarvest) || !parseISODate(lastHarvest) || lastHarvest < firstHarvest) {
    return [];
  }
  const days = diffDays(lastHarvest, firstHarvest) + 1;
  const perDay = total / days;
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i += 1) {
    const day = addDaysISO(firstHarvest, i);
    const week = startOfWeekMonday(day);
    buckets.set(week, (buckets.get(week) ?? 0) + perDay);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, amount]) => ({ weekStart, amount }));
}

export type HarvestLine = {
  cropName: string;
  cultivar: string;
  color: string;
  unit: string;
  amount: number;
  plantingId?: string;
  bedLabels?: string;
};

export function weeklyHarvest(
  plantings: {
    id?: string;
    cropName: string;
    cultivar: string;
    color: string;
    yieldUnit: string;
    predictedYield: number;
    firstHarvestDate: string;
    lastHarvestDate: string;
    bedLabels?: string;
  }[],
): Map<string, HarvestLine[]> {
  const weeks = new Map<string, HarvestLine[]>();
  for (const planting of plantings) {
    const shares = distributeYield(
      planting.firstHarvestDate,
      planting.lastHarvestDate,
      planting.predictedYield,
    );
    for (const share of shares) {
      const list = weeks.get(share.weekStart) ?? [];
      list.push({
        cropName: planting.cropName,
        cultivar: planting.cultivar,
        color: planting.color,
        unit: planting.yieldUnit,
        amount: share.amount,
        plantingId: planting.id,
        bedLabels: planting.bedLabels,
      });
      weeks.set(share.weekStart, list);
    }
  }
  return weeks;
}

export function combineHarvestLines(lines: HarvestLine[]): HarvestLine[] {
  const map = new Map<string, HarvestLine>();
  for (const line of lines) {
    const key = `${line.cropName}|${line.cultivar}|${line.unit}`;
    const existing = map.get(key);
    if (existing) existing.amount += line.amount;
    else map.set(key, { ...line, plantingId: undefined, bedLabels: undefined });
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount || a.cropName.localeCompare(b.cropName));
}

export const DEFAULT_TASK_MINUTES: Record<string, number> = {
  nursery_seed: 20,
  direct_seed: 30,
  sow: 25,
  pot_on: 20,
  transplant: 45,
  cultivation: 20,
  weeding: 20,
  prep_bed: 40,
  fertilise: 20,
  harden_off: 15,
  thinning: 20,
  trellising: 30,
  harvest: 40,
  clear_bed: 30,
  other: 15,
};

export function minutesForTaskType(taskType: string): number {
  return DEFAULT_TASK_MINUTES[taskType] ?? 20;
}

export function tasksForPlanting(planting: {
  cropName: string;
  cultivar: string;
  plantingMethod: PlantingMethod;
  nurseryStartDate: string | null;
  daysInNursery?: number;
  daysToMaturity?: number;
  fieldPlantingDate: string;
  firstHarvestDate: string;
  lastHarvestDate?: string;
  bedLabels?: string[];
}): TaskDraft[] {
  const name = `${ukCropName(planting.cropName)} · ${planting.cultivar}`;
  const where = planting.bedLabels?.length ? ` · ${planting.bedLabels.join(", ")}` : "";
  const tasks: TaskDraft[] = [];
  const nurseryDays = planting.daysInNursery ?? 0;
  if (planting.plantingMethod === "transplanted" && planting.nurseryStartDate) {
    tasks.push({
      taskKey: "nursery_seed",
      taskType: "nursery_seed",
      dueDate: planting.nurseryStartDate,
      title: `Sow ${name} in the nursery${where}`,
    });
    if (nurseryDays >= 21) {
      tasks.push({
        taskKey: "pot_on",
        taskType: "cultivation",
        dueDate: addDaysISO(planting.nurseryStartDate, Math.round(nurseryDays / 2)),
        title: `Pot on ${name}`,
      });
    }
    tasks.push({
      taskKey: "harden_off",
      taskType: "other",
      dueDate: addDaysISO(planting.fieldPlantingDate, -7),
      title: `Harden off ${name}`,
    });
  }
  tasks.push({
    taskKey: "bed_prep",
    taskType: "cultivation",
    dueDate: addDaysISO(planting.fieldPlantingDate, -7),
    title: `Prepare the bed for ${name}${where}`,
  });
  if (planting.plantingMethod === "direct_seeded") {
    tasks.push({
      taskKey: "direct_seed",
      taskType: "direct_seed",
      dueDate: planting.fieldPlantingDate,
      title: `Direct sow ${name}${where}`,
    });
  } else {
    tasks.push({
      taskKey: "transplant",
      taskType: "transplant",
      dueDate: planting.fieldPlantingDate,
      title: `Transplant ${name}${where}`,
    });
  }
  tasks.push({
    taskKey: "cultivate_14",
    taskType: "cultivation",
    dueDate: addDaysISO(planting.fieldPlantingDate, 14),
    title: `Weed ${name}${where}`,
  });
  if ((planting.daysToMaturity ?? 60) >= 40) {
    tasks.push({
      taskKey: "cultivate_28",
      taskType: "cultivation",
      dueDate: addDaysISO(planting.fieldPlantingDate, 28),
      title: `Weed ${name} again${where}`,
    });
  }
  tasks.push({
    taskKey: "harvest_start",
    taskType: "harvest",
    dueDate: planting.firstHarvestDate,
    title: `First harvest · ${name}${where}`,
  });
  if (planting.lastHarvestDate) {
    tasks.push({
      taskKey: "harvest_end",
      taskType: "harvest",
      dueDate: planting.lastHarvestDate,
      title: `Clear the bed · ${name}${where}`,
    });
  }
  return tasks;
}

export type StoredAutoTask = {
  id: string;
  taskKey: string | null;
  status: string;
  manuallyEdited: boolean;
  dueDate: string;
  title?: string;
};

/** Open, unedited auto tasks follow the planting. Done or hand-edited ones stay put. */
export function reconcileAutoTasks(existing: StoredAutoTask[], drafts: TaskDraft[]) {
  const draftByKey = new Map(drafts.map((draft) => [draft.taskKey, draft]));
  const deleteIds: string[] = [];
  const update: { id: string; draft: TaskDraft }[] = [];
  const seen = new Set<string>();
  for (const task of existing) {
    if (!task.taskKey) continue;
    const draft = draftByKey.get(task.taskKey);
    if (task.status === "done" || task.manuallyEdited) {
      seen.add(task.taskKey);
      continue;
    }
    if (!draft) {
      deleteIds.push(task.id);
      continue;
    }
    seen.add(task.taskKey);
    const titleMoved = task.title !== undefined && task.title !== draft.title;
    if (task.dueDate !== draft.dueDate || titleMoved) update.push({ id: task.id, draft });
  }
  const insert = drafts.filter((draft) => !seen.has(draft.taskKey));
  return { deleteIds, update, insert };
}

export function findOverlaps(occupants: Occupant[]): Overlap[] {
  const byBed = new Map<string, Occupant[]>();
  for (const occupant of occupants) {
    const list = byBed.get(occupant.bedId) ?? [];
    list.push(occupant);
    byBed.set(occupant.bedId, list);
  }
  const overlaps: Overlap[] = [];
  for (const list of byBed.values()) {
    const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        if (sorted[j].start > sorted[i].end) break;
        if (
          rangesOverlap(sorted[i].start, sorted[i].end, sorted[j].start, sorted[j].end)
        ) {
          overlaps.push({
            bedId: sorted[i].bedId,
            bedLabel: sorted[i].bedLabel,
            leftKey: sorted[i].key,
            rightKey: sorted[j].key,
            leftLabel: sorted[i].label,
            rightLabel: sorted[j].label,
            leftStart: sorted[i].start,
            leftEnd: sorted[i].end,
            rightStart: sorted[j].start,
            rightEnd: sorted[j].end,
          });
        }
      }
    }
  }
  return overlaps;
}

export function occupantsFor(
  plantings: {
    key: string;
    label: string;
    bedIds: string[];
    bedLabels: string[];
    start: string;
    end: string;
  }[],
): Occupant[] {
  const occupants: Occupant[] = [];
  for (const planting of plantings) {
    planting.bedIds.forEach((bedId, index) => {
      occupants.push({
        key: planting.key,
        label: planting.label,
        bedId,
        bedLabel: planting.bedLabels[index] ?? bedId,
        start: planting.start,
        end: planting.end,
      });
    });
  }
  return occupants;
}

function cropLabel(crop: CropTiming): string {
  return `${crop.name} · ${crop.cultivar}`;
}

function assignBeds(
  bedIds: string[],
  index: number,
  count: number,
  request: PlanRequest,
): string[] {
  if (bedIds.length === 0) return [];
  if (count === 1 || request.placement === "same_beds") return [...bedIds];
  const size = Math.max(1, Math.min(request.bedsPerPlanting, bedIds.length));
  const start = (index * size) % bedIds.length;
  const chosen: string[] = [];
  for (let offset = 0; offset < size; offset += 1) {
    chosen.push(bedIds[(start + offset) % bedIds.length]);
  }
  return [...new Set(chosen)];
}

export type PlanResult =
  | { ok: true; plantings: ProposedPlanting[]; overlaps: Overlap[] }
  | { ok: false; error: string };

export function buildPlan(
  request: PlanRequest,
  crops: CropTiming[],
  beds: BedMeasure[],
  existing: Occupant[] = [],
): PlanResult {
  const crop = crops.find((item) => item.id === request.cropId);
  if (!crop) return { ok: false, error: "Choose a crop." };
  if (!parseISODate(request.anchorDate)) return { ok: false, error: "Choose a real date." };
  if (request.successionCount < 1 || request.successionCount > 24) {
    return { ok: false, error: "Plan between 1 and 24 plantings." };
  }
  if (request.successionCount > 1 && request.successionIntervalDays < 1) {
    return { ok: false, error: "Succession interval needs at least 1 day." };
  }

  const selected = request.bedIds.map((id) => beds.find((bed) => bed.id === id));
  if (selected.some((bed) => !bed)) return { ok: false, error: "One of the selected beds no longer exists." };
  const chosenBeds = selected.filter((bed): bed is BedMeasure => Boolean(bed));
  const blockIds = new Set(chosenBeds.map((bed) => bed.blockId));
  if (blockIds.size > 1) {
    return { ok: false, error: "Assign beds from a single block." };
  }

  const followUp = request.followUpCropId
    ? crops.find((item) => item.id === request.followUpCropId)
    : null;
  if (request.followUpCropId && !followUp) {
    return { ok: false, error: "Choose a follow-up crop." };
  }

  const count = request.successionCount;
  const proposed: ProposedPlanting[] = [];

  for (let index = 0; index < count; index += 1) {
    const anchorDate = addDaysISO(
      request.anchorDate,
      index * (count > 1 ? request.successionIntervalDays : 0),
    );
    const schedule = schedulePlanting({
      plantingMethod: request.plantingMethod,
      daysToMaturity: crop.daysToMaturity,
      daysInNursery: crop.daysInNursery,
      harvestWindowDays: crop.harvestWindowDays,
      dateMode: request.dateMode,
      anchorDate,
    });
    const bedIds = assignBeds(
      chosenBeds.map((bed) => bed.id),
      index,
      count,
      request,
    );
    const assigned = bedIds.map((id) => beds.find((bed) => bed.id === id)!);
    const measured = feetFor(assigned, request);
    if (!measured.ok) return measured;
    proposed.push({
      key: `new-${index}`,
      cropId: crop.id,
      cropName: crop.name,
      cultivar: crop.cultivar,
      color: crop.color,
      plantingMethod: request.plantingMethod,
      dateMode: request.dateMode,
      anchorDate,
      schedule,
      bedIds,
      bedLabels: assigned.map((bed) => bed.label),
      bedFeet: measured.bedFeet,
      predictedYield: predictYield(measured.bedFeet, crop.yieldPer100BedFeet),
      yieldUnit: crop.yieldUnit,
      successionIndex: count > 1 ? index + 1 : null,
      successionCount: count > 1 ? count : null,
      isFollowUp: false,
      parentKey: null,
      notes: request.notes.trim(),
    });
  }

  if (followUp) {
    const primaries = [...proposed];
    for (let index = 0; index < primaries.length; index += 1) {
      const parent = primaries[index];
      const fieldPlantingDate = addDaysISO(
        parent.schedule.lastHarvestDate,
        request.followUpGapDays,
      );
      const schedule = schedulePlanting({
        plantingMethod: followUp.plantingMethod,
        daysToMaturity: followUp.daysToMaturity,
        daysInNursery: followUp.daysInNursery,
        harvestWindowDays: followUp.harvestWindowDays,
        dateMode: "field_planting",
        anchorDate: fieldPlantingDate,
      });
      const assigned = parent.bedIds.map((id) => beds.find((bed) => bed.id === id)!);
      const measured = feetFor(assigned, request);
      if (!measured.ok) return measured;
      proposed.push({
        key: `follow-${index}`,
        cropId: followUp.id,
        cropName: followUp.name,
        cultivar: followUp.cultivar,
        color: followUp.color,
        plantingMethod: followUp.plantingMethod,
        dateMode: "field_planting",
        anchorDate: fieldPlantingDate,
        schedule,
        bedIds: parent.bedIds,
        bedLabels: parent.bedLabels,
        bedFeet: measured.bedFeet,
        predictedYield: predictYield(measured.bedFeet, followUp.yieldPer100BedFeet),
        yieldUnit: followUp.yieldUnit,
        successionIndex: null,
        successionCount: null,
        isFollowUp: true,
        parentKey: parent.key,
        notes: request.notes.trim()
          ? `${request.notes.trim()} Follows ${cropLabel(crop)} after harvest.`
          : `Follows ${cropLabel(crop)} after harvest.`,
      });
    }
  }

  const proposedOccupants = occupantsFor(
    proposed.map((planting) => ({
      key: planting.key,
      label: `${planting.cropName} · ${planting.cultivar}`,
      bedIds: planting.bedIds,
      bedLabels: planting.bedLabels,
      start: planting.schedule.fieldPlantingDate,
      end: planting.schedule.lastHarvestDate,
    })),
  );
  const overlaps = findOverlaps([...existing, ...proposedOccupants]);
  return { ok: true, plantings: proposed, overlaps };
}

function feetFor(
  assigned: BedMeasure[],
  request: PlanRequest,
): { ok: true; bedFeet: number } | { ok: false; error: string } {
  if (assigned.length > 0) {
    return { ok: true, bedFeet: bedFeetOf(assigned) };
  }
  if (request.unassignedBedCount < 1 || request.unassignedBedLength <= 0) {
    return {
      ok: false,
      error: "Choose beds, or enter a bed count and length for an unassigned planting.",
    };
  }
  return {
    ok: true,
    bedFeet: toFeet(
      request.unassignedBedCount * request.unassignedBedLength,
      request.unassignedUnit,
    ),
  };
}

export function blockCode(name: string, taken: string[]): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0] ?? "")
    .join("");
  let base = initials.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (!base) base = "B";
  const used = new Set(taken);
  let code = base;
  let suffix = 2;
  while (used.has(code)) {
    code = `${base}${suffix}`;
    suffix += 1;
  }
  return code;
}

export function planBedChanges(input: {
  existing: BedSyncDraft[];
  bedCount: number;
  bedLength: number;
  bedWidth: number;
  previousLength: number;
  previousWidth: number;
  makeId: () => string;
  makeLabel: (position: number) => string;
}): { beds: BedSyncDraft[]; deleteIds: string[] } {
  const sorted = [...input.existing].sort((a, b) => a.position - b.position);
  const beds: BedSyncDraft[] = [];
  for (let position = 0; position < input.bedCount; position += 1) {
    const current = sorted[position];
    if (!current) {
      beds.push({
        id: input.makeId(),
        label: input.makeLabel(position),
        position,
        length: input.bedLength,
        width: input.bedWidth,
      });
      continue;
    }
    beds.push({
      ...current,
      position,
      length: nearlyEqual(current.length, input.previousLength)
        ? input.bedLength
        : current.length,
      width: nearlyEqual(current.width, input.previousWidth)
        ? input.bedWidth
        : current.width,
    });
  }
  return {
    beds,
    deleteIds: sorted.slice(input.bedCount).map((bed) => bed.id),
  };
}

export function textOn(hex: string): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return "#2c211c";
  const red = Number.parseInt(raw.slice(0, 2), 16);
  const green = Number.parseInt(raw.slice(2, 4), 16);
  const blue = Number.parseInt(raw.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.64 ? "#2c211c" : "#fff8f1";
}
