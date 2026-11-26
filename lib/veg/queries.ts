import { eq, getDb } from "@/lib/veg/memory";
import { gardenerBedName } from "@/lib/veg/bed-name";
import { beds, blocks, companions, crops, customTaskTypes, farmAreas, farmSettings, frostLocations, plantingBeds, plantings, tasks } from "@/lib/veg/tables";
import type { AdvicePlanting, BedRef, CompanionRule } from "@/lib/veg/advice";
import type { FrostTolerance } from "@/lib/veg/frost";
import type { BlockType, DateMode, PlantingMethod, TaskStatus, TaskType, Unit } from "@/lib/veg/types";
import type { BlockView, CropView, FarmAreaView, PlantingView, TaskView } from "@/lib/veg/views";

function listBlocksSync(): BlockView[] {
  const db = getDb();
  const blockRows = db.select().from(blocks).all();
  const bedRows = db.select().from(beds).all();
  return blockRows.map((block) => ({
    id: block.id,
    name: block.name,
    type: block.type as BlockType,
    bedLength: block.bedLength,
    bedWidth: block.bedWidth,
    pathWidth: block.pathWidth,
    unit: block.unit as Unit,
    notes: block.notes,
    sortOrder: block.sortOrder,
    farmAreaId: block.farmAreaId,
    centerLat: block.centerLat,
    centerLng: block.centerLng,
    rotationDeg: block.rotationDeg,
    spanLengthM: block.spanLengthM,
    spanWidthM: block.spanWidthM,
    beds: bedRows
      .filter((bed) => bed.blockId === block.id)
      .map((bed) => ({
        id: bed.id,
        blockId: bed.blockId,
        label: bed.label,
        position: bed.position,
        length: bed.length,
        width: bed.width,
      })),
  }));
}

function listFarmAreasSync(): FarmAreaView[] {
  return getDb()
    .select()
    .from(farmAreas)
    .all()
    .map((area) => ({
      id: area.id,
      name: area.name,
      outline: JSON.parse(area.outlineJson) as [number, number][],
      areaM2: area.areaM2,
    }));
}

function listCropsSync(): CropView[] {
  const db = getDb();
  return db
    .select()
    .from(crops)
    
    .all()
    .map((crop) => ({
      id: crop.id,
      name: crop.name,
      cultivar: crop.cultivar,
      category: crop.category,
      plantingMethod: crop.plantingMethod as PlantingMethod,
      daysToMaturity: crop.daysToMaturity,
      daysInNursery: crop.daysInNursery,
      harvestWindowDays: crop.harvestWindowDays,
      rowsPerBed: crop.rowsPerBed,
      inRowSpacingIn: crop.inRowSpacingIn,
      yieldPer100BedFeet: crop.yieldPer100BedFeet,
      yieldUnit: crop.yieldUnit,
      color: crop.color,
      notes: crop.notes,
      family: crop.family,
      frostTolerance: (crop.frostTolerance as FrostTolerance | null) ?? null,
      minSoilTempC: crop.minSoilTempC,
      supplier: crop.supplier,
      sourceName: crop.sourceName,
      sourceUrl: crop.sourceUrl,
      betweenRowCm: crop.betweenRowCm,
      germinationTempMin: crop.germinationTempMin,
      germinationTempMax: crop.germinationTempMax,
      germinationDaysMin: crop.germinationDaysMin,
      germinationDaysMax: crop.germinationDaysMax,
      sowIndoorsStart: crop.sowIndoorsStart,
      sowIndoorsEnd: crop.sowIndoorsEnd,
      sowOutdoorsStart: crop.sowOutdoorsStart,
      sowOutdoorsEnd: crop.sowOutdoorsEnd,
      transplantStart: crop.transplantStart,
      transplantEnd: crop.transplantEnd,
      hardinessNotes: crop.hardinessNotes,
      yieldIsEstimate: crop.yieldIsEstimate === 1,
      dtmIsTypical: crop.dtmIsTypical === 1,
      userCreated: crop.userCreated === 1,
      rotationFamily: crop.rotationFamily,
    }));
}

export type FrostContext = {
  label: string;
  lastSpringFrost: string;
  firstAutumnFrost: string;
  sourceName: string;
  sourceUrl: string;
  manual: boolean;
};

function getCropSync(id: string): CropView | null {
  return listCropsSync().find((crop) => crop.id === id) ?? null;
}

function listFrostLocationsSync() {
  return getDb().select().from(frostLocations).all();
}

function getFrostContextSync(): FrostContext | null {
  const db = getDb();
  const settings = db.select().from(farmSettings).where(eq(farmSettings.id, "default")).get();
  if (!settings) return null;
  if (settings.useManualFrost && settings.manualLastSpringFrost && settings.manualFirstAutumnFrost) {
    return {
      label: settings.locationLabel || "Manual frost dates",
      lastSpringFrost: settings.manualLastSpringFrost,
      firstAutumnFrost: settings.manualFirstAutumnFrost,
      sourceName: "Entered on the farm",
      sourceUrl: "",
      manual: true,
    };
  }
  if (!settings.frostLocationId) return null;
  const place = db.select().from(frostLocations).where(eq(frostLocations.id, settings.frostLocationId)).get();
  if (!place) return null;
  return {
    label: settings.locationLabel || place.name,
    lastSpringFrost: place.lastSpringFrost,
    firstAutumnFrost: place.firstAutumnFrost,
    sourceName: place.sourceName,
    sourceUrl: place.sourceUrl,
    manual: false,
  };
}

function getFarmSettingsSync() {
  return getDb().select().from(farmSettings).where(eq(farmSettings.id, "default")).get() ?? null;
}

function listSeasonYearsSync(): number[] {
  const db = getDb();
  const rows = db
    .selectDistinct({ year: plantings.seasonYear })
    .from(plantings)
    
    .all();
  return rows.map((row) => row.year);
}

function listPlantingsSync(seasonYear: number): PlantingView[] {
  const db = getDb();
  const rows = db
    .select({ planting: plantings, crop: crops })
    .from(plantings)
    .innerJoin(crops, eq(plantings.cropId, crops.id))
    .where(eq(plantings.seasonYear, seasonYear))
    
    .all();
  const links = db
    .select({ link: plantingBeds, bed: beds, block: blocks })
    .from(plantingBeds)
    .innerJoin(beds, eq(plantingBeds.bedId, beds.id))
    .innerJoin(blocks, eq(beds.blockId, blocks.id))
    .all();
  const bedsByPlanting = new Map<string, PlantingView["beds"]>();
  for (const row of links) {
    const list = bedsByPlanting.get(row.link.plantingId) ?? [];
    list.push({
      id: row.bed.id,
      label: row.bed.label,
      blockId: row.block.id,
      blockName: row.block.name,
      position: row.bed.position,
      length: row.bed.length,
      width: row.bed.width,
      unit: row.block.unit as Unit,
    });
    bedsByPlanting.set(row.link.plantingId, list);
  }
  const planted = rows.map((row) => ({
    id: row.planting.id,
    cropId: row.crop.id,
    cropName: row.crop.name,
    cultivar: row.crop.cultivar,
    category: row.crop.category,
    color: row.crop.color,
    plantingMethod: row.planting.plantingMethod as PlantingMethod,
    daysToMaturity: row.planting.usedDaysToMaturity ?? row.crop.daysToMaturity,
    daysInNursery: row.planting.usedDaysInNursery ?? row.crop.daysInNursery,
    harvestWindowDays: row.planting.usedHarvestWindowDays ?? row.crop.harvestWindowDays,
    yieldPer100BedFeet: row.crop.yieldPer100BedFeet,
    dateMode: row.planting.dateMode as DateMode,
    anchorDate: row.planting.anchorDate,
    nurseryStartDate: row.planting.nurseryStartDate,
    fieldPlantingDate: row.planting.fieldPlantingDate,
    firstHarvestDate: row.planting.firstHarvestDate,
    lastHarvestDate: row.planting.lastHarvestDate,
    bedFeet: row.planting.bedFeet,
    predictedYield: row.planting.predictedYield,
    yieldUnit: row.planting.yieldUnit,
    successionGroupId: row.planting.successionGroupId,
    successionIndex: row.planting.successionIndex,
    successionCount: row.planting.successionCount,
    parentPlantingId: row.planting.parentPlantingId,
    notes: row.planting.notes,
    seasonYear: row.planting.seasonYear,
    frostTolerance: (row.crop.frostTolerance as FrostTolerance | null) ?? null,
    rotationFamily: row.crop.rotationFamily,
    bedsNeeded: row.planting.bedsNeeded ?? Math.max(1, bedsByPlanting.get(row.planting.id)?.length ?? 1),
    bedLengthM: row.planting.bedLengthM,
    rowsPerBed: row.planting.rowsPerBed,
    inRowSpacingCm: row.planting.inRowSpacingCm,
    expectedRevenue: row.planting.expectedRevenue,
    beds: (bedsByPlanting.get(row.planting.id) ?? []).sort((a, b) => a.label.localeCompare(b.label)),
  }));
  const labels = new Map(planted.map((planting) => [planting.id, `${planting.cropName} · ${planting.cultivar}`]));
  return planted.map((planting) => ({
    ...planting,
    parentLabel: planting.parentPlantingId ? labels.get(planting.parentPlantingId) ?? null : null,
  }));
}

function listCustomTaskTypesSync(): { id: string; name: string }[] {
  return getDb()
    .select({ id: customTaskTypes.id, name: customTaskTypes.name })
    .from(customTaskTypes)
    .all()
    .sort((a, b) => a.name.localeCompare(b.name));
}

function listTasksSync(): TaskView[] {
  const db = getDb();
  const rows = db
    .select({ task: tasks, cropName: crops.name, color: crops.color, seasonYear: plantings.seasonYear })
    .from(tasks)
    .leftJoin(plantings, eq(tasks.plantingId, plantings.id))
    .leftJoin(crops, eq(plantings.cropId, crops.id))
    
    .all();
  const links = db
    .select({ plantingId: plantingBeds.plantingId, position: beds.position, blockName: blocks.name })
    .from(plantingBeds)
    .innerJoin(beds, eq(plantingBeds.bedId, beds.id))
    .innerJoin(blocks, eq(beds.blockId, blocks.id))
    .all();
  const labels = new Map<string, string[]>();
  for (const link of links) {
    const list = labels.get(link.plantingId) ?? [];
    list.push(gardenerBedName(link.blockName, link.position));
    labels.set(link.plantingId, list);
  }
  return rows.map((row) => {
    const bedLabels = row.task.plantingId ? labels.get(row.task.plantingId) : undefined;
    return {
      id: row.task.id,
      plantingId: row.task.plantingId,
      taskKey: row.task.taskKey,
      title: row.task.title,
      taskType: row.task.taskType as TaskType,
      dueDate: row.task.dueDate,
      status: row.task.status as TaskStatus,
      notes: row.task.notes,
      minutes: row.task.minutes,
      repeatEveryDays: row.task.repeatEveryDays,
      repeatUntil: row.task.repeatUntil,
      manuallyEdited: row.task.manuallyEdited === 1,
      seasonYear: row.seasonYear,
      cropName: row.cropName,
      color: row.color,
      bedLabels: bedLabels?.sort((a, b) => a.localeCompare(b)).join(", ") ?? null,
    };
  });
}

function listCompanionsSync(): CompanionRule[] {
  return getDb()
    .select()
    .from(companions)
    .all()
    .map((row) => ({ id: row.id, cropName: row.cropName, otherName: row.otherName, kind: row.kind === "bad" ? "bad" : "good", reason: row.reason }));
}

function listAdvicePlantingsSync(): AdvicePlanting[] {
  const db = getDb();
  const rows = db.select({ planting: plantings, crop: crops }).from(plantings).innerJoin(crops, eq(plantings.cropId, crops.id)).all();
  const links = db.select().from(plantingBeds).all();
  const byPlanting = new Map<string, string[]>();
  for (const link of links) {
    const list = byPlanting.get(link.plantingId) ?? [];
    list.push(link.bedId);
    byPlanting.set(link.plantingId, list);
  }
  return rows.map((row) => ({
    id: row.planting.id,
    cropName: row.crop.name,
    cultivar: row.crop.cultivar,
    rotationFamily: row.crop.rotationFamily,
    seasonYear: row.planting.seasonYear,
    start: row.planting.fieldPlantingDate,
    end: row.planting.lastHarvestDate,
    bedIds: byPlanting.get(row.planting.id) ?? [],
  }));
}

function listBedRefsSync(): BedRef[] {
  const db = getDb();
  const names = new Map(db.select().from(blocks).all().map((block) => [block.id, block.name]));
  return db.select().from(beds).all().map((bed) => ({
    id: bed.id,
    blockId: bed.blockId,
    blockName: names.get(bed.blockId) ?? "Block",
    position: bed.position,
    label: bed.label,
  }));
}

function rotationYearSettingSync(): number {
  return getFarmSettingsSync()?.rotationYears ?? 3;
}

import { readFarm } from "@/lib/veg/memory";

export async function listBlocks() { return readFarm(() => listBlocksSync(), [] as ReturnType<typeof listBlocksSync>); }
export async function listFarmAreas() { return readFarm(() => listFarmAreasSync(), [] as ReturnType<typeof listFarmAreasSync>); }
export async function listCrops() { return readFarm(() => listCropsSync(), [] as ReturnType<typeof listCropsSync>); }
export async function getCrop(id: string) { return readFarm(() => getCropSync(id), null); }
export async function listFrostLocations() { return readFarm(() => listFrostLocationsSync(), [] as ReturnType<typeof listFrostLocationsSync>); }
export async function getFrostContext() { return readFarm(() => getFrostContextSync(), null); }
export async function getFarmSettings() { return readFarm(() => getFarmSettingsSync(), null); }
export async function listSeasonYears() { return readFarm(() => listSeasonYearsSync(), [] as number[]); }
export async function listPlantings(seasonYear: number) { return readFarm(() => listPlantingsSync(seasonYear), [] as ReturnType<typeof listPlantingsSync>); }
export async function listCustomTaskTypes() { return readFarm(() => listCustomTaskTypesSync(), [] as ReturnType<typeof listCustomTaskTypesSync>); }
export async function listTasks() { return readFarm(() => listTasksSync(), [] as ReturnType<typeof listTasksSync>); }
export async function listCompanions() { return readFarm(() => listCompanionsSync(), [] as ReturnType<typeof listCompanionsSync>); }
export async function listAdvicePlantings() { return readFarm(() => listAdvicePlantingsSync(), [] as ReturnType<typeof listAdvicePlantingsSync>); }
export async function listBedRefs() { return readFarm(() => listBedRefsSync(), [] as ReturnType<typeof listBedRefsSync>); }
export async function rotationYearSetting() { return readFarm(() => rotationYearSettingSync(), 3); }
