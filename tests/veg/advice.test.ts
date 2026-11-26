import { describe, expect, it } from "vitest";
import { adviceForPlacement, type AdvicePlanting, type BedRef, type CompanionRule } from "@/lib/veg/advice";

const beds: BedRef[] = [
  { id: "a", blockId: "north", blockName: "Block 3", position: 0, label: "3A" },
  { id: "b", blockId: "north", blockName: "Block 3", position: 1, label: "3B" },
  { id: "c", blockId: "north", blockName: "Block 3", position: 2, label: "3C" },
];

const rules: CompanionRule[] = [
  { id: "1", cropName: "Spring onion", otherName: "Carrot", kind: "good", reason: "Spring onion masks the carrot scent and helps deter carrot fly." },
  { id: "2", cropName: "Fennel", otherName: "*", kind: "bad", reason: "it inhibits the growth of neighbours." },
  { id: "3", cropName: "Onion", otherName: "French bean", kind: "bad", reason: "alliums check the growth of beans and peas." },
  { id: "4", cropName: "Tomato", otherName: "Broccoli", kind: "bad", reason: "tomatoes and brassicas tend to check each other's growth." },
];

function planting(patch: Partial<AdvicePlanting> & Pick<AdvicePlanting, "id" | "cropName">): AdvicePlanting {
  return {
    cultivar: "Test",
    rotationFamily: "Leafy/other",
    seasonYear: 2026,
    start: "2026-05-01",
    end: "2026-07-01",
    bedIds: [],
    ...patch,
  };
}

describe("bed advice", () => {
  it("warns when fennel sits next to carrots", () => {
    const notices = adviceForPlacement({
      planting: planting({ id: "fennel", cropName: "Florence fennel", rotationFamily: "Roots/Umbellifers", bedIds: ["c"] }),
      bedIds: ["c"],
      beds,
      rules,
      rotationYears: 3,
      others: [planting({ id: "carrot", cropName: "Carrot", cultivar: "Resistafly", rotationFamily: "Roots/Umbellifers", bedIds: ["b"] })],
    });
    expect(notices.some((notice) => notice.tone === "bad" && /fennel/i.test(notice.message) && notice.message.includes("next door"))).toBe(true);
  });

  it("notes a good pairing of spring onion and carrot", () => {
    const notices = adviceForPlacement({
      planting: planting({ id: "onion", cropName: "Scallion", rotationFamily: "Alliums", bedIds: ["c"] }),
      bedIds: ["c"],
      beds,
      rules,
      rotationYears: 3,
      others: [planting({ id: "carrot", cropName: "Carrot", cultivar: "Resistafly", bedIds: ["b"] })],
    });
    expect(notices.some((notice) => notice.tone === "good" && notice.message.includes("carrot fly"))).toBe(true);
  });

  it("warns about a previous season and only notes the same season", () => {
    const notices = adviceForPlacement({
      planting: planting({ id: "now", cropName: "Kale", cultivar: "Winterbor", rotationFamily: "Brassicas", bedIds: ["a"], start: "2027-04-01", end: "2027-08-01", seasonYear: 2027 }),
      bedIds: ["a"],
      beds,
      rules,
      rotationYears: 3,
      others: [
        planting({ id: "earlier", cropName: "Kale", cultivar: "Winterbor", rotationFamily: "Brassicas", seasonYear: 2027, bedIds: ["a"], start: "2027-01-01", end: "2027-03-01" }),
        planting({ id: "last", cropName: "Kale", cultivar: "Winterbor", rotationFamily: "Brassicas", seasonYear: 2026, bedIds: ["a"], start: "2026-04-01", end: "2026-08-01" }),
      ],
    });
    expect(notices.some((notice) => notice.tone === "info" && notice.message.includes("this year"))).toBe(true);
    expect(notices.some((notice) => notice.tone === "bad" && notice.message.includes("2026"))).toBe(true);
  });

  it("ignores a neighbour when the dates do not overlap", () => {
    const notices = adviceForPlacement({
      planting: planting({ id: "fennel", cropName: "Florence fennel", bedIds: ["c"], start: "2026-09-01", end: "2026-10-01" }),
      bedIds: ["c"],
      beds,
      rules,
      rotationYears: 3,
      others: [planting({ id: "carrot", cropName: "Carrot", bedIds: ["b"], start: "2026-05-01", end: "2026-07-01" })],
    });
    expect(notices).toEqual([]);
  });
});
