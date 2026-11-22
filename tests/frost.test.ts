import { describe, expect, it } from "vitest";
import { estimateClimate, planningWindow, seasonLengthFromParts } from "@/lib/climate";
import {
  defaultSeasonYear,
  diffDays,
  formatDate,
  startOfWeekMonday,
} from "@/lib/dates";
import { rhsFromMinC, usdaFromMinC } from "@/lib/hardiness";
import { matchPostcode, nearestStation, searchStations } from "@/lib/places";
import { stations } from "@/data/stations";

describe("frost dates", () => {
  it("measures a northern season from last spring frost to first autumn frost", () => {
    expect(diffDays("2026-04-15", "2026-10-15")).toBe(183);
    expect(seasonLengthFromParts("north", false, 4, 15, 10, 15)).toBe(183);
  });

  it("wraps a southern season across the new year", () => {
    expect(seasonLengthFromParts("south", false, 10, 15, 4, 15)).toBe(182);
    const window = planningWindow(
      {
        hemisphere: "south",
        frostFree: false,
        lastSpringMonth: 10,
        lastSpringDay: 15,
        firstAutumnMonth: 4,
        firstAutumnDay: 15,
        seasonLengthDays: 182,
      },
      2026,
    );
    expect(window.lastSpringFrost).toBe("2026-10-15");
    expect(window.firstAutumnFrost).toBe("2027-04-15");
    expect(window.seasonLengthDays).toBe(diffDays("2026-10-15", "2027-04-15"));
    expect(window.anchored).toBe(false);
  });

  it("derives RHS and USDA bands from the winter minimum", () => {
    expect(rhsFromMinC(-8)).toBe("H4");
    expect(usdaFromMinC(-8)).toBe("8b");
    expect(rhsFromMinC(-12)).toBe("H5");
    expect(rhsFromMinC(2)).toBe("H2");
    expect(rhsFromMinC(-22)).toBe("H7");
  });

  it("finds median frost dates from daily minima", () => {
    const days = [];
    for (const year of [2022, 2023, 2024]) {
      days.push(
        { date: `${year}-01-15`, tMin: -8, tMax: 2 },
        { date: `${year}-04-10`, tMin: -1, tMax: 8 },
        { date: `${year}-04-16`, tMin: 3, tMax: 12 },
        { date: `${year}-07-15`, tMin: 12, tMax: 24 },
        { date: `${year}-10-20`, tMin: -1, tMax: 9 },
        { date: `${year}-10-21`, tMin: 2, tMax: 10 },
      );
    }
    const estimate = estimateClimate(days, "north");
    expect(estimate.frostFree).toBe(false);
    expect(estimate.lastSpringMonth).toBe(4);
    expect(estimate.lastSpringDay).toBe(10);
    expect(estimate.firstAutumnMonth).toBe(10);
    expect(estimate.firstAutumnDay).toBe(20);
    expect(estimate.rhs).toBe("H4");
    expect(estimate.usdaZone).toBe("8b");
    expect(estimate.summer).toBe("mild");
  });

  it("marks a place frost-free when no day reaches 0°C", () => {
    const estimate = estimateClimate(
      [
        { date: "2022-01-10", tMin: 6, tMax: 18 },
        { date: "2022-07-10", tMin: 22, tMax: 32 },
        { date: "2023-01-10", tMin: 7, tMax: 19 },
        { date: "2023-07-10", tMin: 23, tMax: 33 },
      ],
      "north",
    );
    expect(estimate.frostFree).toBe(true);
    expect(estimate.seasonLengthDays).toBe(365);
    const window = planningWindow(estimate, 2027);
    expect(window.anchored).toBe(true);
    expect(window.lastSpringFrost).toBe("2027-03-01");
  });

  it("uses British date order and Monday weeks", () => {
    expect(formatDate("2027-04-15")).toBe("15 April 2027");
    expect(startOfWeekMonday("2026-11-15")).toBe("2026-11-09");
    expect(startOfWeekMonday("2026-11-16")).toBe("2026-11-16");
    expect(defaultSeasonYear("north", "2026-11-15")).toBe(2027);
    expect(defaultSeasonYear("south", "2026-11-15")).toBe(2026);
  });
});

describe("place lookup", () => {
  it("resolves UK postcodes by the longest prefix", () => {
    expect(matchPostcode(stations, "EH1 2NG").map((station) => station.id)).toEqual(["edinburgh"]);
    expect(matchPostcode(stations, "BS1 4ST").map((station) => station.id)).toEqual(["bristol"]);
    expect(matchPostcode(stations, "B1 1AA").map((station) => station.id)).toEqual(["birmingham"]);
    expect(matchPostcode(stations, "BT1 1AA").map((station) => station.id)).toEqual(["belfast"]);
    expect(matchPostcode(stations, "TR18 2AB").map((station) => station.id)).toEqual(["penzance"]);
  });

  it("finds cities by name and the nearest station to a pin", () => {
    expect(searchStations(stations, "York").some((station) => station.id === "york")).toBe(true);
    const nearEdinburgh = nearestStation(stations, 55.95, -3.19);
    expect(nearEdinburgh.id).toBe("edinburgh");
  });
});
