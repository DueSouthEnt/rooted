import { BLOCKS, CROPS, DEMO_PLANTINGS, catalogBeds, type DemoPlantingSpec } from "@/lib/veg/catalog";
import { bedFeetOf, findOverlaps, occupantsFor, predictYield, schedulePlanting } from "@/lib/veg/planning";
import type { Overlap, PlantingMethod } from "@/lib/veg/types";

export type MaterializedPlanting = {
  id: string;
  cropId: string;
  cropName: string;
  cultivar: string;
  color: string;
  category: string;
  plantingMethod: PlantingMethod;
  daysToMaturity: number;
  daysInNursery: number;
  harvestWindowDays: number;
  yieldPer100BedFeet: number;
  anchorDate: string;
  nurseryStartDate: string | null;
  fieldPlantingDate: string;
  firstHarvestDate: string;
  lastHarvestDate: string;
  bedIds: string[];
  bedLabels: string[];
  bedFeet: number;
  predictedYield: number;
  yieldUnit: string;
  successionGroupId: string | null;
  successionIndex: number | null;
  successionCount: number | null;
  parentPlantingId: string | null;
  notes: string;
  seasonYear: number;
  spec: DemoPlantingSpec;
};

export function materializeDemo(): { plantings: MaterializedPlanting[]; overlaps: Overlap[] } {
  const beds = catalogBeds();
  const bedById = new Map(beds.map((bed) => [bed.id, bed]));
  const blockById = new Map(BLOCKS.map((block) => [block.id, block]));
  const cropById = new Map(CROPS.map((crop) => [crop.id, crop]));

  const plantings: MaterializedPlanting[] = DEMO_PLANTINGS.map((spec) => {
    const crop = cropById.get(spec.cropId);
    if (!crop) throw new Error(`Missing crop ${spec.cropId}`);
    const assigned = spec.bedIds.map((id) => {
      const bed = bedById.get(id);
      if (!bed) throw new Error(`Missing bed ${id}`);
      const block = blockById.get(bed.blockId);
      if (!block) throw new Error(`Missing block ${bed.blockId}`);
      return { ...bed, unit: block.unit, label: bed.label };
    });
    const schedule = schedulePlanting({
      plantingMethod: crop.plantingMethod,
      daysToMaturity: crop.daysToMaturity,
      daysInNursery: crop.daysInNursery,
      harvestWindowDays: crop.harvestWindowDays,
      dateMode: "field_planting",
      anchorDate: spec.anchorDate,
    });
    const feet = bedFeetOf(assigned);
    return {
      id: spec.id,
      cropId: crop.id,
      cropName: crop.name,
      cultivar: crop.cultivar,
      color: crop.color,
      category: crop.category,
      plantingMethod: crop.plantingMethod,
      daysToMaturity: crop.daysToMaturity,
      daysInNursery: crop.daysInNursery,
      harvestWindowDays: crop.harvestWindowDays,
      yieldPer100BedFeet: crop.yieldPer100BedFeet,
      anchorDate: spec.anchorDate,
      nurseryStartDate: schedule.nurseryStartDate,
      fieldPlantingDate: schedule.fieldPlantingDate,
      firstHarvestDate: schedule.firstHarvestDate,
      lastHarvestDate: schedule.lastHarvestDate,
      bedIds: assigned.map((bed) => bed.id),
      bedLabels: assigned.map((bed) => bed.label),
      bedFeet: feet,
      predictedYield: predictYield(feet, crop.yieldPer100BedFeet),
      yieldUnit: crop.yieldUnit,
      successionGroupId: spec.successionGroupId ?? null,
      successionIndex: spec.successionIndex ?? null,
      successionCount: spec.successionCount ?? null,
      parentPlantingId: spec.parentPlantingId ?? null,
      notes: spec.notes ?? "",
      seasonYear: Number(schedule.fieldPlantingDate.slice(0, 4)),
      spec,
    };
  });

  const overlaps = findOverlaps(
    occupantsFor(
      plantings.map((planting) => ({
        key: planting.id,
        label: `${planting.cropName} · ${planting.cultivar}`,
        bedIds: planting.bedIds,
        bedLabels: planting.bedLabels,
        start: planting.fieldPlantingDate,
        end: planting.lastHarvestDate,
      })),
    ),
  );

  return { plantings, overlaps };
}
