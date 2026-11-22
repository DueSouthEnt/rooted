import type { Flower } from "@/lib/flower";
import type { Hemisphere } from "@/lib/climate";

export type BedKind = "annual" | "perennial" | "bulb";
export type PlanTop = "north" | "east" | "south" | "west";

export interface PlantCount {
  perRow: number;
  rows: number;
  total: number;
  tight: boolean;
}

/**
 * Rows run the length of the bed. `spacingCm` is the gap along the row.
 * `rowSpacingCm` is the gap between rows, across the width.
 */
export function plantCount(
  lengthCm: number,
  widthCm: number,
  spacingCm: number,
  rowSpacingCm: number,
): PlantCount {
  const perRow = Math.floor(lengthCm / spacingCm);
  const rows = Math.floor(widthCm / rowSpacingCm);
  const tight = perRow < 1 || rows < 1;
  return {
    perRow: Math.max(0, perRow),
    rows: Math.max(0, rows),
    total: Math.max(0, perRow) * Math.max(0, rows),
    tight,
  };
}

export type ScreenEdge = "top" | "bottom" | "left" | "right";

/** The edge of a bed that should hold the tall plants, given which way the plan is turned. */
export function tallEdge(hemisphere: Hemisphere, topIs: PlanTop): ScreenEdge {
  const back: "north" | "south" = hemisphere === "north" ? "north" : "south";
  if (topIs === "north") return back === "north" ? "top" : "bottom";
  if (topIs === "south") return back === "south" ? "top" : "bottom";
  if (topIs === "east") return back === "north" ? "left" : "right";
  return back === "north" ? "right" : "left";
}

export function tallEdgeLabel(hemisphere: Hemisphere): string {
  return hemisphere === "north"
    ? "Tall plants on the north side, so they don't shade the short ones."
    : "Tall plants on the south side, so they don't shade the short ones.";
}

export function backToFront(flowers: Flower[]): Flower[] {
  return [...flowers].sort((a, b) => b.heightCm - a.heightCm || a.commonName.localeCompare(b.commonName));
}

export interface BedAssignmentWarning {
  tone: "care" | "note";
  text: string;
}

export function bedWarnings(
  bedKind: BedKind,
  flowers: Flower[],
): BedAssignmentWarning[] {
  const warnings: BedAssignmentWarning[] = [];
  const permanent = flowers.filter((flower) =>
    flower.lifeCycle === "perennial" || flower.lifeCycle === "shrub",
  );
  const bulbs = flowers.filter((flower) => flower.lifeCycle === "bulb");
  const annuals = flowers.filter(
    (flower) => flower.lifeCycle === "annual" || flower.lifeCycle === "biennial",
  );

  if (bedKind === "annual" && permanent.length > 0) {
    warnings.push({
      tone: "care",
      text: `${permanent.map((flower) => flower.commonName).join(", ")} will still be here next year. Give them a permanent bed so you're not digging them up to sow calendula.`,
    });
  }
  if (bedKind === "perennial" && annuals.length > 0) {
    warnings.push({
      tone: "note",
      text: `${annuals.map((flower) => flower.commonName).join(", ")} are happier in a bed you can clear. They'll tangle with the crowns if they stay here.`,
    });
  }
  if (bedKind !== "bulb" && bulbs.length > 0 && bedKind === "annual") {
    warnings.push({
      tone: "care",
      text: `${bulbs.map((flower) => flower.commonName).join(", ")} need a bed you won't fork over in spring. A bulb bed, or the front of a perennial bed, is the kinder spot.`,
    });
  }
  return warnings;
}
