import { describe, expect, it } from "vitest";
import { repeatDates, repeatIntervalDays, slugTaskType } from "@/lib/veg/repeat";
import { plantCountPhrase, plantsPerBed } from "@/lib/veg/planting-form";
import { TASK_TYPE_CHOICES, taskTypeLabel } from "@/lib/veg/labels";

describe("repeatDates", () => {
  it("stops at the harvest end and keeps the interval inside seven weeks", () => {
    expect(repeatDates("2026-05-01", 7, "2026-05-22")).toEqual(["2026-05-01", "2026-05-08", "2026-05-15", "2026-05-22"]);
    expect(repeatDates("2026-05-01", 14, "2026-05-10")).toEqual(["2026-05-01"]);
    expect(repeatIntervalDays(8, "weeks")).toBeNull();
    expect(repeatIntervalDays(7, "weeks")).toBe(49);
    expect(repeatIntervalDays(3, "days")).toBe(3);
  });

  it("does not walk past a missing end", () => {
    expect(repeatDates("2026-05-01", 7, "2026-04-01")).toEqual(["2026-05-01"]);
  });
});

describe("custom task types", () => {
  it("offers the generic jobs and keeps a typed name", () => {
    const labels = TASK_TYPE_CHOICES.map((item) => item.label);
    expect(labels).toEqual([
      "Prep the bed",
      "Fertilise",
      "Weeding",
      "Hardening off",
      "Thinning out",
      "Trellising",
      "Sow",
      "Pot on",
      "Transplant",
      "Harvest",
      "Clear bed",
    ]);
    expect(slugTaskType("Side shoot")).toBe("type-side-shoot");
    expect(taskTypeLabel("type-side-shoot", [{ id: "type-side-shoot", name: "Side shoot" }])).toBe("Side shoot");
    expect(taskTypeLabel("weeding")).toBe("Weeding");
  });
});

describe("plant count without a bed-length field", () => {
  it("uses each bed's real length, or the farm's usual length before a bed is chosen", () => {
    expect(plantsPerBed(10, 3, 25)).toBe(120);
    expect(plantCountPhrase([], 3, 25, 10)).toContain("120");
    expect(plantCountPhrase([], 3, 25, 10)).toContain("usual bed length");
    expect(plantCountPhrase([10, 10], 3, 25, 30)).toBe("About 120 plants per bed.");
    expect(plantCountPhrase([10, 5], 3, 25, 30)).toBe("About 60–120 plants per bed.");
  });
});
