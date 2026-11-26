import type { FrostTolerance } from "@/lib/veg/frost";
import type {
  BlockType,
  DateMode,
  PlantingMethod,
  TaskStatus,
  TaskType,
  Unit,
} from "@/lib/veg/types";

export type BedView = {
  id: string;
  blockId: string;
  label: string;
  position: number;
  length: number;
  width: number;
  sharedBedId?: string | null;
};

export type BlockView = {
  id: string;
  name: string;
  type: BlockType;
  bedLength: number;
  bedWidth: number;
  pathWidth: number;
  unit: Unit;
  notes: string;
  sortOrder: number;
  farmAreaId: string | null;
  centerLat: number | null;
  centerLng: number | null;
  rotationDeg: number | null;
  spanLengthM: number | null;
  spanWidthM: number | null;
  beds: BedView[];
};

export type FarmAreaView = {
  id: string;
  name: string;
  /** GeoJSON ring, [longitude, latitude]. */
  outline: [number, number][];
  areaM2: number;
};

export type CropView = {
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
  family: string | null;
  frostTolerance: FrostTolerance | null;
  minSoilTempC: number | null;
  supplier: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  betweenRowCm: number | null;
  germinationTempMin: number | null;
  germinationTempMax: number | null;
  germinationDaysMin: number | null;
  germinationDaysMax: number | null;
  sowIndoorsStart: number | null;
  sowIndoorsEnd: number | null;
  sowOutdoorsStart: number | null;
  sowOutdoorsEnd: number | null;
  transplantStart: number | null;
  transplantEnd: number | null;
  hardinessNotes: string | null;
  yieldIsEstimate: boolean;
  dtmIsTypical: boolean;
  userCreated: boolean;
  rotationFamily: string | null;
};

export type PlantingBedView = {
  id: string;
  label: string;
  blockId: string;
  blockName: string;
  position: number;
  length: number;
  width: number;
  unit: Unit;
};

export type PlantingView = {
  id: string;
  cropId: string;
  cropName: string;
  cultivar: string;
  category: string;
  color: string;
  plantingMethod: PlantingMethod;
  daysToMaturity: number;
  daysInNursery: number;
  harvestWindowDays: number;
  yieldPer100BedFeet: number;
  dateMode: DateMode;
  anchorDate: string;
  nurseryStartDate: string | null;
  fieldPlantingDate: string;
  firstHarvestDate: string;
  lastHarvestDate: string;
  bedFeet: number;
  predictedYield: number;
  yieldUnit: string;
  successionGroupId: string | null;
  successionIndex: number | null;
  successionCount: number | null;
  parentPlantingId: string | null;
  parentLabel: string | null;
  notes: string;
  seasonYear: number;
  frostTolerance: FrostTolerance | null;
  rotationFamily: string | null;
  bedsNeeded: number;
  bedLengthM: number | null;
  rowsPerBed: number | null;
  inRowSpacingCm: number | null;
  expectedRevenue: number | null;
  beds: PlantingBedView[];
};

export type TaskView = {
  id: string;
  plantingId: string | null;
  taskKey: string | null;
  title: string;
  taskType: TaskType;
  dueDate: string;
  status: TaskStatus;
  notes: string;
  minutes: number | null;
  repeatEveryDays: number | null;
  repeatUntil: string | null;
  manuallyEdited: boolean;
  seasonYear: number | null;
  cropName: string | null;
  color: string | null;
  bedLabels: string | null;
};
