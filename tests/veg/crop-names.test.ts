import { describe, expect, it } from "vitest";
import { cropMatchesQuery, ukCropName } from "@/lib/veg/crop-names";

describe("ukCropName", () => {
  it("shows the UK name and still finds the US word", () => {
    expect(ukCropName("Zucchini")).toBe("Courgette");
    expect(ukCropName("Scallion")).toBe("Spring onion");
    expect(ukCropName("Beet")).toBe("Beetroot");
    expect(ukCropName("Bush Bean")).toBe("French bean");
    expect(ukCropName("Arugula")).toBe("Rocket");
    expect(ukCropName("Cilantro")).toBe("Coriander");
    expect(ukCropName("Snap Pea")).toBe("Sugar snap pea");
    expect(ukCropName("Carrot")).toBe("Carrot");
    expect(cropMatchesQuery("Zucchini", "Dunja", "courgette")).toBe(true);
    expect(cropMatchesQuery("Zucchini", "Dunja", "zucchini")).toBe(true);
    expect(cropMatchesQuery("Cilantro", "Santo", "coriander")).toBe(true);
  });
});
