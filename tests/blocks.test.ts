import { describe, expect, it } from "vitest";
import { bedIndexLabels, bedsInSpan, packedSpanM, previewBlock, reflowBlock } from "@/lib/blocks";
import { haversineM } from "@/lib/geo";

describe("bed block layout", () => {
  it("fits 64 beds of 76 cm with 38 cm paths in a 72.6 m run", () => {
    const count = bedsInSpan(72.58, 0.76, 0.38);
    expect(count).toBe(64);
    const span = packedSpanM(64, 0.76, 0.38);
    expect(span).toBeCloseTo(72.58, 2);
    expect(span * 15).toBeCloseTo(1088.7, 0);
  });

  it("uses the sideways drag for the number of beds and the long drag for their length", () => {
    const origin: [number, number] = [-3.19, 55.953];
    const current: [number, number] = [-3.1886, 55.9539];
    const draft = previewBlock(origin, current, {
      rotationDeg: 0,
      bedLengthM: 8,
      bedWidthM: 0.75,
      pathWidthM: 0.4,
    });
    expect(draft).not.toBeNull();
    if (!draft) return;
    expect(draft.count).toBeGreaterThan(1);
    expect(draft.beds).toHaveLength(draft.count);
    expect(draft.bedLengthM).toBeGreaterThan(8);
    const step = haversineM(draft.beds[0].center, draft.beds[1].center);
    expect(step).toBeGreaterThan(1.1);
    expect(step).toBeLessThan(1.2);
    expect(draft.areaM2).toBeCloseTo(draft.bedLengthM * draft.spanM, 0);
  });

  it("numbers a long block the way a grower can still read it", () => {
    expect(bedIndexLabels(64)).toEqual([1, 8, 16, 24, 32, 40, 48, 56, 64]);
    expect(bedIndexLabels(4)).toEqual([1, 2, 3, 4]);
  });

  it("reflows when the path or the count changes, without moving the origin", () => {
    const origin: [number, number] = [-1.5, 52.4];
    const first = reflowBlock({
      origin,
      rotationDeg: 90,
      bedLengthM: 20,
      bedWidthM: 0.75,
      pathWidthM: 0.4,
      count: 4,
      alongSign: 1,
      acrossSign: 1,
    });
    const wider = reflowBlock({ ...first, pathWidthM: 0.6, count: 6 });
    expect(wider.beds).toHaveLength(6);
    expect(wider.spanM).toBeGreaterThan(first.spanM);
    expect(wider.origin).toEqual(origin);
    expect(wider.beds[0].lengthM).toBe(20);
  });
});
