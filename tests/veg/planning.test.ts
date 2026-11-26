import { describe, expect, it } from "vitest";
import { materializeDemo } from "@/lib/veg/demo-plan";
import { addDaysISO, startOfWeekMonday } from "@/lib/veg/dates";
import {
  blockCode,
  buildPlan,
  distributeYield,
  findOverlaps,
  planBedChanges,
  plantingPhase,
  predictYield,
  rangesOverlap,
  schedulePlanting,
  tasksForPlanting,
  weeklyHarvest,
} from "@/lib/veg/planning";
import { CROPS } from "@/lib/veg/catalog";
import type { BedMeasure, Occupant } from "@/lib/veg/types";
import { bedFeetOf } from "@/lib/veg/planning";
import { toFeet } from "@/lib/veg/units";

const tomato = CROPS.find((crop) => crop.id === "crop_tomato_bhn589")!;
const spinach = CROPS.find((crop) => crop.id === "crop_spinach_space")!;
const salad = CROPS.find((crop) => crop.id === "crop_salad_encore")!;

function bed(partial: Partial<BedMeasure> & Pick<BedMeasure, "id" | "label">): BedMeasure {
  return {
    blockId: "block",
    blockName: "Block",
    length: 100,
    width: 2.5,
    unit: "ft",
    ...partial,
  };
}

describe("schedulePlanting", () => {
  it("backs a transplant up from a target harvest and counts the window inclusively", () => {
    const schedule = schedulePlanting({
      plantingMethod: "transplanted",
      daysToMaturity: 30,
      daysInNursery: 21,
      harvestWindowDays: 10,
      dateMode: "target_harvest",
      anchorDate: "2026-06-01",
    });
    expect(schedule).toEqual({
      nurseryStartDate: "2026-04-11",
      fieldPlantingDate: "2026-05-02",
      firstHarvestDate: "2026-06-01",
      lastHarvestDate: "2026-06-10",
    });
  });

  it("ignores nursery days for direct seeding", () => {
    const schedule = schedulePlanting({
      plantingMethod: "direct_seeded",
      daysToMaturity: 38,
      daysInNursery: 28,
      harvestWindowDays: 1,
      dateMode: "field_planting",
      anchorDate: "2026-03-10",
    });
    expect(schedule.nurseryStartDate).toBeNull();
    expect(schedule.fieldPlantingDate).toBe("2026-03-10");
    expect(schedule.firstHarvestDate).toBe("2026-04-17");
    expect(schedule.lastHarvestDate).toBe("2026-04-17");
  });

  it("steps successions from the date the grower locked", () => {
    const result = buildPlan(
      {
        cropId: salad.id,
        plantingMethod: "direct_seeded",
        dateMode: "field_planting",
        anchorDate: "2026-04-01",
        bedIds: ["a", "b", "c"],
        unassignedBedCount: 0,
        unassignedBedLength: 0,
        unassignedUnit: "ft",
        successionCount: 3,
        successionIntervalDays: 14,
        placement: "rotate",
        bedsPerPlanting: 1,
        followUpCropId: null,
        followUpGapDays: 1,
        notes: "",
      },
      [salad],
      [bed({ id: "a", label: "A" }), bed({ id: "b", label: "B" }), bed({ id: "c", label: "C" })],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plantings.map((planting) => planting.schedule.fieldPlantingDate)).toEqual([
      "2026-04-01",
      "2026-04-15",
      "2026-04-29",
    ]);
    expect(result.plantings.map((planting) => planting.bedIds)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("schedules a follow-up the day after harvest and starts its nursery early", () => {
    const result = buildPlan(
      {
        cropId: spinach.id,
        plantingMethod: "direct_seeded",
        dateMode: "field_planting",
        anchorDate: "2026-03-10",
        bedIds: ["a"],
        unassignedBedCount: 0,
        unassignedBedLength: 0,
        unassignedUnit: "ft",
        successionCount: 1,
        successionIntervalDays: 14,
        placement: "same_beds",
        bedsPerPlanting: 1,
        followUpCropId: tomato.id,
        followUpGapDays: 1,
        notes: "",
      },
      [spinach, tomato],
      [bed({ id: "a", label: "A", length: 40 })],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parent = result.plantings[0];
    const follow = result.plantings[1];
    expect(follow.schedule.fieldPlantingDate).toBe(addDaysISO(parent.schedule.lastHarvestDate, 1));
    expect(follow.schedule.nurseryStartDate).toBe(
      addDaysISO(follow.schedule.fieldPlantingDate, -tomato.daysInNursery),
    );
    expect(follow.schedule.nurseryStartDate! < parent.schedule.lastHarvestDate).toBe(true);
    expect(result.overlaps).toEqual([]);
  });

  it("warns when the same bed is replanted before harvest ends", () => {
    const result = buildPlan(
      {
        cropId: salad.id,
        plantingMethod: "direct_seeded",
        dateMode: "field_planting",
        anchorDate: "2026-04-01",
        bedIds: ["a"],
        unassignedBedCount: 0,
        unassignedBedLength: 0,
        unassignedUnit: "ft",
        successionCount: 2,
        successionIntervalDays: 14,
        placement: "same_beds",
        bedsPerPlanting: 1,
        followUpCropId: null,
        followUpGapDays: 1,
        notes: "",
      },
      [salad],
      [bed({ id: "a", label: "SF-4" })],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.overlaps).toHaveLength(1);
    expect(result.overlaps[0]?.bedLabel).toBe("SF-4");
  });
});

describe("yield and weeks", () => {
  it("converts metres to bed-feet before applying the yield rate", () => {
    expect(toFeet(30.48, "m")).toBeCloseTo(100, 4);
    const feet = bedFeetOf([{ length: 30.48, unit: "m" }]);
    expect(predictYield(feet, 150)).toBeCloseTo(150, 3);
  });

  it("spreads a harvest window across Monday weeks without losing yield", () => {
    const shares = distributeYield("2026-11-12", "2026-12-02", 21);
    expect(shares.map((share) => share.weekStart)).toEqual([
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
    ]);
    const total = shares.reduce((sum, share) => sum + share.amount, 0);
    expect(total).toBeCloseTo(21, 6);
    expect(shares[0]?.amount).toBeCloseTo(4, 6);
    expect(shares[3]?.amount).toBeCloseTo(3, 6);
  });

  it("treats Monday as the start of the week", () => {
    expect(startOfWeekMonday("2026-11-13")).toBe("2026-11-09");
    expect(startOfWeekMonday("2026-11-15")).toBe("2026-11-09");
    expect(startOfWeekMonday("2026-11-16")).toBe("2026-11-16");
  });
});

describe("overlaps and tasks", () => {
  it("flags a shared day and allows a next-day turnover", () => {
    expect(rangesOverlap("2026-03-01", "2026-03-10", "2026-03-10", "2026-03-12")).toBe(true);
    expect(rangesOverlap("2026-03-01", "2026-03-10", "2026-03-11", "2026-03-12")).toBe(false);
  });

  it("builds nursery, field, cultivation, and harvest tasks", () => {
    const tasks = tasksForPlanting({
      cropName: "Garlic",
      cultivar: "Music",
      plantingMethod: "direct_seeded",
      nurseryStartDate: null,
      fieldPlantingDate: "2026-10-30",
      firstHarvestDate: "2027-06-27",
      bedLabels: ["NF-3"],
    });
    expect(tasks.map((task) => task.taskKey)).toEqual([
      "bed_prep",
      "direct_seed",
      "cultivate_14",
      "cultivate_28",
      "harvest_start",
    ]);
    expect(tasks.find((task) => task.taskKey === "cultivate_14")?.dueDate).toBe("2026-11-13");
    expect(tasks.some((task) => task.taskType === "nursery_seed")).toBe(false);

    const transplanted = tasksForPlanting({
      cropName: "Kale",
      cultivar: "Winterbor",
      plantingMethod: "transplanted",
      nurseryStartDate: "2026-07-06",
      fieldPlantingDate: "2026-08-03",
      firstHarvestDate: "2026-09-27",
      bedLabels: ["NF-4"],
    });
    expect(transplanted[0]).toMatchObject({ taskKey: "nursery_seed", dueDate: "2026-07-06" });
    expect(transplanted.some((task) => task.taskType === "direct_seed")).toBe(false);
  });

  it("names the phase from today's place in the schedule", () => {
    const planting = {
      nurseryStartDate: "2026-07-06",
      fieldPlantingDate: "2026-08-03",
      firstHarvestDate: "2026-09-27",
      lastHarvestDate: "2026-11-15",
    };
    expect(plantingPhase(planting, "2026-07-01")).toBe("upcoming");
    expect(plantingPhase(planting, "2026-07-20")).toBe("nursery");
    expect(plantingPhase(planting, "2026-08-20")).toBe("in_ground");
    expect(plantingPhase(planting, "2026-11-13")).toBe("harvesting");
    expect(plantingPhase(planting, "2026-11-16")).toBe("finished");
  });
});

describe("bed sync", () => {
  it("keeps a hand-resized bed and drops empty beds from the end", () => {
    const result = planBedChanges({
      existing: [
        { id: "1", label: "NF-1", position: 0, length: 100, width: 2.5 },
        { id: "2", label: "NF-2", position: 1, length: 80, width: 2.5 },
        { id: "3", label: "NF-3", position: 2, length: 100, width: 2.5 },
      ],
      bedCount: 2,
      bedLength: 90,
      bedWidth: 3,
      previousLength: 100,
      previousWidth: 2.5,
      makeId: () => "new",
      makeLabel: (position) => `NF-${position + 1}`,
    });
    expect(result.deleteIds).toEqual(["3"]);
    expect(result.beds.map((item) => item.length)).toEqual([90, 80]);
    expect(result.beds.map((item) => item.width)).toEqual([3, 3]);
  });

  it("derives a short block code and avoids collisions", () => {
    expect(blockCode("North Field", [])).toBe("NF");
    expect(blockCode("North Field", ["NF"])).toBe("NF2");
    expect(blockCode("Propagation House", [])).toBe("PH");
  });
});

describe("demo market garden", () => {
  const demo = materializeDemo();

  it("fills the beds without date overlaps", () => {
    expect(demo.overlaps).toEqual([]);
    expect(demo.plantings.length).toBeGreaterThan(30);
    expect(new Set(demo.plantings.flatMap((planting) => planting.bedIds)).size).toBe(16);
  });

  it("still has a harvest in the week of 13 November 2026", () => {
    const active = demo.plantings.filter(
      (planting) =>
        planting.fieldPlantingDate <= "2026-11-13" && planting.lastHarvestDate >= "2026-11-13",
    );
    const names = new Set(active.map((planting) => planting.cropName));
    expect(names.has("Kale")).toBe(true);
    expect(names.has("Carrot")).toBe(true);
    expect(names.has("Spinach")).toBe(true);
    expect(names.has("Baby Lettuce")).toBe(true);
    const week =
      weeklyHarvest(
        active.map((planting) => ({
          ...planting,
          bedLabels: planting.bedLabels.join(", "),
        })),
      ).get("2026-11-09") ?? [];
    const total = week.reduce((sum, line) => sum + line.amount, 0);
    expect(total).toBeGreaterThan(0);
  });

  it("puts the garlic's first cultivation on 13 November", () => {
    const planting = demo.plantings.find((item) => item.id === "plt_garlic_nf3");
    expect(planting?.fieldPlantingDate).toBe("2026-10-30");
    const tasks = tasksForPlanting({
      cropName: planting!.cropName,
      cultivar: planting!.cultivar,
      plantingMethod: planting!.plantingMethod,
      nurseryStartDate: planting!.nurseryStartDate,
      fieldPlantingDate: planting!.fieldPlantingDate,
      firstHarvestDate: planting!.firstHarvestDate,
      bedLabels: planting!.bedLabels,
    });
    expect(tasks.find((task) => task.taskKey === "cultivate_14")?.dueDate).toBe("2026-11-13");
    expect(planting!.firstHarvestDate.startsWith("2027")).toBe(true);
  });

  it("rotates the salad succession every 14 days onto a free bed", () => {
    const salads = demo.plantings
      .filter((planting) => planting.successionGroupId === "succ_salad")
      .sort((a, b) => (a.successionIndex ?? 0) - (b.successionIndex ?? 0));
    expect(salads.map((planting) => planting.fieldPlantingDate)).toEqual([
      "2026-04-01",
      "2026-04-15",
      "2026-04-29",
      "2026-05-13",
      "2026-05-27",
      "2026-06-10",
    ]);
    expect(salads.map((planting) => planting.bedLabels[0])).toEqual([
      "SF-4",
      "SF-5",
      "SF-6",
      "SF-4",
      "SF-5",
      "SF-6",
    ]);
  });

  it("uses every requested market-garden crop at least once", () => {
    const required = [
      "Carrot",
      "Baby Lettuce",
      "Salad Mix",
      "Kale",
      "Spinach",
      "Radish",
      "Tomato",
      "Cucumber",
      "Bush Bean",
      "Beet",
      "Scallion",
      "Zucchini",
      "Basil",
      "Cilantro",
      "Broccoli",
      "Snap Pea",
    ];
    const planted = new Set(demo.plantings.map((planting) => planting.cropName));
    for (const name of required) expect(planted.has(name)).toBe(true);
    expect(CROPS.some((crop) => crop.name === "Swiss Chard")).toBe(true);
  });
});

describe("findOverlaps pairs", () => {
  it("reports each conflicting pair once", () => {
    const occupants: Occupant[] = [
      { key: "a", label: "A", bedId: "bed", bedLabel: "NF-1", start: "2026-05-01", end: "2026-05-20" },
      { key: "b", label: "B", bedId: "bed", bedLabel: "NF-1", start: "2026-05-10", end: "2026-05-30" },
      { key: "c", label: "C", bedId: "other", bedLabel: "NF-2", start: "2026-05-10", end: "2026-05-30" },
    ];
    expect(findOverlaps(occupants)).toHaveLength(1);
  });
});
