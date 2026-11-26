import { describe, expect, it } from "vitest";
import { clashSentence, sharedClashes, type ShareUse } from "@/lib/shared-space";

function use(partial: Partial<ShareUse> & Pick<ShareUse, "id" | "kind" | "start" | "end" | "lengthM">): ShareUse {
  return { label: partial.label ?? partial.id, ...partial };
}

describe("shared bed space", () => {
  it("allows flowers and vegetables that miss each other on the calendar", () => {
    const clashes = sharedClashes("North strip", 4, [
      use({ id: "pea", kind: "flower", label: "Sweet pea", start: "2026-04-01", end: "2026-06-30", lengthM: 4 }),
      use({ id: "beet", kind: "veg", label: "Beetroot", start: "2026-07-01", end: "2026-09-15", lengthM: 4 }),
    ]);
    expect(clashes).toEqual([]);
  });

  it("allows two crops that share the days when their lengths fit", () => {
    const clashes = sharedClashes("North strip", 5, [
      use({ id: "pea", kind: "flower", label: "Sweet pea", start: "2026-05-01", end: "2026-07-01", lengthM: 2 }),
      use({ id: "lettuce", kind: "veg", label: "Lettuce", start: "2026-05-15", end: "2026-06-15", lengthM: 2 }),
    ]);
    expect(clashes).toEqual([]);
  });

  it("flags a flower and a vegetable that together overrun the bed", () => {
    const clashes = sharedClashes("North strip", 4, [
      use({ id: "pea", kind: "flower", label: "Sweet pea", start: "2026-05-01", end: "2026-07-01", lengthM: 3 }),
      use({ id: "beet", kind: "veg", label: "Beetroot", start: "2026-06-01", end: "2026-08-01", lengthM: 2 }),
    ]);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]?.labels).toEqual(["Beetroot", "Sweet pea"]);
    expect(clashes[0]?.usedM).toBe(5);
    expect(clashSentence(clashes[0]!)).toContain("North strip is 4 m long");
    expect(clashSentence(clashes[0]!)).toContain("want 5 m");
  });

  it("flags three plantings when the pair-wise lengths would still fit", () => {
    const clashes = sharedClashes("North strip", 5, [
      use({ id: "a", kind: "flower", label: "Sweet pea", start: "2026-06-01", end: "2026-06-30", lengthM: 2 }),
      use({ id: "b", kind: "veg", label: "Lettuce", start: "2026-06-01", end: "2026-06-30", lengthM: 2 }),
      use({ id: "c", kind: "veg", label: "Beetroot", start: "2026-06-01", end: "2026-06-30", lengthM: 2 }),
    ]);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]?.usedM).toBe(6);
  });

  it("counts the day a planting finishes as still in the ground", () => {
    const clashes = sharedClashes("North strip", 4, [
      use({ id: "pea", kind: "flower", label: "Sweet pea", start: "2026-06-01", end: "2026-06-15", lengthM: 4 }),
      use({ id: "beet", kind: "veg", label: "Beetroot", start: "2026-06-15", end: "2026-08-01", lengthM: 4 }),
    ]);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]?.start).toBe("2026-06-15");
  });
});
