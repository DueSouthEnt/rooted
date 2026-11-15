import type { Flower } from "@/lib/flower";
import type { PlantingRecord } from "@/lib/records";
import { isPlantingMethod, type PlantingDates } from "@/lib/schedule";

export function toPlantingDates(row: PlantingRecord, flowers: Flower[]): PlantingDates | null {
  const flower = flowers.find((item) => item.slug === row.flower_slug);
  if (!isPlantingMethod(row.method)) return null;
  return {
    id: row.id,
    flowerSlug: row.flower_slug,
    flowerName: flower?.commonName ?? row.flower_slug,
    colour: flower?.colour ?? "#e7b7c6",
    variety: row.variety,
    method: row.method,
    nurseryStart: row.nursery_start,
    fieldDate: row.field_date,
    bloomStart: row.bloom_start,
    bloomEnd: row.bloom_end,
    liftDate: row.lift_date,
    firstBloomYear: row.first_bloom_year,
    spansYears: row.spans_years,
    bedId: row.bed_id,
    bedIds: row.planting_beds?.map((item) => item.bed_id) ?? (row.bed_id ? [row.bed_id] : []),
    bedsNeeded: row.beds_needed ?? 1,
    daysToMaturity: row.days_to_maturity ?? undefined,
    daysInNursery: row.days_in_nursery ?? undefined,
    bloomWeeks: row.bloom_weeks ?? undefined,
    spacingCm: row.spacing_cm ?? undefined,
    bedLengthM: row.bed_length_m ?? undefined,
    notes: row.notes ?? "",
  };
}
