import { describe, expect, it } from "vitest";
import { flowers, flowerBySlug } from "@/data/flowers";
import { plantCount, tallEdge } from "@/lib/beds";
import { fitLabel, recommend, starterMix } from "@/lib/recommend";
import { generateTasks, type SitePlan } from "@/lib/tasks";

function site(overrides: Partial<SitePlan> = {}): SitePlan {
  return {
    seasonYear: 2027,
    hemisphere: "north",
    frostFree: false,
    occasionalFrost: false,
    anchored: false,
    lastSpringFrost: "2027-04-15",
    firstAutumnFrost: "2027-11-05",
    seasonLengthDays: 204,
    usdaZone: "8b",
    rhs: "H5",
    summer: "mild",
    tropical: false,
    ...overrides,
  };
}

function titles(flowerSlug: string, plan = site()) {
  const flower = flowerBySlug(flowerSlug);
  if (!flower) throw new Error(flowerSlug);
  return generateTasks([{ flower, status: "planting" }], plan);
}

describe("task scheduling", () => {
  it("autumn-sows sweet peas the year before they flower", () => {
    const tasks = titles("sweet-pea");
    const sow = tasks.find((task) => task.category === "sow" && task.flowerSlug === "sweet-pea");
    expect(sow?.dueDate).toBe("2026-10-15");
    expect(sow?.title.toLowerCase()).toContain("sow");
    const plant = tasks.find((task) => task.category === "plant" && task.flowerSlug === "sweet-pea");
    expect(plant?.dueDate).toBe("2027-04-01");
    expect(tasks.some((task) => task.category === "harden")).toBe(true);
  });

  it("plants dahlias after the last frost and lifts them in a cold garden", () => {
    const tasks = titles("dahlia");
    const plant = tasks.find((task) => task.category === "plant");
    expect(plant?.dueDate).toBe("2027-04-29");
    const lift = tasks.find((task) => task.category === "lift");
    expect(lift?.dueDate).toBe("2027-11-08");
  });

  it("leaves dahlias in the ground where winters stay mild", () => {
    const tasks = titles("dahlia", site({ rhs: "H3", usdaZone: "9b" }));
    expect(tasks.some((task) => task.category === "lift")).toBe(false);
    expect(tasks.some((task) => task.category === "mulch")).toBe(true);
  });

  it("starts zinnias under cover and plants them after the frost", () => {
    const tasks = titles("zinnia");
    const sow = tasks.find((task) => task.category === "sow");
    const plant = tasks.find((task) => task.category === "plant");
    expect(sow?.dueDate).toBe("2027-03-18");
    expect(plant?.dueDate).toBe("2027-04-29");
    expect(plant && sow && plant.dueDate > sow.dueDate).toBe(true);
  });

  it("puts snapdragons out around the last frost, not weeks after it", () => {
    const tasks = titles("snapdragon");
    expect(tasks.find((task) => task.category === "sow")?.dueDate).toBe("2027-02-04");
    const plant = tasks.find((task) => task.category === "plant");
    expect(plant?.dueDate).toBe("2027-04-08");
    expect(plant && plant.dueDate < "2027-04-15").toBe(true);
  });

  it("stops zinnia successions before they would miss the autumn frost", () => {
    const flower = flowerBySlug("zinnia");
    if (!flower) throw new Error("zinnia");
    const tasks = generateTasks([{ flower, status: "planting", successions: 8 }], site());
    const sows = tasks.filter((task) => task.category === "sow" && task.flowerSlug === "zinnia");
    expect(sows.length).toBeGreaterThan(1);
    expect(sows.length).toBeLessThan(8);
    expect(sows[sows.length - 1].dueDate < "2027-09-01").toBe(true);
  });

  it("schedules a southern-hemisphere zinnia in spring, not a British April", () => {
    const tasks = titles(
      "zinnia",
      site({
        seasonYear: 2026,
        hemisphere: "south",
        lastSpringFrost: "2026-10-15",
        firstAutumnFrost: "2027-04-15",
        seasonLengthDays: 182,
        rhs: "H4",
        usdaZone: "9b",
      }),
    );
    const sow = tasks.find((task) => task.category === "sow" && task.flowerSlug === "zinnia");
    expect(sow?.dueDate.startsWith("2026-09")).toBe(true);
  });

  it("plants tulips in the previous autumn", () => {
    const tasks = titles("tulip");
    const plant = tasks.find((task) => task.category === "plant");
    expect(plant?.dueDate.startsWith("2026-")).toBe(true);
    expect(plant && plant.dueDate < "2027-04-15").toBe(true);
  });
});

describe("recommendations and beds", () => {
  it("keeps a researched catalogue of at least 50 flowers", () => {
    expect(flowers.length).toBeGreaterThanOrEqual(50);
    for (const slug of ["zinnia", "cosmos", "sweet-pea", "dahlia", "peony", "ammi-majus", "eucalyptus", "ranunculus"]) {
      expect(flowerBySlug(slug), slug).toBeTruthy();
    }
    expect(flowerBySlug("sweet-pea")?.autumnSow).toBe(true);
    expect(flowerBySlug("dahlia")?.lifeCycle).toBe("tuber");
    expect(flowerBySlug("dahlia")?.transplantWeeksAfterFrost).toBeGreaterThan(0);
    expect(flowerBySlug("zinnia")?.hardyClass).toBe("tender");
    expect(flowerBySlug("peony")?.yearsToEstablish).toBeGreaterThanOrEqual(3);
  });

  it("flags lisianthus in a short cool season and peonies without a winter", () => {
    const short = site({
      seasonLengthDays: 120,
      summer: "cool",
      rhs: "H7",
      usdaZone: "5a",
      lastSpringFrost: "2027-05-20",
      firstAutumnFrost: "2027-09-17",
    });
    const lisianthus = recommend(flowers, short).find((item) => item.flower.slug === "lisianthus");
    expect(lisianthus?.fit).toBe("risky");

    const warm = site({
      frostFree: true,
      anchored: true,
      seasonLengthDays: 365,
      summer: "hot",
      rhs: "H2",
      usdaZone: "11a",
    });
    const peony = recommend(flowers, warm).find((item) => item.flower.slug === "peony");
    expect(peony?.fit).toBe("risky");
  });

  it("builds a beginner mix with a hardy annual and a filler", () => {
    const mix = starterMix(recommend(flowers, site()));
    expect(mix.length).toBeGreaterThanOrEqual(6);
    expect(mix.length).toBeLessThanOrEqual(8);
    expect(mix.some((item) => item.flower.roles.includes("filler"))).toBe(true);
    expect(
      mix.some((item) => item.flower.hardyClass === "hardy" && item.flower.lifeCycle === "annual"),
    ).toBe(true);
    expect(mix.every((item) => item.flower.difficulty !== "advanced")).toBe(true);
    expect(fitLabel("great")).toBe("A safe bet");
  });

  it("counts plants from metric spacing and puts tall plants on the poleward side", () => {
    expect(plantCount(400, 120, 25, 30)).toEqual({ perRow: 16, rows: 4, total: 64, tight: false });
    expect(plantCount(20, 120, 25, 30).tight).toBe(true);
    expect(tallEdge("north", "north")).toBe("top");
    expect(tallEdge("south", "north")).toBe("bottom");
    expect(tallEdge("north", "east")).toBe("left");
  });
});
