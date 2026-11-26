import type {
  BlockType,
  DateMode,
  PlantingMethod,
  PlantingPhase,
  TaskType,
} from "@/lib/veg/types";

export const BLOCK_TYPE_LABEL: Record<BlockType, string> = {
  open_field: "Open field",
  greenhouse: "Greenhouse",
  high_tunnel: "High tunnel",
};

export const METHOD_LABEL: Record<PlantingMethod, string> = {
  direct_seeded: "Direct seeded",
  transplanted: "Transplanted",
};

export const DATE_MODE_LABEL: Record<DateMode, string> = {
  field_planting: "Field planting date",
  target_harvest: "Target first harvest",
};

export const PHASE_CLASS: Record<PlantingPhase, string> = {
  upcoming: "bg-muted text-muted-foreground",
  nursery: "bg-wheat text-foreground",
  in_ground: "bg-secondary text-secondary-foreground",
  harvesting: "bg-success text-success-foreground",
  finished: "bg-muted text-muted-foreground",
};

export const PHASE_LABEL: Record<PlantingPhase, string> = {
  upcoming: "Upcoming",
  nursery: "In the nursery",
  in_ground: "In the ground",
  harvesting: "Harvesting",
  finished: "Finished",
};

export const TASK_TYPE_LABEL: Record<string, string> = {
  nursery_seed: "Sow",
  direct_seed: "Sow",
  sow: "Sow",
  pot_on: "Pot on",
  transplant: "Transplant",
  cultivation: "Weeding",
  weeding: "Weeding",
  harvest: "Harvest",
  clear_bed: "Clear bed",
  prep_bed: "Prep the bed",
  fertilise: "Fertilise",
  harden_off: "Hardening off",
  thinning: "Thinning out",
  trellising: "Trellising",
  other: "Other",
};

/** Types offered when someone adds a job by hand. */
export const TASK_TYPE_CHOICES: { id: string; label: string }[] = [
  ["prep_bed", "Prep the bed"],
  ["fertilise", "Fertilise"],
  ["weeding", "Weeding"],
  ["harden_off", "Hardening off"],
  ["thinning", "Thinning out"],
  ["trellising", "Trellising"],
  ["sow", "Sow"],
  ["pot_on", "Pot on"],
  ["transplant", "Transplant"],
  ["harvest", "Harvest"],
  ["clear_bed", "Clear bed"],
].map(([id, label]) => ({ id, label }));

export const TASK_TYPES: TaskType[] = TASK_TYPE_CHOICES.map((item) => item.id);

export function taskTypeLabel(id: string, custom: { id: string; name: string }[] = []): string {
  return TASK_TYPE_LABEL[id] ?? custom.find((item) => item.id === id)?.name ?? id;
}

export const CATEGORIES = [
  "Greens",
  "Roots",
  "Fruiting",
  "Brassicas",
  "Legumes",
  "Alliums",
  "Herbs",
] as const;
