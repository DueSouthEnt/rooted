import type { FrostTolerance } from "@/lib/veg/frost";
import type { PlantingMethod } from "@/lib/veg/types";

export type VegetableSeed = {
  id: string;
  name: string;
  family: string;
  category: string;
  frostTolerance: FrostTolerance;
  minSoilTempC: number;
  color: string;
  plantingMethod: PlantingMethod;
  daysToMaturity: number;
  daysInNursery: number;
  harvestWindowDays: number;
  rowsPerBed: number;
  inRowSpacingCm: number;
  betweenRowCm: number;
  yieldPer100BedFeet: number;
  yieldUnit: string;
  germinationTempMin: number;
  germinationTempMax: number;
  germinationDaysMin: number;
  germinationDaysMax: number;
  sowIndoors: [number, number] | null;
  sowOutdoors: [number, number] | null;
  transplant: [number, number] | null;
  notes: string;
};

function veg(
  id: string,
  name: string,
  family: string,
  category: string,
  frostTolerance: FrostTolerance,
  minSoilTempC: number,
  color: string,
  plantingMethod: PlantingMethod,
  daysToMaturity: number,
  daysInNursery: number,
  harvestWindowDays: number,
  rowsPerBed: number,
  inRowSpacingCm: number,
  betweenRowCm: number,
  yieldPer100BedFeet: number,
  yieldUnit: string,
  germinationTempMin: number,
  germinationTempMax: number,
  germinationDaysMin: number,
  germinationDaysMax: number,
  sowIndoors: [number, number] | null,
  sowOutdoors: [number, number] | null,
  transplant: [number, number] | null,
  notes: string,
): VegetableSeed {
  return {
    id, name, family, category, frostTolerance, minSoilTempC, color, plantingMethod,
    daysToMaturity, daysInNursery, harvestWindowDays, rowsPerBed, inRowSpacingCm, betweenRowCm,
    yieldPer100BedFeet, yieldUnit, germinationTempMin, germinationTempMax, germinationDaysMin,
    germinationDaysMax, sowIndoors, sowOutdoors, transplant, notes,
  };
}

/** Crop-level facts used when a packet does not print its own number. Windows are UK temperate months. */
export const VEGETABLES: VegetableSeed[] = [
  veg("veg_carrot", "Carrot", "Apiaceae", "Roots", "hardy", 7, "#e07a3d", "direct_seeded", 70, 0, 21, 6, 2.5, 15, 140, "lbs", 7, 24, 10, 21, null, [3, 7], null, "Direct sow in rows. Roots stand light frost; lift before the ground freezes solid."),
  veg("veg_parsnip", "Parsnip", "Apiaceae", "Roots", "hardy", 8, "#e6c27a", "direct_seeded", 120, 0, 30, 3, 10, 30, 100, "lbs", 10, 20, 14, 28, null, [3, 5], null, "Slow to germinate. Flavour improves after frost."),
  veg("veg_celeriac", "Celeriac", "Apiaceae", "Roots", "half_hardy", 12, "#c4b48a", "transplanted", 110, 70, 21, 2, 30, 40, 80, "lbs", 15, 21, 14, 21, [2, 4], null, [5, 6], "Long nursery period. The crown is damaged by a hard frost."),
  veg("veg_celery", "Celery", "Apiaceae", "Stems", "half_hardy", 12, "#8fbf6a", "transplanted", 90, 70, 21, 2, 25, 30, 80, "heads", 15, 21, 14, 21, [3, 4], null, [5, 6], "Needs steady water. A light frost checks growth."),
  veg("veg_fennel", "Florence fennel", "Apiaceae", "Stems", "half_hardy", 10, "#d5e2b8", "direct_seeded", 80, 0, 14, 3, 20, 30, 40, "bulbs", 15, 22, 7, 14, [4, 5], [5, 7], [5, 7], "Bolts if checked by cold. Sow after the soil has warmed."),
  veg("veg_beet", "Beetroot", "Amaranthaceae", "Roots", "half_hardy", 8, "#8e2f45", "direct_seeded", 55, 0, 21, 4, 8, 20, 90, "bunches", 10, 24, 7, 14, [3, 4], [4, 7], [4, 6], "Each seed cluster is several embryos. Tops tolerate a light frost."),
  veg("veg_chard", "Swiss chard", "Amaranthaceae", "Greens", "half_hardy", 8, "#c4546a", "direct_seeded", 55, 0, 40, 3, 20, 30, 80, "bunches", 10, 24, 7, 14, [3, 5], [4, 7], [4, 7], "Leaf harvest over a long window. Hard frost burns the leaf."),
  veg("veg_spinach", "Spinach", "Amaranthaceae", "Greens", "hardy", 5, "#3e8f5a", "direct_seeded", 40, 0, 21, 6, 3, 15, 50, "lbs", 5, 20, 6, 14, null, [3, 5], null, "Best in cool weather. Autumn sowings stand frost under a cover."),
  veg("veg_orach", "Orach", "Amaranthaceae", "Greens", "half_hardy", 8, "#c45a6a", "direct_seeded", 40, 0, 21, 3, 15, 25, 30, "lbs", 10, 20, 7, 14, null, [4, 7], null, "Warm-season spinach substitute. Pick young leaves."),
  veg("veg_cabbage", "Cabbage", "Brassicaceae", "Brassicas", "hardy", 7, "#3d7a4a", "transplanted", 80, 35, 21, 2, 40, 40, 90, "heads", 10, 24, 5, 10, [2, 6], [3, 7], [4, 8], "Spring, summer and winter types differ in hardiness. Winter kinds stand frost."),
  veg("veg_kale", "Kale", "Brassicaceae", "Brassicas", "hardy", 7, "#1f6b45", "transplanted", 55, 28, 50, 3, 30, 40, 90, "bunches", 10, 24, 5, 10, [3, 6], [4, 7], [4, 8], "Leaf kale is among the hardiest market-garden greens."),
  veg("veg_cauliflower", "Cauliflower", "Brassicaceae", "Brassicas", "half_hardy", 8, "#e6e2c8", "transplanted", 80, 35, 10, 2, 45, 50, 70, "heads", 10, 24, 5, 10, [2, 6], null, [4, 7], "Curds mark if growth is checked by cold or drought."),
  veg("veg_calabrese", "Calabrese", "Brassicaceae", "Brassicas", "half_hardy", 8, "#2a6b48", "transplanted", 70, 28, 14, 2, 40, 45, 70, "heads", 10, 24, 5, 10, [3, 6], null, [4, 7], "Summer broccoli. The main head is cut before the buds open."),
  veg("veg_sprouting", "Sprouting broccoli", "Brassicaceae", "Brassicas", "hardy", 7, "#3d6b45", "transplanted", 220, 35, 40, 2, 60, 60, 40, "bunches", 10, 24, 5, 10, [5, 6], null, [6, 7], "Overwinters and spears in late winter or spring."),
  veg("veg_brussels", "Brussels sprouts", "Brassicaceae", "Brassicas", "hardy", 7, "#2f5c3a", "transplanted", 120, 35, 40, 1, 60, 70, 60, "lbs", 10, 24, 5, 10, [3, 4], null, [5, 6], "Buttons firm up after frost. A long season crop."),
  veg("veg_kohlrabi", "Kohlrabi", "Brassicaceae", "Brassicas", "half_hardy", 8, "#8fbf7a", "direct_seeded", 50, 0, 14, 3, 15, 25, 60, "bulbs", 10, 24, 5, 10, [3, 6], [4, 7], [4, 7], "Harvest the swollen stem while it is still tender."),
  veg("veg_turnip", "Turnip", "Brassicaceae", "Roots", "hardy", 7, "#f0e6c8", "direct_seeded", 50, 0, 14, 4, 8, 20, 70, "bunches", 10, 22, 4, 8, null, [3, 8], null, "Quick root. Autumn sowings stand frost."),
  veg("veg_swede", "Swede", "Brassicaceae", "Roots", "hardy", 7, "#e0c070", "direct_seeded", 120, 0, 30, 3, 15, 30, 120, "lbs", 10, 22, 5, 10, null, [5, 6], null, "Maincrop root for autumn and winter. Flavour sweetens after frost."),
  veg("veg_radish", "Radish", "Brassicaceae", "Roots", "hardy", 5, "#d4536a", "direct_seeded", 28, 0, 7, 6, 2.5, 10, 100, "bunches", 8, 24, 4, 8, null, [3, 9], null, "A catch crop. Summer heat makes them pithy."),
  veg("veg_mooli", "Mooli", "Brassicaceae", "Roots", "half_hardy", 10, "#f4f0e4", "direct_seeded", 60, 0, 14, 3, 10, 25, 80, "lbs", 12, 25, 4, 8, null, [6, 8], null, "Long white radish. Sow in summer so it does not bolt."),
  veg("veg_pakchoi", "Pak choi", "Brassicaceae", "Greens", "half_hardy", 8, "#6a9a48", "direct_seeded", 45, 0, 14, 4, 15, 20, 50, "heads", 10, 22, 4, 8, [3, 7], [4, 8], [4, 8], "Bolt-prone in a cold spring. Autumn crops are steadier."),
  veg("veg_chinese_cabbage", "Chinese cabbage", "Brassicaceae", "Greens", "half_hardy", 10, "#9bc36b", "direct_seeded", 70, 0, 14, 3, 25, 30, 70, "heads", 15, 22, 4, 8, null, [6, 8], null, "Sow after midsummer. Spring sowings run to flower."),
  veg("veg_mizuna", "Mizuna", "Brassicaceae", "Greens", "hardy", 5, "#7dae4c", "direct_seeded", 35, 0, 21, 6, 5, 15, 40, "lbs", 8, 22, 4, 8, null, [3, 9], null, "Cut-and-come salad mustard. Stands frost."),
  veg("veg_mustard", "Mustard greens", "Brassicaceae", "Greens", "hardy", 6, "#6b8f3a", "direct_seeded", 35, 0, 14, 6, 5, 15, 35, "lbs", 8, 22, 4, 8, null, [3, 9], null, "Peppery leaves for salad or bunching."),
  veg("veg_rocket", "Rocket", "Brassicaceae", "Greens", "hardy", 5, "#5c8a3e", "direct_seeded", 30, 0, 14, 6, 3, 12, 30, "lbs", 8, 22, 4, 8, null, [3, 9], null, "Wild and salad rocket both stand a frost. Heat makes them hot."),
  veg("veg_tatsoi", "Tatsoi", "Brassicaceae", "Greens", "hardy", 5, "#3e6b45", "direct_seeded", 45, 0, 21, 4, 15, 20, 40, "heads", 8, 22, 4, 8, null, [3, 9], null, "Rosette mustard. Very cold-tolerant."),
  veg("veg_komatsuna", "Komatsuna", "Brassicaceae", "Greens", "hardy", 6, "#4a7a40", "direct_seeded", 40, 0, 21, 4, 10, 20, 40, "bunches", 8, 22, 4, 8, null, [3, 9], null, "Mild mustard spinach. Useful in the shoulder seasons."),
  veg("veg_lettuce", "Lettuce", "Asteraceae", "Greens", "half_hardy", 5, "#8fbf6a", "transplanted", 50, 21, 14, 3, 25, 30, 90, "heads", 5, 20, 4, 10, [2, 8], [3, 8], [3, 9], "A light frost marks outer leaves. Hearted types are less hardy than loose leaf."),
  veg("veg_chicory", "Chicory", "Asteraceae", "Greens", "hardy", 8, "#c4d48a", "direct_seeded", 80, 0, 21, 3, 20, 30, 50, "heads", 10, 22, 6, 12, [5, 6], [6, 7], null, "Heading chicory and forcing types. Many stand winter outdoors."),
  veg("veg_endive", "Endive", "Asteraceae", "Greens", "half_hardy", 8, "#d5e6a8", "direct_seeded", 70, 0, 14, 3, 25, 30, 50, "heads", 10, 22, 5, 10, [4, 7], [5, 8], [5, 8], "Blanch the heart. A hard frost collapses the head."),
  veg("veg_onion", "Onion", "Amaryllidaceae", "Alliums", "hardy", 5, "#c6b48a", "transplanted", 120, 50, 14, 4, 8, 25, 150, "lbs", 10, 22, 10, 14, [1, 3], [3, 4], [4, 5], "Sets or transplants. Bulbs need a dry finish, not frost protection."),
  veg("veg_shallot", "Shallot", "Amaryllidaceae", "Alliums", "hardy", 5, "#d4c09a", "direct_seeded", 100, 0, 14, 4, 15, 25, 80, "lbs", 10, 20, 10, 14, null, [2, 4], null, "Sets go out in early spring and stand frost."),
  veg("veg_scallion", "Spring onion", "Amaryllidaceae", "Alliums", "hardy", 5, "#5e8f52", "direct_seeded", 60, 0, 21, 6, 2, 10, 120, "bunches", 10, 22, 8, 14, [2, 3], [3, 8], null, "Successional sowings. Overwintering kinds stand frost."),
  veg("veg_leek", "Leek", "Amaryllidaceae", "Alliums", "hardy", 5, "#6a8f55", "transplanted", 140, 50, 40, 3, 15, 30, 100, "bunches", 10, 20, 10, 14, [2, 4], null, [5, 7], "Winter leeks are fully hardy and stand in the bed."),
  veg("veg_garlic", "Garlic", "Amaryllidaceae", "Alliums", "hardy", 2, "#c6b48a", "direct_seeded", 240, 0, 14, 4, 15, 20, 50, "lbs", 5, 15, 10, 21, null, [10, 11], null, "Plant cloves in autumn. Needs a cold spell to split into cloves."),
  veg("veg_chive", "Chives", "Amaryllidaceae", "Herbs", "hardy", 5, "#6a9a48", "direct_seeded", 80, 0, 30, 4, 10, 20, 20, "bunches", 10, 20, 10, 14, [3, 4], [4, 6], null, "Perennial. Dies back in winter and returns."),
  veg("veg_pea", "Pea", "Fabaceae", "Legumes", "hardy", 5, "#88b04b", "direct_seeded", 70, 0, 14, 2, 5, 40, 35, "lbs", 8, 20, 7, 14, null, [3, 6], null, "Early sowings stand frost. Mangetout and shelling peas share the same window."),
  veg("veg_broad_bean", "Broad bean", "Fabaceae", "Legumes", "hardy", 5, "#6d9140", "direct_seeded", 90, 0, 21, 2, 20, 40, 50, "lbs", 8, 18, 7, 14, null, [2, 4], null, "Autumn or early spring sowings. Flowers are damaged by a hard frost."),
  veg("veg_french_bean", "French bean", "Fabaceae", "Legumes", "tender", 12, "#6d9140", "direct_seeded", 60, 0, 21, 2, 8, 40, 60, "lbs", 15, 25, 7, 12, [4, 5], [5, 7], [5, 6], "Killed by frost. Do not sow outdoors until the soil is warm."),
  veg("veg_runner", "Runner bean", "Fabaceae", "Legumes", "tender", 12, "#c4392a", "direct_seeded", 70, 0, 30, 1, 20, 40, 80, "lbs", 15, 22, 7, 12, [4, 5], [5, 6], [5, 6], "A frost ends the crop. Poles or a wigwam."),
  veg("veg_soy", "Soya bean", "Fabaceae", "Legumes", "tender", 15, "#c4b06a", "direct_seeded", 80, 0, 14, 2, 8, 30, 30, "lbs", 18, 25, 6, 10, [4, 5], [5, 6], null, "Needs a warm summer. Edamame is the same species, picked green."),
  veg("veg_tomato", "Tomato", "Solanaceae", "Fruiting", "tender", 16, "#c4392a", "transplanted", 75, 42, 50, 1, 45, 60, 400, "lbs", 18, 27, 6, 12, [2, 4], null, [5, 6], "Frost kills the plant. Outdoor crops need a warm site."),
  veg("veg_pepper", "Sweet pepper", "Solanaceae", "Fruiting", "tender", 18, "#c45a2a", "transplanted", 70, 56, 30, 2, 40, 45, 80, "lbs", 20, 28, 8, 14, [2, 4], null, [5, 6], "Needs more heat than tomato. A frost ends the crop."),
  veg("veg_chilli", "Chilli", "Solanaceae", "Fruiting", "tender", 18, "#a32020", "transplanted", 80, 56, 30, 2, 40, 45, 20, "lbs", 20, 30, 8, 16, [2, 4], null, [5, 6], "Long season under cover. Fruit ripens off the plant if frost threatens."),
  veg("veg_aubergine", "Aubergine", "Solanaceae", "Fruiting", "tender", 18, "#5a3a6a", "transplanted", 70, 56, 21, 1, 50, 60, 40, "lbs", 20, 30, 8, 16, [2, 3], null, [5, 6], "Greenhouse crop in a cool summer. Frost kills it."),
  veg("veg_tomatillo", "Tomatillo", "Solanaceae", "Fruiting", "tender", 16, "#c4d45a", "transplanted", 75, 42, 21, 1, 60, 80, 40, "lbs", 18, 27, 6, 12, [3, 4], null, [5, 6], "Husk covers the fruit. Treat like a tomato for frost."),
  veg("veg_cucumber", "Cucumber", "Cucurbitaceae", "Fruiting", "tender", 16, "#3f8f4a", "transplanted", 60, 21, 28, 1, 30, 50, 200, "lbs", 18, 28, 4, 8, [4, 5], [5, 6], [5, 6], "Ridge and greenhouse types are both killed by frost."),
  veg("veg_courgette", "Courgette", "Cucurbitaceae", "Fruiting", "tender", 15, "#7a9a38", "transplanted", 50, 21, 35, 1, 60, 90, 180, "lbs", 18, 27, 4, 8, [4, 5], [5, 6], [5, 6], "One frost finishes the plant. Harvest fruit small."),
  veg("veg_squash", "Winter squash", "Cucurbitaceae", "Fruiting", "tender", 15, "#e07a3d", "transplanted", 100, 21, 14, 1, 90, 120, 150, "lbs", 18, 27, 4, 8, [4, 5], null, [5, 6], "Cure the fruit before storage. The vine is tender; the cured fruit is not."),
  veg("veg_pumpkin", "Pumpkin", "Cucurbitaceae", "Fruiting", "tender", 15, "#e08a2a", "transplanted", 110, 21, 14, 1, 100, 150, 200, "lbs", 18, 27, 4, 8, [4, 5], null, [5, 6], "Needs a long warm season. Harvest before a hard frost."),
  veg("veg_melon", "Melon", "Cucurbitaceae", "Fruiting", "tender", 18, "#e6c45a", "transplanted", 90, 28, 14, 1, 50, 80, 40, "lbs", 20, 30, 5, 10, [4, 5], null, [5, 6], "A greenhouse crop in a cool summer."),
  veg("veg_sweetcorn", "Sweetcorn", "Poaceae", "Fruiting", "tender", 15, "#e6c84a", "direct_seeded", 85, 0, 10, 2, 20, 40, 40, "cobs", 16, 30, 6, 10, [4, 5], [5, 6], [5, 6], "Sow in blocks for pollination. Frost kills seedlings."),
  veg("veg_basil", "Basil", "Lamiaceae", "Herbs", "tender", 18, "#2f7a49", "transplanted", 30, 28, 40, 3, 20, 25, 30, "lbs", 18, 25, 5, 10, [3, 6], [6, 7], [5, 7], "A cold night blackens the leaf. Keep it under cover in a cool spring."),
  veg("veg_coriander", "Coriander", "Apiaceae", "Herbs", "half_hardy", 10, "#6a9a48", "direct_seeded", 45, 0, 10, 4, 5, 15, 30, "bunches", 12, 20, 7, 14, null, [4, 8], null, "Bolts in heat. A light frost is tolerated; a hard one is not."),
  veg("veg_dill", "Dill", "Apiaceae", "Herbs", "half_hardy", 10, "#8fbf6a", "direct_seeded", 50, 0, 14, 3, 10, 20, 15, "bunches", 12, 20, 7, 14, null, [4, 7], null, "Leaf and seed crops. Dislikes transplanting."),
  veg("veg_parsley", "Parsley", "Apiaceae", "Herbs", "hardy", 8, "#3e8f5a", "direct_seeded", 80, 0, 40, 3, 15, 20, 30, "bunches", 10, 24, 14, 28, [2, 4], [3, 7], null, "Biennial. Curly and flat-leaf both stand winter in many districts."),
  veg("veg_chervil", "Chervil", "Apiaceae", "Herbs", "hardy", 8, "#9bc36b", "direct_seeded", 45, 0, 21, 4, 8, 15, 15, "bunches", 10, 18, 7, 14, null, [3, 8], null, "Cool-season herb. Runs to seed in summer heat."),
  veg("veg_sorrel", "Sorrel", "Polygonaceae", "Greens", "hardy", 5, "#4a7a32", "direct_seeded", 60, 0, 40, 3, 20, 30, 30, "bunches", 8, 18, 7, 14, null, [3, 6], null, "Perennial. Leaves return after frost."),
  veg("veg_corn_salad", "Corn salad", "Caprifoliaceae", "Greens", "hardy", 5, "#8fbf6a", "direct_seeded", 50, 0, 21, 6, 5, 12, 20, "lbs", 8, 18, 7, 14, null, [8, 9], null, "Lamb's lettuce. An autumn sowing stands the winter."),
  veg("veg_purslane", "Winter purslane", "Montiaceae", "Greens", "hardy", 5, "#7a9a48", "direct_seeded", 40, 0, 21, 4, 10, 15, 15, "lbs", 8, 16, 7, 14, null, [8, 9], null, "Claytonia. A mild winter salad."),
  veg("veg_summer_purslane", "Summer purslane", "Portulacaceae", "Greens", "tender", 15, "#c45a4a", "direct_seeded", 40, 0, 14, 4, 8, 15, 15, "lbs", 18, 25, 5, 10, null, [5, 7], null, "Warm-season purslane. Frost kills it."),
  veg("veg_asparagus", "Asparagus", "Asparagaceae", "Perennials", "hardy", 8, "#6a8f3a", "transplanted", 730, 0, 40, 1, 40, 90, 20, "lbs", 15, 24, 14, 21, [2, 3], null, [3, 4], "A perennial. Do not cut spears in the first year."),
  veg("veg_artichoke", "Globe artichoke", "Asteraceae", "Perennials", "half_hardy", 10, "#6a8f55", "transplanted", 150, 50, 21, 1, 90, 120, 10, "heads", 15, 22, 10, 18, [2, 3], null, [4, 5], "Crowns need winter protection in cold districts."),
  veg("veg_rhubarb", "Rhubarb", "Polygonaceae", "Perennials", "hardy", 5, "#c4392a", "transplanted", 365, 0, 40, 1, 90, 120, 40, "lbs", 10, 18, 14, 28, null, null, [11, 3], "Crowns are hardy. Pull stems, do not cut them."),
  veg("veg_okra", "Okra", "Malvaceae", "Fruiting", "tender", 18, "#6a8f32", "transplanted", 60, 28, 21, 1, 40, 50, 20, "lbs", 20, 30, 6, 12, [3, 4], null, [5, 6], "A hot-summer crop. Frost kills the plant."),
  veg("veg_new_zealand_spinach", "New Zealand spinach", "Aizoaceae", "Greens", "half_hardy", 12, "#5a8a40", "direct_seeded", 60, 0, 40, 2, 30, 40, 40, "lbs", 15, 22, 10, 20, [4, 5], [5, 6], null, "A warm-season spinach that keeps going in summer."),
  veg("veg_land_cress", "Land cress", "Brassicaceae", "Greens", "hardy", 5, "#4a7a32", "direct_seeded", 40, 0, 21, 4, 10, 15, 20, "bunches", 8, 18, 5, 10, null, [3, 9], null, "Watercress flavour from dry ground. Stands frost."),
  veg("veg_salsify", "Salsify", "Asteraceae", "Roots", "hardy", 7, "#e6d7b0", "direct_seeded", 120, 0, 21, 3, 10, 25, 40, "lbs", 10, 20, 10, 18, null, [4, 5], null, "Long root. Leave it until after frost to lift."),
  veg("veg_scorzonera", "Scorzonera", "Asteraceae", "Roots", "hardy", 7, "#3a3228", "direct_seeded", 140, 0, 21, 3, 10, 25, 30, "lbs", 10, 20, 10, 18, null, [4, 5], null, "Black-skinned root. Often left for a second year."),
  veg("veg_hamburg_parsley", "Hamburg parsley", "Apiaceae", "Roots", "hardy", 7, "#c4b48a", "direct_seeded", 100, 0, 21, 3, 10, 25, 40, "lbs", 10, 20, 14, 24, null, [3, 5], null, "A parsley-flavoured root. Hardy in the ground."),
  veg("veg_texsel", "Texsel greens", "Brassicaceae", "Greens", "hardy", 6, "#7a9a40", "direct_seeded", 35, 0, 14, 6, 5, 15, 25, "lbs", 8, 20, 4, 8, null, [3, 9], null, "Ethiopian mustard bred for leaves. Quick and cold-tolerant."),
  veg("veg_shiso", "Shiso", "Lamiaceae", "Herbs", "tender", 16, "#6a3a4a", "transplanted", 70, 28, 30, 3, 20, 25, 10, "bunches", 18, 24, 7, 14, [3, 5], null, [5, 6], "Perilla. Treat like basil for warmth."),
  veg("veg_thyme", "Thyme", "Lamiaceae", "Herbs", "hardy", 10, "#6a7a40", "transplanted", 90, 42, 40, 3, 20, 25, 8, "bunches", 15, 22, 10, 18, [3, 4], null, [5, 6], "Woody perennial. Established plants stand frost."),
  veg("veg_sage", "Sage", "Lamiaceae", "Herbs", "hardy", 10, "#8a8a58", "transplanted", 90, 42, 40, 2, 30, 40, 8, "bunches", 15, 22, 10, 18, [3, 4], null, [5, 6], "Perennial. Wet cold is harder on it than frost."),
  veg("veg_lovage", "Lovage", "Apiaceae", "Herbs", "hardy", 8, "#4a7a32", "direct_seeded", 90, 0, 30, 1, 40, 60, 10, "bunches", 10, 18, 10, 18, [3, 4], [4, 5], null, "A tall perennial with a celery flavour."),
];

const BY_NAME = new Map(VEGETABLES.map((vegetable) => [vegetable.name.toLowerCase(), vegetable]));

export function vegetableForName(name: string): VegetableSeed | undefined {
  return BY_NAME.get(name.toLowerCase());
}
