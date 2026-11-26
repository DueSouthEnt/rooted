import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a real date.");

export const blockSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name the block.").max(80),
  type: z.enum(["open_field", "greenhouse", "high_tunnel"]),
  bedCount: z.number().int().min(1, "Add at least one bed.").max(80),
  bedLength: z.number().positive("Bed length needs to be greater than zero.").max(2000),
  bedWidth: z.number().positive("Bed width needs to be greater than zero.").max(50),
  pathWidth: z.number().min(0).max(30),
  unit: z.enum(["ft", "m"]),
  notes: z.string().max(2000),
});

export const bedSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1, "Label the bed.").max(40),
  length: z.number().positive().max(2000),
  width: z.number().positive().max(50),
});

export const cropSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name the crop.").max(80),
  cultivar: z.string().trim().min(1, "Name the cultivar.").max(80),
  category: z.string().trim().min(1, "Add a category.").max(40),
  plantingMethod: z.enum(["direct_seeded", "transplanted"]),
  daysToMaturity: z.number().int().min(1, "Days to maturity starts at 1.").max(400),
  daysInNursery: z.number().int().min(0).max(180),
  harvestWindowDays: z.number().int().min(1, "Harvest window is at least 1 day.").max(180),
  rowsPerBed: z.number().int().min(1).max(24),
  inRowSpacingIn: z.number().min(0).max(48),
  yieldPer100BedFeet: z.number().min(0).max(20000),
  yieldUnit: z.string().trim().min(1, "Add a yield unit.").max(24),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #c4622d."),
  notes: z.string().max(2000),
  family: z.string().max(80).optional(),
  frostTolerance: z.enum(["tender", "half_hardy", "hardy"]).optional(),
  supplier: z.string().max(80).optional(),
});

export const planSchema = z.object({
  cropId: z.string().min(1),
  plantingMethod: z.enum(["direct_seeded", "transplanted"]),
  dateMode: z.enum(["field_planting", "target_harvest"]),
  anchorDate: dateString,
  bedIds: z.array(z.string()).max(200),
  unassignedBedCount: z.number().int().min(0).max(500),
  unassignedBedLength: z.number().min(0).max(10000),
  unassignedUnit: z.enum(["ft", "m"]),
  successionCount: z.number().int().min(1).max(24),
  successionIntervalDays: z.number().int().min(1).max(365),
  placement: z.enum(["same_beds", "rotate"]),
  bedsPerPlanting: z.number().int().min(1).max(100),
  followUpCropId: z.string().nullable(),
  followUpGapDays: z.number().int().min(0).max(90),
  notes: z.string().max(2000),
  acknowledgeOverlaps: z.boolean(),
  seasonYear: z.number().int().min(2000).max(2100),
});

export const editPlantingSchema = planSchema
  .pick({
    cropId: true,
    plantingMethod: true,
    dateMode: true,
    anchorDate: true,
    bedIds: true,
    unassignedBedCount: true,
    unassignedBedLength: true,
    unassignedUnit: true,
    notes: true,
    acknowledgeOverlaps: true,
  })
  .extend({ id: z.string().min(1) });

export const manualTaskSchema = z.object({
  title: z.string().trim().min(1, "Name the task.").max(160),
  taskType: z.string().trim().min(1, "Choose a task type.").max(80),
  dueDate: dateString,
  notes: z.string().max(2000),
  plantingId: z.string().nullable().optional(),
  minutes: z.number().int().positive().max(24 * 60).nullable().optional(),
  repeatEveryDays: z.number().int().positive().max(49).nullable().optional(),
  repeatUntil: dateString.nullable().optional(),
});

export function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}
