import { describe, expect, it } from "vitest";
import { VEGETABLES } from "@/lib/veg/seed/vegetables";
import varietyFile from "@/lib/veg/seed/varieties.json";
import { FROST_LOCATIONS } from "@/lib/veg/seed/frost-locations";

describe("catalogue size", () => {
  it("covers the common market-garden crops and several hundred varieties", () => {
    expect(VEGETABLES.length).toBeGreaterThanOrEqual(60);
    expect(varietyFile.varieties.length).toBeGreaterThanOrEqual(200);
    const families = new Set(VEGETABLES.map((vegetable) => vegetable.family));
    expect(families.has("Brassicaceae")).toBe(true);
    expect(families.has("Solanaceae")).toBe(true);
    expect(families.has("Cucurbitaceae")).toBe(true);
    expect(families.has("Fabaceae")).toBe(true);
    expect(families.has("Amaryllidaceae")).toBe(true);
  });

  it("includes frost stations in every UK country", () => {
    const regions = new Set(FROST_LOCATIONS.map((place) => place.region));
    expect(FROST_LOCATIONS.length).toBeGreaterThanOrEqual(30);
    expect(regions.has("Scotland")).toBe(true);
    expect(regions.has("Wales")).toBe(true);
    expect(regions.has("Northern Ireland")).toBe(true);
  });
});
