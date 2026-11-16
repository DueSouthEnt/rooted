import { describe, expect, it } from "vitest";
import { placeSuccessionSeries, successionDefaults, successionEligible, successionWindows, cutAndComeAgain } from "@/lib/succession";
import type { PlantingDates } from "@/lib/schedule";

const base = {
  nurseryStart: "2027-03-01",
  fieldDate: "2027-03-29",
  bloomStart: "2027-05-13",
  bloomEnd: "2027-07-21",
  liftDate: null,
  firstBloomYear: 2027,
};

function row(partial: Partial<PlantingDates> & Pick<PlantingDates, "id" | "fieldDate" | "bloomEnd">): PlantingDates {
  return {
    flowerSlug: "sunflower",
    flowerName: "Sunflower",
    colour: "#e2b15a",
    variety: "ProCut Orange",
    method: "direct",
    nurseryStart: null,
    bloomStart: partial.fieldDate,
    liftDate: null,
    firstBloomYear: 2027,
    spansYears: false,
    bedId: null,
    successionIndex: 1,
    ...partial,
  };
}

describe("succession sowings", () => {
  it("offsets each sowing by the interval and leaves the first alone", () => {
    const windows = successionWindows(base, 3, 21);
    expect(windows).toHaveLength(3);
    expect(windows[0].fieldDate).toBe("2027-03-29");
    expect(windows[1].fieldDate).toBe("2027-04-19");
    expect(windows[2].bloomStart).toBe("2027-06-24");
    expect(windows[2].bloomEnd > windows[1].bloomEnd).toBe(true);
  });

  it("offers successions for annuals, not for plants that stay in the ground", () => {
    expect(successionEligible("annual")).toBe(true);
    expect(successionEligible("perennial")).toBe(false);
    expect(successionEligible("tuber")).toBe(false);
    expect(successionDefaults({ successionWeeks: 3, defaultSuccessions: 3 })).toEqual({ count: 3, intervalDays: 21 });
    expect(cutAndComeAgain({ deadhead: true, successionWeeks: null })).toBe(true);
    expect(cutAndComeAgain({ deadhead: true, successionWeeks: 3 })).toBe(false);
  });

  it("puts the next sowing back on the same bed once the first has finished, otherwise the nearest free bed", () => {
    const first = row({ id: "s1", fieldDate: "2027-04-01", bloomEnd: "2027-05-01", successionIndex: 1, successionGroup: "g" });
    const second = row({ id: "s2", fieldDate: "2027-05-15", bloomEnd: "2027-06-15", successionIndex: 2, successionGroup: "g" });
    const third = row({ id: "s3", fieldDate: "2027-05-20", bloomEnd: "2027-06-20", successionIndex: 3, successionGroup: "g" });
    const blocker = row({ id: "other", fieldDate: "2027-05-15", bloomEnd: "2027-08-01", bedId: "bed-2" });
    const placed = placeSuccessionSeries({
      series: [first, second, third],
      startBedId: "bed-1",
      blockBedIds: ["bed-1", "bed-2", "bed-3"],
      plantings: [blocker],
    });
    expect(placed.placed).toEqual([
      { id: "s1", bedId: "bed-1" },
      { id: "s2", bedId: "bed-1" },
      { id: "s3", bedId: "bed-3" },
    ]);
    expect(placed.left).toEqual([]);
  });

  it("leaves a sowing in the tray when the block has nowhere free", () => {
    const first = row({ id: "s1", fieldDate: "2027-04-01", bloomEnd: "2027-05-01", successionIndex: 1 });
    const second = row({ id: "s2", fieldDate: "2027-04-10", bloomEnd: "2027-05-10", successionIndex: 2 });
    const full = row({ id: "other", fieldDate: "2027-04-01", bloomEnd: "2027-08-01", bedId: "bed-2" });
    const placed = placeSuccessionSeries({
      series: [first, second],
      startBedId: "bed-1",
      blockBedIds: ["bed-1", "bed-2"],
      plantings: [full],
    });
    expect(placed.placed).toEqual([{ id: "s1", bedId: "bed-1" }]);
    expect(placed.left).toEqual(["s2"]);
  });
});
