import type { SitePlan } from "@/lib/tasks";
import type { Flower } from "@/lib/flower";
import { rhsRank, usdaNumber } from "@/lib/hardiness";

export type Fit = "great" | "good" | "care" | "risky";

export interface Recommendation {
  flower: Flower;
  score: number;
  fit: Fit;
  reasons: string[];
}

export function recommend(flowers: Flower[], site: SitePlan): Recommendation[] {
  return flowers
    .map((flower) => scoreFlower(flower, site))
    .sort((a, b) => b.score - a.score || a.flower.commonName.localeCompare(b.flower.commonName));
}

export function scoreFlower(flower: Flower, site: SitePlan): Recommendation {
  let score = 68;
  const reasons: string[] = [];
  const flags = new Set<string>();

  const needed = daysNeeded(flower);
  if (flower.lifeCycle === "bulb" || flower.bloomWeeksFromLastFrost != null) {
    if (flower.needsWinterChill && (site.frostFree || (site.rhs && rhsRank(site.rhs) < rhsRank("H4")))) {
      score -= 30;
      flags.add("chill");
      reasons.push(
        `${flower.commonName} wants a proper winter. This climate is too gentle — you'll get leaves, or nothing, unless you pre-chill them.`,
      );
    } else {
      score += 12;
      reasons.push(seasonReason(flower, site));
    }
  } else if (needed > site.seasonLengthDays) {
    score -= 36;
    flags.add("season");
    reasons.push(
      `They need about ${needed} days to earn their keep, and this season is closer to ${site.seasonLengthDays}. That's a gamble, not a plan.`,
    );
  } else if (needed > site.seasonLengthDays - 14) {
    score -= 12;
    flags.add("tight");
    reasons.push("The season only just fits. Sow on time or they'll still be thinking about it at the frost.");
  } else {
    score += 12;
  }

  if (flower.climate === "cool" && site.summer === "hot") {
    score -= flower.heatSensitive ? 28 : 18;
    flags.add("heat");
    reasons.push(
      flower.heatSensitive
        ? "Heat finishes them. In a hot summer, treat them as a spring crop and don't expect June."
        : "They prefer cool weather and will stall once the heat settles in.",
    );
  } else if (flower.climate === "heat" && site.summer === "cool") {
    score -= 18;
    flags.add("cool");
    reasons.push("This one wants heat. A cool summer will leave you with a lot of leaf and a polite apology.");
  } else if (flower.climate === "warm" && site.summer === "cool") {
    score -= 10;
    flags.add("cool");
    reasons.push("Happier with some warmth. In a cool year, give them your sunniest bed and don't sow them early into cold soil.");
  } else if (
    (flower.climate === "cool" && site.summer === "cool") ||
    (flower.climate === "heat" && site.summer === "hot") ||
    (flower.climate === "warm" && (site.summer === "mild" || site.summer === "hot"))
  ) {
    score += 8;
  } else if (site.summer === "mild" || flower.climate === "mild") {
    score += 4;
  }

  if (flower.lifeCycle === "perennial" || flower.lifeCycle === "shrub") {
    const zone = site.usdaZone ? usdaNumber(site.usdaZone) : null;
    if (zone != null && zone < flower.usdaMin - 0.6) {
      score -= 28;
      flags.add("zone");
      reasons.push(
        `Hardiness is about USDA ${formatZoneRange(flower)} and RHS ${flower.rhs}. This garden is colder than that. They won't reliably overwinter.`,
      );
    } else if (zone != null && zone > flower.usdaMax + 0.6 && flower.needsWinterChill) {
      score -= 30;
      flags.add("chill");
      reasons.push("They need winter chill to flower. A warm garden won't give it to them.");
    } else if (site.rhs && rhsRank(flower.rhs) < rhsRank(site.rhs)) {
      score -= 22;
      flags.add("zone");
      reasons.push(
        `Rated ${flower.rhs}, and this garden winters colder than that. Protection, or a different plant.`,
      );
    } else {
      score += 10;
    }
  }

  if (flower.liftIfColderThanRhs && site.rhs && rhsRank(site.rhs) > rhsRank(flower.liftIfColderThanRhs)) {
    flags.add("lift");
    reasons.push("They'll grow, then you'll lift them after the frost. Budget a wet November afternoon.");
  } else if (flower.liftIfColderThanRhs && !site.frostFree && !site.rhs) {
    flags.add("lift");
    reasons.push("Assume you'll lift and store them unless you know the bed stays mild.");
  }

  if (flower.difficulty === "easy") score += 8;
  if (flower.difficulty === "advanced") {
    score -= 6;
    flags.add("advanced");
    reasons.push(advancedLine(flower));
  }

  if (flower.yearsToEstablish >= 3) {
    reasons.push(
      `Plant them for year ${flower.yearsToEstablish}, not for this season's buckets. That's the deal, and it's worth it.`,
    );
  } else if (flower.yearsToEstablish === 2) {
    reasons.push("You'll get a taste in year one and a proper crop in year two.");
  }

  if (flower.autumnSow && (site.summer === "cool" || site.summer === "mild")) {
    reasons.push("Autumn sowing suits this climate. Earlier flowers, sturdier plants, less April panic.");
  }

  if (reasons.length === 0) reasons.push(seasonReason(flower, site));

  const fit = decideFit(score, flags);
  return { flower, score, fit, reasons: reasons.slice(0, 3) };
}

function daysNeeded(flower: Flower): number {
  if (flower.minSeasonDays) return flower.minSeasonDays;
  if (flower.indoorWeeksBeforeFrost != null) {
    return flower.daysFromPlantToBloom + Math.max(0, flower.transplantWeeksAfterFrost ?? 0) * 7;
  }
  if (flower.daysFromSowToBloom != null) {
    return flower.daysFromSowToBloom + Math.max(0, flower.directSowWeeksAfterFrost ?? 0) * 7;
  }
  return flower.daysFromPlantToBloom + Math.max(0, flower.transplantWeeksAfterFrost ?? 0) * 7;
}

function decideFit(score: number, flags: Set<string>): Fit {
  if (flags.has("season") || flags.has("zone") || flags.has("chill") || score < 48) return "risky";
  if (
    flags.has("heat") ||
    flags.has("cool") ||
    flags.has("tight") ||
    flags.has("lift") ||
    flags.has("advanced")
  ) {
    return "care";
  }
  if (score >= 80) return "great";
  return "good";
}

function seasonReason(flower: Flower, site: SitePlan): string {
  if (site.frostFree) {
    return "Frost barely visits. You can grow for a long stretch — just don't expect chill-loving plants to play along.";
  }
  if (flower.hardyClass === "hardy") {
    return "A hardy one. It can be out in the cold, which is most of the trick in this climate.";
  }
  if (flower.hardyClass === "tender") {
    return "Tender. Keep it under cover until the frost has actually finished, not until you are bored of waiting.";
  }
  return "Half-hardy. A light frost won't end it, but a hard one will.";
}

function advancedLine(flower: Flower): string {
  if (flower.slug === "lisianthus") {
    return "Lisianthus is a long, fiddly sow. If this is your first season, buy plugs or let someone else grow it.";
  }
  return "Not a first-season plant unless you enjoy fiddling. It will work, slowly.";
}

function formatZoneRange(flower: Flower): string {
  const min = zoneText(flower.usdaMin);
  const max = zoneText(flower.usdaMax);
  return `${min}–${max}`;
}

function zoneText(value: number): string {
  const base = Math.floor(value);
  return `${base}${value - base >= 0.5 ? "b" : "a"}`;
}

const STARTER_ROLES = ["spring", "filler", "focal", "foliage", "spike"] as const;

export function starterMix(recommendations: Recommendation[]): Recommendation[] {
  const pool = recommendations.filter((item) => {
    const flower = item.flower;
    if (item.fit !== "great" && item.fit !== "good") return false;
    if (flower.difficulty === "advanced") return false;
    if (flower.yearsToEstablish >= 3) return false;
    if (item.reasons.some((reason) => reason.includes("lift them"))) return false;
    return true;
  });

  const chosen: Recommendation[] = [];
  const used = new Set<string>();

  function take(predicate: (item: Recommendation) => boolean) {
    const next = pool.find((item) => !used.has(item.flower.slug) && predicate(item));
    if (!next) return;
    used.add(next.flower.slug);
    chosen.push(next);
  }

  take(
    (item) =>
      item.flower.hardyClass === "hardy" &&
      item.flower.lifeCycle === "annual" &&
      (item.flower.autumnSow || item.flower.roles.includes("spring")),
  );
  for (const role of STARTER_ROLES) {
    if (role === "spring") continue;
    take((item) => item.flower.roles.includes(role));
  }
  take(
    (item) =>
      item.flower.hardyClass === "tender" &&
      item.flower.roles.includes("focal") &&
      item.flower.lifeCycle === "annual",
  );

  for (const item of pool) {
    if (chosen.length >= 7) break;
    if (used.has(item.flower.slug)) continue;
    used.add(item.flower.slug);
    chosen.push(item);
  }

  return chosen.slice(0, 8);
}

export function starterStory(site: SitePlan, mix: Recommendation[], placeName?: string | null): string {
  const where = placeName?.trim() || "this garden";
  if (mix.length === 0) {
    return `${where} is a tough brief. Start with whatever scored as worth a row, and ignore the glamorous gambles for now.`;
  }
  const names = mix.map((item) => item.flower.commonName);
  const list = formatList(names);
  if (site.summer === "hot") {
    return `For a first season in ${where}, lean on heat-lovers and use the cool weeks for anything tender-hearted. ${list} will teach you the year without a November crisis.`;
  }
  if (site.summer === "cool" || site.seasonLengthDays < 150) {
    return `The season in ${where} is on the cool side, so start with plants that like that. ${list}. Leave the heat-lovers until you've seen a summer here.`;
  }
  return `For a first season in ${where}, mix an autumn sowing with a few tender flowers once the soil warms. ${list}. Dahlias can wait until you know you enjoy the November dig.`;
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function fitLabel(fit: Fit): string {
  switch (fit) {
    case "great":
      return "A safe bet";
    case "good":
      return "Worth a row";
    case "care":
      return "Needs a hand";
    case "risky":
      return "A gamble here";
  }
}
