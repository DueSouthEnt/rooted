import { describe, expect, it } from "vitest";
import { assignBeds, availabilityFor, basicPlantingTasks, composePlantingDates, plantCount, type BedOccupancy, type BedSlot } from "@/lib/veg/planting-form";

const beds: BedSlot[] = [
  { id: "a", label: "NF-1", blockId: "north", blockName: "North Field", position: 0 },
  { id: "b", label: "NF-2", blockId: "north", blockName: "North Field", position: 1 },
  { id: "c", label: "NF-3", blockId: "north", blockName: "North Field", position: 2 },
];

describe("composePlantingDates", () => {
  it("turns a direct sow and a harvest window into first and last pick", () => {
    const dates = composePlantingDates({
      method: "direct_seeded",
      nurserySowDate: "2026-01-01",
      daysInNursery: 30,
      fieldDate: "2026-05-04",
      daysToMaturity: 55,
      harvestWindow: 3,
      harvestWindowUnit: "weeks",
      manualFieldDate: null,
      manualFirstHarvest: null,
      manualLastHarvest: null,
    });
    expect(dates.nurseryStartDate).toBeNull();
    expect(dates.fieldPlantingDate).toBe("2026-05-04");
    expect(dates.firstHarvestDate).toBe("2026-06-28");
    expect(dates.harvestWindowDays).toBe(21);
    expect(dates.lastHarvestDate).toBe("2026-07-18");
  });

  it("works a nursery sowing forward to transplant, then to harvest", () => {
    const dates = composePlantingDates({
      method: "transplanted",
      nurserySowDate: "2026-03-01",
      daysInNursery: 42,
      fieldDate: "2026-03-01",
      daysToMaturity: 60,
      harvestWindow: 14,
      harvestWindowUnit: "days",
      manualFieldDate: null,
      manualFirstHarvest: null,
      manualLastHarvest: null,
    });
    expect(dates.nurseryStartDate).toBe("2026-03-01");
    expect(dates.fieldPlantingDate).toBe("2026-04-12");
    expect(dates.firstHarvestDate).toBe("2026-06-11");
    expect(dates.lastHarvestDate).toBe("2026-06-24");
  });

  it("keeps a hand-edited date instead of the calculated one", () => {
    const dates = composePlantingDates({
      method: "transplanted",
      nurserySowDate: "2026-03-01",
      daysInNursery: 42,
      fieldDate: "2026-03-01",
      daysToMaturity: 60,
      harvestWindow: 7,
      harvestWindowUnit: "days",
      manualFieldDate: "2026-04-20",
      manualFirstHarvest: null,
      manualLastHarvest: "2026-07-01",
    });
    expect(dates.computedFieldDate).toBe("2026-04-12");
    expect(dates.fieldPlantingDate).toBe("2026-04-20");
    expect(dates.firstHarvestDate).toBe("2026-06-19");
    expect(dates.lastHarvestDate).toBe("2026-07-01");
  });
});

describe("plantCount", () => {
  it("counts plants from bed length, rows, and spacing", () => {
    expect(plantCount(10, 2, 3, 25)).toBe(3 * 40 * 2);
    expect(plantCount(10, 1, 3, 0)).toBe(0);
  });
});

describe("assignBeds", () => {
  const occupancy: BedOccupancy[] = [
    { plantingId: "may", plantingLabel: "Beet · Detroit Dark Red", bedId: "c", start: "2026-05-04", end: "2026-07-18" },
  ];

  it("refuses a bed that is still cropping and names a free one", () => {
    const result = assignBeds({
      beds,
      occupancy,
      startBedId: "c",
      bedCount: 1,
      start: "2026-06-01",
      end: "2026-07-01",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("NF-3");
      expect(result.message).toContain("Beet · Detroit Dark Red");
      expect(result.message).toContain("NF-1");
    }
  });

  it("allows the same bed once the earlier crop has finished", () => {
    const result = assignBeds({
      beds,
      occupancy,
      startBedId: "c",
      bedCount: 1,
      start: "2026-07-20",
      end: "2026-10-03",
    });
    expect(result).toEqual({ ok: true, bedIds: ["c"] });
  });

  it("fills adjacent free beds and stops when a neighbour clashes", () => {
    expect(assignBeds({ beds, occupancy, startBedId: "a", bedCount: 2, start: "2026-06-01", end: "2026-07-01" })).toEqual({
      ok: true,
      bedIds: ["a", "b"],
    });
    const blocked = assignBeds({ beds, occupancy, startBedId: "b", bedCount: 2, start: "2026-06-01", end: "2026-07-01" });
    expect(blocked.ok).toBe(false);
  });

  it("marks nursery time as not occupying the bed", () => {
    const marks = availabilityFor(beds, occupancy, "2026-04-01", "2026-05-03");
    expect(marks.every((mark) => mark.status === "free")).toBe(true);
  });
});

describe("basicPlantingTasks", () => {
  it("adds sow, pot on, transplant, and harvest for a nursery crop", () => {
    const tasks = basicPlantingTasks({
      cropName: "Tomato",
      cultivar: "BHN 589",
      method: "transplanted",
      nurseryStartDate: "2026-03-01",
      daysInNursery: 42,
      fieldPlantingDate: "2026-04-12",
      firstHarvestDate: "2026-06-11",
    });
    expect(tasks.map((task) => task.taskKey)).toContain("nursery_seed");
    expect(tasks.map((task) => task.taskKey)).toContain("pot_on");
    expect(tasks.map((task) => task.taskKey)).toContain("transplant");
    expect(tasks.map((task) => task.taskKey)).toContain("harvest_start");
  });
});
