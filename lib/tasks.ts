import { addDays, addWeeks, addYears, diffDays } from "@/lib/dates";
import type { Hemisphere, Summer } from "@/lib/climate";
import type { Flower } from "@/lib/flower";
import { rhsRank, type RhsRating } from "@/lib/hardiness";

export type TaskCategory =
  | "plan"
  | "sow"
  | "harden"
  | "plant"
  | "pinch"
  | "support"
  | "feed"
  | "harvest"
  | "deadhead"
  | "lift"
  | "divide"
  | "mulch"
  | "note";

export interface SitePlan {
  seasonYear: number;
  hemisphere: Hemisphere;
  frostFree: boolean;
  occasionalFrost: boolean;
  anchored: boolean;
  lastSpringFrost: string;
  firstAutumnFrost: string;
  seasonLengthDays: number;
  usdaZone: string | null;
  rhs: RhsRating | null;
  summer: Summer;
  tropical: boolean;
}

export interface CropInput {
  flower: Flower;
  status: "planting" | "established";
  successions?: number;
}

export interface TaskDraft {
  taskKey: string;
  flowerSlug: string | null;
  title: string;
  detail: string;
  dueDate: string;
  category: TaskCategory;
  covered: boolean;
}

function previousAutumnFrost(site: SitePlan): string {
  return addYears(site.firstAutumnFrost, -1);
}

function autumnSowingOk(site: SitePlan): boolean {
  if (site.frostFree) return true;
  if (!site.rhs) return true;
  return rhsRank(site.rhs) <= rhsRank("H6");
}

function siteColderThan(site: SitePlan, rating: RhsRating): boolean {
  if (site.frostFree) return false;
  if (!site.rhs) return true;
  return rhsRank(site.rhs) > rhsRank(rating);
}

function mustLift(flower: Flower, site: SitePlan): boolean {
  if (!flower.liftIfColderThanRhs) return false;
  return siteColderThan(site, flower.liftIfColderThanRhs);
}

function needsPrechill(flower: Flower, site: SitePlan): boolean {
  if (!flower.needsWinterChill) return false;
  if (site.frostFree) return true;
  if (!site.rhs) return false;
  return rhsRank(site.rhs) < rhsRank("H4");
}

function anchorNote(site: SitePlan): string {
  if (!site.anchored) return "";
  if (site.tropical) {
    return " Frost is rare here, and the tropical year follows rain more than frost. This date is only a rhythm.";
  }
  return " Frost is rare here, so this is a planning date, not a frost date.";
}

function lastViable(site: SitePlan, daysNeeded: number): string {
  return addDays(site.firstAutumnFrost, -(daysNeeded + 7));
}

export function generateTasks(crops: CropInput[], site: SitePlan): TaskDraft[] {
  const tasks: TaskDraft[] = [];
  const seen = new Set<string>();

  function add(task: TaskDraft) {
    if (seen.has(task.taskKey)) return;
    seen.add(task.taskKey);
    tasks.push(task);
  }

  for (const crop of crops) {
    const flower = crop.flower;
    const status = crop.status;
    const successions = Math.max(1, Math.min(8, crop.successions ?? flower.defaultSuccessions));

    if (flower.biennialSummerSow) {
      scheduleBiennial(add, flower, site, status);
    } else if (flower.lifeCycle === "tuber" || flower.sowMethod === "tuber") {
      scheduleTuber(add, flower, site);
    } else if (flower.lifeCycle === "corm" || flower.sowMethod === "corm") {
      scheduleCorm(add, flower, site);
    } else if (flower.lifeCycle === "bulb" || flower.sowMethod === "bulb") {
      scheduleBulb(add, flower, site, status);
    } else if (flower.lifeCycle === "perennial" || flower.lifeCycle === "shrub") {
      schedulePerennial(add, flower, site, status);
    } else {
      scheduleAnnual(add, flower, site, successions);
    }
  }

  if (tasks.length > 0) {
    const earliest = tasks.map((task) => task.dueDate).sort()[0];
    add({
      taskKey: `farm:order:${site.seasonYear}`,
      flowerSlug: null,
      title: "Order seed, corms and tubers",
      detail: `For ${crops.map((crop) => crop.flower.commonName).join(", ")}. The good varieties sell out while everyone is still thinking about Christmas.`,
      dueDate: addDays(earliest, -56),
      category: "plan",
      covered: false,
    });
  }

  const indoorSows = tasks.filter((task) => task.covered && task.category === "sow");
  if (indoorSows.length > 0) {
    const first = indoorSows.map((task) => task.dueDate).sort()[0];
    add({
      taskKey: `farm:sow-station:${site.seasonYear}`,
      flowerSlug: null,
      title: "Set up the sowing station",
      detail:
        "Clean trays, fresh compost, a bright windowsill or a light. Label as you sow — February-you does not remember what March-you planted.",
      dueDate: addDays(first, -3),
      category: "plan",
      covered: true,
    });
  }

  return tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));
}

function scheduleAnnual(
  add: (task: TaskDraft) => void,
  flower: Flower,
  site: SitePlan,
  successions: number,
) {
  const useAutumn =
    flower.autumnSow &&
    autumnSowingOk(site) &&
    (flower.sowMethod === "direct" || flower.sowMethod === "either");

  if (useAutumn && flower.autumnSowWeeksBeforeFrost != null) {
    const sowDate = addWeeks(previousAutumnFrost(site), -flower.autumnSowWeeksBeforeFrost);
    add({
      taskKey: `${flower.slug}:autumn-sow:${sowDate}`,
      flowerSlug: flower.slug,
      title: `Sow ${flower.commonName} for next spring`,
      detail: autumnSowDetail(flower, site),
      dueDate: sowDate,
      category: "sow",
      covered: true,
    });
    if (flower.transplantWeeksAfterFrost != null) {
      const plantDate = addWeeks(site.lastSpringFrost, flower.transplantWeeksAfterFrost);
      addPlant(add, flower, site, plantDate, "Plant out");
      addHarden(add, flower, plantDate);
      addCulture(add, flower, site, plantDate, false);
    } else {
      addCulture(add, flower, site, addDays(sowDate, 120), true);
    }
    const leftover = Math.max(0, successions - 1);
    if (leftover > 0 && flower.successionWeeks) {
      scheduleDirectSuccessions(add, flower, site, leftover, flower.directSowWeeksAfterFrost ?? 0);
    }
    return;
  }

  if (flower.indoorWeeksBeforeFrost != null && flower.sowMethod !== "direct") {
    scheduleIndoor(add, flower, site, successions);
    return;
  }

  scheduleDirectSuccessions(
    add,
    flower,
    site,
    successions,
    flower.directSowWeeksAfterFrost ?? flower.transplantWeeksAfterFrost ?? 0,
  );
}

function autumnSowDetail(flower: Flower, site: SitePlan): string {
  const base =
    flower.sowMethod === "direct"
      ? `Sow direct in a free-draining bed, or in deep modules if your winter is wet. ${flower.commonName} wants to be a small plant before the cold, not a seedling facing it.`
      : `Sow in deep pots or modules and keep them in a cold frame or an unheated greenhouse. This is the autumn sowing that gives earlier flowers than a spring rush.`;
  const prep = flower.prep ? ` ${flower.prep}` : "";
  return `${base}${prep}${anchorNote(site)} ${flower.notes}`;
}

function scheduleIndoor(
  add: (task: TaskDraft) => void,
  flower: Flower,
  site: SitePlan,
  successions: number,
) {
  const weeks = flower.indoorWeeksBeforeFrost ?? 6;
  const gap = flower.successionWeeks ?? 3;
  const plantOffset = flower.transplantWeeksAfterFrost ?? 1;
  const days = flower.daysFromPlantToBloom;
  const lastPlant = lastViable(site, days);
  let made = 0;

  for (let index = 0; index < successions; index += 1) {
    const sowDate = addWeeks(addWeeks(site.lastSpringFrost, -weeks), index * gap);
    const plantDate = addWeeks(sowDate, weeks + plantOffset);
    if (index > 0 && diffDays(lastPlant, plantDate) > 0) break;
    made += 1;
    const label =
      successions > 1 ? `Sow ${flower.commonName} under cover (${made})` : `Sow ${flower.commonName} under cover`;
    add({
      taskKey: `${flower.slug}:indoor-sow:${sowDate}`,
      flowerSlug: flower.slug,
      title: label,
      detail: indoorDetail(flower, site, plantDate),
      dueDate: sowDate,
      category: "sow",
      covered: true,
    });
    addHarden(add, flower, plantDate);
    addPlant(add, flower, site, plantDate, "Plant out");
    addCulture(add, flower, site, plantDate, false);
  }
}

function indoorDetail(flower: Flower, site: SitePlan, plantDate: string): string {
  const germ =
    flower.germTempMinC != null && flower.germTempMaxC != null
      ? ` Germinate around ${flower.germTempMinC}–${flower.germTempMaxC}°C` +
        (flower.germDaysMin != null
          ? `, usually ${flower.germDaysMin}–${flower.germDaysMax} days.`
          : ".")
      : "";
  const prep = flower.prep ? ` ${flower.prep}` : "";
  const late =
    diffDays(lastViable(site, flower.daysFromPlantToBloom), plantDate) > 0
      ? " This sowing may run out of season before it does much. Grow it if you like a gamble."
      : "";
  return `Start them in trays. Planting out is around ${plantDate}.${germ}${prep}${late}${anchorNote(site)}`;
}

function scheduleDirectSuccessions(
  add: (task: TaskDraft) => void,
  flower: Flower,
  site: SitePlan,
  count: number,
  startWeeksAfterFrost: number,
) {
  const gap = flower.successionWeeks ?? 3;
  const days = flower.daysFromSowToBloom ?? flower.daysFromPlantToBloom;
  const lastSow = lastViable(site, days);
  let made = 0;
  for (let index = 0; index < count; index += 1) {
    const sowDate = addWeeks(site.lastSpringFrost, startWeeksAfterFrost + index * gap);
    if (index > 0 && diffDays(lastSow, sowDate) > 0) break;
    made += 1;
    const title =
      count > 1 ? `Direct sow ${flower.commonName} (${made})` : `Direct sow ${flower.commonName}`;
    add({
      taskKey: `${flower.slug}:direct-sow:${sowDate}`,
      flowerSlug: flower.slug,
      title,
      detail: `Sow where they are to flower.${flower.prep ? ` ${flower.prep}` : ""} About ${days} days to the first cut.${anchorNote(site)}`,
      dueDate: sowDate,
      category: "sow",
      covered: false,
    });
    addCulture(add, flower, site, sowDate, true);
  }
}

function scheduleTuber(add: (task: TaskDraft) => void, flower: Flower, site: SitePlan) {
  const plantDate = addWeeks(site.lastSpringFrost, flower.transplantWeeksAfterFrost ?? 2);
  if (flower.presprout) {
    const potDate = addDays(plantDate, -28);
    add({
      taskKey: `${flower.slug}:presprout:${potDate}`,
      flowerSlug: flower.slug,
      title: `Pot ${flower.commonName} tubers for a head start`,
      detail:
        "Sit the tubers in a little compost somewhere bright and frost-free. Don't drown them. You're waking them up, not making soup.",
      dueDate: potDate,
      category: "sow",
      covered: true,
    });
  }
  add({
    taskKey: `${flower.slug}:plant:${plantDate}`,
    flowerSlug: flower.slug,
    title: `Plant ${flower.commonName}`,
    detail: `Wait until the soil has warmed, not merely until the forecast looks polite. Space them ${flower.spacingCm} cm apart. ${flower.notes}${anchorNote(site)}`,
    dueDate: plantDate,
    category: "plant",
    covered: false,
  });
  addCulture(add, flower, site, plantDate, false);
  addLiftOrMulch(add, flower, site);
}

function scheduleCorm(add: (task: TaskDraft) => void, flower: Flower, site: SitePlan) {
  const mildAutumn =
    site.frostFree || (site.rhs != null && rhsRank(site.rhs) <= rhsRank("H4"));
  if (mildAutumn && flower.autumnPlantWeeksBeforeFrost != null) {
    const plantDate = addWeeks(previousAutumnFrost(site), -flower.autumnPlantWeeksBeforeFrost);
    add({
      taskKey: `${flower.slug}:autumn-plant:${plantDate}`,
      flowerSlug: flower.slug,
      title: `Plant ${flower.commonName} corms under cover`,
      detail: `${flower.prep ?? "Plant the corms in a tunnel or a cold greenhouse."} They want a long cool spell and will give up once summer heat arrives. ${flower.notes}`,
      dueDate: plantDate,
      category: "plant",
      covered: true,
    });
    addCulture(add, flower, site, addWeeks(site.lastSpringFrost, flower.bloomWeeksFromLastFrost ?? 0), false);
  } else {
    const count = flower.successionWeeks ? Math.min(8, flower.defaultSuccessions) : 1;
    const gap = flower.successionWeeks ?? 2;
    const start = flower.transplantWeeksAfterFrost ?? -6;
    const lastPlant = lastViable(site, flower.daysFromPlantToBloom);
    for (let index = 0; index < count; index += 1) {
      const plantDate = addWeeks(site.lastSpringFrost, start + index * gap);
      if (index > 0 && diffDays(lastPlant, plantDate) > 0) break;
      const title =
        count > 1 ? `Plant ${flower.commonName} (${index + 1})` : `Plant ${flower.commonName}`;
      add({
        taskKey: `${flower.slug}:spring-plant:${plantDate}`,
        flowerSlug: flower.slug,
        title,
        detail: `${flower.prep ? `${flower.prep} ` : ""}${flower.notes}${anchorNote(site)}`,
        dueDate: plantDate,
        category: "plant",
        covered: true,
      });
      addCulture(add, flower, site, plantDate, false);
    }
  }
  if (mustLift(flower, site)) addLiftOrMulch(add, flower, site);
}

function scheduleBulb(
  add: (task: TaskDraft) => void,
  flower: Flower,
  site: SitePlan,
  status: CropInput["status"],
) {
  if (status !== "established" && flower.autumnPlantWeeksBeforeFrost != null) {
    const plantDate = addWeeks(previousAutumnFrost(site), -flower.autumnPlantWeeksBeforeFrost);
    const prechill = needsPrechill(flower, site)
      ? " This winter is mild for them. Pre-chill the bulbs in a paper bag in the fridge for 10–14 weeks, away from fruit."
      : "";
    add({
      taskKey: `${flower.slug}:bulb-plant:${plantDate}`,
      flowerSlug: flower.slug,
      title: `Plant ${flower.commonName} bulbs`,
      detail: `Plant in autumn for spring flowers.${prechill} ${flower.notes}`,
      dueDate: plantDate,
      category: "plant",
      covered: false,
    });
  }
  addBloomTasks(add, flower, site, status === "planting" && flower.yearsToEstablish > 1);
  if (status === "established") {
    add({
      taskKey: `${flower.slug}:feed:${site.lastSpringFrost}`,
      flowerSlug: flower.slug,
      title: `Feed ${flower.commonName} as growth starts`,
      detail: "A light feed as the shoots appear. Don't bury the bulbs deeper while you're at it.",
      dueDate: addWeeks(site.lastSpringFrost, -3),
      category: "feed",
      covered: false,
    });
  }
}

function schedulePerennial(
  add: (task: TaskDraft) => void,
  flower: Flower,
  site: SitePlan,
  status: CropInput["status"],
) {
  if (status !== "established") {
    if (flower.autumnPlantWeeksBeforeFrost != null) {
      const plantDate = addWeeks(previousAutumnFrost(site), -flower.autumnPlantWeeksBeforeFrost);
      add({
        taskKey: `${flower.slug}:crown:${plantDate}`,
        flowerSlug: flower.slug,
        title: `Plant ${flower.commonName}`,
        detail: `${flower.notes} ${flower.yearsToEstablish > 1 ? `Expect proper cuts in year ${flower.yearsToEstablish}, not this season. The plant is busy building a crown.` : ""}`,
        dueDate: plantDate,
        category: "plant",
        covered: false,
      });
    } else if (flower.indoorWeeksBeforeFrost != null) {
      scheduleIndoor(add, flower, site, 1);
      return;
    } else {
      const plantDate = addWeeks(site.lastSpringFrost, flower.transplantWeeksAfterFrost ?? 0);
      addPlant(add, flower, site, plantDate, "Plant");
    }
  }

  const young = status !== "established" && flower.yearsToEstablish > 1;
  addBloomTasks(add, flower, site, young);

  if (status === "established" || flower.yearsToEstablish <= 1) {
    add({
      taskKey: `${flower.slug}:spring-feed:${site.seasonYear}`,
      flowerSlug: flower.slug,
      title: `Feed ${flower.commonName}`,
      detail: "A balanced feed as growth gets going. Mulch if the soil is tired, but don't smother the crown.",
      dueDate: addWeeks(site.lastSpringFrost, -2),
      category: "feed",
      covered: false,
    });
  }

  if (status === "established") {
    add({
      taskKey: `${flower.slug}:divide:${site.seasonYear}`,
      flowerSlug: flower.slug,
      title: `Divide ${flower.commonName} if the clump is crowded`,
      detail: "Every three or four years is plenty. Replant the vigorous bits, not the woody middle.",
      dueDate: addWeeks(site.firstAutumnFrost, -3),
      category: "divide",
      covered: false,
    });
    if (site.rhs && rhsRank(site.rhs) >= rhsRank("H5")) {
      add({
        taskKey: `${flower.slug}:mulch:${site.seasonYear}`,
        flowerSlug: flower.slug,
        title: `Mulch ${flower.commonName} for winter`,
        detail: "Wait until the soil has cooled, then mulch. Do it before the ground freezes solid.",
        dueDate: addDays(site.firstAutumnFrost, 7),
        category: "mulch",
        covered: false,
      });
    }
  }
}

function scheduleBiennial(
  add: (task: TaskDraft) => void,
  flower: Flower,
  site: SitePlan,
  status: CropInput["status"],
) {
  if (status !== "established") {
    const sowDate = addWeeks(addYears(site.lastSpringFrost, -1), 8);
    const plantDate = addWeeks(previousAutumnFrost(site), -6);
    add({
      taskKey: `${flower.slug}:biennial-sow:${sowDate}`,
      flowerSlug: flower.slug,
      title: `Sow ${flower.commonName} for next spring`,
      detail: `Sow in early summer. These flower the following spring, which is the deal with a biennial. ${flower.notes}`,
      dueDate: sowDate,
      category: "sow",
      covered: true,
    });
    add({
      taskKey: `${flower.slug}:biennial-plant:${plantDate}`,
      flowerSlug: flower.slug,
      title: `Plant out ${flower.commonName}`,
      detail: "Get them into their flowering spot in late summer so they can establish before winter.",
      dueDate: plantDate,
      category: "plant",
      covered: false,
    });
  }
  addBloomTasks(add, flower, site, false);
}

function addHarden(add: (task: TaskDraft) => void, flower: Flower, plantDate: string) {
  const due = addDays(plantDate, -10);
  add({
    taskKey: `${flower.slug}:harden:${due}`,
    flowerSlug: flower.slug,
    title: `Harden off ${flower.commonName}`,
    detail: "Ten days outside by day, under cover at night. Skipping this is how you get sulking plants.",
    dueDate: due,
    category: "harden",
    covered: true,
  });
}

function addPlant(
  add: (task: TaskDraft) => void,
  flower: Flower,
  site: SitePlan,
  plantDate: string,
  verb: string,
) {
  add({
    taskKey: `${flower.slug}:plant:${plantDate}`,
    flowerSlug: flower.slug,
    title: `${verb} ${flower.commonName}`,
    detail: `Space ${flower.spacingCm} cm apart in the row, ${flower.rowSpacingCm} cm between rows. ${flower.soil}${anchorNote(site)}`,
    dueDate: plantDate,
    category: "plant",
    covered: false,
  });
}

function addCulture(
  add: (task: TaskDraft) => void,
  flower: Flower,
  site: SitePlan,
  originDate: string,
  fromSow: boolean,
) {
  const pinchDate =
    flower.pinchWeeksFromLastFrost != null
      ? addWeeks(site.lastSpringFrost, flower.pinchWeeksFromLastFrost)
      : flower.pinch !== "none" && flower.pinchDaysAfterPlant != null
        ? addDays(originDate, flower.pinchDaysAfterPlant)
        : null;

  if (pinchDate && flower.pinch !== "none") {
    add({
      taskKey: `${flower.slug}:pinch:${pinchDate}`,
      flowerSlug: flower.slug,
      title: `Pinch out ${flower.commonName}`,
      detail:
        flower.pinch === "midseason"
          ? "Pinch the tip to make them branch. Keep pinching side shoots until mid-season, then let the buds form."
          : "Pinch the growing tip once they have a few true leaves. You want branches, not a single lonely stem.",
      dueDate: pinchDate,
      category: "pinch",
      covered: false,
    });
  }

  if (flower.pinch === "midseason") {
    const start = site.lastSpringFrost;
    const mid = addDays(start, Math.round(diffDays(start, site.firstAutumnFrost) / 2));
    add({
      taskKey: `${flower.slug}:stop-pinch:${mid}`,
      flowerSlug: flower.slug,
      title: `Stop pinching ${flower.commonName}`,
      detail: "They need the rest of the season to set buds. One more pinch and you'll be waiting until the frost.",
      dueDate: mid,
      category: "pinch",
      covered: false,
    });
  }

  if (flower.support !== "none" && flower.supportDaysAfterPlant != null) {
    const supportDate = addDays(originDate, flower.supportDaysAfterPlant);
    add({
      taskKey: `${flower.slug}:support:${supportDate}`,
      flowerSlug: flower.slug,
      title: `Support ${flower.commonName}`,
      detail: supportDetail(flower),
      dueDate: supportDate,
      category: "support",
      covered: false,
    });
  }

  if (flower.hungry) {
    add({
      taskKey: `${flower.slug}:feed:${originDate}`,
      flowerSlug: flower.slug,
      title: `Feed ${flower.commonName}`,
      detail: "They are hungry. A feed a week after planting, then again when the buds show, is enough. More is not a personality.",
      dueDate: addDays(originDate, 7),
      category: "feed",
      covered: false,
    });
  }

  addBloomTasks(add, flower, site, flower.yearsToEstablish > 1, originDate, fromSow);
}

function addBloomTasks(
  add: (task: TaskDraft) => void,
  flower: Flower,
  site: SitePlan,
  young: boolean,
  originDate?: string,
  fromSow?: boolean,
) {
  const start =
    flower.bloomWeeksFromLastFrost != null
      ? addWeeks(site.lastSpringFrost, flower.bloomWeeksFromLastFrost)
      : originDate
        ? addDays(
            originDate,
            fromSow
              ? (flower.daysFromSowToBloom ?? flower.daysFromPlantToBloom)
              : flower.daysFromPlantToBloom,
          )
        : addWeeks(site.lastSpringFrost, 8);
  const end = addDays(start, flower.bloomWeeks * 7);

  if (young) {
    add({
      taskKey: `${flower.slug}:patience:${start}`,
      flowerSlug: flower.slug,
      title: `Leave ${flower.commonName} to establish`,
      detail: `You may see a bud. Leave it. ${flower.commonName} takes about ${flower.yearsToEstablish} years to settle, and cutting hard now taxes the plant. ${flower.harvestStage}`,
      dueDate: start,
      category: "note",
      covered: false,
    });
    return;
  }

  add({
    taskKey: `${flower.slug}:harvest:${start}`,
    flowerSlug: flower.slug,
    title: `First cuts of ${flower.commonName}`,
    detail: `${flower.harvestStage} Vase life is about ${flower.vaseLifeDaysMin}–${flower.vaseLifeDaysMax} days. The window runs to roughly ${end}.`,
    dueDate: start,
    category: "harvest",
    covered: false,
  });

  if (flower.deadhead) {
    add({
      taskKey: `${flower.slug}:deadhead:${start}`,
      flowerSlug: flower.slug,
      title: `Deadhead ${flower.commonName} each week`,
      detail: "Cut spent flowers before they set seed, or the plant will decide its work is done.",
      dueDate: start,
      category: "deadhead",
      covered: false,
    });
  }
}

function addLiftOrMulch(add: (task: TaskDraft) => void, flower: Flower, site: SitePlan) {
  if (mustLift(flower, site)) {
    add({
      taskKey: `${flower.slug}:lift:${site.seasonYear}`,
      flowerSlug: flower.slug,
      title: `Lift and store ${flower.commonName}`,
      detail: flower.overwintering,
      dueDate: addDays(site.firstAutumnFrost, 3),
      category: "lift",
      covered: false,
    });
    return;
  }
  add({
    taskKey: `${flower.slug}:leave:${site.seasonYear}`,
    flowerSlug: flower.slug,
    title: `Mulch ${flower.commonName} and leave them in`,
    detail: site.frostFree
      ? `${flower.overwintering} There's no reliable frost to blacken the tops. Lift only if the plants are spent or the soil is soggy.`
      : `${flower.overwintering} This garden is mild enough to leave them, with a dry mulch over the crown.`,
    dueDate: addDays(site.firstAutumnFrost, 7),
    category: "mulch",
    covered: false,
  });
}

function supportDetail(flower: Flower): string {
  switch (flower.support) {
    case "netting":
      return "Put horizontal netting on before they need it. Wrestling flopped stems through netting is a hobby for nobody.";
    case "stake":
      return "One stake per stem, or a corridor of canes and string. Do it while you can still see the soil.";
    case "trellis":
      return "Get the trellis or pea netting up before planting. They will not wait politely.";
    case "corral":
      return "A square of stakes and twine around the clump. Tie it in layers as they grow.";
    default:
      return "Give them something to lean on.";
  }
}

export function tasksForWeek(tasks: TaskDraft[], weekStart: string): TaskDraft[] {
  const weekEnd = addDays(weekStart, 6);
  return tasks.filter((task) => task.dueDate >= weekStart && task.dueDate <= weekEnd);
}
