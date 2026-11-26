import { describe, expect, it } from "vitest";
import {
  blockSpanForBeds,
  DEFAULT_BED_LENGTH_M,
  displayOfMetres,
  lengthClashMessage,
  matchingPreset,
  metresFromDisplay,
  plantingFitsBed,
  shiftIsoDate,
  standardBedLengthMetres,
} from "@/lib/veg/bed-length";

describe("standard bed length", () => {
  it("defaults to 15 metres", () => {
    expect(DEFAULT_BED_LENGTH_M).toBe(15);
    expect(standardBedLengthMetres(null)).toBe(15);
    expect(standardBedLengthMetres(0)).toBe(15);
  });

  it("treats 15 m as 50 ft and 30 m as 100 ft", () => {
    expect(matchingPreset(15)).toBe(15);
    expect(matchingPreset(30)).toBe(30);
    expect(matchingPreset(12)).toBeNull();
    expect(displayOfMetres(15, "ft")).toBeCloseTo(49.21, 1);
    expect(metresFromDisplay(50, "ft")).toBeCloseTo(15.24, 2);
  });

  it("converts a custom length from the unit on screen", () => {
    expect(metresFromDisplay(10, "m")).toBe(10);
    expect(metresFromDisplay(10, "ft")).toBeCloseTo(3.048, 3);
  });
});

describe("planting length against a bed", () => {
  it("refuses a 30 m planting on a 15 m bed", () => {
    expect(plantingFitsBed(30, 15)).toBe(false);
    expect(lengthClashMessage(30, 15, "North")).toContain("30 m");
    expect(lengthClashMessage(30, 15, "North")).toContain("15 m");
  });

  it("allows a planting that is shorter than the bed", () => {
    expect(plantingFitsBed(15, 30)).toBe(true);
    expect(plantingFitsBed(15, 15)).toBe(true);
  });
});

describe("block span from typed dimensions", () => {
  it("uses the bed length as the block length and widens the block for the paths", () => {
    const span = blockSpanForBeds(2, 15, 1.2, 0.45);
    expect(span.spanLengthM).toBe(15);
    expect(span.spanWidthM).toBeCloseTo(2.85, 2);
  });
});

describe("shifting a planting", () => {
  it("moves every date by the same number of days", () => {
    expect(shiftIsoDate("2026-05-01", 7)).toBe("2026-05-08");
    expect(shiftIsoDate(null, 7)).toBeNull();
  });
});
