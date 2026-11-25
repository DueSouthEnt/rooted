/** Flower and vegetable sections of Seed to Harvest. */
export const SECTIONS = ["flowers", "veg"] as const;

export type Section = (typeof SECTIONS)[number];

export function isSection(value: string): value is Section {
  return value === "flowers" || value === "veg";
}

/**
 * Keep flowers and veg, drop anything else, and drop duplicates.
 * Order is always flowers, then veg. An empty result means nothing was chosen.
 * The signup trigger uses the same rules and falls back to flowers when metadata is missing.
 */
export function normalizeSections(value: unknown): Section[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const found = new Set<Section>();
  for (const item of raw) {
    const text = String(item).trim();
    if (isSection(text)) found.add(text);
  }
  return SECTIONS.filter((section) => found.has(section));
}

export function sectionsFromForm(values: readonly FormDataEntryValue[]): Section[] {
  return normalizeSections(values.map((value) => String(value)));
}

export function homeForSections(sections: readonly Section[]): "/flowers" | "/veg" {
  if (sections.includes("flowers") || sections.length === 0) return "/flowers";
  return "/veg";
}

export function sectionAllowed(sections: readonly Section[], section: Section): boolean {
  return sections.includes(section);
}

/** Only same-site paths, and only a section the person actually turned on. */
export function safeNext(value: string, sections: readonly Section[]): string {
  const home = homeForSections(sections);
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) return home;
  let path = value;
  if (path === "/app" || path.startsWith("/app/")) path = `/flowers${path.slice("/app".length)}`;
  if (path === "/flowers/settings" || path === "/settings") return "/settings";
  if (path.startsWith("/login") || path.startsWith("/signup")) return home;
  if ((path === "/flowers" || path.startsWith("/flowers/")) && !sections.includes("flowers")) return home;
  if ((path === "/veg" || path.startsWith("/veg/")) && !sections.includes("veg")) return home;
  return path;
}
