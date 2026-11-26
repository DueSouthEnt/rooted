import { describe, expect, it } from "vitest";
import { reconcileAutoTasks, tasksForPlanting } from "@/lib/veg/planning";

describe("tasksForPlanting", () => {
  it("builds the nursery, field, weed, and harvest jobs", () => {
    const tasks = tasksForPlanting({
      cropName: "Tomato",
      cultivar: "BHN 589",
      plantingMethod: "transplanted",
      nurseryStartDate: "2026-03-01",
      daysInNursery: 42,
      daysToMaturity: 70,
      fieldPlantingDate: "2026-04-12",
      firstHarvestDate: "2026-06-21",
      lastHarvestDate: "2026-09-01",
      bedLabels: ["Propagation House · Bed 1"],
    });
    expect(tasks.map((task) => task.taskKey)).toEqual([
      "nursery_seed",
      "pot_on",
      "harden_off",
      "bed_prep",
      "transplant",
      "cultivate_14",
      "cultivate_28",
      "harvest_start",
      "harvest_end",
    ]);
    expect(tasks.find((task) => task.taskKey === "bed_prep")?.dueDate).toBe("2026-04-05");
    expect(tasks.find((task) => task.taskKey === "harvest_end")?.title).toContain("Propagation House · Bed 1");
  });

  it("skips the later weeding on a short crop", () => {
    const tasks = tasksForPlanting({
      cropName: "Radish",
      cultivar: "French Breakfast",
      plantingMethod: "direct_seeded",
      nurseryStartDate: null,
      daysToMaturity: 25,
      fieldPlantingDate: "2026-11-18",
      firstHarvestDate: "2026-12-13",
      lastHarvestDate: "2026-12-19",
    });
    expect(tasks.map((task) => task.taskKey)).not.toContain("cultivate_28");
    expect(tasks.map((task) => task.taskKey)).toContain("direct_seed");
  });
});

describe("reconcileAutoTasks", () => {
  const drafts = tasksForPlanting({
    cropName: "Beet",
    cultivar: "Detroit Dark Red",
    plantingMethod: "direct_seeded",
    nurseryStartDate: null,
    daysToMaturity: 55,
    fieldPlantingDate: "2026-05-11",
    firstHarvestDate: "2026-07-05",
    lastHarvestDate: "2026-07-25",
  });

  it("moves an open auto task when the planting dates change", () => {
    const result = reconcileAutoTasks(
      [{ id: "t1", taskKey: "direct_seed", status: "open", manuallyEdited: false, dueDate: "2026-05-04" }],
      drafts,
    );
    expect(result.update.map((item) => item.draft.dueDate)).toContain("2026-05-11");
  });

  it("leaves a completed or hand-edited task on its old date", () => {
    const result = reconcileAutoTasks(
      [
        { id: "done", taskKey: "direct_seed", status: "done", manuallyEdited: false, dueDate: "2026-05-04" },
        { id: "moved", taskKey: "cultivate_14", status: "open", manuallyEdited: true, dueDate: "2026-05-20" },
      ],
      drafts,
    );
    expect(result.update).toEqual([]);
    expect(result.deleteIds).toEqual([]);
    expect(result.insert.map((task) => task.taskKey)).not.toContain("direct_seed");
    expect(result.insert.map((task) => task.taskKey)).not.toContain("cultivate_14");
  });
});
