import { rememberDefs, table } from "@/lib/veg/memory";

const bool = ["userCreated", "manuallyEdited", "useManualFrost", "yieldIsEstimate", "dtmIsTypical"];

export const blocks = table("veg_blocks", {
  id: "id",
  farmId: "farm_id",
  name: "name",
  type: "type",
  bedLength: "bed_length",
  bedWidth: "bed_width",
  pathWidth: "path_width",
  unit: "unit",
  notes: "notes",
  sortOrder: "sort_order",
  farmAreaId: "farm_area_id",
  centerLat: "center_lat",
  centerLng: "center_lng",
  rotationDeg: "rotation_deg",
  spanLengthM: "span_length_m",
  spanWidthM: "span_width_m",
  createdAt: "created_at",
  updatedAt: "updated_at",
});

export const farmAreas = table("veg_farm_areas", {
  id: "id",
  farmId: "farm_id",
  name: "name",
  outlineJson: "outline_json",
  areaM2: "area_m2",
  createdAt: "created_at",
  updatedAt: "updated_at",
});

export const beds = table("veg_beds", {
  id: "id",
  farmId: "farm_id",
  blockId: "block_id",
  label: "label",
  position: "position",
  length: "length",
  width: "width",
  sharedBedId: "shared_bed_id",
  createdAt: "created_at",
  updatedAt: "updated_at",
});

export const crops = table(
  "veg_crops",
  {
    id: "id",
    farmId: "farm_id",
    name: "name",
    cultivar: "cultivar",
    category: "category",
    plantingMethod: "planting_method",
    daysToMaturity: "days_to_maturity",
    daysInNursery: "days_in_nursery",
    harvestWindowDays: "harvest_window_days",
    rowsPerBed: "rows_per_bed",
    inRowSpacingIn: "in_row_spacing_in",
    yieldPer100BedFeet: "yield_per_100_bed_feet",
    yieldUnit: "yield_unit",
    color: "color",
    notes: "notes",
    vegetableId: "vegetable_id",
    family: "family",
    frostTolerance: "frost_tolerance",
    minSoilTempC: "min_soil_temp_c",
    supplier: "supplier",
    sourceName: "source_name",
    sourceUrl: "source_url",
    betweenRowCm: "between_row_cm",
    germinationTempMin: "germination_temp_min",
    germinationTempMax: "germination_temp_max",
    germinationDaysMin: "germination_days_min",
    germinationDaysMax: "germination_days_max",
    sowIndoorsStart: "sow_indoors_start",
    sowIndoorsEnd: "sow_indoors_end",
    sowOutdoorsStart: "sow_outdoors_start",
    sowOutdoorsEnd: "sow_outdoors_end",
    transplantStart: "transplant_start",
    transplantEnd: "transplant_end",
    hardinessNotes: "hardiness_notes",
    yieldIsEstimate: "yield_is_estimate",
    dtmIsTypical: "dtm_is_typical",
    userCreated: "user_created",
    rotationFamily: "rotation_family",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  bool,
);

export const companions = table(
  "veg_companions",
  {
    id: "id",
    farmId: "farm_id",
    cropName: "crop_name",
    otherName: "other_name",
    kind: "kind",
    reason: "reason",
    userCreated: "user_created",
  },
  bool,
);

export const vegetables = table("veg_vegetables", {
  id: "id",
  name: "name",
  family: "family",
  category: "category",
  frostTolerance: "frost_tolerance",
  minSoilTempC: "min_soil_temp_c",
  color: "color",
  notes: "notes",
});

export const frostLocations = table("veg_frost_locations", {
  id: "id",
  country: "country",
  region: "region",
  name: "name",
  latitude: "latitude",
  longitude: "longitude",
  lastSpringFrost: "last_spring_frost",
  firstAutumnFrost: "first_autumn_frost",
  sourceName: "source_name",
  sourceUrl: "source_url",
});

export const farmSettings = table(
  "veg_farm_settings",
  {
    id: "id",
    farmId: "farm_id",
    country: "country",
    locationLabel: "location_label",
    frostLocationId: "frost_location_id",
    latitude: "latitude",
    longitude: "longitude",
    manualLastSpringFrost: "manual_last_spring_frost",
    manualFirstAutumnFrost: "manual_first_autumn_frost",
    useManualFrost: "use_manual_frost",
    rotationYears: "rotation_years",
    standardBedLengthM: "standard_bed_length_m",
  },
  bool,
);

export const plantings = table("veg_plantings", {
  id: "id",
  farmId: "farm_id",
  cropId: "crop_id",
  seasonYear: "season_year",
  plantingMethod: "planting_method",
  dateMode: "date_mode",
  anchorDate: "anchor_date",
  nurseryStartDate: "nursery_start_date",
  fieldPlantingDate: "field_planting_date",
  firstHarvestDate: "first_harvest_date",
  lastHarvestDate: "last_harvest_date",
  bedFeet: "bed_feet",
  predictedYield: "predicted_yield",
  yieldUnit: "yield_unit",
  successionGroupId: "succession_group_id",
  successionIndex: "succession_index",
  successionCount: "succession_count",
  parentPlantingId: "parent_planting_id",
  notes: "notes",
  bedsNeeded: "beds_needed",
  bedLengthM: "bed_length_m",
  rowsPerBed: "rows_per_bed",
  inRowSpacingCm: "in_row_spacing_cm",
  expectedRevenue: "expected_revenue",
  usedDaysToMaturity: "used_days_to_maturity",
  usedDaysInNursery: "used_days_in_nursery",
  usedHarvestWindowDays: "used_harvest_window_days",
  createdAt: "created_at",
  updatedAt: "updated_at",
});

export const plantingBeds = table("veg_planting_beds", {
  farmId: "farm_id",
  plantingId: "planting_id",
  bedId: "bed_id",
});

export const customTaskTypes = table("veg_custom_task_types", {
  id: "id",
  farmId: "farm_id",
  name: "name",
  createdAt: "created_at",
});

export const tasks = table(
  "veg_tasks",
  {
    id: "id",
    farmId: "farm_id",
    plantingId: "planting_id",
    taskKey: "task_key",
    title: "title",
    taskType: "task_type",
    dueDate: "due_date",
    status: "status",
    notes: "notes",
    minutes: "minutes",
    repeatEveryDays: "repeat_every_days",
    repeatUntil: "repeat_until",
    manuallyEdited: "manually_edited",
    completedAt: "completed_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  bool,
);

rememberDefs([blocks, farmAreas, beds, crops, companions, vegetables, frostLocations, farmSettings, plantings, plantingBeds, customTaskTypes, tasks]);
