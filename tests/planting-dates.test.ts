import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { composeFlowerDates } from "@/lib/planting-dates";

describe("planting dialog dates", () => {
  it("works plant-out and first bloom forward from a sow date", () => {
    const dates = composeFlowerDates({
      style: "indoor",
      sowDate: "2027-03-01",
      daysInNursery: 28,
      daysToMaturity: 45,
      bloomWeeks: 10,
    });
    expect(dates.nurseryStart).toBe("2027-03-01");
    expect(dates.fieldDate).toBe("2027-03-29");
    expect(dates.bloomStart).toBe(addDays("2027-03-29", 45));
    expect(dates.bloomEnd).toBe(addDays(dates.bloomStart, 10 * 7 - 1));
  });

  it("sows direct on the day it goes into the bed", () => {
    const dates = composeFlowerDates({
      style: "direct",
      sowDate: "2027-04-12",
      daysInNursery: 28,
      daysToMaturity: 50,
      bloomWeeks: 8,
    });
    expect(dates.nurseryStart).toBeNull();
    expect(dates.fieldDate).toBe("2027-04-12");
    expect(dates.bloomStart).toBe(addDays("2027-04-12", 50));
  });

  it("keeps a plant-out date you typed, and still moves the bloom with days to maturity", () => {
    const dates = composeFlowerDates({
      style: "indoor",
      sowDate: "2027-03-01",
      daysInNursery: 28,
      daysToMaturity: 60,
      bloomWeeks: 6,
      fieldDate: "2027-04-20",
    });
    expect(dates.fieldDate).toBe("2027-04-20");
    expect(dates.bloomStart).toBe(addDays("2027-04-20", 60));
  });
});
