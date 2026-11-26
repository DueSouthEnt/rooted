export type Unit = "ft" | "m";

export type BlockType = "open_field" | "greenhouse" | "high_tunnel";

export type PlantingMethod = "direct_seeded" | "transplanted";

export type DateMode = "field_planting" | "target_harvest";

export type Placement = "same_beds" | "rotate";

export type PlantingPhase =
  | "upcoming"
  | "nursery"
  | "in_ground"
  | "harvesting"
  | "finished";

export type TaskType =
  | "nursery_seed"
  | "direct_seed"
  | "transplant"
  | "cultivation"
  | "harvest"
  | "other"
  | "prep_bed"
  | "fertilise"
  | "weeding"
  | "harden_off"
  | "thinning"
  | "trellising"
  | "pot_on"
  | "clear_bed"
  | "sow"
  | (string & {});

export type TaskStatus = "open" | "done";

export type CropTiming = {
  id: string;
  name: string;
  cultivar: string;
  category: string;
  plantingMethod: PlantingMethod;
  daysToMaturity: number;
  daysInNursery: number;
  harvestWindowDays: number;
  rowsPerBed: number;
  inRowSpacingIn: number;
  yieldPer100BedFeet: number;
  yieldUnit: string;
  color: string;
  notes: string;
};

export type BedMeasure = {
  id: string;
  label: string;
  blockId: string;
  blockName: string;
  length: number;
  width: number;
  unit: Unit;
};

export type Schedule = {
  nurseryStartDate: string | null;
  fieldPlantingDate: string;
  firstHarvestDate: string;
  lastHarvestDate: string;
};

export type PlanRequest = {
  cropId: string;
  plantingMethod: PlantingMethod;
  dateMode: DateMode;
  anchorDate: string;
  bedIds: string[];
  unassignedBedCount: number;
  unassignedBedLength: number;
  unassignedUnit: Unit;
  successionCount: number;
  successionIntervalDays: number;
  placement: Placement;
  bedsPerPlanting: number;
  followUpCropId: string | null;
  followUpGapDays: number;
  notes: string;
};

export type ProposedPlanting = {
  key: string;
  cropId: string;
  cropName: string;
  cultivar: string;
  color: string;
  plantingMethod: PlantingMethod;
  dateMode: DateMode;
  anchorDate: string;
  schedule: Schedule;
  bedIds: string[];
  bedLabels: string[];
  bedFeet: number;
  predictedYield: number;
  yieldUnit: string;
  successionIndex: number | null;
  successionCount: number | null;
  isFollowUp: boolean;
  parentKey: string | null;
  notes: string;
};

export type Occupant = {
  key: string;
  label: string;
  bedId: string;
  bedLabel: string;
  start: string;
  end: string;
};

export type Overlap = {
  bedId: string;
  bedLabel: string;
  leftKey: string;
  rightKey: string;
  leftLabel: string;
  rightLabel: string;
  leftStart: string;
  leftEnd: string;
  rightStart: string;
  rightEnd: string;
};

export type TaskDraft = {
  taskKey: string;
  taskType: TaskType;
  dueDate: string;
  title: string;
};

export type BedSyncDraft = {
  id: string;
  label: string;
  position: number;
  length: number;
  width: number;
};
