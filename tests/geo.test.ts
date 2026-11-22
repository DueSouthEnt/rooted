import { describe, expect, it } from "vitest";
import { plantCount } from "@/lib/beds";
import {
  destination,
  formatSquareMetres,
  haversineM,
  pointInRing,
  rectangleAreaM2,
  rectangleFromCorners,
  rectangleRing,
  ringAreaM2,
  toCentimetres,
  withRotation,
} from "@/lib/geo";

describe("satellite geometry", () => {
  it("measures a hundred metres north", () => {
    const start: [number, number] = [-3.1883, 55.9533];
    const end = destination(start[1], start[0], 0, 100);
    expect(haversineM(start, end)).toBeGreaterThan(99);
    expect(haversineM(start, end)).toBeLessThan(101);
  });

  it("keeps a rotated bed the same size", () => {
    const dragged = rectangleFromCorners([-3.19, 55.95], [-3.1892, 55.9504]);
    expect(dragged).not.toBeNull();
    if (!dragged) return;
    const turned = withRotation(dragged, 35);
    expect(turned.lengthM).toBe(dragged.lengthM);
    expect(turned.widthM).toBe(dragged.widthM);
    const ring = rectangleRing(turned);
    expect(ring).toHaveLength(4);
    expect(haversineM(ring[0], ring[1])).toBeGreaterThan(dragged.widthM * 0.9);
    expect(haversineM(ring[0], ring[1])).toBeLessThan(dragged.widthM * 1.15);
    expect(rectangleAreaM2(turned)).toBeCloseTo(dragged.lengthM * dragged.widthM, 4);
  });

  it("turns measured metres into the plant-count the beds page already uses", () => {
    const bed = {
      type: "rectangle" as const,
      center: [-3.19, 55.95] as [number, number],
      lengthM: 10,
      widthM: 1.2,
      rotationDeg: 90,
    };
    const { lengthCm, widthCm } = toCentimetres(bed);
    expect(plantCount(lengthCm, widthCm, 25, 30)).toEqual({
      perRow: 40,
      rows: 4,
      total: 160,
      tight: false,
    });
  });

  it("knows when a point sits inside the farm outline", () => {
    const ring: [number, number][] = [
      [-3.2, 55.95],
      [-3.18, 55.95],
      [-3.18, 55.96],
      [-3.2, 55.96],
    ];
    expect(pointInRing([-3.19, 55.955], ring)).toBe(true);
    expect(pointInRing([-3.1, 55.955], ring)).toBe(false);
    expect(ringAreaM2(ring)).toBeGreaterThan(1_000_000);
    expect(formatSquareMetres(12.34)).toBe("12.3 m²");
  });
});
