import type { RhsRating } from "@/lib/hardiness";

export type LifeCycle =
  | "annual"
  | "biennial"
  | "perennial"
  | "bulb"
  | "tuber"
  | "corm"
  | "shrub";

export type HardyClass = "hardy" | "half_hardy" | "tender";
export type ClimatePref = "cool" | "mild" | "warm" | "heat";
export type SowMethod =
  | "direct"
  | "indoor"
  | "either"
  | "tuber"
  | "bulb"
  | "corm"
  | "crown"
  | "division";
export type SunNeed = "full" | "part" | "shade";
export type SupportNeed = "none" | "netting" | "stake" | "trellis" | "corral";
export type Difficulty = "easy" | "moderate" | "advanced";
export type PinchStyle = "none" | "once" | "midseason";
export type FlowerRole =
  | "focal"
  | "filler"
  | "foliage"
  | "spike"
  | "spring"
  | "autumn"
  | "dried";
export type BloomSeason = "spring" | "summer" | "autumn";

export interface Flower {
  slug: string;
  commonName: string;
  latinName: string;
  lifeCycle: LifeCycle;
  hardyClass: HardyClass;
  /** Half-zones: 8 is 8a, 8.5 is 8b. Overwintering range for perennial structures. */
  usdaMin: number;
  usdaMax: number;
  rhs: RhsRating;
  climate: ClimatePref;
  sowMethod: SowMethod;
  autumnSow: boolean;
  /** Weeks before the first autumn frost. */
  autumnSowWeeksBeforeFrost: number | null;
  indoorWeeksBeforeFrost: number | null;
  /** Negative means before the last spring frost. */
  transplantWeeksAfterFrost: number | null;
  directSowWeeksAfterFrost: number | null;
  autumnPlantWeeksBeforeFrost: number | null;
  germTempMinC: number | null;
  germTempMaxC: number | null;
  germDaysMin: number | null;
  germDaysMax: number | null;
  daysFromPlantToBloom: number;
  daysFromSowToBloom: number | null;
  /** If set, bloom is scheduled from the last spring frost instead of days-to-flower. */
  bloomWeeksFromLastFrost: number | null;
  bloomWeeks: number;
  spacingCm: number;
  rowSpacingCm: number;
  heightCm: number;
  sun: SunNeed;
  soil: string;
  successionWeeks: number | null;
  defaultSuccessions: number;
  pinch: PinchStyle;
  pinchDaysAfterPlant: number | null;
  /** Used for autumn-sown crops pinched in late winter, not three weeks after sowing. */
  pinchWeeksFromLastFrost: number | null;
  support: SupportNeed;
  supportDaysAfterPlant: number | null;
  harvestStage: string;
  vaseLifeDaysMin: number;
  vaseLifeDaysMax: number;
  pestsDiseases: string;
  overwintering: string;
  yearsToEstablish: number;
  difficulty: Difficulty;
  roles: FlowerRole[];
  bloomSeasons: BloomSeason[];
  colour: string;
  varieties: string;
  notes: string;
  caution: string | null;
  /** Lift in autumn when the site is colder than this RHS band. */
  liftIfColderThanRhs: RhsRating | null;
  heatSensitive: boolean;
  minSeasonDays: number | null;
  needsWinterChill: boolean;
  deadhead: boolean;
  hungry: boolean;
  biennialSummerSow: boolean;
  presprout: boolean;
  prep: string | null;
}

export type FlowerInput = Pick<
  Flower,
  | "slug"
  | "commonName"
  | "latinName"
  | "lifeCycle"
  | "hardyClass"
  | "usdaMin"
  | "usdaMax"
  | "rhs"
  | "climate"
  | "sowMethod"
  | "daysFromPlantToBloom"
  | "bloomWeeks"
  | "spacingCm"
  | "rowSpacingCm"
  | "heightCm"
  | "sun"
  | "soil"
  | "harvestStage"
  | "vaseLifeDaysMin"
  | "vaseLifeDaysMax"
  | "pestsDiseases"
  | "overwintering"
  | "varieties"
  | "notes"
  | "colour"
  | "roles"
  | "bloomSeasons"
> &
  Partial<
    Omit<
      Flower,
      | "slug"
      | "commonName"
      | "latinName"
      | "lifeCycle"
      | "hardyClass"
      | "usdaMin"
      | "usdaMax"
      | "rhs"
      | "climate"
      | "sowMethod"
      | "daysFromPlantToBloom"
      | "bloomWeeks"
      | "spacingCm"
      | "rowSpacingCm"
      | "heightCm"
      | "sun"
      | "soil"
      | "harvestStage"
      | "vaseLifeDaysMin"
      | "vaseLifeDaysMax"
      | "pestsDiseases"
      | "overwintering"
      | "varieties"
      | "notes"
      | "colour"
      | "roles"
      | "bloomSeasons"
    >
  >;

export function defineFlower(input: FlowerInput): Flower {
  return {
    autumnSow: false,
    autumnSowWeeksBeforeFrost: null,
    indoorWeeksBeforeFrost: null,
    transplantWeeksAfterFrost: null,
    directSowWeeksAfterFrost: null,
    autumnPlantWeeksBeforeFrost: null,
    germTempMinC: null,
    germTempMaxC: null,
    germDaysMin: null,
    germDaysMax: null,
    daysFromSowToBloom: null,
    bloomWeeksFromLastFrost: null,
    successionWeeks: null,
    defaultSuccessions: 1,
    pinch: "none",
    pinchDaysAfterPlant: null,
    pinchWeeksFromLastFrost: null,
    support: "none",
    supportDaysAfterPlant: null,
    yearsToEstablish: 1,
    difficulty: "easy",
    caution: null,
    liftIfColderThanRhs: null,
    heatSensitive: false,
    minSeasonDays: null,
    needsWinterChill: false,
    deadhead: input.lifeCycle === "annual" || input.lifeCycle === "biennial",
    hungry: false,
    biennialSummerSow: false,
    presprout: false,
    prep: null,
    ...input,
  };
}

export function vaseLifeLabel(flower: Flower): string {
  if (flower.vaseLifeDaysMin === flower.vaseLifeDaysMax) {
    return `${flower.vaseLifeDaysMin} days`;
  }
  return `${flower.vaseLifeDaysMin}–${flower.vaseLifeDaysMax} days`;
}

export function lifeCycleLabel(lifeCycle: Flower["lifeCycle"]): string {
  switch (lifeCycle) {
    case "annual":
      return "Annual";
    case "biennial":
      return "Biennial";
    case "perennial":
      return "Perennial";
    case "bulb":
      return "Bulb";
    case "tuber":
      return "Tuber";
    case "corm":
      return "Corm";
    case "shrub":
      return "Shrub";
  }
}

export function hardyLabel(hardyClass: Flower["hardyClass"]): string {
  switch (hardyClass) {
    case "hardy":
      return "Hardy";
    case "half_hardy":
      return "Half-hardy";
    case "tender":
      return "Tender";
  }
}
