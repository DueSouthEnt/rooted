import { describe, expect, it } from "vitest";
import { bedsEmptyInMonth, bedWeekUtilisation, classifyBeds, consecutiveBeds, freeBedIds, groundSpan, longestOpenGap } from "@/lib/occupancy";
import type { PlantingDates } from "@/lib/schedule";

function planting(partial: Partial<PlantingDates> & Pick<PlantingDates, "id" | "fieldDate" | "bloomEnd">): PlantingDates {
  return {
    flowerSlug: "calendula",
    flowerName: "Calendula",
    colour: "#e39b2b",
    variety: "Indian Prince",
    method: "direct",
    nurseryStart: null,
    bloomStart: partial.fieldDate,
    liftDate: null,
    firstBloomYear: 2027,
    spansYears: false,
    bedId: null,
    ...partial,
  };
}

describe("bed occupancy", () => {
  it("keeps an annual off the bed until it is planted, and releases it after the last cut", () => {
    const row = planting({ id: "a", fieldDate: "2027-04-01", bloomStart: "2027-06-01", bloomEnd: "2027-07-15", nurseryStart: "2027-03-01", bedId: "bed-1" });
    const span = groundSpan(row, 2027);
    expect(span).toEqual({ start: "2027-04-01", end: "2027-07-15" });
    expect(freeBedIds([row], ["bed-1", "bed-2"], "2027-03-01", "2027-03-20")).toEqual(["bed-1", "bed-2"]);
    expect(freeBedIds([row], ["bed-1", "bed-2"], "2027-05-01", "2027-05-20")).toEqual(["bed-2"]);
    expect(freeBedIds([row], ["bed-1"], "2027-07-16", "2027-08-01")).toEqual(["bed-1"]);
  });

  it("lets a perennial hold the bed for the rest of the year and the years after", () => {
    const peony = planting({
      id: "p",
      method: "crown",
      spansYears: true,
      fieldDate: "2026-10-09",
      bloomStart: "2029-05-10",
      bloomEnd: "2029-05-31",
      firstBloomYear: 2029,
      bedId: "bed-1",
    });
    expect(groundSpan(peony, 2027)).toEqual({ start: "2027-01-01", end: "2027-12-31" });
    expect(freeBedIds([peony], ["bed-1", "bed-2"], "2028-06-01", "2028-07-01")).toEqual(["bed-2"]);
  });

  it("refuses a drop that would overlap, including the shared end day", () => {
    const row = planting({ id: "a", fieldDate: "2027-04-01", bloomEnd: "2027-07-15", bedId: "bed-1" });
    expect(freeBedIds([row], ["bed-1"], "2027-07-15", "2027-07-20")).toEqual([]);
    expect(freeBedIds([row], ["bed-1"], "2027-07-16", "2027-08-01", "a")).toEqual(["bed-1"]);
  });

  it("treats the planting being moved as free, and marks the other bed busy", () => {
    const staying = planting({ id: "stay", fieldDate: "2027-05-01", bloomEnd: "2027-08-01", bedId: "bed-2" });
    const moving = planting({ id: "move", fieldDate: "2027-05-01", bloomEnd: "2027-08-01", bedId: "bed-1" });
    const free = freeBedIds([staying, moving], ["bed-1", "bed-2", "bed-3"], "2027-05-01", "2027-08-01", "move");
    expect(free).toEqual(["bed-1", "bed-3"]);
    expect(classifyBeds(["bed-1", "bed-2", "bed-3"], free)).toEqual([
      { id: "bed-1", state: "free" },
      { id: "bed-2", state: "busy" },
      { id: "bed-3", state: "free" },
    ]);
  });

  it("only accepts a run of consecutive free beds", () => {
    const ordered = ["b1", "b2", "b3", "b4"];
    expect(consecutiveBeds(ordered, "b2", 2, ["b2", "b3", "b4"])).toEqual(["b2", "b3"]);
    expect(consecutiveBeds(ordered, "b2", 2, ["b2", "b4"])).toBeNull();
    expect(consecutiveBeds(ordered, "b4", 2, ordered)).toBeNull();
    expect(consecutiveBeds(ordered, "b1", 1, ["b1"])).toEqual(["b1"]);
  });

  it("counts empty beds in a month and bed-weeks used", () => {
    const row = planting({ id: "a", fieldDate: "2027-06-01", bloomEnd: "2027-06-20", bedId: "bed-1" });
    expect(bedsEmptyInMonth(["bed-1", "bed-2"], [row], 2027, 6)).toEqual(["bed-2"]);
    expect(bedsEmptyInMonth(["bed-1", "bed-2"], [row], 2027, 8)).toEqual(["bed-1", "bed-2"]);
    const use = bedWeekUtilisation(["bed-1", "bed-2"], [row], 2027);
    expect(use.totalWeeks).toBeGreaterThan(use.usedWeeks);
    expect(use.percent).toBeGreaterThan(0);
    expect(use.percent).toBeLessThan(20);
  });

  it("finds the longest gap a quick crop could fill", () => {
    const row = planting({ id: "a", fieldDate: "2027-04-01", bloomEnd: "2027-05-31", bedId: "bed-1" });
    const gap = longestOpenGap(["bed-1", "bed-2"], [row], 2027, "2027-06-01");
    expect(gap?.bedId).toBe("bed-1");
    expect(gap && gap.days).toBeGreaterThan(100);
    const later = longestOpenGap(["bed-1"], [row], 2027, "2027-06-01");
    expect(later?.start).toBe("2027-06-01");
  });
});
