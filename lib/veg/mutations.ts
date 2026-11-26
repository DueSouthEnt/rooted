import { and, eq, inArray, isNull, getDb } from "@/lib/veg/memory";
import { beds, blocks, companions, crops, customTaskTypes, farmAreas, farmSettings, plantingBeds, plantings, tasks, vegetables } from "@/lib/veg/tables";
import { ROTATION_FAMILIES, rotationFamilyFor, type RotationFamily } from "@/lib/veg/advice";
import {
  blockOutsideOutline,
  convexRingsOverlap,
  fromMetres,
  layoutBeds,
  rectangleRing,
  ringAreaM2,
  spanWidthForCount,
  type LatLng,
} from "@/lib/veg/bed-layout";
import { addDaysISO, parseISODate } from "@/lib/veg/dates";
import { TASK_TYPE_CHOICES } from "@/lib/veg/labels";
import { repeatDates, slugTaskType } from "@/lib/veg/repeat";
import { gardenerBedName } from "@/lib/veg/bed-name";
import { assignBeds, basicPlantingTasks, composePlantingDates, type BedOccupancy, type BedSlot, type HarvestWindowUnit } from "@/lib/veg/planting-form";
import { toFeet } from "@/lib/veg/units";
import {
  blockCode,
  buildPlan,
  planBedChanges,
  tasksForPlanting,
} from "@/lib/veg/planning";
import type { CropTiming, Occupant, Overlap, PlanRequest, Unit } from "@/lib/veg/types";
import {
  bedSchema,
  blockSchema,
  cropSchema,
  editPlantingSchema,
  firstIssue,
  manualTaskSchema,
  planSchema,
} from "@/lib/veg/validators";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; overlaps?: Overlap[] };

function stamp(): string {
  return new Date().toISOString();
}

function cropTiming(row: {
  id: string;
  name: string;
  cultivar: string;
  category: string;
  plantingMethod: CropTiming["plantingMethod"];
  daysToMaturity: number;
  daysInNursery: number;
  harvestWindowDays: number;
  rowsPerBed: number;
  inRowSpacingIn: number;
  yieldPer100BedFeet: number;
  yieldUnit: string;
  color: string;
  notes: string;
}): CropTiming {
  return {
    id: row.id,
    name: row.name,
    cultivar: row.cultivar,
    category: row.category,
    plantingMethod: row.plantingMethod as CropTiming["plantingMethod"],
    daysToMaturity: row.daysToMaturity,
    daysInNursery: row.daysInNursery,
    harvestWindowDays: row.harvestWindowDays,
    rowsPerBed: row.rowsPerBed,
    inRowSpacingIn: row.inRowSpacingIn,
    yieldPer100BedFeet: row.yieldPer100BedFeet,
    yieldUnit: row.yieldUnit,
    color: row.color,
    notes: row.notes,
  };
}

function loadCrops(): CropTiming[] {
  return getDb().select().from(crops).all().map(cropTiming);
}

function loadBeds() {
  const db = getDb();
  const bedRows = db.select().from(beds).all();
  const blockRows = db.select().from(blocks).all();
  const blockById = new Map(blockRows.map((block) => [block.id, block]));
  return bedRows.flatMap((bed) => {
    const block = blockById.get(bed.blockId);
    if (!block) return [];
    return [
      {
        id: bed.id,
        label: bed.label,
        blockId: block.id,
        blockName: block.name,
        length: bed.length,
        width: bed.width,
        unit: block.unit as Unit,
      },
    ];
  });
}

function existingOccupants(ignoreIds: string[] = []): Occupant[] {
  const db = getDb();
  const ignored = new Set(ignoreIds);
  const rows = db
    .select({ planting: plantings, crop: crops })
    .from(plantings)
    .innerJoin(crops, eq(plantings.cropId, crops.id))
    .all();
  const links = db
    .select({ link: plantingBeds, bed: beds })
    .from(plantingBeds)
    .innerJoin(beds, eq(plantingBeds.bedId, beds.id))
    .all();
  const byPlanting = new Map<string, { id: string; label: string }[]>();
  for (const link of links) {
    const list = byPlanting.get(link.link.plantingId) ?? [];
    list.push({ id: link.bed.id, label: link.bed.label });
    byPlanting.set(link.link.plantingId, list);
  }
  const occupants: Occupant[] = [];
  for (const row of rows) {
    if (ignored.has(row.planting.id)) continue;
    for (const bed of byPlanting.get(row.planting.id) ?? []) {
      occupants.push({
        key: row.planting.id,
        label: `${row.crop.name} · ${row.crop.cultivar}`,
        bedId: bed.id,
        bedLabel: bed.label,
        start: row.planting.fieldPlantingDate,
        end: row.planting.lastHarvestDate,
      });
    }
  }
  return occupants;
}

function writeTasks(
  tx: Pick<ReturnType<typeof getDb>, "insert" | "delete" | "update" | "select">,
  plantingId: string,
  drafts: ReturnType<typeof tasksForPlanting>,
  now: string,
) {
  const current = tx.select().from(tasks).where(eq(tasks.plantingId, plantingId)).all();
  const autos = current.filter((task) => task.taskKey);
  const nextKeys = new Set(drafts.map((draft) => draft.taskKey));
  for (const task of autos) {
    if (task.taskKey && !nextKeys.has(task.taskKey) && task.status === "open" && task.manuallyEdited !== 1) {
      tx.delete(tasks).where(eq(tasks.id, task.id)).run();
    }
  }
  for (const draft of drafts) {
    const found = autos.find((task) => task.taskKey === draft.taskKey);
    if (!found) {
      tx.insert(tasks)
        .values({
          id: crypto.randomUUID(),
          plantingId,
          taskKey: draft.taskKey,
          title: draft.title,
          taskType: draft.taskType,
          dueDate: draft.dueDate,
          status: "open",
          notes: "",
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    } else if (found.status === "open" && found.manuallyEdited !== 1) {
      tx.update(tasks)
        .set({
          title: draft.title,
          taskType: draft.taskType,
          dueDate: draft.dueDate,
          updatedAt: now,
        })
        .where(eq(tasks.id, found.id))
        .run();
    }
  }
}

function takenCodes(): string[] {
  const labels = getDb().select({ label: beds.label }).from(beds).all();
  return [...new Set(labels.map((row) => row.label.split("-")[0]).filter(Boolean))];
}

export function saveBlock(input: unknown): ActionResult<{ id: string }> {
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const data = parsed.data;
  const db = getDb();
  const now = stamp();

  if (!data.id) {
    const id = crypto.randomUUID();
    const code = blockCode(data.name, takenCodes());
    const sortRow = db.select({ sortOrder: blocks.sortOrder }).from(blocks).all();
    const sortOrder = sortRow.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
    db.transaction((tx) => {
      tx.insert(blocks)
        .values({
          id,
          name: data.name,
          type: data.type,
          bedLength: data.bedLength,
          bedWidth: data.bedWidth,
          pathWidth: data.pathWidth,
          unit: data.unit,
          notes: data.notes.trim(),
          sortOrder,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      for (let position = 0; position < data.bedCount; position += 1) {
        tx.insert(beds)
          .values({
            id: crypto.randomUUID(),
            blockId: id,
            label: `${code}-${position + 1}`,
            position,
            length: data.bedLength,
            width: data.bedWidth,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
    });
    return { ok: true, data: { id } };
  }

  const current = db.select().from(blocks).where(eq(blocks.id, data.id)).get();
  if (!current) return { ok: false, error: "That block is no longer on the map." };
  const currentBeds = db.select().from(beds).where(eq(beds.blockId, data.id)).all();
  const prefix = currentBeds[0]?.label.split("-")[0] || blockCode(data.name, []);
  const plan = planBedChanges({
    existing: currentBeds.map((bed) => ({
      id: bed.id,
      label: bed.label,
      position: bed.position,
      length: bed.length,
      width: bed.width,
    })),
    bedCount: data.bedCount,
    bedLength: data.bedLength,
    bedWidth: data.bedWidth,
    previousLength: current.bedLength,
    previousWidth: current.bedWidth,
    makeId: () => crypto.randomUUID(),
    makeLabel: (position) => `${prefix}-${position + 1}`,
  });
  if (plan.deleteIds.length) {
    const blocked = db
      .select({ bedId: plantingBeds.bedId })
      .from(plantingBeds)
      .where(inArray(plantingBeds.bedId, plan.deleteIds))
      .all();
    if (blocked.length) {
      const blockedIds = new Set(blocked.map((row) => row.bedId));
      const names = currentBeds.filter((bed) => blockedIds.has(bed.id)).map((bed) => bed.label);
      return {
        ok: false,
        error: `${names.join(", ")} still has plantings. Move them before shortening the block.`,
      };
    }
  }

  db.transaction((tx) => {
    tx.update(blocks)
      .set({
        name: data.name,
        type: data.type,
        bedLength: data.bedLength,
        bedWidth: data.bedWidth,
        pathWidth: data.pathWidth,
        unit: data.unit,
        notes: data.notes.trim(),
        updatedAt: now,
      })
      .where(eq(blocks.id, data.id!))
      .run();
    if (plan.deleteIds.length) {
      tx.delete(beds).where(inArray(beds.id, plan.deleteIds)).run();
    }
    for (const bed of plan.beds) {
      const exists = currentBeds.some((item) => item.id === bed.id);
      if (exists) {
        tx.update(beds)
          .set({
            label: bed.label,
            position: bed.position,
            length: bed.length,
            width: bed.width,
            updatedAt: now,
          })
          .where(eq(beds.id, bed.id))
          .run();
      } else {
        tx.insert(beds)
          .values({
            id: bed.id,
            blockId: data.id!,
            label: bed.label,
            position: bed.position,
            length: bed.length,
            width: bed.width,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
    }
  });
  return { ok: true, data: { id: data.id } };
}

export function deleteBlock(id: string): ActionResult {
  const db = getDb();
  const block = db.select().from(blocks).where(eq(blocks.id, id)).get();
  if (!block) return { ok: false, error: "That block is already gone." };
  const bedIds = db.select().from(beds).where(eq(beds.blockId, id)).all().map((bed) => bed.id);
  if (bedIds.length) {
    const planted = db.select().from(plantingBeds).where(inArray(plantingBeds.bedId, bedIds)).all();
    if (planted.length) {
      return { ok: false, error: "This block still has plantings. Move them before deleting it." };
    }
  }
  db.delete(blocks).where(eq(blocks.id, id)).run();
  return { ok: true, data: null };
}

export function deleteFarmArea(id: string): ActionResult {
  const db = getDb();
  const area = db.select().from(farmAreas).where(eq(farmAreas.id, id)).get();
  if (!area) return { ok: false, error: "That farm area is already gone." };
  const used = db.select().from(blocks).where(eq(blocks.farmAreaId, id)).all();
  if (used.length) return { ok: false, error: "Move or delete the blocks in this area first." };
  db.delete(farmAreas).where(eq(farmAreas.id, id)).run();
  return { ok: true, data: null };
}

export function addBed(blockId: string): ActionResult<{ id: string }> {
  const db = getDb();
  const block = db.select().from(blocks).where(eq(blocks.id, blockId)).get();
  if (!block) return { ok: false, error: "Choose a block first." };
  const current = db.select().from(beds).where(eq(beds.blockId, blockId)).all();
  const prefix = current[0]?.label.split("-")[0] || blockCode(block.name, takenCodes());
  const position = current.reduce((max, bed) => Math.max(max, bed.position), -1) + 1;
  let label = `${prefix}-${position + 1}`;
  const used = new Set(current.map((bed) => bed.label));
  let n = position + 1;
  while (used.has(label)) {
    n += 1;
    label = `${prefix}-${n}`;
  }
  const id = crypto.randomUUID();
  const now = stamp();
  db.transaction((tx) => {
    tx.insert(beds)
      .values({
        id,
        blockId,
        label,
        position,
        length: block.bedLength,
        width: block.bedWidth,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    tx.update(blocks).set({ updatedAt: now }).where(eq(blocks.id, blockId)).run();
  });
  return { ok: true, data: { id } };
}

export function saveBed(input: unknown): ActionResult {
  const parsed = bedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const data = parsed.data;
  const db = getDb();
  const bed = db.select().from(beds).where(eq(beds.id, data.id)).get();
  if (!bed) return { ok: false, error: "That bed is no longer on the map." };
  const duplicate = db
    .select()
    .from(beds)
    .where(and(eq(beds.blockId, bed.blockId), eq(beds.label, data.label)))
    .all()
    .find((row) => row.id !== data.id);
  if (duplicate) return { ok: false, error: `${data.label} is already used in this block.` };
  db.update(beds)
    .set({
      label: data.label,
      length: data.length,
      width: data.width,
      updatedAt: stamp(),
    })
    .where(eq(beds.id, data.id))
    .run();
  return { ok: true, data: null };
}

export function deleteBed(id: string): ActionResult {
  const db = getDb();
  const bed = db.select().from(beds).where(eq(beds.id, id)).get();
  if (!bed) return { ok: false, error: "That bed is already gone." };
  const used = db.select().from(plantingBeds).where(eq(plantingBeds.bedId, id)).get();
  if (used) {
    return { ok: false, error: `${bed.label} still has plantings. Reassign them before deleting the bed.` };
  }
  db.delete(beds).where(eq(beds.id, id)).run();
  return { ok: true, data: null };
}

export function saveCrop(input: unknown): ActionResult<{ id: string }> {
  const parsed = cropSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const data = parsed.data;
  const db = getDb();
  const now = stamp();
  const values = {
    name: data.name,
    cultivar: data.cultivar,
    category: data.category,
    plantingMethod: data.plantingMethod,
    daysToMaturity: data.daysToMaturity,
    daysInNursery: data.plantingMethod === "transplanted" ? data.daysInNursery : 0,
    harvestWindowDays: data.harvestWindowDays,
    rowsPerBed: data.rowsPerBed,
    inRowSpacingIn: data.inRowSpacingIn,
    yieldPer100BedFeet: data.yieldPer100BedFeet,
    yieldUnit: data.yieldUnit,
    color: data.color,
    notes: data.notes.trim(),
    family: data.family?.trim() || null,
    frostTolerance: data.frostTolerance || null,
    supplier: data.supplier?.trim() || null,
    updatedAt: now,
  };
  if (!data.id) {
    const id = crypto.randomUUID();
    db.insert(crops).values({ ...values, id, userCreated: 1, createdAt: now }).run();
    return { ok: true, data: { id } };
  }
  const current = db.select().from(crops).where(eq(crops.id, data.id)).get();
  if (!current) return { ok: false, error: "That crop is no longer in the library." };
  db.update(crops).set(values).where(eq(crops.id, data.id)).run();
  return { ok: true, data: { id: data.id } };
}

export function deleteCrop(id: string): ActionResult {
  const db = getDb();
  const used = db.select().from(plantings).where(eq(plantings.cropId, id)).get();
  if (used) {
    return {
      ok: false,
      error: "This crop is on the game plan. Delete those plantings before removing it from the library.",
    };
  }
  const crop = db.select().from(crops).where(eq(crops.id, id)).get();
  if (!crop) return { ok: false, error: "That crop is already gone." };
  if (crop.userCreated !== 1) return { ok: false, error: "Catalogue varieties stay in the library. You can delete a variety you added." };
  db.delete(crops).where(eq(crops.id, id)).run();
  return { ok: true, data: null };
}

function persistPlantings(
  proposed: ReturnType<typeof buildPlan> & { ok: true },
  seasonYear: number,
  acknowledge: boolean,
): ActionResult<{ count: number }> {
  if (proposed.overlaps.length && !acknowledge) {
    return {
      ok: false,
      error: "These beds overlap an existing planting. Acknowledge the conflict to save anyway.",
      overlaps: proposed.overlaps,
    };
  }
  const db = getDb();
  const now = stamp();
  const ids = new Map(proposed.plantings.map((planting) => [planting.key, crypto.randomUUID()]));
  const groupId = proposed.plantings.some((planting) => planting.successionCount)
    ? crypto.randomUUID()
    : null;
  db.transaction((tx) => {
    for (const planting of proposed.plantings) {
      const id = ids.get(planting.key)!;
      tx.insert(plantings)
        .values({
          id,
          cropId: planting.cropId,
          seasonYear,
          plantingMethod: planting.plantingMethod,
          dateMode: planting.dateMode,
          anchorDate: planting.anchorDate,
          nurseryStartDate: planting.schedule.nurseryStartDate,
          fieldPlantingDate: planting.schedule.fieldPlantingDate,
          firstHarvestDate: planting.schedule.firstHarvestDate,
          lastHarvestDate: planting.schedule.lastHarvestDate,
          bedFeet: planting.bedFeet,
          predictedYield: planting.predictedYield,
          yieldUnit: planting.yieldUnit,
          successionGroupId: planting.successionCount ? groupId : null,
          successionIndex: planting.successionIndex,
          successionCount: planting.successionCount,
          parentPlantingId: planting.parentKey ? ids.get(planting.parentKey) ?? null : null,
          notes: planting.notes,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      for (const bedId of planting.bedIds) {
        tx.insert(plantingBeds).values({ plantingId: id, bedId }).run();
      }
      writeTasks(
        tx,
        id,
        tasksForPlanting({
          cropName: planting.cropName,
          cultivar: planting.cultivar,
          plantingMethod: planting.plantingMethod,
          nurseryStartDate: planting.schedule.nurseryStartDate,
          fieldPlantingDate: planting.schedule.fieldPlantingDate,
          firstHarvestDate: planting.schedule.firstHarvestDate,
          bedLabels: planting.bedLabels,
        }),
        now,
      );
    }
  });
  return { ok: true, data: { count: proposed.plantings.length } };
}

export function createPlantings(input: unknown): ActionResult<{ count: number }> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (!parseISODate(parsed.data.anchorDate)) return { ok: false, error: "Choose a real date." };
  const request: PlanRequest = {
    ...parsed.data,
    followUpCropId: parsed.data.followUpCropId || null,
  };
  const plan = buildPlan(request, loadCrops(), loadBeds(), existingOccupants());
  if (!plan.ok) return plan;
  return persistPlantings(plan, parsed.data.seasonYear, parsed.data.acknowledgeOverlaps);
}

export function updatePlanting(input: unknown): ActionResult {
  const parsed = editPlantingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (!parseISODate(parsed.data.anchorDate)) return { ok: false, error: "Choose a real date." };
  const db = getDb();
  const current = db.select().from(plantings).where(eq(plantings.id, parsed.data.id)).get();
  if (!current) return { ok: false, error: "That planting is no longer on the plan." };
  const request: PlanRequest = {
    cropId: parsed.data.cropId,
    plantingMethod: parsed.data.plantingMethod,
    dateMode: parsed.data.dateMode,
    anchorDate: parsed.data.anchorDate,
    bedIds: parsed.data.bedIds,
    unassignedBedCount: parsed.data.unassignedBedCount,
    unassignedBedLength: parsed.data.unassignedBedLength,
    unassignedUnit: parsed.data.unassignedUnit,
    successionCount: 1,
    successionIntervalDays: 14,
    placement: "same_beds",
    bedsPerPlanting: 1,
    followUpCropId: null,
    followUpGapDays: 1,
    notes: parsed.data.notes,
  };
  const plan = buildPlan(request, loadCrops(), loadBeds(), existingOccupants([current.id]));
  if (!plan.ok) return plan;
  const planting = plan.plantings[0];
  if (!planting) return { ok: false, error: "The planting could not be calculated." };
  if (plan.overlaps.length && !parsed.data.acknowledgeOverlaps) {
    return {
      ok: false,
      error: "These beds overlap an existing planting. Acknowledge the conflict to save anyway.",
      overlaps: plan.overlaps,
    };
  }
  const now = stamp();
  db.transaction((tx) => {
    tx.update(plantings)
      .set({
        cropId: planting.cropId,
        plantingMethod: planting.plantingMethod,
        dateMode: planting.dateMode,
        anchorDate: planting.anchorDate,
        nurseryStartDate: planting.schedule.nurseryStartDate,
        fieldPlantingDate: planting.schedule.fieldPlantingDate,
        firstHarvestDate: planting.schedule.firstHarvestDate,
        lastHarvestDate: planting.schedule.lastHarvestDate,
        bedFeet: planting.bedFeet,
        predictedYield: planting.predictedYield,
        yieldUnit: planting.yieldUnit,
        notes: planting.notes,
        updatedAt: now,
      })
      .where(eq(plantings.id, current.id))
      .run();
    tx.delete(plantingBeds).where(eq(plantingBeds.plantingId, current.id)).run();
    for (const bedId of planting.bedIds) {
      tx.insert(plantingBeds).values({ plantingId: current.id, bedId }).run();
    }
    writeTasks(
      tx,
      current.id,
      tasksForPlanting({
        cropName: planting.cropName,
        cultivar: planting.cultivar,
        plantingMethod: planting.plantingMethod,
        nurseryStartDate: planting.schedule.nurseryStartDate,
        fieldPlantingDate: planting.schedule.fieldPlantingDate,
        firstHarvestDate: planting.schedule.firstHarvestDate,
        bedLabels: planting.bedLabels,
      }),
      now,
    );
  });
  return { ok: true, data: null };
}

export function deletePlanting(id: string): ActionResult {
  const db = getDb();
  const row = db.select().from(plantings).where(eq(plantings.id, id)).get();
  if (!row) return { ok: false, error: "That planting is already gone." };
  db.transaction((tx) => {
    tx.delete(tasks).where(eq(tasks.plantingId, id)).run();
    tx.delete(plantingBeds).where(eq(plantingBeds.plantingId, id)).run();
    tx.delete(plantings).where(eq(plantings.id, id)).run();
  });
  return { ok: true, data: null };
}

export function deleteSuccession(groupId: string): ActionResult<{ count: number }> {
  const db = getDb();
  const rows = db.select().from(plantings).where(eq(plantings.successionGroupId, groupId)).all();
  if (!rows.length) return { ok: false, error: "That succession is already gone." };
  db.delete(plantings).where(eq(plantings.successionGroupId, groupId)).run();
  return { ok: true, data: { count: rows.length } };
}

export function createManualTask(input: unknown): ActionResult<{ id: string }> {
  const parsed = manualTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (!parseISODate(parsed.data.dueDate)) return { ok: false, error: "Choose a real date." };
  const id = crypto.randomUUID();
  const now = stamp();
  getDb()
    .insert(tasks)
    .values({
      id,
      taskKey: null,
      title: parsed.data.title,
      taskType: parsed.data.taskType,
      dueDate: parsed.data.dueDate,
      status: "open",
      notes: parsed.data.notes.trim(),
      plantingId: parsed.data.plantingId || null,
      minutes: parsed.data.minutes ?? null,
      repeatEveryDays: parsed.data.repeatEveryDays ?? null,
      repeatUntil: parsed.data.repeatUntil ?? null,
      manuallyEdited: 1,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  const every = parsed.data.repeatEveryDays ?? null;
  const until = parsed.data.repeatUntil ?? null;
  if (every && until) {
    const dates = repeatDates(parsed.data.dueDate, every, until).slice(1);
    for (const dueDate of dates) {
      getDb()
        .insert(tasks)
        .values({
          id: crypto.randomUUID(),
          taskKey: null,
          title: parsed.data.title,
          taskType: parsed.data.taskType,
          dueDate,
          status: "open",
          notes: parsed.data.notes.trim(),
          plantingId: parsed.data.plantingId || null,
          minutes: parsed.data.minutes ?? null,
          repeatEveryDays: every,
          repeatUntil: until,
          manuallyEdited: 1,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  }
  return { ok: true, data: { id } };
}

export function createCustomTaskType(name: string): ActionResult<{ id: string; name: string }> {
  const trimmed = name.trim();
  if (trimmed.length < 2) return { ok: false, error: "Name the task type." };
  if (trimmed.length > 40) return { ok: false, error: "Keep the task type under 40 characters." };
  const known = TASK_TYPE_CHOICES.find((item) => item.label.toLowerCase() === trimmed.toLowerCase());
  if (known) return { ok: true, data: { id: known.id, name: known.label } };
  const id = slugTaskType(trimmed);
  if (!id) return { ok: false, error: "Use letters or numbers in the task type." };
  const db = getDb();
  const existing = db.select().from(customTaskTypes).where(eq(customTaskTypes.id, id)).get();
  if (existing) return { ok: true, data: { id: existing.id, name: existing.name } };
  db.insert(customTaskTypes).values({ id, name: trimmed, createdAt: stamp() }).run();
  return { ok: true, data: { id, name: trimmed } };
}

export function updateTask(id: string, input: unknown): ActionResult {
  const parsed = manualTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (!parseISODate(parsed.data.dueDate)) return { ok: false, error: "Choose a real date." };
  const db = getDb();
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) return { ok: false, error: "That task is no longer on the board." };
  db.update(tasks)
    .set({
      title: parsed.data.title,
      taskType: parsed.data.taskType,
      dueDate: parsed.data.dueDate,
      notes: parsed.data.notes.trim(),
      plantingId: parsed.data.plantingId || null,
      minutes: parsed.data.minutes ?? null,
      repeatEveryDays: parsed.data.repeatEveryDays ?? null,
      repeatUntil: parsed.data.repeatUntil ?? null,
      manuallyEdited: 1,
      updatedAt: stamp(),
    })
    .where(eq(tasks.id, id))
    .run();
  return { ok: true, data: null };
}

export function rescheduleTask(id: string, dueDate: string): ActionResult {
  if (!parseISODate(dueDate)) return { ok: false, error: "Choose a real date." };
  const db = getDb();
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) return { ok: false, error: "That task is no longer on the board." };
  db.update(tasks)
    .set({ dueDate, manuallyEdited: 1, updatedAt: stamp() })
    .where(eq(tasks.id, id))
    .run();
  return { ok: true, data: null };
}

export function setTaskStatus(id: string, status: "open" | "done"): ActionResult {
  const db = getDb();
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) return { ok: false, error: "That task is no longer on the board." };
  const now = stamp();
  db.transaction((tx) => {
    tx.update(tasks)
      .set({
        status,
        completedAt: status === "done" ? now : null,
        updatedAt: now,
      })
      .where(eq(tasks.id, id))
      .run();
    if (status === "done" && task.repeatEveryDays && task.repeatEveryDays > 0) {
      const nextDate = addDaysISO(task.dueDate, task.repeatEveryDays);
      const until = task.repeatUntil;
      if (!until || nextDate <= until) {
        const already = tx
          .select()
          .from(tasks)
          .where(and(eq(tasks.title, task.title), eq(tasks.dueDate, nextDate)))
          .all()
          .some((row) => row.plantingId === task.plantingId);
        if (!already) {
          tx.insert(tasks)
            .values({
              id: crypto.randomUUID(),
              plantingId: task.plantingId,
              taskKey: null,
              title: task.title,
              taskType: task.taskType,
              dueDate: nextDate,
              status: "open",
              notes: task.notes,
              minutes: task.minutes,
              repeatEveryDays: task.repeatEveryDays,
              repeatUntil: until,
              manuallyEdited: 1,
              completedAt: null,
              createdAt: now,
              updatedAt: now,
            })
            .run();
        }
      }
    }
  });
  return { ok: true, data: null };
}

export function saveFarmArea(input: { id?: string; name: string; outline: [number, number][] }): ActionResult<{ id: string }> {
  if (!input.name.trim()) return { ok: false, error: "Name the farm area." };
  if (input.outline.length < 3) return { ok: false, error: "A farm outline needs at least three corners." };
  const ring: LatLng[] = input.outline.map(([longitude, latitude]) => ({ latitude, longitude }));
  const id = input.id || crypto.randomUUID();
  const stamp = new Date().toISOString();
  const values = {
    name: input.name.trim(),
    outlineJson: JSON.stringify(input.outline),
    areaM2: ringAreaM2(ring),
    updatedAt: stamp,
  };
  const db = getDb();
  const existing = db.select().from(farmAreas).where(eq(farmAreas.id, id)).get();
  if (existing) db.update(farmAreas).set(values).where(eq(farmAreas.id, id)).run();
  else db.insert(farmAreas).values({ id, ...values, createdAt: stamp }).run();
  return { ok: true, data: { id } };
}

export function saveMapBlock(input: {
  id?: string;
  farmAreaId: string | null;
  name: string;
  type: "open_field" | "greenhouse" | "high_tunnel";
  unit: "ft" | "m";
  bedLength: number;
  bedWidth: number;
  pathWidth: number;
  centerLat: number;
  centerLng: number;
  rotationDeg: number;
  spanLengthM: number;
  spanWidthM: number;
  bedCount?: number;
}): ActionResult<{ id: string; warnings: string[] }> {
  if (!input.name.trim()) return { ok: false, error: "Name the block." };
  if (input.bedWidth <= 0 || input.bedLength <= 0) return { ok: false, error: "Bed length and width need to be greater than zero." };
  const spanWidthM = input.bedCount && input.bedCount > 0
    ? spanWidthForCount(input.bedCount, input.bedWidth, input.pathWidth, input.unit)
    : input.spanWidthM;
  const layout = layoutBeds({
    spanLengthM: input.spanLengthM,
    spanWidthM,
    bedLength: input.bedLength,
    bedWidth: input.bedWidth,
    pathWidth: input.pathWidth,
    unit: input.unit,
  });
  if (layout.bedCount < 1) return { ok: false, error: "That patch is narrower than one bed." };
  const db = getDb();
  const id = input.id || crypto.randomUUID();
  const existingBeds = input.id
    ? db.select().from(beds).where(eq(beds.blockId, id)).orderBy(beds.position).all()
    : [];
  if (layout.bedCount < existingBeds.length) {
    const removing = existingBeds.slice(layout.bedCount);
    const blocked = db
      .select({ bedId: plantingBeds.bedId })
      .from(plantingBeds)
      .where(inArray(plantingBeds.bedId, removing.map((bed) => bed.id)))
      .all();
    if (blocked.length) {
      return { ok: false, error: "Some beds in this block still have plantings. Move those plantings before making the block narrower." };
    }
  }
  const center = { latitude: input.centerLat, longitude: input.centerLng };
  const ring = rectangleRing(center, input.spanLengthM, spanWidthM, input.rotationDeg);
  const warnings: string[] = [];
  if (layout.clipped) {
    warnings.push(`The patch is shorter than ${input.bedLength} ${input.unit}. Beds were clipped to ${fromMetres(layout.bedLengthM, input.unit).toFixed(1)} ${input.unit}.`);
  }
  if (input.farmAreaId) {
    const area = db.select().from(farmAreas).where(eq(farmAreas.id, input.farmAreaId)).get();
    if (area) {
      const outline = (JSON.parse(area.outlineJson) as [number, number][]).map(([longitude, latitude]) => ({ latitude, longitude }));
      if (blockOutsideOutline(ring, outline)) warnings.push("This block sits outside the farm outline.");
    }
  }
  const others = db.select().from(blocks).all().filter((block) => block.id !== id && block.centerLat != null && block.centerLng != null && block.spanLengthM && block.spanWidthM);
  for (const other of others) {
    const otherRing = rectangleRing(
      { latitude: other.centerLat!, longitude: other.centerLng! },
      other.spanLengthM!,
      other.spanWidthM!,
      other.rotationDeg ?? 0,
    );
    if (convexRingsOverlap(ring, otherRing)) warnings.push(`This block overlaps ${other.name}.`);
  }
  const stamp = new Date().toISOString();
  const prefix = existingBeds[0]?.label.split("-")[0] || blockCode(input.name.trim(), []);
  const usedLength = fromMetres(layout.bedLengthM, input.unit);
  db.transaction((tx) => {
    const row = {
      name: input.name.trim(),
      type: input.type,
      bedLength: input.bedLength,
      bedWidth: input.bedWidth,
      pathWidth: input.pathWidth,
      unit: input.unit,
      farmAreaId: input.farmAreaId,
      centerLat: input.centerLat,
      centerLng: input.centerLng,
      rotationDeg: input.rotationDeg,
      spanLengthM: input.spanLengthM,
      spanWidthM,
      updatedAt: stamp,
    };
    const found = tx.select().from(blocks).where(eq(blocks.id, id)).get();
    if (found) tx.update(blocks).set(row).where(eq(blocks.id, id)).run();
    else {
      const sortOrder = tx.select().from(blocks).all().reduce((max, block) => Math.max(max, block.sortOrder), -1) + 1;
      tx.insert(blocks).values({ id, ...row, notes: "", sortOrder, createdAt: stamp }).run();
    }
    existingBeds.slice(layout.bedCount).forEach((bed) => {
      tx.delete(beds).where(eq(beds.id, bed.id)).run();
    });
    for (let index = 0; index < layout.bedCount; index += 1) {
      const current = existingBeds[index];
      if (current) {
        tx.update(beds)
          .set({ position: index, length: usedLength, width: input.bedWidth, updatedAt: stamp })
          .where(eq(beds.id, current.id))
          .run();
      } else {
        tx.insert(beds)
          .values({
            id: crypto.randomUUID(),
            blockId: id,
            label: `${prefix}-${index + 1}`,
            position: index,
            length: usedLength,
            width: input.bedWidth,
            createdAt: stamp,
            updatedAt: stamp,
          })
          .run();
      }
    }
  });
  return { ok: true, data: { id, warnings } };
}

export function saveFrostSettings(input: {
  locationLabel: string;
  frostLocationId: string | null;
  latitude: number | null;
  longitude: number | null;
  manualLastSpringFrost: string | null;
  manualFirstAutumnFrost: string | null;
  useManualFrost: boolean;
}): ActionResult {
  const monthDay = /^\d{2}-\d{2}$/;
  if (input.useManualFrost) {
    if (!input.manualLastSpringFrost || !input.manualFirstAutumnFrost || !monthDay.test(input.manualLastSpringFrost) || !monthDay.test(input.manualFirstAutumnFrost)) {
      return { ok: false, error: "Enter both frost dates as month-day, for example 04-15." };
    }
  }
  getDb()
    .insert(farmSettings)
    .values({
      id: "default",
      country: "GB",
      locationLabel: input.locationLabel,
      frostLocationId: input.frostLocationId,
      latitude: input.latitude,
      longitude: input.longitude,
      manualLastSpringFrost: input.manualLastSpringFrost,
      manualFirstAutumnFrost: input.manualFirstAutumnFrost,
      useManualFrost: input.useManualFrost ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: farmSettings.id,
      set: {
        locationLabel: input.locationLabel,
        frostLocationId: input.frostLocationId,
        latitude: input.latitude,
        longitude: input.longitude,
        manualLastSpringFrost: input.manualLastSpringFrost,
        manualFirstAutumnFrost: input.manualFirstAutumnFrost,
        useManualFrost: input.useManualFrost ? 1 : 0,
      },
    })
    .run();
  return { ok: true, data: null };
}

export function deleteManualTask(id: string): ActionResult {
  const db = getDb();
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) return { ok: false, error: "That task is already gone." };
  if (task.taskKey) {
    return { ok: false, error: "Planting tasks stay with the planting. Check this one off, or edit the planting." };
  }
  db.delete(tasks).where(eq(tasks.id, id)).run();
  return { ok: true, data: null };
}

export function saveUserVariety(input: {
  cropName: string;
  varietyName: string;
  supplier: string;
  daysToMaturity: number;
  daysInNursery: number;
  harvestWindowDays: number;
  rowsPerBed: number;
  spacingCm: number;
  plantingMethod: "direct_seeded" | "transplanted";
}): ActionResult<{ id: string }> {
  const cropName = input.cropName.trim();
  const varietyName = input.varietyName.trim();
  if (!cropName || !varietyName) return { ok: false, error: "Name the crop and the variety." };
  if (input.daysToMaturity <= 0 || input.harvestWindowDays <= 0) {
    return { ok: false, error: "Days to maturity and the harvest window need to be greater than zero." };
  }
  const db = getDb();
  const match = db
    .select()
    .from(vegetables)
    .all()
    .find((vegetable) => vegetable.name.toLowerCase() === cropName.toLowerCase());
  const id = `user_${crypto.randomUUID()}`;
  const now = stamp();
  db.insert(crops)
    .values({
      id,
      name: match?.name ?? cropName,
      cultivar: varietyName,
      category: match?.category ?? "Other",
      plantingMethod: input.plantingMethod,
      daysToMaturity: Math.round(input.daysToMaturity),
      daysInNursery: input.plantingMethod === "transplanted" ? Math.max(0, Math.round(input.daysInNursery)) : 0,
      harvestWindowDays: Math.round(input.harvestWindowDays),
      rowsPerBed: Math.max(1, Math.round(input.rowsPerBed)),
      inRowSpacingIn: Math.round((input.spacingCm / 2.54) * 10) / 10,
      yieldPer100BedFeet: match ? 80 : 0,
      yieldUnit: "bunches",
      color: match?.color ?? "#8C3B2A",
      notes: "Added on this farm.",
      vegetableId: match?.id ?? null,
      family: match?.family ?? null,
      rotationFamily: rotationFamilyFor(match?.family, match?.category),
      frostTolerance: match?.frostTolerance ?? null,
      minSoilTempC: match?.minSoilTempC ?? null,
      supplier: input.supplier.trim() || null,
      sourceName: "Added on this farm",
      sourceUrl: null,
      userCreated: 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return { ok: true, data: { id } };
}

function bedSlots(db: ReturnType<typeof getDb>): BedSlot[] {
  const bedRows = db.select().from(beds).all();
  const blockRows = db.select().from(blocks).all();
  const blocksById = new Map(blockRows.map((block) => [block.id, block]));
  return bedRows.map((bed) => {
    const block = blocksById.get(bed.blockId);
    const blockName = block?.name ?? "Block";
    return {
      id: bed.id,
      label: gardenerBedName(blockName, bed.position),
      blockId: bed.blockId,
      blockName,
      position: bed.position,
    };
  });
}

function occupancyRows(db: ReturnType<typeof getDb>): BedOccupancy[] {
  const cropRows = db.select().from(crops).all();
  const names = new Map(cropRows.map((crop) => [crop.id, `${crop.name} · ${crop.cultivar}`]));
  const planted = db.select().from(plantings).all();
  const links = db.select().from(plantingBeds).all();
  const spans: BedOccupancy[] = [];
  for (const link of links) {
    const planting = planted.find((item) => item.id === link.plantingId);
    if (!planting) continue;
    spans.push({
      plantingId: planting.id,
      plantingLabel: names.get(planting.cropId) ?? "Planting",
      bedId: link.bedId,
      start: planting.fieldPlantingDate,
      end: planting.lastHarvestDate,
    });
  }
  return spans;
}

export function saveQuickPlanting(input: {
  seasonYear: number;
  cropId: string;
  method: "direct_seeded" | "transplanted";
  nurserySowDate: string;
  daysInNursery: number;
  fieldDate: string;
  daysToMaturity: number;
  harvestWindow: number;
  harvestWindowUnit: HarvestWindowUnit;
  manualFieldDate: string | null;
  manualFirstHarvest: string | null;
  manualLastHarvest: string | null;
  bedCount: number;
  bedLengthM: number;
  rowsPerBed: number;
  spacingCm: number;
  expectedHarvest: number | null;
  expectedRevenue: number | null;
  notes: string;
  customTasks: { title: string; dueDate: string; taskType?: string; repeatEveryDays?: number | null; repeatUntil?: string | null }[];
  id?: string;
}): ActionResult<{ id: string }> {
  if (!parseISODate(input.fieldDate)) return { ok: false, error: "Choose a real sowing or transplant date." };
  if (input.method === "transplanted" && !parseISODate(input.nurserySowDate)) {
    return { ok: false, error: "Choose the nursery sowing date." };
  }
  const db = getDb();
  const crop = db.select().from(crops).where(eq(crops.id, input.cropId)).get();
  if (!crop) return { ok: false, error: "Choose a variety." };
  let dates;
  try {
    dates = composePlantingDates(input);
  } catch {
    return { ok: false, error: "Those dates do not work out. Check the numbers." };
  }
  if (dates.lastHarvestDate < dates.firstHarvestDate || dates.firstHarvestDate < dates.fieldPlantingDate) {
    return { ok: false, error: "Harvest has to start on or after the field date, and finish after it starts." };
  }
  const id = input.id ?? crypto.randomUUID();
  const now = stamp();
  const lengthFeet = toFeet(input.bedLengthM, "m");
  const bedFeet = lengthFeet * Math.max(1, input.bedCount);
  if (input.id) {
    const current = db.select().from(plantings).where(eq(plantings.id, input.id)).get();
    if (!current) return { ok: false, error: "That planting is no longer on the plan." };
    const held = db.select().from(plantingBeds).where(eq(plantingBeds.plantingId, input.id)).all();
    for (const link of held) {
      const check = assignBeds({
        beds: bedSlots(db),
        occupancy: occupancyRows(db),
        startBedId: link.bedId,
        bedCount: 1,
        start: dates.fieldPlantingDate,
        end: dates.lastHarvestDate,
        ignorePlantingId: input.id,
      });
      if (!check.ok) return { ok: false, error: check.message };
    }
  }
  db.transaction((tx) => {
    const values = {
      cropId: crop.id,
      seasonYear: input.seasonYear,
      plantingMethod: input.method,
      dateMode: "field_planting" as const,
      anchorDate: dates.fieldPlantingDate,
      nurseryStartDate: dates.nurseryStartDate,
      fieldPlantingDate: dates.fieldPlantingDate,
      firstHarvestDate: dates.firstHarvestDate,
      lastHarvestDate: dates.lastHarvestDate,
      predictedYield: input.expectedHarvest ?? 0,
      yieldUnit: crop.yieldUnit,
      notes: input.notes.trim(),
      bedsNeeded: Math.max(1, Math.round(input.bedCount)),
      bedLengthM: input.bedLengthM,
      rowsPerBed: Math.max(1, Math.round(input.rowsPerBed)),
      inRowSpacingCm: input.spacingCm,
      expectedRevenue: input.expectedRevenue,
      usedDaysToMaturity: Math.round(input.daysToMaturity),
      usedDaysInNursery: Math.round(input.daysInNursery),
      usedHarvestWindowDays: dates.harvestWindowDays,
      updatedAt: now,
    };
    if (input.id) {
      tx.update(plantings).set(values).where(eq(plantings.id, id)).run();
      tx.delete(tasks).where(and(eq(tasks.plantingId, id), isNull(tasks.taskKey))).run();
      const autos = tx.select().from(tasks).where(eq(tasks.plantingId, id)).all();
      for (const task of autos) {
        if (task.taskKey) tx.delete(tasks).where(eq(tasks.id, task.id)).run();
      }
    } else {
      tx.insert(plantings).values({ ...values, id, bedFeet, createdAt: now }).run();
    }
    const drafts = basicPlantingTasks({
      cropName: crop.name,
      cultivar: crop.cultivar,
      method: input.method,
      nurseryStartDate: dates.nurseryStartDate,
      daysInNursery: input.daysInNursery,
      fieldPlantingDate: dates.fieldPlantingDate,
      firstHarvestDate: dates.firstHarvestDate,
    });
    for (const draft of drafts) {
      tx.insert(tasks)
        .values({
          id: crypto.randomUUID(),
          plantingId: id,
          taskKey: draft.taskKey,
          title: draft.title,
          taskType: draft.taskType,
          dueDate: draft.dueDate,
          status: "open",
          notes: "",
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
    for (const task of input.customTasks) {
      if (!task.title.trim() || !parseISODate(task.dueDate)) continue;
      const every = task.repeatEveryDays && task.repeatEveryDays > 0 ? task.repeatEveryDays : null;
      const until = task.repeatUntil && parseISODate(task.repeatUntil) ? task.repeatUntil : null;
      const dates = every && until ? repeatDates(task.dueDate, every, until) : [task.dueDate];
      for (const dueDate of dates) {
        tx.insert(tasks)
          .values({
            id: crypto.randomUUID(),
            plantingId: id,
            taskKey: null,
            title: task.title.trim(),
            taskType: task.taskType || "other",
            dueDate,
            status: "open",
            notes: "",
            minutes: null,
            repeatEveryDays: every,
            repeatUntil: until,
            manuallyEdited: 1,
            completedAt: null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
    }
  });
  const written = db.select({ id: plantings.id }).from(plantings).where(eq(plantings.id, id)).get();
  if (!written) return { ok: false, error: "The planting did not stay saved. Try again." };
  return { ok: true, data: { id } };
}

export function assignPlantingBeds(plantingId: string, startBedId: string): ActionResult<{ bedIds: string[] }> {
  const db = getDb();
  const planting = db.select().from(plantings).where(eq(plantings.id, plantingId)).get();
  if (!planting) return { ok: false, error: "That planting is no longer on the plan." };
  const decision = assignBeds({
    beds: bedSlots(db),
    occupancy: occupancyRows(db),
    startBedId,
    bedCount: planting.bedsNeeded ?? 1,
    start: planting.fieldPlantingDate,
    end: planting.lastHarvestDate,
    ignorePlantingId: planting.id,
  });
  if (!decision.ok) return { ok: false, error: decision.message };
  const chosen = db.select().from(beds).where(inArray(beds.id, decision.bedIds)).all();
  const blockRows = db.select().from(blocks).all();
  const unitOf = new Map(blockRows.map((block) => [block.id, block.unit as Unit]));
  const bedFeet = chosen.reduce((sum, bed) => sum + toFeet(bed.length, unitOf.get(bed.blockId) ?? "ft"), 0);
  const now = stamp();
  db.transaction((tx) => {
    tx.delete(plantingBeds).where(eq(plantingBeds.plantingId, planting.id)).run();
    for (const bedId of decision.bedIds) {
      tx.insert(plantingBeds).values({ plantingId: planting.id, bedId }).run();
    }
    tx.update(plantings).set({ bedFeet, updatedAt: now }).where(eq(plantings.id, planting.id)).run();
  });
  return { ok: true, data: { bedIds: decision.bedIds } };
}

export function saveRotationYears(years: number): ActionResult {
  const count = Math.round(years);
  if (!Number.isFinite(count) || count < 1 || count > 8) {
    return { ok: false, error: "Look back between 1 and 8 seasons." };
  }
  getDb().update(farmSettings).set({ rotationYears: count }).where(eq(farmSettings.id, "default")).run();
  return { ok: true, data: null };
}

export function saveRotationFamily(cropId: string, family: string): ActionResult {
  if (!ROTATION_FAMILIES.includes(family as RotationFamily)) return { ok: false, error: "Choose a rotation family." };
  const db = getDb();
  const crop = db.select().from(crops).where(eq(crops.id, cropId)).get();
  if (!crop) return { ok: false, error: "That crop is no longer in the library." };
  db.update(crops).set({ rotationFamily: family, updatedAt: stamp() }).where(eq(crops.id, cropId)).run();
  return { ok: true, data: null };
}

export function saveCompanion(input: { cropName: string; otherName: string; kind: "good" | "bad"; reason: string }): ActionResult<{ id: string }> {
  const cropName = input.cropName.trim();
  const otherName = input.otherName.trim();
  const reason = input.reason.trim();
  if (!cropName || !otherName || !reason) return { ok: false, error: "Name both crops and give a one-line reason." };
  if (input.kind !== "good" && input.kind !== "bad") return { ok: false, error: "Say whether the pairing helps or hinders." };
  const id = `cmp_user_${crypto.randomUUID()}`;
  getDb().insert(companions).values({ id, cropName, otherName, kind: input.kind, reason, userCreated: 1 }).run();
  return { ok: true, data: { id } };
}

export function deleteCompanion(id: string): ActionResult {
  getDb().delete(companions).where(eq(companions.id, id)).run();
  return { ok: true, data: null };
}

export function clearPlantingBeds(plantingId: string): ActionResult {
  const db = getDb();
  const planting = db.select().from(plantings).where(eq(plantings.id, plantingId)).get();
  if (!planting) return { ok: false, error: "That planting is no longer on the plan." };
  const now = stamp();
  db.transaction((tx) => {
    tx.delete(plantingBeds).where(eq(plantingBeds.plantingId, plantingId)).run();
    tx.update(plantings).set({ bedFeet: 0, updatedAt: now }).where(eq(plantings.id, plantingId)).run();
  });
  return { ok: true, data: null };
}
