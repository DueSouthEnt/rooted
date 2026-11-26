/** US catalogue names shown with the UK name a gardener would say. */
const UK_NAMES: Record<string, string> = {
  zucchini: "Courgette",
  courgette: "Courgette",
  scallion: "Spring onion",
  "spring onion": "Spring onion",
  beet: "Beetroot",
  beetroot: "Beetroot",
  "snap pea": "Sugar snap pea",
  "sugar snap": "Sugar snap pea",
  "sugar snap pea": "Sugar snap pea",
  mangetout: "Mangetout",
  "bush bean": "French bean",
  "french bean": "French bean",
  "fava bean": "Broad bean",
  "broad bean": "Broad bean",
  arugula: "Rocket",
  rocket: "Rocket",
  cilantro: "Coriander",
  coriander: "Coriander",
  rutabaga: "Swede",
  swede: "Swede",
  eggplant: "Aubergine",
  aubergine: "Aubergine",
  "salad mix": "Salad leaves",
  "baby lettuce": "Baby lettuce",
  "head lettuce": "Head lettuce",
  "swiss chard": "Swiss chard",
};

/** Other words that should still find the crop. */
const SEARCH_ALIASES: Record<string, string[]> = {
  Courgette: ["zucchini"],
  "Spring onion": ["scallion", "green onion"],
  Beetroot: ["beet"],
  "Sugar snap pea": ["snap pea", "mangetout", "sugar snap"],
  Mangetout: ["snow pea", "snap pea"],
  "French bean": ["bush bean", "green bean"],
  "Broad bean": ["fava", "fava bean"],
  Rocket: ["arugula"],
  Coriander: ["cilantro"],
  Swede: ["rutabaga"],
  Aubergine: ["eggplant"],
  "Salad leaves": ["salad mix", "mesclun"],
};

export function ukCropName(name: string): string {
  const mapped = UK_NAMES[name.trim().toLowerCase()];
  return mapped ?? name;
}

export function cropSearchBlob(name: string, extra = ""): string {
  const uk = ukCropName(name);
  const aliases = SEARCH_ALIASES[uk] ?? [];
  return [name, uk, ...aliases, extra].join(" ").toLowerCase();
}

export function cropMatchesQuery(name: string, extra: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return cropSearchBlob(name, extra).includes(needle);
}
