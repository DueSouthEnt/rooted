import { describe, expect, it } from "vitest";
import {
  blockOutsideOutline,
  convexRingsOverlap,
  fromMetres,
  layoutBeds,
  rectangleRing,
  rotateMetres,
  spanWidthForCount,
  toMetres,
} from "@/lib/veg/bed-layout";

describe("layoutBeds", () => {
  it("fits beds across a dragged width with paths only between them", () => {
    const layout = layoutBeds({
      spanLengthM: 30,
      spanWidthM: 10,
      bedLength: 30,
      bedWidth: 1,
      pathWidth: 0.5,
      unit: "m",
    });
    expect(layout.bedCount).toBe(7);
    expect(layout.usedWidthM).toBeCloseTo(10, 5);
    expect(layout.clipped).toBe(false);
    expect(layout.beds[0].acrossM).toBeCloseTo(4.5, 5);
    expect(layout.beds[6].acrossM).toBeCloseTo(-4.5, 5);
  });

  it("drops a bed that would spill past the dragged edge", () => {
    const layout = layoutBeds({
      spanLengthM: 20,
      spanWidthM: 9.9,
      bedLength: 20,
      bedWidth: 1,
      pathWidth: 0.5,
      unit: "m",
    });
    expect(layout.bedCount).toBe(6);
    expect(layout.usedWidthM).toBeLessThanOrEqual(9.9);
  });

  it("clips bed length and warns when the drag is shorter than the set length", () => {
    const layout = layoutBeds({
      spanLengthM: 12,
      spanWidthM: 4,
      bedLength: 100,
      bedWidth: 2.5,
      pathWidth: 1.5,
      unit: "ft",
    });
    expect(layout.clipped).toBe(true);
    expect(layout.bedLengthM).toBeCloseTo(12, 5);
    expect(fromMetres(layout.bedLengthM, "ft")).toBeLessThan(100);
  });

  it("converts feet so six 30-inch beds and 18-inch paths fill their span", () => {
    const width = spanWidthForCount(6, 2.5, 1.5, "ft");
    const layout = layoutBeds({
      spanLengthM: toMetres(100, "ft"),
      spanWidthM: width,
      bedLength: 100,
      bedWidth: 2.5,
      pathWidth: 1.5,
      unit: "ft",
    });
    expect(layout.bedCount).toBe(6);
    expect(layout.clipped).toBe(false);
    expect(toMetres(2.5, "ft")).toBeCloseTo(0.762, 3);
  });

  it("rotates a north-running bed to the east at 90 degrees", () => {
    const north = rotateMetres(10, 0, 0);
    expect(north.northM).toBeCloseTo(10, 5);
    expect(north.eastM).toBeCloseTo(0, 5);
    const east = rotateMetres(10, 0, 90);
    expect(east.eastM).toBeCloseTo(10, 5);
    expect(east.northM).toBeCloseTo(0, 5);
  });

  it("flags a rotated block that leaves the farm outline or overlaps a neighbour", () => {
    const center = { latitude: 55.93, longitude: -3.22 };
    const inside = rectangleRing(center, 20, 8, 15);
    const outline = rectangleRing(center, 80, 80, 0);
    const outside = rectangleRing({ latitude: 55.931, longitude: -3.22 }, 20, 8, 15);
    expect(blockOutsideOutline(inside, outline)).toBe(false);
    expect(blockOutsideOutline(outside, outline)).toBe(true);
    const neighbour = rectangleRing({ latitude: center.latitude, longitude: center.longitude + 0.00002 }, 20, 8, 40);
    expect(convexRingsOverlap(inside, neighbour)).toBe(true);
    const clear = rectangleRing({ latitude: center.latitude + 0.002, longitude: center.longitude }, 20, 8, 0);
    expect(convexRingsOverlap(inside, clear)).toBe(false);
  });
});
