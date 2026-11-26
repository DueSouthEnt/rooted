import { describe, expect, it } from "vitest";
import { assessFrostRisk } from "@/lib/veg/frost";
import { haversineKm, nearestPlace, parseLatLng, ukPostcodeArea } from "@/lib/veg/geo";
import { FROST_LOCATIONS } from "@/lib/veg/seed/frost-locations";
import { POSTCODE_AREAS } from "@/lib/veg/seed/postcode-areas";

describe("assessFrostRisk", () => {
  const oxford = { lastSpringFrost: "04-05", firstAutumnFrost: "11-12" };

  it("warns when a tender crop goes out before the last spring frost and suggests a later date", () => {
    const result = assessFrostRisk({
      tolerance: "tender",
      fieldPlantingDate: "2026-03-24",
      lastHarvestDate: "2026-08-01",
      ...oxford,
    });
    expect(result.warnings[0]?.code).toBe("before_last_frost");
    expect(result.warnings[0]?.message).toContain("12 days before");
    expect(result.warnings[0]?.severity).toBe("risk");
    expect(result.suggestedFieldDate).toBe("2026-04-12");
  });

  it("lets hardy crops go out before the last frost without a warning", () => {
    const result = assessFrostRisk({
      tolerance: "hardy",
      fieldPlantingDate: "2026-03-10",
      lastHarvestDate: "2026-05-20",
      ...oxford,
    });
    expect(result.warnings).toEqual([]);
  });

  it("cautions on a half-hardy crop sown well before the last frost", () => {
    const result = assessFrostRisk({
      tolerance: "half_hardy",
      fieldPlantingDate: "2026-03-01",
      lastHarvestDate: "2026-06-15",
      ...oxford,
    });
    expect(result.warnings[0]?.severity).toBe("caution");
    expect(result.suggestedFieldDate).toBe("2026-04-05");
  });

  it("does not treat an October garlic planting as a spring-frost problem", () => {
    const result = assessFrostRisk({
      tolerance: "hardy",
      fieldPlantingDate: "2026-10-30",
      lastHarvestDate: "2027-06-27",
      ...oxford,
    });
    expect(result.warnings.find((warning) => warning.code === "before_last_frost")).toBeUndefined();
  });

  it("warns when a tender harvest runs past the first autumn frost", () => {
    const result = assessFrostRisk({
      tolerance: "tender",
      fieldPlantingDate: "2026-06-01",
      lastHarvestDate: "2026-11-20",
      ...oxford,
    });
    expect(result.warnings.some((warning) => warning.code === "harvest_after_first_frost")).toBe(true);
  });
});

describe("nearest frost location", () => {
  it("picks Edinburgh rather than London for an Edinburgh coordinate", () => {
    const nearest = nearestPlace(55.95, -3.19, FROST_LOCATIONS);
    expect(nearest?.name).toMatch(/Edinburgh/i);
  });

  it("measures a short hop between Oxford and Heathrow as under 100 km", () => {
    const oxford = FROST_LOCATIONS.find((place) => place.name.startsWith("Oxford"));
    const heathrow = FROST_LOCATIONS.find((place) => place.name.startsWith("Heathrow"));
    expect(oxford && heathrow).toBeTruthy();
    expect(haversineKm(oxford!.latitude, oxford!.longitude, heathrow!.latitude, heathrow!.longitude)).toBeLessThan(100);
  });

  it("reads a lat,lng pair and a UK postcode area", () => {
    expect(parseLatLng("51.75, -1.26")).toEqual({ latitude: 51.75, longitude: -1.26 });
    expect(ukPostcodeArea("EH1 1YZ")).toBe("EH");
    expect(ukPostcodeArea("SW1A 1AA")).toBe("SW");
    expect(POSTCODE_AREAS.EH).toBeTruthy();
    const nearest = nearestPlace(POSTCODE_AREAS.EH.latitude, POSTCODE_AREAS.EH.longitude, FROST_LOCATIONS);
    expect(nearest?.name).toMatch(/Edinburgh/i);
  });
});
