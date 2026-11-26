import { describe, expect, it } from "vitest";
import { bedLabelPx, bedNumbersToShow, labelsThatFit } from "@/lib/veg/bed-labels";

describe("bedNumbersToShow", () => {
  it("shows every number when each bed has room", () => {
    expect(bedNumbersToShow(6, 28, 16)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(bedNumbersToShow(4, 22, 14)).toEqual([0, 1, 2, 3]);
  });

  it("keeps the first and last and steps by 2, 4, or 8 when labels would collide", () => {
    const six = bedNumbersToShow(6, 8, 14);
    expect(six[0]).toBe(0);
    expect(six[six.length - 1]).toBe(5);
    expect(six.length).toBeLessThan(6);
    for (let index = 1; index < six.length; index += 1) {
      expect((six[index] - six[index - 1]) * 8).toBeGreaterThanOrEqual(14);
    }

    const many = bedNumbersToShow(24, 6, 14);
    expect(many[0]).toBe(0);
    expect(many[many.length - 1]).toBe(23);
    expect(many).toContain(8);
    expect(many).toContain(16);
    for (let index = 1; index < many.length; index += 1) {
      expect((many[index] - many[index - 1]) * 6).toBeGreaterThanOrEqual(14);
    }
  });

  it("hides every label when the block is too small on screen", () => {
    expect(bedNumbersToShow(6, 2, 14)).toEqual([]);
    expect(bedNumbersToShow(42, 0.3, 14)).toEqual([]);
    expect(bedNumbersToShow(1, 4, 14)).toEqual([]);
  });

  it("hides a crop name that would cover its neighbour", () => {
    const shown = labelsThatFit([
      { id: "a", x: 0, y: 0, w: 70, h: 16 },
      { id: "b", x: 20, y: 4, w: 70, h: 16 },
      { id: "c", x: 160, y: 0, w: 70, h: 16 },
    ]);
    expect(shown).toEqual(["a", "c"]);
  });

  it("grows the label slightly as the zoom increases", () => {
    expect(bedLabelPx(16)).toBe(11);
    expect(bedLabelPx(19)).toBe(12);
    expect(bedLabelPx(24)).toBe(15);
  });
});
