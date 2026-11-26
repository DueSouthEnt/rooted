import { ukCropName } from "@/lib/veg/crop-names";
import { formatMedium } from "@/lib/veg/dates";

export const ROTATION_FAMILIES = [
  "Brassicas",
  "Alliums",
  "Legumes",
  "Solanaceae",
  "Roots/Umbellifers",
  "Cucurbits",
  "Leafy/other",
] as const;

export type RotationFamily = (typeof ROTATION_FAMILIES)[number];
export type AdviceTone = "bad" | "good" | "info";
export type AdviceNotice = { tone: AdviceTone; message: string };
export type CompanionRule = { id: string; cropName: string; otherName: string; kind: "good" | "bad"; reason: string };
export type AdvicePlanting = {
  id: string;
  cropName: string;
  cultivar: string;
  rotationFamily: string | null;
  seasonYear: number;
  start: string;
  end: string;
  bedIds: string[];
};
export type BedRef = { id: string; blockId: string; blockName: string; position: number; label: string };

const BOTANICAL: Record<string, RotationFamily> = {
  Brassicaceae: "Brassicas",
  Amaryllidaceae: "Alliums",
  Fabaceae: "Legumes",
  Solanaceae: "Solanaceae",
  Apiaceae: "Roots/Umbellifers",
  Cucurbitaceae: "Cucurbits",
};

export function rotationFamilyFor(botanical: string | null | undefined, category: string | null | undefined): RotationFamily {
  if (botanical && BOTANICAL[botanical]) return BOTANICAL[botanical];
  if (category === "Brassicas") return "Brassicas";
  if (category === "Alliums") return "Alliums";
  return "Leafy/other";
}

export function datesOverlap(start: string, end: string, otherStart: string, otherEnd: string): boolean {
  return start <= otherEnd && otherStart <= end;
}

export function adjacentBedIds(beds: BedRef[], bedId: string): string[] {
  const bed = beds.find((item) => item.id === bedId);
  if (!bed) return [];
  return beds
    .filter((item) => item.id !== bedId && item.blockId === bed.blockId && Math.abs(item.position - bed.position) === 1)
    .map((item) => item.id);
}

function cropKey(name: string): string {
  return ukCropName(name).toLowerCase();
}

function isFennel(name: string): boolean {
  return cropKey(name).includes("fennel");
}

function namesMatch(cropName: string, ruleName: string): boolean {
  if (ruleName === "*") return true;
  const crop = cropKey(cropName);
  const rule = cropKey(ruleName);
  if (crop === rule) return true;
  if ((rule === "fennel" && crop.includes("fennel")) || (crop === "fennel" && rule.includes("fennel"))) return true;
  return false;
}

function pairRule(rules: CompanionRule[], left: string, right: string): CompanionRule | null {
  if (cropKey(left) === cropKey(right)) return null;
  const direct = rules.filter(
    (rule) =>
      rule.otherName !== "*" &&
      ((namesMatch(left, rule.cropName) && namesMatch(right, rule.otherName)) ||
        (namesMatch(right, rule.cropName) && namesMatch(left, rule.otherName))),
  );
  const bad = direct.find((rule) => rule.kind === "bad");
  if (bad) return bad;
  if (direct[0]) return direct[0];
  if (isFennel(left) === isFennel(right)) return null;
  return (
    rules.find(
      (rule) => rule.otherName === "*" && rule.kind === "bad" && (isFennel(rule.cropName) || namesMatch(left, rule.cropName) || namesMatch(right, rule.cropName)),
    ) ?? null
  );
}

function bedPhrase(beds: BedRef[], bedId: string, nextDoor: boolean): string {
  const bed = beds.find((item) => item.id === bedId);
  if (!bed) return "A nearby bed";
  const name = bed.label || `${bed.blockName} bed ${bed.position + 1}`;
  return nextDoor ? `${name} (next door)` : name;
}

function spell(start: string, end: string): string {
  return `${formatMedium(start)}–${formatMedium(end)}`;
}

export function adviceForPlacement(input: {
  planting: AdvicePlanting;
  bedIds: string[];
  others: AdvicePlanting[];
  beds: BedRef[];
  rules: CompanionRule[];
  rotationYears: number;
}): AdviceNotice[] {
  const notices: AdviceNotice[] = [];
  const seenPairs = new Set<string>();
  const seenRotation = new Set<string>();
  const seenSeason = new Set<string>();
  const years = Math.max(1, input.rotationYears);
  const neighbourOf = new Map(input.bedIds.map((bedId) => [bedId, new Set(adjacentBedIds(input.beds, bedId))]));

  for (const other of input.others) {
    if (other.id === input.planting.id) continue;
    if (!datesOverlap(input.planting.start, input.planting.end, other.start, other.end)) continue;
    for (const bedId of input.bedIds) {
      const sameBed = other.bedIds.includes(bedId);
      const nextDoor = !sameBed && other.bedIds.some((id) => neighbourOf.get(bedId)?.has(id));
      if (!sameBed && !nextDoor) continue;
      const whereId = sameBed ? bedId : (other.bedIds.find((id) => neighbourOf.get(bedId)?.has(id)) ?? bedId);
      const rule = pairRule(input.rules, input.planting.cropName, other.cropName);
      if (!rule) continue;
      const key = `${rule.kind}|${cropKey(input.planting.cropName)}|${cropKey(other.cropName)}|${whereId}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      const where = bedPhrase(input.beds, whereId, nextDoor);
      const crop = ukCropName(other.cropName);
      if (rule.kind === "bad") {
        notices.push({
          tone: "bad",
          message: `${ukCropName(input.planting.cropName)} doesn't grow well near ${crop}: ${rule.reason} ${where} has ${other.cultivar} ${spell(other.start, other.end)}.`,
        });
      } else {
        notices.push({
          tone: "good",
          message: `Nice pairing: ${rule.reason} ${where} has ${other.cultivar} ${spell(other.start, other.end)}.`,
        });
      }
    }
  }

  const family = input.planting.rotationFamily;
  if (family) {
    for (const bedId of input.bedIds) {
      const history = input.others.filter((other) => other.id !== input.planting.id && other.bedIds.includes(bedId) && other.rotationFamily === family);
      const earlierThisYear = history
        .filter((other) => other.seasonYear === input.planting.seasonYear && other.end < input.planting.start)
        .sort((a, b) => b.end.localeCompare(a.end))[0];
      if (earlierThisYear && !seenSeason.has(bedId)) {
        seenSeason.add(bedId);
        notices.push({
          tone: "info",
          message: `${bedPhrase(input.beds, bedId, false)} already grew ${family} this year (${earlierThisYear.cultivar}). Fine to keep going with ${family.toLowerCase()} in a long season.`,
        });
      }
      const previous = history
        .filter((other) => other.seasonYear < input.planting.seasonYear && other.seasonYear >= input.planting.seasonYear - years)
        .sort((a, b) => b.seasonYear - a.seasonYear)[0];
      if (previous && !seenRotation.has(bedId)) {
        seenRotation.add(bedId);
        notices.push({
          tone: "bad",
          message: `${bedPhrase(input.beds, bedId, false)} had ${family} in ${previous.seasonYear} (${previous.cultivar}). Rotating to a different family reduces clubroot and pest build-up.`,
        });
      }
    }
  }

  const order: Record<AdviceTone, number> = { bad: 0, good: 1, info: 2 };
  return notices.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 4);
}

export function badCompanionText(input: Omit<Parameters<typeof adviceForPlacement>[0], "rotationYears">): string | null {
  const bad = adviceForPlacement({ ...input, rotationYears: 1 }).find((notice) => notice.tone === "bad" && notice.message.includes("doesn't grow well"));
  return bad?.message ?? null;
}
