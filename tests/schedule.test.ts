import { describe, expect, it } from "vitest";
import { flowers } from "@/data/flowers";
import { addDays, diffDays } from "@/lib/dates";
import {
  autumnSowWindow,
  bedOccupancy,
  clashOnBed,
  scheduleFlower,
  shiftDates,
  sowNow,
  visibleInYear,
  yearBars,
  type PlantingDates,
} from "@/lib/schedule";
import type { SitePlan } from "@/lib/tasks";

const site: SitePlan = {
  seasonYear: 2027,
  hemisphere: "north",
  frostFree: false,
  occasionalFrost: false,
  anchored: true,
  lastSpringFrost: "2027-04-12",
  firstAutumnFrost: "2027-11-20",
  seasonLengthDays: 222,
  usdaZone: "9a",
  rhs: "H3",
  summer: "cool",
  tropical: false,
};

function flower(slug: string) {
  const found = flowers.find((item) => item.slug === slug);
  if (!found) throw new Error(slug);
  return found;
}

describe("flower windows", () => {
  it("dates an indoor hardy annual from the last spring frost", () => {
    const window = scheduleFlower(flower("calendula"), site);
    expect(window.method).toBe("indoor");
    expect(window.nurseryStart).toBe(addDays(site.lastSpringFrost, -6 * 7));
    expect(window.fieldDate).toBe(addDays(site.lastSpringFrost, -2 * 7));
    expect(window.bloomStart).toBe(addDays(window.fieldDate, 45));
    expect(diffDays(window.bloomStart, window.bloomEnd) + 1).toBe(10 * 7);
    expect(window.liftDate).toBeNull();
    expect(window.firstBloomYear).toBe(2027);
  });

  it("gives a dahlia a plant-out, a long bloom, and a lift after the autumn frost", () => {
    const window = scheduleFlower(flower("dahlia"), site);
    expect(window.method).toBe("tuber");
    expect(window.fieldDate).toBe(addDays(site.lastSpringFrost, 14));
    expect(window.bloomStart).toBe(addDays(window.fieldDate, 90));
    expect(window.liftDate).toBe(addDays(site.firstAutumnFrost, 7));
    expect(window.spansYears).toBe(true);
    expect(window.liftDate! > window.bloomStart).toBe(true);
  });

  it("plants a peony the autumn before and withholds bloom until it is established", () => {
    const window = scheduleFlower(flower("peony"), site);
    expect(window.method).toBe("crown");
    expect(window.fieldDate < "2027-01-01").toBe(true);
    expect(window.firstBloomYear).toBe(2029);
    const planting = sample(window, "peony", "Peony");
    const firstYear = yearBars(planting, 2027);
    expect(firstYear.bloom).toBeNull();
    expect(firstYear.establishing).not.toBeNull();
    const established = yearBars(planting, 2029);
    expect(established.bloom).not.toBeNull();
    expect(visibleInYear(planting, 2028)).toBe(true);
  });

  it("keeps the gaps when a planting is moved in time", () => {
    const window = scheduleFlower(flower("calendula"), site);
    const moved = shiftDates({ ...window, firstBloomYear: window.firstBloomYear }, 14);
    expect(diffDays(moved.nurseryStart!, moved.fieldDate)).toBe(diffDays(window.nurseryStart!, window.fieldDate));
    expect(diffDays(moved.bloomStart, moved.bloomEnd)).toBe(diffDays(window.bloomStart, window.bloomEnd));
    expect(moved.fieldDate).toBe(addDays(window.fieldDate, 14));
  });

  it("refuses a bed that is already in flower for those dates", () => {
    const calendula = sample(scheduleFlower(flower("calendula"), site), "calendula", "Calendula");
    calendula.bedId = "bed-a";
    const other = { ...calendula, id: "other", flowerName: "Cosmos", bedId: "bed-a" };
    expect(clashOnBed([calendula], "bed-a", other.fieldDate, other.bloomEnd, other.id)?.id).toBe(calendula.id);
    expect(clashOnBed([calendula], "bed-b", other.fieldDate, other.bloomEnd, other.id)).toBeNull();
    const span = bedOccupancy(calendula, 2027);
    expect(span?.start).toBe(calendula.fieldDate);
  });

  it("suggests an autumn sow when that is what the date calls for", () => {
    const sweet = autumnSowWindow(flower("sweet-pea"), site);
    expect(sweet?.nurseryStart).toBe("2026-10-30");
    const now = sowNow(flowers, site, "2026-11-15", 8);
    expect(now.some((item) => item.flower.slug === "sweet-pea" && item.action.includes("next spring"))).toBe(true);
    expect(now.every((item) => item.fit !== "risky")).toBe(true);
    expect(now.some((item) => item.flower.commonName.toLowerCase().includes("lettuce"))).toBe(false);
  });
});

function sample(window: ReturnType<typeof scheduleFlower>, slug: string, name: string): PlantingDates {
  return {
    id: slug,
    flowerSlug: slug,
    flowerName: name,
    colour: "#e7b7c6",
    variety: window.variety,
    method: window.method,
    nurseryStart: window.nurseryStart,
    fieldDate: window.fieldDate,
    bloomStart: window.bloomStart,
    bloomEnd: window.bloomEnd,
    liftDate: window.liftDate,
    firstBloomYear: window.firstBloomYear,
    spansYears: window.spansYears,
    bedId: null,
  };
}
