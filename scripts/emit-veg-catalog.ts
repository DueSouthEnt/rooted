import { writeFileSync } from "node:fs";
import { CROPS } from "@/lib/veg/catalog";
import { FROST_LOCATIONS } from "@/lib/veg/seed/frost-locations";
import { VEGETABLES, vegetableForName, type VegetableSeed } from "@/lib/veg/seed/vegetables";
import varietyFile from "@/lib/veg/seed/varieties.json";

type VarietySeed = {
  id: string;
  vegetableId: string;
  cultivar: string;
  supplier: string;
  sourceName: string;
  sourceUrl: string;
  plantingMethod?: string;
  daysToMaturity?: number;
  daysInNursery?: number;
  harvestWindowDays?: number;
  rowsPerBed?: number;
  inRowSpacingCm?: number;
  betweenRowCm?: number;
  yieldPer100BedFeet?: number;
  yieldUnit?: string;
  yieldIsEstimate?: boolean;
  dtmIsTypical?: boolean;
  germinationTempMin?: number | null;
  germinationTempMax?: number | null;
  germinationDaysMin?: number | null;
  germinationDaysMax?: number | null;
  sowIndoorsStart?: number | null;
  sowIndoorsEnd?: number | null;
  sowOutdoorsStart?: number | null;
  sowOutdoorsEnd?: number | null;
  transplantStart?: number | null;
  transplantEnd?: number | null;
  notes?: string;
};

const NAME_ALIAS: Record<string, string> = {
  "baby lettuce": "lettuce",
  "salad mix": "lettuce",
  "head lettuce": "lettuce",
  "snap pea": "pea",
  "bush bean": "french bean",
  beet: "beetroot",
  scallion: "spring onion",
  zucchini: "courgette",
  cilantro: "coriander",
};

function inches(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}

function sql(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replaceAll("'", "''")}'`;
}

const lines: string[] = ["-- Catalogue only. No sample beds, plantings, or Bampton data."];
for (const vegetable of VEGETABLES) {
  lines.push(
    `insert into public.veg_vegetables (id, name, family, category, frost_tolerance, min_soil_temp_c, color, notes) values (${[
      vegetable.id,
      vegetable.name,
      vegetable.family,
      vegetable.category,
      vegetable.frostTolerance,
      vegetable.minSoilTempC,
      vegetable.color,
      vegetable.notes,
    ].map(sql).join(", ")}) on conflict (id) do nothing;`,
  );
}
for (const place of FROST_LOCATIONS) {
  lines.push(
    `insert into public.veg_frost_locations (id, country, region, name, latitude, longitude, last_spring_frost, first_autumn_frost, source_name, source_url) values (${[
      place.id,
      place.country,
      place.region,
      place.name,
      place.latitude,
      place.longitude,
      place.lastSpringFrost,
      place.firstAutumnFrost,
      place.sourceName,
      place.sourceUrl,
    ].map(sql).join(", ")}) on conflict (id) do nothing;`,
  );
}

const byId = new Map(VEGETABLES.map((vegetable) => [vegetable.id, vegetable]));
for (const variety of varietyFile.varieties as VarietySeed[]) {
  const vegetable = byId.get(variety.vegetableId);
  if (!vegetable) continue;
  const values = {
    name: vegetable.name,
    cultivar: variety.cultivar,
    category: vegetable.category,
    plantingMethod: variety.plantingMethod ?? vegetable.plantingMethod,
    daysToMaturity: variety.daysToMaturity ?? vegetable.daysToMaturity,
    daysInNursery: variety.daysInNursery ?? vegetable.daysInNursery,
    harvestWindowDays: variety.harvestWindowDays ?? vegetable.harvestWindowDays,
    rowsPerBed: variety.rowsPerBed ?? vegetable.rowsPerBed,
    inRowSpacingIn: inches(variety.inRowSpacingCm ?? vegetable.inRowSpacingCm),
    yieldPer100BedFeet: variety.yieldPer100BedFeet ?? vegetable.yieldPer100BedFeet,
    yieldUnit: variety.yieldUnit ?? vegetable.yieldUnit,
    color: vegetable.color,
    notes: variety.notes ?? vegetable.notes,
    vegetableId: vegetable.id,
    family: vegetable.family,
    frostTolerance: vegetable.frostTolerance,
    minSoilTempC: vegetable.minSoilTempC,
    supplier: variety.supplier,
    sourceName: variety.sourceName,
    sourceUrl: variety.sourceUrl,
    betweenRowCm: variety.betweenRowCm ?? vegetable.betweenRowCm,
    germinationTempMin: variety.germinationTempMin ?? vegetable.germinationTempMin,
    germinationTempMax: variety.germinationTempMax ?? vegetable.germinationTempMax,
    germinationDaysMin: variety.germinationDaysMin ?? vegetable.germinationDaysMin,
    germinationDaysMax: variety.germinationDaysMax ?? vegetable.germinationDaysMax,
    sowIndoorsStart: variety.sowIndoorsStart ?? vegetable.sowIndoors?.[0] ?? null,
    sowIndoorsEnd: variety.sowIndoorsEnd ?? vegetable.sowIndoors?.[1] ?? null,
    sowOutdoorsStart: variety.sowOutdoorsStart ?? vegetable.sowOutdoors?.[0] ?? null,
    sowOutdoorsEnd: variety.sowOutdoorsEnd ?? vegetable.sowOutdoors?.[1] ?? null,
    transplantStart: variety.transplantStart ?? vegetable.transplant?.[0] ?? null,
    transplantEnd: variety.transplantEnd ?? vegetable.transplant?.[1] ?? null,
    hardinessNotes: vegetable.notes,
  };
  lines.push(
    `insert into public.veg_crops (id, farm_id, name, cultivar, category, planting_method, days_to_maturity, days_in_nursery, harvest_window_days, rows_per_bed, in_row_spacing_in, yield_per_100_bed_feet, yield_unit, color, notes, vegetable_id, family, frost_tolerance, min_soil_temp_c, supplier, source_name, source_url, between_row_cm, germination_temp_min, germination_temp_max, germination_days_min, germination_days_max, sow_indoors_start, sow_indoors_end, sow_outdoors_start, sow_outdoors_end, transplant_start, transplant_end, hardiness_notes, yield_is_estimate, dtm_is_typical, user_created, rotation_family) values (${[
      variety.id,
      null,
      values.name,
      values.cultivar,
      values.category,
      values.plantingMethod,
      values.daysToMaturity,
      values.daysInNursery,
      values.harvestWindowDays,
      values.rowsPerBed,
      values.inRowSpacingIn,
      values.yieldPer100BedFeet,
      values.yieldUnit,
      values.color,
      values.notes,
      values.vegetableId,
      values.family,
      values.frostTolerance,
      values.minSoilTempC,
      values.supplier,
      values.sourceName,
      values.sourceUrl,
      values.betweenRowCm,
      values.germinationTempMin,
      values.germinationTempMax,
      values.germinationDaysMin,
      values.germinationDaysMax,
      values.sowIndoorsStart,
      values.sowIndoorsEnd,
      values.sowOutdoorsStart,
      values.sowOutdoorsEnd,
      values.transplantStart,
      values.transplantEnd,
      values.hardinessNotes,
      variety.yieldIsEstimate === false ? false : true,
      Boolean(variety.dtmIsTypical),
      false,
      null,
    ].map(sql).join(", ")}) on conflict (id) do nothing;`,
  );
}

for (const crop of CROPS) {
  const alias = NAME_ALIAS[crop.name.toLowerCase()] ?? crop.name;
  const vegetable: VegetableSeed | undefined = vegetableForName(alias);
  if (!vegetable) continue;
  lines.push(
    `update public.veg_crops set vegetable_id = ${sql(vegetable.id)}, family = ${sql(vegetable.family)}, frost_tolerance = ${sql(vegetable.frostTolerance)}, min_soil_temp_c = ${sql(vegetable.minSoilTempC)}, rotation_family = null where id = ${sql(crop.id)} and farm_id is null;`,
  );
}

const target = new URL("../supabase/migrations/20261126120000_veg.sql", import.meta.url);
const current = require("node:fs").readFileSync(target, "utf8");
if (!current.includes("insert into public.veg_vegetables")) {
  writeFileSync(target, `${current}\n${lines.join("\n")}\n`);
}
console.log("catalogue statements", lines.length);
